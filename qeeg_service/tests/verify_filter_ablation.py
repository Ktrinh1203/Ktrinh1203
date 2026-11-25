"""
Empirical ablation test verifying whether neuro-DSP filters help or harm
the qEEG biomarker/triage pipeline and Hierarchical Stroke ML model across:
- Suite A: Clean 6 clinical & hardware cases (6.0s @ 500 Hz)
- Suite B: Outdoor ADS1299 field noise (DC offset + 50 Hz mains + 80 Hz EMG)
- Suite C: Short BLE capture windows (1.0s, 2.0s, 4.0s, 6.0s @ 250 Hz)
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from scipy import signal

os.environ.setdefault("QEEG_DISABLE_N1_BG", "1")

QEEG_ROOT = Path(__file__).resolve().parents[1]
if str(QEEG_ROOT) not in sys.path:
    sys.path.insert(0, str(QEEG_ROOT))
SRC_ROOT = QEEG_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

import app as qeeg_app  # noqa: E402
from src.montage_normalizer import STANDARD_19_CHANNELS  # noqa: E402


def _apply_filter_mode(raw_6ch: np.ndarray, sfreq: float, mode: str) -> np.ndarray:
    """Apply one of five controlled filter ablation regimes to (N, 6) EEG data."""
    data = np.asarray(raw_6ch, dtype=np.float64)
    if mode == "raw":
        return data.copy()

    if mode == "dc_only":
        return data - np.mean(data, axis=0, keepdims=True)

    if mode == "hp05_notch50":
        centered = data - np.mean(data, axis=0, keepdims=True)
        nyq = max(sfreq / 2.0, 1.0)
        hp_b, hp_a = signal.butter(2, min(0.5 / nyq, 0.2), btype="highpass")
        out = qeeg_app._safe_filtfilt(hp_b, hp_a, centered)
        if sfreq > 105.0:
            notch_b, notch_a = signal.iirnotch(50.0 / nyq, Q=30.0)
            out = qeeg_app._safe_filtfilt(notch_b, notch_a, out)
        return out

    if mode == "prod_full":
        return qeeg_app.dsp_filter_signal(data, sfreq=sfreq, notch_50hz=True)

    if mode == "prod_trim":
        out = qeeg_app.dsp_filter_signal(data, sfreq=sfreq, notch_50hz=True)
        trim_n = int(0.5 * sfreq)
        if len(out) >= int(3.0 * sfreq) and len(out) - 2 * trim_n >= int(sfreq):
            return out[trim_n:-trim_n, :]
        return out

    raise ValueError(f"Unknown filter mode: {mode}")


def _eval_bundle_on_filtered(filtered_6ch: np.ndarray, sfreq: float) -> Optional[Dict[str, Any]]:
    """Run DomainAdaptedHierarchicalBundle feature extractor + classifier without double filtering."""
    bundle = qeeg_app.state.bundle
    if not bundle or not bundle.is_loaded:
        return None
    interpolated_19 = bundle.montage_normalizer.compute_spherical_spline_interpolation(
        data_src=filtered_6ch.T,
        src_ch_names=qeeg_app.ACTIVE_HARDWARE_CHANNELS,
        axis=0,
    ).T
    epoch_dur = min(2.0, max(0.5, len(interpolated_19) / sfreq / 2.0))
    epoch_len = max(32, int(epoch_dur * sfreq))
    n_epochs = max(1, len(interpolated_19) // epoch_len)
    rows: List[Dict[str, float]] = []
    for idx in range(n_epochs):
        ep = interpolated_19[idx * epoch_len : (idx + 1) * epoch_len, :]
        if len(ep) < 32:
            continue
        rows.append(bundle._extract_canonical_features(ep.T, STANDARD_19_CHANNELS, sfreq))
    if not rows:
        rows.append(bundle._extract_canonical_features(interpolated_19.T, STANDARD_19_CHANNELS, sfreq))
    return bundle.predict_features(pd.DataFrame(rows), mode="pure_eeg", fast_score=None)


def _eval_case(
    case_meta: Dict[str, Any],
    raw_6ch: np.ndarray,
    sfreq: float,
    mode: str,
) -> Dict[str, Any]:
    """Evaluate biomarkers, neutral-ID triage accuracy, and ML bundle predictions."""
    filtered_6ch = _apply_filter_mode(raw_6ch, sfreq=sfreq, mode=mode)
    raw_aligned = raw_6ch[: len(filtered_6ch)] if len(filtered_6ch) == len(raw_6ch) else raw_6ch[int(0.5 * sfreq) : int(0.5 * sfreq) + len(filtered_6ch)]
    metrics = qeeg_app._compute_6ch_and_80_features(
        raw_6ch=raw_aligned,
        filtered_6ch=filtered_6ch,
        sfreq=sfreq,
        notch_50hz=(mode in {"hp05_notch50", "prod_full", "prod_trim"}),
    )
    triage = qeeg_app._classify_clinical_triage(
        case_id="csv_ablation_neutral",
        clinical_category=case_meta["clinicalCategory"],
        metrics=metrics,
        raw_6ch=raw_aligned,
        sfreq=sfreq,
        fast_score=None,
    )
    ml_direct = _eval_bundle_on_filtered(filtered_6ch, sfreq=sfreq)
    return {
        "pred": triage["classificationLabel"],
        "gt": case_meta["groundTruthLabel"],
        "dar": float(metrics["mean_dar"]),
        "bsi": float(metrics["mean_bsi"]),
        "alpha_peak": float(metrics["alpha_peak_hz"]),
        "ml_label": ml_direct.get("prediction_label", "N/A") if ml_direct else "N/A",
    }


def _add_outdoor_field_noise(raw_6ch: np.ndarray, sfreq: float, seed: int = 42) -> np.ndarray:
    """Inject realistic ADS1299 outdoor artifacts: DC drift + 50 Hz mains + 80 Hz EMG."""
    rng = np.random.default_rng(seed)
    n, n_ch = raw_6ch.shape
    t = np.arange(n, dtype=np.float64)[:, None] / sfreq
    dc_offsets = np.array([[180.0, 210.0, 245.0, 275.0, 300.0, 320.0]])[:, :n_ch]
    mains_50hz = 35.0 * np.sin(2.0 * np.pi * 50.0 * t + rng.uniform(0, 0.3, size=(1, n_ch)))
    emg_80hz = 15.0 * np.sin(2.0 * np.pi * 80.0 * t + rng.uniform(0, np.pi, size=(1, n_ch)))
    return raw_6ch + dc_offsets + mains_50hz + emg_80hz


def main() -> int:
    qeeg_app.initialize_server_state()
    modes: List[str] = ["raw", "dc_only", "hp05_notch50", "prod_full", "prod_trim"]

    print(f"Bundle loaded: {bool(qeeg_app.state.bundle and qeeg_app.state.bundle.is_loaded)}")
    print(f"ADS1299 real hardware rows: {len(qeeg_app.state.ads1299_df) if qeeg_app.state.ads1299_df is not None else 0}")

    # Suite A & B: 6 curated cases (clean vs outdoor noise)
    clean_signals: Dict[str, np.ndarray] = {
        c["id"]: qeeg_app._acquire_case_signal(c["id"], duration_s=6.0, sfreq=500.0)
        for c in qeeg_app.CURATED_CASES
    }
    noisy_signals: Dict[str, np.ndarray] = {
        cid: _add_outdoor_field_noise(sig, sfreq=500.0, seed=42)
        for cid, sig in clean_signals.items()
    }

    clean_ref: Dict[str, Dict[str, Any]] = {}
    for c in qeeg_app.CURATED_CASES:
        clean_ref[c["id"]] = _eval_case(c, clean_signals[c["id"]], sfreq=500.0, mode="prod_full")

    def summarize_suite(title: str, signals_by_id: Dict[str, np.ndarray]) -> None:
        print(f"\n=== {title} ===")
        print(f"{'Mode':<14} | {'Acc':<5} | {'MeanDAR_Err%':<12} | {'MeanBSI_Err':<11} | {'Flips vs GT'}")
        print("-" * 78)
        for mode in modes:
            hits = 0
            dar_errs: List[float] = []
            bsi_errs: List[float] = []
            flips: List[str] = []
            for c in qeeg_app.CURATED_CASES:
                res = _eval_case(c, signals_by_id[c["id"]], sfreq=500.0, mode=mode)
                ref = clean_ref[c["id"]]
                if res["pred"] == res["gt"]:
                    hits += 1
                else:
                    flips.append(f"{c['id']}:{res['pred']}")
                dar_errs.append(abs(res["dar"] - ref["dar"]) / max(ref["dar"], 1e-6) * 100.0)
                bsi_errs.append(abs(res["bsi"] - ref["bsi"]))
            flip_txt = ", ".join(flips) if flips else "NONE"
            print(f"{mode:<14} | {hits}/6  | {np.mean(dar_errs):>10.2f}% | {np.mean(bsi_errs):>11.4f} | {flip_txt}")

    summarize_suite("SUITE A: CLEAN CLINICAL + ADS1299 CASES (6.0s @ 500Hz)", clean_signals)
    summarize_suite("SUITE B: OUTDOOR FIELD NOISE (DC 180-320uV + 50Hz + 80Hz EMG)", noisy_signals)

    # Check ML model directly on Stroke (LVO + ICH) vs Control (Healthy + ADS1299)
    print("\n=== SUITE B2: DIRECT HIERARCHICAL ML MODEL ON CLEAN vs NOISY ===")
    for suite_name, sig_map in [("CLEAN", clean_signals), ("NOISY", noisy_signals)]:
        print(f"-- {suite_name} --")
        for mode in modes:
            preds = []
            for c in qeeg_app.CURATED_CASES:
                res = _eval_case(c, sig_map[c["id"]], sfreq=500.0, mode=mode)
                preds.append(f"{c['id'].replace('case_', '')}={res['ml_label']}")
            print(f"  {mode:<13}: " + " | ".join(preds))

    # Check updated production predict_raw_stream() end-to-end on Clean vs Outdoor Noise
    print("\n=== SUITE B3: UPDATED BUNDLE.predict_raw_stream() (CLEAN vs NOISY + DETACHED LEAD) ===")
    bundle = qeeg_app.state.bundle
    for suite_name, sig_map in [("CLEAN", clean_signals), ("NOISY", noisy_signals)]:
        preds = []
        for c in qeeg_app.CURATED_CASES:
            res = bundle.predict_raw_stream(
                sig_map[c["id"]],
                channel_names=qeeg_app.ACTIVE_HARDWARE_CHANNELS,
                sfreq=500.0,
                epoch_duration_s=2.0,
                mode="pure_eeg",
            )
            preds.append(f"{c['id'].replace('case_', '')}={res.get('prediction_label', 'ERR')}")
        print(f"  {suite_name:<6}: " + " | ".join(preds))

    # Detached CH3 (flat DC + 50Hz hum only) should be excluded before CAR
    detached = clean_signals["case_healthy_alpha"].copy()
    t_vec = np.arange(len(detached), dtype=np.float64) / 500.0
    detached[:, 2] = 280.0 + 40.0 * np.sin(2.0 * np.pi * 50.0 * t_vec)
    res_det = bundle.predict_raw_stream(
        detached,
        channel_names=qeeg_app.ACTIVE_HARDWARE_CHANNELS,
        sfreq=500.0,
        epoch_duration_s=2.0,
        mode="pure_eeg",
    )
    print(f"  DETACHED_CH3 healthy_alpha -> {res_det.get('prediction_label')} active={res_det.get('hardware_active_channels')}")

    # Suite C: Short BLE windows at 250 Hz (1.0s, 2.0s, 4.0s, 6.0s)
    print("\n=== SUITE C: SHORT BLE WINDOWS @ 250Hz (prod_full vs dc_only) ===")
    target_cases = [c for c in qeeg_app.CURATED_CASES if c["id"] in {"case_ischemia_lvo", "case_healthy_alpha", "case_ads1299_hardware"}]
    for c in target_cases:
        ref_6s = _eval_case(c, qeeg_app._acquire_case_signal(c["id"], duration_s=6.0, sfreq=250.0), sfreq=250.0, mode="prod_full")
        print(f"-- {c['id']} (GT={c['groundTruthLabel']}, 6s ref DAR={ref_6s['dar']:.2f}, BSI={ref_6s['bsi']:.3f}) --")
        for dur in (1.0, 2.0, 4.0, 6.0):
            sig_250 = qeeg_app._acquire_case_signal(c["id"], duration_s=dur, sfreq=250.0)
            r_prod = _eval_case(c, sig_250, sfreq=250.0, mode="prod_full")
            r_dc = _eval_case(c, sig_250, sfreq=250.0, mode="dc_only")
            dar_err_prod = abs(r_prod["dar"] - ref_6s["dar"]) / max(ref_6s["dar"], 1e-6) * 100.0
            dar_err_dc = abs(r_dc["dar"] - ref_6s["dar"]) / max(ref_6s["dar"], 1e-6) * 100.0
            print(
                f"  {dur:>3.1f}s | prod_full: {r_prod['pred']:<16} DAR={r_prod['dar']:>5.2f} ({dar_err_prod:>5.1f}% err) BSI={r_prod['bsi']:.3f}"
                f" || dc_only: {r_dc['pred']:<16} DAR={r_dc['dar']:>5.2f} ({dar_err_dc:>5.1f}% err) BSI={r_dc['bsi']:.3f}"
            )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
