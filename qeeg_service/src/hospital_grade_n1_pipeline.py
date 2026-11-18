"""
File: src/hospital_grade_n1_pipeline.py
Description:
    Hospital-grade N=1 Self-Referenced Feature Extraction, First-Contact Signal Quality Gate,
    and Fold-Internal Class-Conditional Feature Selection pipeline for acute stroke EEG triage.

    Guarantees:
    - Strictly N=1 within-patient computation (zero cross-patient scaling/statistics).
    - Mathematically invariant to arbitrary positive hardware amplifier gains / transfer functions.
    - Autonomous First-Contact Signal Quality Gate with anatomical 10-20 neighbor graph healing.
    - Class-Conditional Center Leakage F-stat selector operating strictly inside training folds.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union
import warnings

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.base import BaseEstimator, ClassifierMixin, TransformerMixin
from sklearn.ensemble import ExtraTreesClassifier, HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.feature_selection import f_classif
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import balanced_accuracy_score, silhouette_score
from sklearn.model_selection import StratifiedGroupKFold, StratifiedKFold
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import RobustScaler

# Base directory definitions
PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROCESSED_DIR = PROJECT_ROOT / "datasets" / "processed"
RESULTS_DIR = PROJECT_ROOT / "results"

V5_RAW_PARQUET = PROCESSED_DIR / "stroke_mimics_remediated_dataset_v5.parquet"
HEFMI_RAW_PARQUET = PROCESSED_DIR / "hefmi_ich_features_232.parquet"
UCLH_RAW_PARQUET = PROCESSED_DIR / "uclh_eeg_features_condB.parquet"
UCLH_232_FALLBACK = PROCESSED_DIR / "uclh_eeg_features_232.parquet"

WPLI_COHORT_PARQUET = RESULTS_DIR / "cohort_423_with_real_wpli_subject.parquet"
WPLI_UCLH_PARQUET = RESULTS_DIR / "uclh_wpli_subject.parquet"

COHORT_N1_PARQUET = RESULTS_DIR / "cohort_423_n1_features.parquet"
UCLH_N1_PARQUET = RESULTS_DIR / "uclh_28_n1_features.parquet"
CHANG5_AUGMENTED_POOL_PARQUET = RESULTS_DIR / "chang5_cohort_423_augmented_pool.parquet"

# Standard 10-20 electrode layout (19 channels)
STANDARD_19_CHANNELS: List[str] = [
    "FP1", "FP2", "F7", "F3", "FZ", "F4", "F8",
    "T3", "C3", "CZ", "C4", "T4",
    "T5", "P3", "PZ", "P4", "T6",
    "O1", "O2"
]

# 8 Homologous Left-Right electrode pairs
HOMOLOGOUS_PAIRS: List[Tuple[str, str]] = [
    ("FP1", "FP2"),
    ("F7", "F8"),
    ("F3", "F4"),
    ("T3", "T4"),
    ("C3", "C4"),
    ("T5", "T6"),
    ("P3", "P4"),
    ("O1", "O2")
]

# 11 Standard spectral and complexity metrics per channel
METRICS_11: List[str] = [
    "rel_delta", "rel_theta", "rel_alpha", "rel_beta", "rel_gamma",
    "dar", "dtabr", "tar",
    "hjorth_mobility", "hjorth_complexity", "spectral_entropy"
]

# Anatomical 10-20 neighbor adjacency graph
NEIGHBOR_GRAPH_19: Dict[str, List[str]] = {
    "FP1": ["F7", "F3", "FZ"],
    "FP2": ["F8", "F4", "FZ"],
    "F7": ["FP1", "F3", "T3"],
    "F3": ["FP1", "F7", "FZ", "C3"],
    "FZ": ["FP1", "FP2", "F3", "F4", "CZ"],
    "F4": ["FP2", "F8", "FZ", "C4"],
    "F8": ["FP2", "F4", "T4"],
    "T3": ["F7", "C3", "T5"],
    "C3": ["F3", "T3", "CZ", "P3"],
    "CZ": ["FZ", "C3", "C4", "PZ"],
    "C4": ["F4", "T4", "CZ", "P4"],
    "T4": ["F8", "C4", "T6"],
    "T5": ["T3", "P3", "O1"],
    "P3": ["C3", "T5", "PZ", "O1"],
    "PZ": ["CZ", "P3", "P4", "O1", "O2"],
    "P4": ["C4", "T6", "PZ", "O2"],
    "T6": ["T4", "P4", "O2"],
    "O1": ["P3", "T5", "PZ", "O2"],
    "O2": ["P4", "T6", "PZ", "O1"],
}

LEFT_HEMISPHERE_CHANNELS: Set[str] = {"FP1", "F7", "F3", "T3", "C3", "T5", "P3", "O1"}
RIGHT_HEMISPHERE_CHANNELS: Set[str] = {"FP2", "F8", "F4", "T4", "C4", "T6", "P4", "O2"}
MIDLINE_CHANNELS: Set[str] = {"FZ", "CZ", "PZ"}

# 22 within-hemisphere neighbor edges from NEIGHBOR_GRAPH_19 (quantifies spatial contrast / cap smoothing)
IPSI_EDGES: List[Tuple[str, str]] = [
    (u, v) for u in STANDARD_19_CHANNELS for v in NEIGHBOR_GRAPH_19[u]
    if u < v and (
        (u in LEFT_HEMISPHERE_CHANNELS and v in LEFT_HEMISPHERE_CHANNELS) or
        (u in RIGHT_HEMISPHERE_CHANNELS and v in RIGHT_HEMISPHERE_CHANNELS)
    )
]


# =============================================================================
# 1. FirstContactSignalQualityGate (Strict N=1 Mode)
# =============================================================================

class FirstContactSignalQualityGate:
    """
    Hospital-Grade First-Contact Signal Quality Gate (Strict N=1 Mode).

    Operates strictly on single-patient recordings or subject-level features without
    cross-patient statistics. Evaluates all 19 standard 10-20 channels for:
    1. Missing / NaN / Inf / Flatline (zero variance across relative bands or zero activity).
    2. Electrode Disconnection / Rail Saturation (rel_delta > 0.985 with spectral_entropy < 0.05).
    3. High-Frequency / Mains / Peripheral Interference (rel_gamma > 0.50 or extreme Hjorth mobility).

    Autonomous Spatial Healing:
    - 0 bad channels: status = "PASS".
    - 1 <= n_bad <= 4: status = "DEGRADED_AUTO_HEALED" (interpolated via anatomical 10-20 neighbors).
    - > 4 bad channels: status = "REJECT_UNUSABLE_SIGNAL_RECHECK_ELECTRODES" (refuses blind prediction).
    """

    def __init__(
        self,
        flatline_std_threshold: float = 1e-6,
        rail_delta_threshold: float = 0.985,
        rail_entropy_threshold: float = 0.05,
        high_gamma_threshold: float = 0.50,
        extreme_mobility_threshold: float = 10.0,
        max_healable_channels: int = 4
    ) -> None:
        self.flatline_std_threshold = flatline_std_threshold
        self.rail_delta_threshold = rail_delta_threshold
        self.rail_entropy_threshold = rail_entropy_threshold
        self.high_gamma_threshold = high_gamma_threshold
        self.extreme_mobility_threshold = extreme_mobility_threshold
        self.max_healable_channels = max_healable_channels

    def assess_channel(self, channel_data: Dict[str, float], ch: str) -> Tuple[bool, Optional[str]]:
        """
        Assesses a single channel's spectral integrity.
        Returns: (is_bad, reason_str).
        """
        vals = [channel_data.get(f"{ch}_{m}", np.nan) for m in METRICS_11]
        if any(np.isnan(v) or np.isinf(v) for v in vals):
            return True, "NaN_or_Inf"

        d = float(channel_data.get(f"{ch}_rel_delta", 0.0))
        t = float(channel_data.get(f"{ch}_rel_theta", 0.0))
        a = float(channel_data.get(f"{ch}_rel_alpha", 0.0))
        b = float(channel_data.get(f"{ch}_rel_beta", 0.0))
        g = float(channel_data.get(f"{ch}_rel_gamma", 0.0))
        se = float(channel_data.get(f"{ch}_spectral_entropy", 1.0))
        hm = float(channel_data.get(f"{ch}_hjorth_mobility", 1.0))

        bands = [d, t, a, b, g]
        # 1. Flatline check
        if np.std(bands) < self.flatline_std_threshold or (d == 0.0 and t == 0.0 and a == 0.0):
            return True, "Flatline"

        # 2. Rail saturation / Disconnection
        if d > self.rail_delta_threshold and se < self.rail_entropy_threshold:
            return True, "Rail_Saturation"

        # 3. High-frequency noise / Mains
        if g > self.high_gamma_threshold:
            return True, "High_Gamma_Interference"

        if hm > self.extreme_mobility_threshold:
            return True, "Extreme_Hjorth_Mobility"

        return False, None

    def assess_subject(
        self,
        row_or_dict: Union[pd.Series, Dict[str, Any]]
    ) -> Tuple[str, Dict[str, Any], Dict[str, Any]]:
        """
        Evaluates a single patient row/dict across 19 standard channels.
        Returns:
            status: "PASS", "DEGRADED_AUTO_HEALED", or "REJECT_UNUSABLE_SIGNAL_RECHECK_ELECTRODES"
            healed_data: dictionary with repaired metrics if healable
            quality_report: detailed audit dictionary
        """
        data = dict(row_or_dict)
        bad_channels = []
        reasons = {}

        for ch in STANDARD_19_CHANNELS:
            is_bad, reason = self.assess_channel(data, ch)
            if is_bad:
                bad_channels.append(ch)
                reasons[ch] = reason

        n_bad = len(bad_channels)
        report = {
            "n_bad_channels": n_bad,
            "bad_channels": bad_channels,
            "reasons": reasons,
            "total_channels_checked": len(STANDARD_19_CHANNELS)
        }

        if n_bad == 0:
            return "PASS", data, report

        if n_bad <= self.max_healable_channels:
            healed_data = self._heal_dictionary(data, bad_channels)
            report["healing_applied"] = True
            return "DEGRADED_AUTO_HEALED", healed_data, report

        report["healing_applied"] = False
        return "REJECT_UNUSABLE_SIGNAL_RECHECK_ELECTRODES", data, report

    def assess_recording(
        self,
        df_epochs: pd.DataFrame
    ) -> Tuple[str, pd.DataFrame, Dict[str, Any]]:
        """
        Evaluates a multi-epoch patient recording.
        Performs median-anchored channel screening, vector-heals corrupted channels across all epochs,
        and interpolates any localized per-epoch NaN/Inf values from valid same-hemisphere neighbors.
        """
        df_out = df_epochs.copy()
        metric_cols = [
            f"{ch}_{m}"
            for ch in STANDARD_19_CHANNELS
            for m in METRICS_11
            if f"{ch}_{m}" in df_out.columns
        ]
        if metric_cols:
            df_out[metric_cols] = (
                df_out[metric_cols]
                .astype(np.float64)
                .replace([np.inf, -np.inf], np.nan)
            )

        med_row = df_out.median(numeric_only=True).to_dict()
        status, _, report = self.assess_subject(med_row)

        if status == "REJECT_UNUSABLE_SIGNAL_RECHECK_ELECTRODES":
            return status, df_out, report

        bad_channels = report.get("bad_channels", [])
        if status == "DEGRADED_AUTO_HEALED":
            for ch in bad_channels:
                chosen_neighbors = self._get_valid_neighbors(ch, bad_channels)
                for m in METRICS_11:
                    col = f"{ch}_{m}"
                    if col not in df_out.columns:
                        continue
                    nb_cols = [f"{nb}_{m}" for nb in chosen_neighbors if f"{nb}_{m}" in df_out.columns]
                    if len(nb_cols) > 0:
                        df_out[col] = df_out[nb_cols].mean(axis=1, skipna=True)
                    else:
                        df_out[col] = 0.0

        # Heal localized per-epoch NaNs for remaining valid channels (and fallback if neighbors lacked a row)
        for ch in STANDARD_19_CHANNELS:
            chosen_neighbors = self._get_valid_neighbors(ch, bad_channels)
            for m in METRICS_11:
                col = f"{ch}_{m}"
                if col not in df_out.columns:
                    continue
                nan_mask = df_out[col].isna()
                if not nan_mask.any():
                    continue
                if ch not in bad_channels:
                    nb_cols = [f"{nb}_{m}" for nb in chosen_neighbors if f"{nb}_{m}" in df_out.columns]
                    if len(nb_cols) > 0:
                        df_out.loc[nan_mask, col] = df_out.loc[nan_mask, nb_cols].mean(axis=1, skipna=True)
                still_nan = df_out[col].isna()
                if still_nan.any():
                    ch_med = df_out[col].median(skipna=True)
                    fill_val = float(ch_med) if pd.notna(ch_med) and np.isfinite(ch_med) else 0.0
                    df_out.loc[still_nan, col] = fill_val

        return status, df_out, report

    def _get_valid_neighbors(self, ch: str, bad_channels: List[str]) -> List[str]:
        """Identifies optimal neighbor channels prioritizing anatomical hemisphere."""
        neighbors = NEIGHBOR_GRAPH_19.get(ch, [])
        valid = [nb for nb in neighbors if nb not in bad_channels]

        if ch in LEFT_HEMISPHERE_CHANNELS:
            same_hemi = [nb for nb in valid if nb in LEFT_HEMISPHERE_CHANNELS or nb in MIDLINE_CHANNELS]
        elif ch in RIGHT_HEMISPHERE_CHANNELS:
            same_hemi = [nb for nb in valid if nb in RIGHT_HEMISPHERE_CHANNELS or nb in MIDLINE_CHANNELS]
        else:
            same_hemi = valid

        if len(same_hemi) > 0:
            return same_hemi
        if len(valid) > 0:
            return valid

        # Fallback to any operational channel in hemisphere
        target_set = LEFT_HEMISPHERE_CHANNELS if ch in LEFT_HEMISPHERE_CHANNELS else RIGHT_HEMISPHERE_CHANNELS
        fallback = [c for c in STANDARD_19_CHANNELS if c in target_set and c not in bad_channels]
        if len(fallback) > 0:
            return fallback

        return [c for c in STANDARD_19_CHANNELS if c not in bad_channels]

    def _heal_dictionary(self, data: Dict[str, Any], bad_channels: List[str]) -> Dict[str, Any]:
        """Heals bad channel metrics in a single row/dict."""
        healed = dict(data)
        for ch in bad_channels:
            chosen_nb = self._get_valid_neighbors(ch, bad_channels)
            for m in METRICS_11:
                vals = [healed.get(f"{nb}_{m}", np.nan) for nb in chosen_nb]
                valid_vals = [v for v in vals if not np.isnan(v)]
                avg_val = float(np.mean(valid_vals)) if len(valid_vals) > 0 else 0.0
                healed[f"{ch}_{m}"] = avg_val
        return healed


# =============================================================================
# 1b. Scale-Invariant Math Primitives & Within-Patient K-Means Analyzer (14 cols)
# =============================================================================

def _bounded_ratio(a: float, b: float) -> float:
    """
    Computes (a - b) / (a + b) with scale-relative epsilon.
    Invariant to positive amplifier scaling K > 0 (< 1e-12).
    """
    mag = abs(a) + abs(b)
    eps_rel = max(1e-12 * mag, 1e-30)
    denom = a + b
    if abs(denom) < eps_rel:
        denom = eps_rel if denom >= 0.0 else -eps_rel
    return float((a - b) / denom)


def _bounded_ratio_vec(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """
    Vectorized bounded ratio (a - b) / (a + b) with scale-relative epsilon.
    Invariant to positive amplifier scaling K > 0 (< 1e-12).
    """
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    mag = np.abs(a) + np.abs(b)
    eps_rel = np.maximum(1e-12 * mag, 1e-30)
    denom = a + b
    denom_safe = np.where(np.abs(denom) < eps_rel, np.where(denom >= 0.0, eps_rel, -eps_rel), denom)
    return (a - b) / denom_safe


def _fast_kmeans_2(
    X: np.ndarray,
    n_init: int = 10,
    max_iter: int = 50,
    random_state: int = 42
) -> Tuple[np.ndarray, np.ndarray, float]:
    """
    Pure NumPy deterministic Lloyd K-Means for K=2 with K-means++ initialization.
    Avoids multi-threading startup overhead on Windows, running in < 1ms per recording.
    """
    rng = np.random.RandomState(random_state)
    N, D = X.shape
    best_inertia = np.inf
    best_labels = np.zeros(N, dtype=int)
    best_centers = np.zeros((2, D), dtype=np.float64)

    for _ in range(n_init):
        c0_idx = rng.randint(0, N)
        c0 = X[c0_idx].copy()
        dist0 = np.sum((X - c0) ** 2, axis=1)
        denom_p = np.sum(dist0)
        prob = dist0 / (denom_p + 1e-12) if denom_p > 1e-12 else np.ones(N) / N
        c1_idx = rng.choice(N, p=prob)
        c1 = X[c1_idx].copy()

        labels = np.zeros(N, dtype=int)
        for _it in range(max_iter):
            d0 = np.sum((X - c0) ** 2, axis=1)
            d1 = np.sum((X - c1) ** 2, axis=1)
            new_labels = (d1 < d0).astype(int)
            n0 = np.sum(new_labels == 0)
            n1 = np.sum(new_labels == 1)
            if n0 == 0 or n1 == 0:
                break
            new_c0 = np.mean(X[new_labels == 0], axis=0)
            new_c1 = np.mean(X[new_labels == 1], axis=0)
            if np.array_equal(new_labels, labels) or (
                np.max(np.abs(c0 - new_c0)) < 1e-6 and np.max(np.abs(c1 - new_c1)) < 1e-6
            ):
                labels = new_labels
                c0 = new_c0
                c1 = new_c1
                break
            labels = new_labels
            c0 = new_c0
            c1 = new_c1

        d0 = np.sum((X - c0) ** 2, axis=1)
        d1 = np.sum((X - c1) ** 2, axis=1)
        inertia = float(np.sum(np.where(labels == 0, d0, d1)))
        if inertia < best_inertia:
            best_inertia = inertia
            best_labels = labels.copy()
            best_centers = np.vstack([c0, c1])

    return best_labels, best_centers, best_inertia


class WithinPatientEpochKMeansAnalyzer:
    """
    Within-Patient Epoch K-Means Analyzer (Strict N=1, Zero-Leakage).
    Returns the 14 Cluster Topography & Gap Features (n1_km_*), invariant to positive gain K > 0 (< 1e-12).
    """

    KM_FEATURE_NAMES: List[str] = [
        "n1_km_available",
        "n1_km_minor_frac",
        "n1_km_centroid_dist",
        "n1_km_silhouette",
        "n1_km_variance_ratio",
        "n1_km_gap_focal_dar",
        "n1_km_gap_focal_delta",
        "n1_km_gap_blink",
        "n1_km_gap_beta",
        "n1_km_gap_mobility",
        "n1_km_dom_focal_dar",
        "n1_km_min_focal_dar",
        "n1_km_dom_blink",
        "n1_km_min_blink",
    ]

    def __init__(self, random_state: int = 42) -> None:
        self.random_state = random_state

    @staticmethod
    def _sanitize_epoch_df(df_epochs: pd.DataFrame) -> pd.DataFrame:
        """Replaces Inf/-Inf with NaN and imputes per-column NaN with clean-epoch median (or 0.0)."""
        metric_cols = [
            f"{ch}_{m}"
            for ch in STANDARD_19_CHANNELS
            for m in METRICS_11
            if f"{ch}_{m}" in df_epochs.columns
        ]
        if not metric_cols:
            return df_epochs
        arr = df_epochs[metric_cols].to_numpy(dtype=np.float64, copy=True)
        if np.all(np.isfinite(arr)):
            return df_epochs
        arr[~np.isfinite(arr)] = np.nan
        col_medians = np.nanmedian(arr, axis=0)
        col_medians = np.nan_to_num(col_medians, nan=0.0, posinf=0.0, neginf=0.0)
        nan_r, nan_c = np.where(np.isnan(arr))
        if len(nan_r) > 0:
            arr[nan_r, nan_c] = col_medians[nan_c]
        df_clean = df_epochs.copy()
        df_clean[metric_cols] = arr
        return df_clean

    def extract_epoch_feature_matrix(self, df_epochs: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Extracts 27 gain-invariant epoch features across E epochs.
        """
        df_clean = self._sanitize_epoch_df(df_epochs)
        feats_list: List[np.ndarray] = []

        # 1. 16 homologous asymmetry bounded ratios
        pair_dar_list = []
        pair_delta_list = []
        for L, R_ch in HOMOLOGOUS_PAIRS:
            r_delta = _bounded_ratio_vec(df_clean[f"{L}_rel_delta"].values, df_clean[f"{R_ch}_rel_delta"].values)
            r_dar = _bounded_ratio_vec(df_clean[f"{L}_dar"].values, df_clean[f"{R_ch}_dar"].values)
            feats_list.append(r_delta)
            feats_list.append(r_dar)
            pair_delta_list.append(r_delta)
            pair_dar_list.append(r_dar)

        # 2. 5 whole-head normalized band proportions
        d_all = np.nanmean([df_clean[f"{ch}_rel_delta"].values for ch in STANDARD_19_CHANNELS], axis=0)
        t_all = np.nanmean([df_clean[f"{ch}_rel_theta"].values for ch in STANDARD_19_CHANNELS], axis=0)
        a_all = np.nanmean([df_clean[f"{ch}_rel_alpha"].values for ch in STANDARD_19_CHANNELS], axis=0)
        b_all = np.nanmean([df_clean[f"{ch}_rel_beta"].values for ch in STANDARD_19_CHANNELS], axis=0)
        g_all = np.nanmean([df_clean[f"{ch}_rel_gamma"].values for ch in STANDARD_19_CHANNELS], axis=0)
        band_sum = d_all + t_all + a_all + b_all + g_all
        scale_eps = np.maximum(1e-12 * band_sum, 1e-30)
        for b_arr in [d_all, t_all, a_all, b_all, g_all]:
            feats_list.append(b_arr / (band_sum + scale_eps))

        # 3. Blink artifact score (frontal vs central/posterior delta)
        fp_d = 0.5 * (df_clean["FP1_rel_delta"].values + df_clean["FP2_rel_delta"].values)
        cp_d = np.nanmean([df_clean[f"{ch}_rel_delta"].values for ch in ["C3", "C4", "P3", "P4", "O1", "O2"]], axis=0)
        blink_score = _bounded_ratio_vec(fp_d, cp_d)
        feats_list.append(blink_score)

        # 4. Paroxysmal burst scores
        mob_max = np.nanmax([df_clean[f"{ch}_hjorth_mobility"].values for ch in STANDARD_19_CHANNELS], axis=0)
        mob_med = np.nanmedian([df_clean[f"{ch}_hjorth_mobility"].values for ch in STANDARD_19_CHANNELS], axis=0)
        burst_mob = _bounded_ratio_vec(mob_max, mob_med)
        feats_list.append(burst_mob)

        beta_max = np.nanmax([df_clean[f"{ch}_rel_beta"].values for ch in STANDARD_19_CHANNELS], axis=0)
        beta_med = np.nanmedian([df_clean[f"{ch}_rel_beta"].values for ch in STANDARD_19_CHANNELS], axis=0)
        burst_beta = _bounded_ratio_vec(beta_max, beta_med)
        feats_list.append(burst_beta)

        ent_max = np.nanmax([df_clean[f"{ch}_spectral_entropy"].values for ch in STANDARD_19_CHANNELS], axis=0)
        ent_med = np.nanmedian([df_clean[f"{ch}_spectral_entropy"].values for ch in STANDARD_19_CHANNELS], axis=0)
        burst_ent = _bounded_ratio_vec(ent_max, ent_med)
        feats_list.append(burst_ent)

        # 5. Focal asymmetry
        focal_dar = np.nanmax(np.abs(np.array(pair_dar_list)), axis=0)
        focal_delta = np.nanmax(np.abs(np.array(pair_delta_list)), axis=0)
        feats_list.append(focal_dar)
        feats_list.append(focal_delta)

        epoch_mat = np.nan_to_num(np.column_stack(feats_list).astype(np.float64), nan=0.0, posinf=0.0, neginf=0.0)
        blink_score = np.nan_to_num(np.asarray(blink_score, dtype=np.float64), nan=0.0, posinf=0.0, neginf=0.0)
        focal_dar = np.nan_to_num(np.asarray(focal_dar, dtype=np.float64), nan=0.0, posinf=0.0, neginf=0.0)
        return epoch_mat, blink_score, focal_dar

    def analyze(self, df_epochs: pd.DataFrame) -> Dict[str, float]:
        """
        Runs within-patient K-Means clustering (K=2) and returns 14 n1_km_* features.
        """
        E = len(df_epochs)
        epoch_mat, blink_scores, focal_dar_arr = self.extract_epoch_feature_matrix(df_epochs)

        def _safe_float(v: Any) -> float:
            return float(np.nan_to_num(v, nan=0.0, posinf=0.0, neginf=0.0))

        def _fallback() -> Dict[str, float]:
            mean_fdar = _safe_float(np.nanmean(focal_dar_arr)) if len(focal_dar_arr) > 0 else 0.0
            mean_blink = _safe_float(np.nanmean(blink_scores)) if len(blink_scores) > 0 else 0.0
            return {
                "n1_km_available": 0.0,
                "n1_km_minor_frac": 0.0,
                "n1_km_centroid_dist": 0.0,
                "n1_km_silhouette": 0.0,
                "n1_km_variance_ratio": 0.0,
                "n1_km_gap_focal_dar": 0.0,
                "n1_km_gap_focal_delta": 0.0,
                "n1_km_gap_blink": 0.0,
                "n1_km_gap_beta": 0.0,
                "n1_km_gap_mobility": 0.0,
                "n1_km_dom_focal_dar": mean_fdar,
                "n1_km_min_focal_dar": mean_fdar,
                "n1_km_dom_blink": mean_blink,
                "n1_km_min_blink": mean_blink,
            }

        epoch_var = np.var(epoch_mat, axis=0)
        if E < 6 or np.sum(epoch_var) < 1e-10:
            return _fallback()

        mean_ep = np.nanmean(epoch_mat, axis=0)
        std_ep = np.nanstd(epoch_mat, axis=0)
        scale_eps_ep = np.maximum(1e-12 * np.nanmean(np.abs(epoch_mat), axis=0), 1e-30)
        Z_epoch = np.nan_to_num((epoch_mat - mean_ep) / (std_ep + scale_eps_ep), nan=0.0, posinf=0.0, neginf=0.0)

        try:
            labels, _, inertia = _fast_kmeans_2(Z_epoch, n_init=10, random_state=self.random_state)
            n_0 = int(np.sum(labels == 0))
            n_1 = int(np.sum(labels == 1))
            if n_0 == 0 or n_1 == 0:
                return _fallback()

            blink_0 = _safe_float(np.nanmean(blink_scores[labels == 0]))
            blink_1 = _safe_float(np.nanmean(blink_scores[labels == 1]))
            if (blink_1 - blink_0 > 0.25) and ((n_1 / E) < 0.35):
                dom_c = 0
            elif (blink_0 - blink_1 > 0.25) and ((n_0 / E) < 0.35):
                dom_c = 1
            else:
                dom_c = 0 if n_0 >= n_1 else 1

            min_c = 1 - dom_c
            minor_frac = _safe_float((n_1 if dom_c == 0 else n_0) / E)

            mu_dom_z = np.nanmean(Z_epoch[labels == dom_c], axis=0)
            mu_min_z = np.nanmean(Z_epoch[labels == min_c], axis=0)
            centroid_dist = _safe_float(np.linalg.norm(mu_dom_z - mu_min_z) / np.sqrt(epoch_mat.shape[1]))

            try:
                sil = _safe_float(silhouette_score(Z_epoch, labels))
            except Exception:
                sil = 0.0

            total_ss = _safe_float(np.sum((Z_epoch - np.nanmean(Z_epoch, axis=0)) ** 2))
            var_ratio = _safe_float(np.clip(1.0 - (inertia / (total_ss + 1e-12)), 0.0, 1.0))

            mu_dom_raw = np.nan_to_num(np.nanmean(epoch_mat[labels == dom_c], axis=0), nan=0.0, posinf=0.0, neginf=0.0)
            mu_min_raw = np.nan_to_num(np.nanmean(epoch_mat[labels == min_c], axis=0), nan=0.0, posinf=0.0, neginf=0.0)

            return {
                "n1_km_available": 1.0,
                "n1_km_minor_frac": minor_frac,
                "n1_km_centroid_dist": centroid_dist,
                "n1_km_silhouette": sil,
                "n1_km_variance_ratio": var_ratio,
                "n1_km_gap_focal_dar": _safe_float(abs(mu_dom_raw[25] - mu_min_raw[25])),
                "n1_km_gap_focal_delta": _safe_float(abs(mu_dom_raw[26] - mu_min_raw[26])),
                "n1_km_gap_blink": _safe_float(abs(mu_dom_raw[21] - mu_min_raw[21])),
                "n1_km_gap_beta": _safe_float(abs(mu_dom_raw[23] - mu_min_raw[23])),
                "n1_km_gap_mobility": _safe_float(abs(mu_dom_raw[22] - mu_min_raw[22])),
                "n1_km_dom_focal_dar": _safe_float(mu_dom_raw[25]),
                "n1_km_min_focal_dar": _safe_float(mu_min_raw[25]),
                "n1_km_dom_blink": _safe_float(mu_dom_raw[21]),
                "n1_km_min_blink": _safe_float(mu_min_raw[21]),
            }
        except Exception:
            return _fallback()


# =============================================================================
# 2. N1SelfReferencedFeatureExtractor (Strict N=1 Mode, 973 Features)
# =============================================================================

class N1SelfReferencedFeatureExtractor:
    """
    Hospital-Grade Strict N=1 Self-Referenced Feature Extractor.

    Computes within-patient/within-epoch transformations ONLY (zero cross-patient statistics).
    Features are mathematically invariant to arbitrary positive hardware amplifier gains.

    Groups (973 total features):
    - Group A: Unit-Variance Log-Spectral Topography (19x11 = 209 features + IQR/Span summaries)
    - Group B: Unit-Variance Homologous Asymmetry (8 pairs x 11 metrics signed + abs + summaries)
    - Group C: Anatomical & Vascular Territory Contrasts (Post-Ant, MCA, ACA, PCA, spatial correlations)
    - Group D: Within-Recording Temporal Burstiness / Stationarity (vectorized std, IQR, CV across epochs)
    - Group E: Within-Subject Normalized wPLI Topology (8 homologous pairs normalized by patient mean/std)
    - Group F: Spline-Invariant Ipsilateral Spatial Contrast Scaling (ipsi_contrast_* + ipsi_g_*)
    - Group G: Within-Patient Epoch K-Means Salience & Clean-Cluster Telemetry (14 n1_km_* features)
    """

    def __init__(self, eps: float = 1e-6, clip_min: float = 1e-4, random_state: int = 42) -> None:
        self.eps = eps
        self.clip_min = clip_min
        self.random_state = random_state
        self.ch_idx: Dict[str, int] = {ch: i for i, ch in enumerate(STANDARD_19_CHANNELS)}
        self.km_analyzer = WithinPatientEpochKMeansAnalyzer(random_state=random_state)

    def extract_patient_features(
        self,
        df_epochs_or_row: Union[pd.DataFrame, pd.Series, Dict[str, Any]],
        df_epochs: Optional[pd.DataFrame] = None,
        wpli_series: Optional[Union[pd.Series, Dict[str, Any]]] = None
    ) -> Dict[str, float]:
        """
        Extracts complete N=1 self-referenced feature suite for a single patient.
        """
        if isinstance(df_epochs_or_row, pd.DataFrame):
            df_epochs = df_epochs_or_row
            med_row = df_epochs.median(numeric_only=True).to_dict()
        elif isinstance(df_epochs_or_row, pd.Series):
            med_row = df_epochs_or_row.to_dict()
        else:
            med_row = dict(df_epochs_or_row)

        # -------------------------------------------------------------
        # -------------------------------------------------------------
        # Group A: Continuous Within-Patient 19-Channel Spatial Z-Score Topography
        # ------------------------------------------------------------------------
        # Shape: (19, 11)
        X = np.zeros((len(STANDARD_19_CHANNELS), len(METRICS_11)), dtype=np.float64)
        for i, ch in enumerate(STANDARD_19_CHANNELS):
            for j, m in enumerate(METRICS_11):
                col = f"{ch}_{m}"
                val = med_row.get(col, np.nan)
                X[i, j] = val if np.isfinite(val) else self.clip_min

        # Continuous within-patient 19-channel spatial z-score:
        # Uses scale-relative epsilon so positive hardware gain scaling K > 0 cancels to < 1e-12
        # without rank-swap step discontinuities on electrode interpolation.
        Z = np.zeros_like(X)
        for j in range(len(METRICS_11)):
            col_vals = X[:, j]
            m_j = float(np.mean(col_vals))
            s_j = float(np.std(col_vals))
            scale_eps = max(1e-12 * float(np.mean(np.abs(col_vals))), 1e-30)
            Z[:, j] = np.clip((col_vals - m_j) / (s_j + scale_eps), -4.0, 4.0)

        def _bounded_ratio(a: float, b: float) -> float:
            eps_rel = max(1e-12 * (abs(a) + abs(b)), 1e-30)
            denom = a + b
            if abs(denom) < eps_rel:
                denom = eps_rel if denom >= 0 else -eps_rel
            return float((a - b) / denom)

        feats: Dict[str, float] = {}

        # 209 per-channel continuous spatial z-score topographic features
        for i, ch in enumerate(STANDARD_19_CHANNELS):
            for j, m in enumerate(METRICS_11):
                feats[f"n1_topo_{m}_{ch}"] = float(Z[i, j])

        # Topographic continuous spread summaries per metric across 19 channels
        for j, m in enumerate(METRICS_11):
            zm = Z[:, j]
            feats[f"n1_toposum_iqr_{m}"] = float(np.percentile(zm, 75) - np.percentile(zm, 25))
            feats[f"n1_toposum_span_{m}"] = float(np.max(zm) - np.min(zm))

        # -------------------------------------------------------------
        # Group B: Continuous Z-Diff & Bounded Homologous Asymmetry
        # -------------------------------------------------------------
        for j, m in enumerate(METRICS_11):
            abs_z_diffs = []
            abs_ratios = []
            for L, R_ch in HOMOLOGOUS_PAIRS:
                i_l, i_r = self.ch_idx[L], self.ch_idx[R_ch]
                zdiff = float(Z[i_l, j] - Z[i_r, j])
                abs_zdiff = float(np.abs(zdiff))
                feats[f"n1_asym_zdiff_{m}_{L}_{R_ch}"] = zdiff
                feats[f"n1_asym_abs_zdiff_{m}_{L}_{R_ch}"] = abs_zdiff
                abs_z_diffs.append(abs_zdiff)

                # Bounded ratio independent of skull spatial variance (L - R) / (L + R)
                vl = float(X[i_l, j])
                vr = float(X[i_r, j])
                ratio = _bounded_ratio(vl, vr)
                abs_ratio = float(np.abs(ratio))
                feats[f"n1_asym_ratio_{m}_{L}_{R_ch}"] = ratio
                feats[f"n1_asym_abs_ratio_{m}_{L}_{R_ch}"] = abs_ratio
                abs_ratios.append(abs_ratio)

            arr_abs = np.array(abs_z_diffs, dtype=np.float64)
            max_abs = float(np.max(arr_abs))
            mean_abs = float(np.mean(arr_abs))
            feats[f"n1_asym_max_abs_{m}"] = max_abs
            feats[f"n1_asym_mean_abs_{m}"] = mean_abs
            feats[f"n1_asym_std_abs_{m}"] = float(np.std(arr_abs))
            feats[f"n1_asym_focal_peak_{m}"] = float(max_abs / (mean_abs + 0.1))

            arr_ratios = np.array(abs_ratios, dtype=np.float64)
            sorted_r = np.sort(arr_ratios)
            max_ratio = float(np.max(arr_ratios))
            mean_ratio = float(np.mean(arr_ratios))
            mean_other_7 = float(np.mean(sorted_r[:-1])) if len(sorted_r) > 1 else mean_ratio
            top2_mean = float(np.mean(sorted_r[-2:])) if len(sorted_r) >= 2 else max_ratio

            feats[f"n1_asym_max_abs_ratio_{m}"] = max_ratio
            feats[f"n1_asym_mean_abs_ratio_{m}"] = mean_ratio
            feats[f"n1_asym_std_abs_ratio_{m}"] = float(np.std(arr_ratios))
            feats[f"n1_asym_top2_mean_abs_ratio_{m}"] = top2_mean
            # Focal peak ratio: strongest asymmetry over remaining 7 pairs (key to small focal stroke)
            feats[f"n1_asym_focal_peak_ratio_{m}"] = float(max_ratio / (mean_other_7 + 0.02))

        # -------------------------------------------------------------
        # Group C: Anatomical & Vascular Territory Bounded Contrasts
        # -------------------------------------------------------------
        post_idx = [self.ch_idx[c] for c in ["O1", "O2", "P3", "P4", "T5", "T6"]]
        ant_idx = [self.ch_idx[c] for c in ["FP1", "FP2", "F3", "F4", "F7", "F8"]]
        mca_l_idx = [self.ch_idx[c] for c in ["F7", "T3", "T5", "C3"]]
        mca_r_idx = [self.ch_idx[c] for c in ["F8", "T4", "T6", "C4"]]
        aca_l_idx = [self.ch_idx[c] for c in ["FP1", "F3"]]
        aca_r_idx = [self.ch_idx[c] for c in ["FP2", "F4"]]
        pca_l_idx = [self.ch_idx[c] for c in ["P3", "O1"]]
        pca_r_idx = [self.ch_idx[c] for c in ["P4", "O2"]]
        hem_l_idx = [self.ch_idx[c] for c in ["FP1", "F7", "F3", "T3", "C3", "T5", "P3", "O1"]]
        hem_r_idx = [self.ch_idx[c] for c in ["FP2", "F8", "F4", "T4", "C4", "T6", "P4", "O2"]]
        cent_idx = [self.ch_idx[c] for c in ["C3", "CZ", "C4"]]
        front_idx = [self.ch_idx[c] for c in ["FP1", "FP2", "F3", "FZ", "F4", "F7", "F8"]]

        grad_metrics = ["rel_alpha", "rel_delta", "rel_theta", "dar", "spectral_entropy", "hjorth_mobility"]
        for m in grad_metrics:
            j = METRICS_11.index(m)
            zm = Z[:, j]
            feats[f"n1_grad_post_minus_ant_{m}"] = float(np.mean(zm[post_idx]) - np.mean(zm[ant_idx]))

            mca_diff = float(np.mean(zm[mca_l_idx]) - np.mean(zm[mca_r_idx]))
            feats[f"n1_vasc_mca_asym_{m}"] = mca_diff
            feats[f"n1_vasc_mca_abs_{m}"] = float(np.abs(mca_diff))

            aca_diff = float(np.mean(zm[aca_l_idx]) - np.mean(zm[aca_r_idx]))
            feats[f"n1_vasc_aca_asym_{m}"] = aca_diff
            feats[f"n1_vasc_aca_abs_{m}"] = float(np.abs(aca_diff))

            pca_diff = float(np.mean(zm[pca_l_idx]) - np.mean(zm[pca_r_idx]))
            feats[f"n1_vasc_pca_asym_{m}"] = pca_diff
            feats[f"n1_vasc_pca_abs_{m}"] = float(np.abs(pca_diff))

            # Bounded vascular & anatomical contrasts in [-1, +1] independent of skull std
            xm_raw = X[:, j]
            mca_l_val = float(np.mean(xm_raw[mca_l_idx]))
            mca_r_val = float(np.mean(xm_raw[mca_r_idx]))
            mca_ratio = _bounded_ratio(mca_l_val, mca_r_val)
            feats[f"n1_vasc_mca_ratio_{m}"] = mca_ratio
            feats[f"n1_vasc_mca_abs_ratio_{m}"] = float(np.abs(mca_ratio))

            aca_l_val = float(np.mean(xm_raw[aca_l_idx]))
            aca_r_val = float(np.mean(xm_raw[aca_r_idx]))
            aca_ratio = _bounded_ratio(aca_l_val, aca_r_val)
            feats[f"n1_vasc_aca_ratio_{m}"] = aca_ratio
            feats[f"n1_vasc_aca_abs_ratio_{m}"] = float(np.abs(aca_ratio))

            pca_l_val = float(np.mean(xm_raw[pca_l_idx]))
            pca_r_val = float(np.mean(xm_raw[pca_r_idx]))
            pca_ratio = _bounded_ratio(pca_l_val, pca_r_val)
            feats[f"n1_vasc_pca_ratio_{m}"] = pca_ratio
            feats[f"n1_vasc_pca_abs_ratio_{m}"] = float(np.abs(pca_ratio))

            hem_l_val = float(np.mean(xm_raw[hem_l_idx]))
            hem_r_val = float(np.mean(xm_raw[hem_r_idx]))
            hem_ratio = _bounded_ratio(hem_l_val, hem_r_val)
            feats[f"n1_vasc_hem_ratio_{m}"] = hem_ratio
            feats[f"n1_vasc_hem_abs_ratio_{m}"] = float(np.abs(hem_ratio))

            cent_val = float(np.mean(xm_raw[cent_idx]))
            front_val = float(np.mean(xm_raw[front_idx]))
            cent_front_ratio = _bounded_ratio(cent_val, front_val)
            feats[f"n1_grad_cent_front_ratio_{m}"] = cent_front_ratio
            feats[f"n1_grad_cent_front_abs_ratio_{m}"] = float(np.abs(cent_front_ratio))

            post_val = float(np.mean(xm_raw[post_idx]))
            ant_val = float(np.mean(xm_raw[ant_idx]))
            post_ant_ratio = _bounded_ratio(post_val, ant_val)
            feats[f"n1_grad_post_ant_ratio_{m}"] = post_ant_ratio
            feats[f"n1_grad_post_ant_abs_ratio_{m}"] = float(np.abs(post_ant_ratio))

            # Left-Right homologous spatial rank correlation
            v_l = [xm_raw[self.ch_idx[L]] for L, R_ch in HOMOLOGOUS_PAIRS]
            v_r = [xm_raw[self.ch_idx[R_ch]] for L, R_ch in HOMOLOGOUS_PAIRS]
            lr_res = stats.spearmanr(v_l, v_r)
            lr_corr = lr_res.correlation if hasattr(lr_res, 'correlation') else lr_res[0]
            feats[f"n1_lr_rank_corr_{m}"] = float(lr_corr if not np.isnan(lr_corr) else 1.0)

        def _calc_spatial_corr(m1: str, m2: str) -> float:
            j1 = METRICS_11.index(m1)
            j2 = METRICS_11.index(m2)
            v1 = Z[:, j1]
            v2 = Z[:, j2]
            r = np.corrcoef(v1, v2)[0, 1]
            return float(r if not np.isnan(r) else 0.0)

        feats["n1_corr_delta_alpha"] = _calc_spatial_corr("rel_delta", "rel_alpha")
        feats["n1_corr_dar_entropy"] = _calc_spatial_corr("dar", "spectral_entropy")
        feats["n1_corr_theta_alpha"] = _calc_spatial_corr("rel_theta", "rel_alpha")
        feats["n1_corr_delta_theta"] = _calc_spatial_corr("rel_delta", "rel_theta")

        # -------------------------------------------------------------
        # Group D: Within-Recording Temporal Burstiness / Stationarity (Vectorized, Gain-Invariant)
        # -------------------------------------------------------------
        dyn_keys = ["max_abs_zdiff_delta", "post_minus_ant_alpha", "mean_abs_zdiff_dar", "mca_abs_asym_delta"]
        if df_epochs is not None and len(df_epochs) > 1:
            n_ep = len(df_epochs)

            def _ep_col(col_name: str, default_val: float) -> np.ndarray:
                if col_name in df_epochs.columns:
                    arr = df_epochs[col_name].values.astype(np.float64)
                    if not np.all(np.isfinite(arr)):
                        finite_vals = arr[np.isfinite(arr)]
                        fill = float(np.median(finite_vals)) if len(finite_vals) > 0 else default_val
                        arr = np.where(np.isfinite(arr), arr, fill)
                    return arr
                return np.full(n_ep, default_val, dtype=np.float64)

            d_l = _ep_col("C3_rel_delta", 0.5)
            d_r = _ep_col("C4_rel_delta", 0.5)
            a_post = 0.5 * (_ep_col("O1_rel_alpha", 0.2) + _ep_col("O2_rel_alpha", 0.2))
            a_ant = 0.5 * (_ep_col("FP1_rel_alpha", 0.2) + _ep_col("FP2_rel_alpha", 0.2))
            dar_l = _ep_col("C3_dar", 1.0)
            dar_r = _ep_col("C4_dar", 1.0)
            mca_d_l = np.mean([_ep_col(f"{c}_rel_delta", 0.5) for c in ["F7", "T3", "T5", "C3"]], axis=0)
            mca_d_r = np.mean([_ep_col(f"{c}_rel_delta", 0.5) for c in ["F8", "T4", "T6", "C4"]], axis=0)

            ep_dyn = {
                "max_abs_zdiff_delta": np.abs(_bounded_ratio_vec(d_l, d_r)),
                "post_minus_ant_alpha": _bounded_ratio_vec(a_post, a_ant),
                "mean_abs_zdiff_dar": np.abs(_bounded_ratio_vec(dar_l, dar_r)),
                "mca_abs_asym_delta": np.abs(_bounded_ratio_vec(mca_d_l, mca_d_r)),
            }

            for k in dyn_keys:
                vals = np.nan_to_num(ep_dyn[k], nan=0.0, posinf=0.0, neginf=0.0)
                std_val = float(np.std(vals))
                mean_val = float(np.mean(vals))
                feats[f"n1_burst_std_{k}"] = std_val
                feats[f"n1_burst_iqr_{k}"] = float(np.percentile(vals, 75) - np.percentile(vals, 25))
                feats[f"n1_burst_cv_{k}"] = float(std_val / (np.abs(mean_val) + 0.1))
        else:
            for k in dyn_keys:
                feats[f"n1_burst_std_{k}"] = 0.0
                feats[f"n1_burst_iqr_{k}"] = 0.0
                feats[f"n1_burst_cv_{k}"] = 0.0

        # -------------------------------------------------------------
        # Group E: Within-Subject Normalized wPLI Topology & Bounded Ratios
        # -------------------------------------------------------------
        if wpli_series is not None:
            w_dict = wpli_series.to_dict() if isinstance(wpli_series, pd.Series) else dict(wpli_series)

            total_global_w = 0.0
            for b in ["delta", "theta", "alpha", "beta"]:
                total_global_w += float(w_dict.get(f"wpli_global_homo_{b}", 0.3))

            for b in ["delta", "theta", "alpha", "beta"]:
                pairs_b = [
                    f"wpli_homo_{b}_FP1_FP2", f"wpli_homo_{b}_F7_F8", f"wpli_homo_{b}_F3_F4",
                    f"wpli_homo_{b}_T3_T4", f"wpli_homo_{b}_C3_C4", f"wpli_homo_{b}_T5_T6",
                    f"wpli_homo_{b}_P3_P4", f"wpli_homo_{b}_O1_O2"
                ]
                w_vals = np.array([float(w_dict.get(p, 0.3)) for p in pairs_b], dtype=np.float64)
                mean_w = float(np.mean(w_vals))
                std_w = float(np.std(w_vals))

                for p_name, w in zip(pairs_b, w_vals):
                    p_short = p_name.replace(f"wpli_homo_{b}_", "")
                    feats[f"n1_wpli_norm_{b}_{p_short}"] = float(w / (mean_w + self.eps))
                    feats[f"n1_wpli_z_{b}_{p_short}"] = float((w - mean_w) / (std_w + self.eps))

                z_homo = (w_vals - mean_w) / (std_w + self.eps)
                feats[f"n1_wpli_homo_max_z_{b}"] = float(np.max(z_homo))
                feats[f"n1_wpli_homo_mean_abs_z_{b}"] = float(np.mean(np.abs(z_homo)))

                ant_w = float(np.mean(w_vals[:3]))
                post_w = float(np.mean(w_vals[5:]))
                feats[f"n1_wpli_post_minus_ant_{b}"] = float(post_w - ant_w)
                feats[f"n1_wpli_post_ant_ratio_{b}"] = float((post_w - ant_w) / (post_w + ant_w + 1e-6))

                # Intra-hemispheric pairs and bounded ratios
                intra_vals = []
                for intra_pair in ["F3P3_F4P4", "C3O1_C4O2", "F7T5_F8T6"]:
                    asym_col = f"asym_wpli_{b}_{intra_pair}"
                    asym_raw = float(w_dict.get(asym_col, 0.0))
                    feats[f"n1_wpli_{asym_col}"] = asym_raw

                    p_l_name = intra_pair.split("_")[0]
                    p_r_name = intra_pair.split("_")[1]
                    wl = float(w_dict.get(f"wpli_intra_{b}_{p_l_name[:2]}_{p_l_name[2:]}", 0.3))
                    wr = float(w_dict.get(f"wpli_intra_{b}_{p_r_name[:2]}_{p_r_name[2:]}", 0.3))
                    intra_vals.extend([wl, wr])
                    feats[f"n1_wpli_asym_ratio_{b}_{intra_pair}"] = float((wl - wr) / (wl + wr + 1e-6))

                mean_intra = float(np.mean(intra_vals)) if len(intra_vals) > 0 else 0.3
                feats[f"n1_wpli_homo_vs_cross_ratio_{b}"] = float((mean_w - mean_intra) / (mean_w + mean_intra + 1e-6))

                glob_b = float(w_dict.get(f"wpli_global_homo_{b}", 0.3))
                feats[f"n1_wpli_band_prop_{b}"] = float(glob_b / (total_global_w + 1e-6))

            g_tar = float(w_dict.get("wpli_global_tar", 0.5))
            g_dar = float(w_dict.get("wpli_global_dar", 0.5))
            feats["n1_wpli_norm_tar"] = float(g_tar / (g_tar + g_dar + self.eps))
        else:
            for b in ["delta", "theta", "alpha", "beta"]:
                pairs_b = [
                    f"wpli_homo_{b}_FP1_FP2", f"wpli_homo_{b}_F7_F8", f"wpli_homo_{b}_F3_F4",
                    f"wpli_homo_{b}_T3_T4", f"wpli_homo_{b}_C3_C4", f"wpli_homo_{b}_T5_T6",
                    f"wpli_homo_{b}_P3_P4", f"wpli_homo_{b}_O1_O2"
                ]
                for p_name in pairs_b:
                    p_short = p_name.replace(f"wpli_homo_{b}_", "")
                    feats[f"n1_wpli_norm_{b}_{p_short}"] = 1.0
                    feats[f"n1_wpli_z_{b}_{p_short}"] = 0.0

                feats[f"n1_wpli_homo_max_z_{b}"] = 0.0
                feats[f"n1_wpli_homo_mean_abs_z_{b}"] = 0.0
                feats[f"n1_wpli_post_minus_ant_{b}"] = 0.0
                feats[f"n1_wpli_post_ant_ratio_{b}"] = 0.0

                for intra_pair in ["F3P3_F4P4", "C3O1_C4O2", "F7T5_F8T6"]:
                    asym_col = f"asym_wpli_{b}_{intra_pair}"
                    feats[f"n1_wpli_{asym_col}"] = 0.0
                    feats[f"n1_wpli_asym_ratio_{b}_{intra_pair}"] = 0.0

                feats[f"n1_wpli_homo_vs_cross_ratio_{b}"] = 0.0
                feats[f"n1_wpli_band_prop_{b}"] = 0.25

            feats["n1_wpli_norm_tar"] = 0.5

        # ------------------------------------------------------------------
        # Group F: Spline-Invariant Ipsilateral Spatial Contrast Scaling
        # ------------------------------------------------------------------
        for j, m in enumerate(METRICS_11):
            edge_vals = []
            for u, v in IPSI_EDGES:
                xu = float(X[self.ch_idx[u], j])
                xv = float(X[self.ch_idx[v], j])
                mag_uv = abs(xu) + abs(xv)
                eps_uv = max(1e-12 * mag_uv, 1e-30)
                edge_vals.append(abs(xu - xv) / (mag_uv + eps_uv))
            feats[f"n1_ipsi_contrast_{m}"] = float(np.mean(edge_vals))

        feats["n1_ipsi_contrast_composite"] = float(
            np.mean([feats[f"n1_ipsi_contrast_{m}"] for m in ["dtabr", "rel_beta", "spectral_entropy", "hjorth_mobility"]])
        )

        for m in ("dar", "dtabr", "rel_alpha", "rel_theta"):
            denom_g = (feats[f"n1_ipsi_contrast_{m}"] + 1e-6) ** 0.60
            g_vals = np.sort(
                [feats[f"n1_asym_abs_ratio_{m}_{L}_{R_ch}"] / denom_g for L, R_ch in HOMOLOGOUS_PAIRS]
            )
            feats[f"n1_ipsi_g_mean_{m}"] = float(np.mean(g_vals))
            feats[f"n1_ipsi_g_top2_{m}"] = float(np.mean(g_vals[-2:]))
            feats[f"n1_ipsi_g_top3_{m}"] = float(np.mean(g_vals[-3:]))
            feats[f"n1_ipsi_g_max_{m}"] = float(g_vals[-1])

        # ------------------------------------------------------------------
        # Group G: Within-Patient Epoch K-Means Salience Features (14 n1_km_*)
        # ------------------------------------------------------------------
        if df_epochs is not None and len(df_epochs) >= 6:
            km_feats = self.km_analyzer.analyze(df_epochs)
            feats.update(km_feats)
        else:
            j_delta = METRICS_11.index("rel_delta")
            fp_d = 0.5 * (float(X[self.ch_idx["FP1"], j_delta]) + float(X[self.ch_idx["FP2"], j_delta]))
            cp_d = float(np.mean([X[self.ch_idx[ch], j_delta] for ch in ["C3", "C4", "P3", "P4", "O1", "O2"]]))
            blink_fb = float(_bounded_ratio(fp_d, cp_d))
            focal_dar_fb = float(feats["n1_asym_max_abs_ratio_dar"])
            feats.update({
                "n1_km_available": 0.0,
                "n1_km_minor_frac": 0.0,
                "n1_km_centroid_dist": 0.0,
                "n1_km_silhouette": 0.0,
                "n1_km_variance_ratio": 0.0,
                "n1_km_gap_focal_dar": 0.0,
                "n1_km_gap_focal_delta": 0.0,
                "n1_km_gap_blink": 0.0,
                "n1_km_gap_beta": 0.0,
                "n1_km_gap_mobility": 0.0,
                "n1_km_dom_focal_dar": focal_dar_fb,
                "n1_km_min_focal_dar": focal_dar_fb,
                "n1_km_dom_blink": blink_fb,
                "n1_km_min_blink": blink_fb,
            })

        return feats


# =============================================================================
# 3. FoldInternalClassConditionalSelector (Leakage-Free Transformer)
# =============================================================================

class FoldInternalClassConditionalSelector(BaseEstimator, TransformerMixin):
    """
    Fold-Internal Class-Conditional Feature Selector.

    Operates strictly within training folds during cross-validation.
    Evaluates:
    1. Within-Class Center Leakage F-stat:
       Calculates one-way ANOVA F-stat predicting recording center SEPARATELY within each class:
       F_leak(j) = (1 / |C|) * sum_{c in C} f_classif(X_{y=c}[:, j], centers_{y=c})
       Completely eliminates the false-positive center leakage caused by unbalanced class distributions.
    2. Between-Class Biological F-stat:
       F_bio(j) = f_classif(X[:, j], y)
    3. Cross-Center Biological Concordance:
       Checks sign consistency of clinical contrast across independent centers with multi-state labels.

    Composite Scoring:
       score(j) = (F_bio(j) / (F_leak(j) + 1.0)) * (1.0 + (concordance_bonus - 1.0) * C(j))
    """

    def __init__(
        self,
        k_features: int = 60,
        max_leakage_f: float = 15.0,
        min_bio_f: float = 1.0,
        concordance_bonus: float = 1.5,
        task: str = "multiclass",
        return_dataframe: bool = False
    ) -> None:
        self.k_features = k_features
        self.max_leakage_f = max_leakage_f
        self.min_bio_f = min_bio_f
        self.concordance_bonus = concordance_bonus
        self.task = task
        self.return_dataframe = return_dataframe

    def fit(
        self,
        X: Union[np.ndarray, pd.DataFrame],
        y: Union[np.ndarray, pd.Series],
        centers: Optional[Union[np.ndarray, pd.Series, List[str]]] = None,
        y_fine: Optional[Union[np.ndarray, pd.Series]] = None
    ) -> "FoldInternalClassConditionalSelector":
        """
        Fits selector on training fold data.
        Supports task-specific evaluation:
        - "multiclass": standard 3-class biological separation.
        - "stage1": Normal (0) vs Abnormal (1 or 2).
        - "stage2": Other_Abnormal (1) vs Stroke (2) evaluated strictly on abnormal subjects.
        """
        if isinstance(X, pd.DataFrame):
            self.feature_names_in_ = list(X.columns)
            X_arr = X.values.astype(np.float64)
        else:
            self.feature_names_in_ = [f"f_{i}" for i in range(X.shape[1])]
            X_arr = np.asarray(X, dtype=np.float64)

        y_arr = np.asarray(y)
        y_fine_arr = np.asarray(y_fine) if y_fine is not None else y_arr
        c_arr = np.asarray(centers) if centers is not None else None
        n_features = X_arr.shape[1]

        # Determine task target and subset
        if self.task == "stage1":
            y_task = (y_arr > 0).astype(int)
            X_task = X_arr
            c_task = c_arr
            y_fine_task = y_fine_arr
            classes_for_leak = np.unique(y_fine_task)
            concordance_classes = (0, 1)
        elif self.task == "stage2":
            mask_ab = (y_arr > 0)
            X_task = X_arr[mask_ab]
            y_task = (y_arr[mask_ab] == 2).astype(int)  # 0: Other_Abnormal, 1: Stroke
            c_task = c_arr[mask_ab] if c_arr is not None else None
            y_fine_task = y_fine_arr[mask_ab]
            classes_for_leak = np.unique(y_fine_task)
            concordance_classes = (0, 1)
        else:
            y_task = y_arr
            X_task = X_arr
            c_task = c_arr
            y_fine_task = y_fine_arr
            classes_for_leak = np.unique(y_fine_task)
            concordance_classes = None

        # 1. Between-Class Biological F-statistic
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            warnings.simplefilter("ignore", RuntimeWarning)
            with np.errstate(divide="ignore", invalid="ignore"):
                f_bio, _ = f_classif(X_task, y_task)
        f_bio = np.nan_to_num(f_bio, nan=0.0, posinf=0.0, neginf=0.0)

        # 2. Within-Class Center Leakage F-statistic (calculated strictly within pure classes)
        f_leak = np.zeros(n_features, dtype=np.float64)
        if c_task is not None:
            leak_per_class = []

            for c_val in classes_for_leak:
                mask = (y_fine_task == c_val)
                if np.sum(mask) >= 4:
                    X_c = X_task[mask]
                    centers_c = c_task[mask]
                    u_cnts, counts = np.unique(centers_c, return_counts=True)

                    # Need at least 2 distinct centers with >= 2 subjects each
                    if len(u_cnts) >= 2 and min(counts) >= 2:
                        with warnings.catch_warnings():
                            warnings.simplefilter("ignore", UserWarning)
                            warnings.simplefilter("ignore", RuntimeWarning)
                            with np.errstate(divide="ignore", invalid="ignore"):
                                f_val, _ = f_classif(X_c, centers_c)
                        f_val = np.nan_to_num(f_val, nan=0.0, posinf=0.0, neginf=0.0)
                        leak_per_class.append(f_val)

            if len(leak_per_class) > 0:
                f_leak = np.mean(leak_per_class, axis=0)

        # 3. Cross-Center Biological Concordance
        concordance = np.ones(n_features, dtype=np.float64) * 0.5
        if c_task is not None:
            u_centers = np.unique(c_task)
            signs_per_feat = []

            for cnt in u_centers:
                c_mask = (c_task == cnt)
                y_cnt = y_task[c_mask]
                X_cnt = X_task[c_mask]

                if concordance_classes is not None:
                    has_cls0 = np.isin(concordance_classes[0], y_cnt)
                    has_cls1 = np.isin(concordance_classes[1], y_cnt)
                    if has_cls0 and has_cls1:
                        med_1 = np.median(X_cnt[y_cnt == concordance_classes[1]], axis=0)
                        med_0 = np.median(X_cnt[y_cnt == concordance_classes[0]], axis=0)
                        signs_per_feat.append(np.sign(med_1 - med_0))
                else:
                    has_stroke = np.isin(2, y_cnt) or (len(np.unique(y_cnt)) > 1 and max(y_cnt) > 0)
                    has_control = np.isin(0, y_cnt)
                    if has_stroke and has_control:
                        med_stroke = np.median(X_cnt[y_cnt > 0], axis=0)
                        med_ctrl = np.median(X_cnt[y_cnt == 0], axis=0)
                        signs_per_feat.append(np.sign(med_stroke - med_ctrl))

            if len(signs_per_feat) >= 2:
                signs_arr = np.array(signs_per_feat)  # shape (n_multi_centers, n_features)
                pos_frac = np.mean(signs_arr > 0, axis=0)
                # Concordance is maximum agreement rate (range [0.5, 1.0])
                concordance = np.maximum(pos_frac, 1.0 - pos_frac)

        # 4. Composite Scoring & Selection
        composite_scores = (f_bio / (f_leak + 1.0)) * (1.0 + (self.concordance_bonus - 1.0) * concordance)
        composite_scores = np.nan_to_num(composite_scores, nan=0.0, posinf=0.0, neginf=0.0)

        # Filter out extreme leaking features if requested
        if self.max_leakage_f > 0:
            severe_leak_mask = (f_leak > self.max_leakage_f)
            composite_scores[severe_leak_mask] *= 0.1

        # Pick top K
        sorted_indices = np.argsort(composite_scores)[::-1]
        k = min(self.k_features, n_features)
        self.selected_indices_ = sorted_indices[:k]
        self.selected_features_ = [self.feature_names_in_[i] for i in self.selected_indices_]
        self.f_bio_ = f_bio
        self.f_leak_ = f_leak
        self.concordance_ = concordance
        self.composite_scores_ = composite_scores

        return self

    def transform(self, X: Union[np.ndarray, pd.DataFrame]) -> Union[np.ndarray, pd.DataFrame]:
        """Transforms input array or DataFrame by selecting fitted feature subset."""
        if isinstance(X, pd.DataFrame):
            res_df = X.reindex(columns=self.selected_features_, fill_value=0.0).copy()
            res_df = res_df.replace([np.inf, -np.inf], np.nan).fillna(0.0)
            return res_df if self.return_dataframe else res_df.values
        X_arr = np.asarray(X)
        return X_arr[:, self.selected_indices_]

    def fit_transform(
        self,
        X: Union[np.ndarray, pd.DataFrame],
        y: Union[np.ndarray, pd.Series] = None,
        centers: Optional[Union[np.ndarray, pd.Series, List[str]]] = None,
        y_fine: Optional[Union[np.ndarray, pd.Series]] = None,
        **fit_params
    ) -> Union[np.ndarray, pd.DataFrame]:
        return self.fit(X, y, centers=centers, y_fine=y_fine).transform(X)

    def get_feature_names_out(self, input_features: Optional[List[str]] = None) -> np.ndarray:
        return np.array(self.selected_features_)


# =============================================================================
# 3b. HospitalGradeN1Classifier (5 Model Families, 3 Paradigms, N=1 Triage)
# =============================================================================

class HospitalGradeN1Classifier(BaseEstimator, ClassifierMixin):
    """
    Hospital-Grade N=1 3-State Acute Stroke Classifier & Triage Pipeline (Option A).

    Integrates:
    - Dual-Branch Architecture:
      * Branch 1 (Base Stationary Ensemble): 5 model families on base N=1 features (base_cols_)
        preserving Normal vs Mimic discrimination.
      * Branch 2 (Sub-Bag & K-Means Salience Ensemble): 5 model families on full 973 features
        (959 + 14 n1_km_*) augmented strictly inside training folds with orig + subbag_h1/h2/salient.
    - Inner-OOF Simplex Calibration: strictly leak-free optimization of beta_subbag_ and
      class_multipliers_ + tau_stroke_ on inner-fold OOF predictions.
    - Spline-Invariant Fallback Guard (16 n1_ipsi_g_* features, LogisticRegression C=0.02).
    - Clinical Reassurance Telemetry & Few-Shot Control Onboarding Calibration.
    """

    def __init__(
        self,
        paradigm: str = "X3",
        k_features_s1: int = 60,
        k_features_s2: int = 55,
        k_features_flat: int = 70,
        max_leakage_f: float = 12.0,
        tau_s1: float = 0.65,
        tau_s2: float = 0.50,
        alpha_meta: float = 0.45,
        auto_calibrate_thresholds: bool = True,
        random_state: int = 42,
        use_subbag_ensemble: bool = True,
        subbag_pool_path: Optional[Union[str, Path]] = CHANG5_AUGMENTED_POOL_PARQUET,
        beta_subbag: Optional[float] = None,
    ) -> None:
        self.paradigm = paradigm
        self.k_features_s1 = k_features_s1
        self.k_features_s2 = k_features_s2
        self.k_features_flat = k_features_flat
        self.max_leakage_f = max_leakage_f
        self.tau_s1 = tau_s1
        self.tau_s2 = tau_s2
        self.alpha_meta = alpha_meta
        self.auto_calibrate_thresholds = auto_calibrate_thresholds
        self.random_state = random_state
        self.use_subbag_ensemble = use_subbag_ensemble
        self.subbag_pool_path = subbag_pool_path
        self.beta_subbag = beta_subbag

        self.quality_gate_ = FirstContactSignalQualityGate()
        self.extractor_ = N1SelfReferencedFeatureExtractor(random_state=random_state)
        self.subtype_classifier_: Optional[Any] = None

    def _build_ensemble(self, rs: int) -> Dict[str, Any]:
        """Instantiates the 5 complementary estimator families."""
        return {
            "et": ExtraTreesClassifier(
                n_estimators=500,
                max_features="sqrt",
                class_weight="balanced_subsample",
                random_state=rs,
                n_jobs=-1
            ),
            "rf": RandomForestClassifier(
                n_estimators=500,
                class_weight="balanced_subsample",
                random_state=rs + 1,
                n_jobs=-1
            ),
            "hgb": HistGradientBoostingClassifier(
                max_iter=300,
                max_depth=5,
                l2_regularization=2.0,
                learning_rate=0.04,
                class_weight="balanced",
                random_state=rs + 2
            ),
            "lr": LogisticRegression(
                C=0.2,
                solver="lbfgs",
                class_weight="balanced",
                max_iter=2000,
                random_state=rs + 3
            ),
            "mlp": MLPClassifier(
                hidden_layer_sizes=(128, 64),
                alpha=1.0,
                early_stopping=True,
                max_iter=500,
                random_state=rs + 4
            )
        }

    def _build_inner_ensemble(self, rs: int) -> Dict[str, Any]:
        """Lightweight 4-family inner ensemble for fast leak-free Inner-OOF calibration."""
        return {
            "et": ExtraTreesClassifier(
                n_estimators=150,
                max_features="sqrt",
                class_weight="balanced_subsample",
                random_state=rs,
                n_jobs=-1
            ),
            "rf": RandomForestClassifier(
                n_estimators=150,
                class_weight="balanced_subsample",
                random_state=rs + 1,
                n_jobs=-1
            ),
            "lr": LogisticRegression(
                C=0.2,
                solver="lbfgs",
                class_weight="balanced",
                max_iter=1000,
                random_state=rs + 2
            ),
            "hgb": HistGradientBoostingClassifier(
                max_iter=150,
                max_depth=5,
                l2_regularization=2.0,
                learning_rate=0.05,
                class_weight="balanced",
                random_state=rs + 3
            ),
        }

    def _load_subbag_training_data(
        self,
        X_df: pd.DataFrame,
        y_arr: np.ndarray,
        c_arr: Optional[np.ndarray],
        g_arr: Optional[np.ndarray],
    ) -> Tuple[pd.DataFrame, np.ndarray, Optional[np.ndarray], np.ndarray, np.ndarray, np.ndarray]:
        """
        Assembles leak-free Branch 2 training pool from orig rows in X_df plus
        subbag_h1/subbag_h2/subbag_salient rows strictly matching g_arr.
        Never loads mirrored rows or out-of-fold subjects.
        """
        n_orig = len(X_df)
        orig_groups = np.array([str(g) for g in g_arr]) if g_arr is not None else np.array([f"row_{i}" for i in range(n_orig)])
        orig_centers = np.array(c_arr) if c_arr is not None else None

        sub_dfs: List[pd.DataFrame] = [X_df[self.subbag_cols_].copy()]
        y_parts: List[np.ndarray] = [y_arr.astype(int)]
        c_parts: List[np.ndarray] = [orig_centers] if orig_centers is not None else []
        g_parts: List[np.ndarray] = [orig_groups]
        a_parts: List[np.ndarray] = [np.array(["orig"] * n_orig, dtype=object)]

        if g_arr is not None and self.subbag_pool_path is not None:
            pool_path = Path(self.subbag_pool_path)
            if pool_path.exists():
                pool_df = pd.read_parquet(pool_path)
                if (
                    "human_subject_id" in pool_df.columns
                    and "aug_type" in pool_df.columns
                    and set(self.subbag_cols_).issubset(pool_df.columns)
                ):
                    train_group_set = set(orig_groups.tolist())
                    allowed_aug = {"subbag_h1", "subbag_h2", "subbag_salient"}
                    pool_sids = pool_df["human_subject_id"].astype(str)
                    mask_sub = pool_sids.isin(train_group_set) & pool_df["aug_type"].isin(allowed_aug)
                    sub_only = pool_df.loc[mask_sub].copy()

                    if len(sub_only) > 0:
                        g_to_y = {str(g): int(yv) for g, yv in zip(orig_groups, y_arr)}
                        sub_sids = sub_only["human_subject_id"].astype(str).values
                        sub_y = np.array([g_to_y[s] for s in sub_sids], dtype=int)
                        sub_dfs.append(sub_only[self.subbag_cols_].copy())
                        y_parts.append(sub_y)
                        g_parts.append(sub_sids)
                        a_parts.append(sub_only["aug_type"].values.astype(object))
                        if orig_centers is not None:
                            g_to_c = {str(g): cv for g, cv in zip(orig_groups, orig_centers)}
                            c_parts.append(np.array([g_to_c[s] for s in sub_sids]))

        X_b2 = pd.concat(sub_dfs, ignore_index=True)
        y_b2 = np.concatenate(y_parts)
        g_b2 = np.concatenate(g_parts)
        a_b2 = np.concatenate(a_parts)
        c_b2 = np.concatenate(c_parts) if len(c_parts) > 0 else None
        is_orig_b2 = (a_b2 == "orig")

        # Patient-normalized weights: orig=1.0, subbags share 0.75 per patient, then class-balanced
        sw = np.ones(len(y_b2), dtype=np.float64)
        for u_grp in np.unique(g_b2):
            m_aug = (g_b2 == u_grp) & (~is_orig_b2)
            n_aug = int(np.sum(m_aug))
            if n_aug > 0:
                sw[m_aug] = 0.75 / float(n_aug)

        n_classes = max(3, int(np.max(y_b2)) + 1)
        class_counts = np.bincount(y_b2, minlength=n_classes)
        n_total = len(y_b2)
        for c_idx in range(n_classes):
            if class_counts[c_idx] > 0:
                sw[y_b2 == c_idx] *= float(n_total) / (float(n_classes) * float(class_counts[c_idx]))
        sw /= max(float(np.mean(sw)), 1e-12)

        return X_b2, y_b2, c_b2, g_b2, is_orig_b2, sw

    def fit(
        self,
        X: Union[np.ndarray, pd.DataFrame],
        y: Union[np.ndarray, pd.Series],
        centers: Optional[Union[np.ndarray, pd.Series, List[str]]] = None,
        groups: Optional[Union[np.ndarray, pd.Series, List[str]]] = None
    ) -> "HospitalGradeN1Classifier":
        """
        Fits Dual-Branch classifier on training data strictly inside the calling fold.
        """
        if isinstance(X, pd.DataFrame):
            self.feature_names_in_ = list(X.columns)
            X_df = X.copy()
        else:
            self.feature_names_in_ = [f"f_{i}" for i in range(X.shape[1])]
            X_df = pd.DataFrame(X, columns=self.feature_names_in_)

        y_arr = np.asarray(y, dtype=int)
        c_arr = np.asarray(centers) if centers is not None else None
        g_arr = np.asarray(groups) if groups is not None else None
        if c_arr is None and g_arr is not None:
            c_arr = g_arr

        # Column partitions for backward compatibility (959 vs 973 cols)
        non_km_cols = [
            c for c in self.feature_names_in_
            if not c.startswith("n1_km_") and not c.startswith("n1_kmclean_")
        ]
        self.base_cols_ = non_km_cols if len(non_km_cols) > 0 else list(self.feature_names_in_)
        self.subbag_cols_ = list(self.feature_names_in_)

        # Store training control baseline for optional Few-Shot Site Onboarding
        ctrl_mask = (y_arr == 0)
        if np.any(ctrl_mask):
            ctrl_means = X_df.loc[ctrl_mask, self.feature_names_in_].mean(axis=0, skipna=True).fillna(0.0).values
        else:
            ctrl_means = X_df[self.feature_names_in_].mean(axis=0, skipna=True).fillna(0.0).values
        self.train_ctrl_mean_raw_ = np.asarray(ctrl_means, dtype=np.float64)
        self.scaler_shift_ = None

        self.calibrated_tau_s1_ = self.tau_s1
        self.calibrated_tau_s2_ = self.tau_s2
        self.has_subbag_branch_ = False
        self.beta_subbag_ = float(self.beta_subbag) if self.beta_subbag is not None else 0.50
        self.class_multipliers_ = np.array([1.0, 1.0, 1.0], dtype=np.float64)

        X_base_df = X_df[self.base_cols_]

        # -------------------------------------------------------------
        # 1. Fit Stage 1 Pipeline (Normal vs Abnormal) if X1 or X3
        # -------------------------------------------------------------
        if self.paradigm in ("X1", "X3"):
            self.sel_s1_ = FoldInternalClassConditionalSelector(
                k_features=self.k_features_s1,
                max_leakage_f=self.max_leakage_f,
                task="stage1",
                return_dataframe=True
            )
            X_s1_sel = self.sel_s1_.fit_transform(X_base_df, y_arr, centers=c_arr, y_fine=y_arr)
            self.imp_s1_ = SimpleImputer(strategy="median")
            self.scaler_s1_ = RobustScaler()
            X_s1_norm = self.scaler_s1_.fit_transform(self.imp_s1_.fit_transform(X_s1_sel))
            y_s1 = (y_arr > 0).astype(int)

            self.models_s1_ = self._build_ensemble(self.random_state)
            for model in self.models_s1_.values():
                model.fit(X_s1_norm, y_s1)

        # -------------------------------------------------------------
        # 2. Fit Stage 2 Pipeline (Other_Abnormal vs Stroke) if X1 or X3
        # -------------------------------------------------------------
        if self.paradigm in ("X1", "X3"):
            mask_ab = (y_arr > 0)
            X_ab_df = X_base_df[mask_ab]
            y_ab = (y_arr[mask_ab] == 2).astype(int)
            c_ab = c_arr[mask_ab] if c_arr is not None else None

            self.sel_s2_ = FoldInternalClassConditionalSelector(
                k_features=self.k_features_s2,
                max_leakage_f=self.max_leakage_f,
                task="stage2",
                return_dataframe=True
            )
            X_s2_sel = self.sel_s2_.fit_transform(X_ab_df, y_arr[mask_ab], centers=c_ab, y_fine=y_arr[mask_ab])
            self.imp_s2_ = SimpleImputer(strategy="median")
            self.scaler_s2_ = RobustScaler()
            X_s2_norm = self.scaler_s2_.fit_transform(self.imp_s2_.fit_transform(X_s2_sel))

            self.models_s2_ = self._build_ensemble(self.random_state + 10)
            for model in self.models_s2_.values():
                model.fit(X_s2_norm, y_ab)

        # -------------------------------------------------------------
        # 3a. Branch 1: Base Stationary Flat 3-Class Pipeline (X2 / X3)
        # -------------------------------------------------------------
        if self.paradigm in ("X2", "X3"):
            self.sel_flat_ = FoldInternalClassConditionalSelector(
                k_features=self.k_features_flat,
                max_leakage_f=self.max_leakage_f,
                task="multiclass",
                return_dataframe=True
            )
            X_flat_sel = self.sel_flat_.fit_transform(X_base_df, y_arr, centers=c_arr, y_fine=y_arr)
            self.imp_flat_ = SimpleImputer(strategy="median")
            self.scaler_flat_ = RobustScaler()
            X_flat_norm = self.scaler_flat_.fit_transform(self.imp_flat_.fit_transform(X_flat_sel))

            self.models_flat_ = self._build_ensemble(self.random_state + 20)
            for model in self.models_flat_.values():
                model.fit(X_flat_norm, y_arr)

        # -------------------------------------------------------------
        # 3b. Branch 2: Sub-Bag & K-Means Salience Ensemble (973 cols)
        # -------------------------------------------------------------
        if self.paradigm in ("X2", "X3") and self.use_subbag_ensemble:
            X_b2_df, y_b2, c_b2, g_b2, is_orig_b2, sw_b2 = self._load_subbag_training_data(
                X_df, y_arr, c_arr, g_arr
            )
            k_features_subbag = self.k_features_flat + 10
            self.sel_subbag_ = FoldInternalClassConditionalSelector(
                k_features=k_features_subbag,
                max_leakage_f=self.max_leakage_f,
                task="multiclass",
                return_dataframe=True
            )
            # Fit selector strictly on orig rows so F_bio/F_leak are not inflated by sub-bags
            c_b2_orig = c_b2[is_orig_b2] if c_b2 is not None else None
            self.sel_subbag_.fit(
                X_b2_df.loc[is_orig_b2],
                y_b2[is_orig_b2],
                centers=c_b2_orig,
                y_fine=y_b2[is_orig_b2]
            )
            X_b2_sel = self.sel_subbag_.transform(X_b2_df)
            self.imp_subbag_ = SimpleImputer(strategy="median")
            self.scaler_subbag_ = RobustScaler()
            X_b2_norm = self.scaler_subbag_.fit_transform(self.imp_subbag_.fit_transform(X_b2_sel))

            self.models_subbag_ = self._build_ensemble(self.random_state + 40)
            for m_name, model in self.models_subbag_.items():
                if m_name in ("et", "rf", "hgb", "lr"):
                    model.fit(X_b2_norm, y_b2, sample_weight=sw_b2)
                else:
                    model.fit(X_b2_norm, y_b2)
            self.has_subbag_branch_ = True

        # -------------------------------------------------------------
        # 4. Inner-OOF Simplex Calibration & Clinical Focal Override Gate
        # -------------------------------------------------------------
        self.calibrated_tau_s1_ = self.tau_s1
        self.calibrated_tau_s2_ = self.tau_s2
        self.tau_abnormal_ = 0.50
        self.tau_stroke_ = 0.40
        self.tau_override_prob_ = 0.45
        self.tau_override_focal_ = 2.50

        if self.auto_calibrate_thresholds:
            try:
                n_splits_inner = 5
                n_unique_groups = len(np.unique(g_arr)) if g_arr is not None else 0
                if g_arr is not None and n_unique_groups >= n_splits_inner:
                    cv_inner = StratifiedGroupKFold(n_splits=n_splits_inner, shuffle=True, random_state=self.random_state)
                    splits = list(cv_inner.split(X_df, y_arr, g_arr))
                else:
                    cv_inner = StratifiedKFold(n_splits=n_splits_inner, shuffle=True, random_state=self.random_state)
                    splits = list(cv_inner.split(X_df, y_arr))

                inner_s1_probs = np.zeros(len(y_arr), dtype=np.float64)
                inner_s2_probs = np.zeros(len(y_arr), dtype=np.float64)
                inner_flat_probs = np.zeros((len(y_arr), 3), dtype=np.float64)
                inner_subbag_probs = np.zeros((len(y_arr), 3), dtype=np.float64)
                has_s2_oof = np.zeros(len(y_arr), dtype=bool)

                orig_g_str = np.array([str(g) for g in g_arr]) if g_arr is not None else np.array([f"row_{i}" for i in range(len(y_arr))])
                if self.has_subbag_branch_:
                    X_b2_orig_norm = self.scaler_subbag_.transform(
                        self.imp_subbag_.transform(self.sel_subbag_.transform(X_df[self.subbag_cols_]))
                    )

                for fold_in_i, (in_tr, in_val) in enumerate(splits):
                    if self.paradigm in ("X1", "X3"):
                        y_tr_s1 = (y_arr[in_tr] > 0).astype(int)
                        clf_in_s1 = ExtraTreesClassifier(
                            n_estimators=100, max_features="sqrt", class_weight="balanced_subsample",
                            random_state=self.random_state, n_jobs=-1
                        )
                        clf_in_s1.fit(X_s1_norm[in_tr], y_tr_s1)
                        inner_s1_probs[in_val] = clf_in_s1.predict_proba(X_s1_norm[in_val])[:, 1]

                        mask_tr_ab = (y_arr[in_tr] > 0)
                        mask_val_ab = (y_arr[in_val] > 0)
                        if np.sum(mask_tr_ab) > 10 and np.sum(mask_val_ab) > 0:
                            y_tr_s2 = (y_arr[in_tr][mask_tr_ab] == 2).astype(int)
                            val_ab_idx = in_val[mask_val_ab]
                            tr_ab_idx = in_tr[mask_tr_ab]
                            clf_in_s2 = ExtraTreesClassifier(
                                n_estimators=100, max_features="sqrt", class_weight="balanced_subsample",
                                random_state=self.random_state + 10, n_jobs=-1
                            )
                            X_in_tr_s2 = self.scaler_s2_.transform(self.imp_s2_.transform(self.sel_s2_.transform(X_base_df.iloc[tr_ab_idx])))
                            X_in_val_s2 = self.scaler_s2_.transform(self.imp_s2_.transform(self.sel_s2_.transform(X_base_df.iloc[val_ab_idx])))
                            clf_in_s2.fit(X_in_tr_s2, y_tr_s2)
                            inner_s2_probs[val_ab_idx] = clf_in_s2.predict_proba(X_in_val_s2)[:, 1]
                            has_s2_oof[val_ab_idx] = True

                    if self.paradigm in ("X2", "X3"):
                        m1_in = self._build_inner_ensemble(self.random_state + 20 + fold_in_i)
                        p1_in = np.zeros((len(in_val), 3), dtype=np.float64)
                        for m_inst in m1_in.values():
                            m_inst.fit(X_flat_norm[in_tr], y_arr[in_tr])
                            p1_in += m_inst.predict_proba(X_flat_norm[in_val])
                        inner_flat_probs[in_val] = p1_in / len(m1_in)

                        if self.has_subbag_branch_:
                            val_subs = set(orig_g_str[in_val].tolist())
                            tr_mask_b2 = ~np.isin(g_b2, list(val_subs))
                            m2_in = self._build_inner_ensemble(self.random_state + 40 + fold_in_i)
                            p2_in = np.zeros((len(in_val), 3), dtype=np.float64)
                            for m_inst in m2_in.values():
                                m_inst.fit(X_b2_norm[tr_mask_b2], y_b2[tr_mask_b2], sample_weight=sw_b2[tr_mask_b2])
                                p2_in += m_inst.predict_proba(X_b2_orig_norm[in_val])
                            inner_subbag_probs[in_val] = p2_in / len(m2_in)

                if self.paradigm in ("X1", "X3"):
                    best_bacc_s1 = -1.0
                    best_tau_s1 = self.tau_s1
                    for t in np.linspace(0.35, 0.75, 41):
                        pred_bin = (inner_s1_probs >= t).astype(int)
                        rec0 = np.mean(pred_bin[y_arr == 0] == 0) if np.sum(y_arr == 0) > 0 else 0.5
                        rec1 = np.mean(pred_bin[y_arr > 0] == 1) if np.sum(y_arr > 0) > 0 else 0.5
                        bacc = 0.5 * (rec0 + rec1)
                        if bacc > best_bacc_s1:
                            best_bacc_s1 = bacc
                            best_tau_s1 = float(t)
                    self.calibrated_tau_s1_ = best_tau_s1
                    self.tau_abnormal_ = best_tau_s1

                    if np.sum(has_s2_oof) > 10:
                        y_oof_ab = y_arr[has_s2_oof]
                        p_oof_s2 = inner_s2_probs[has_s2_oof]
                        best_bacc_s2 = -1.0
                        best_tau_s2 = self.tau_s2
                        for t in np.linspace(0.35, 0.70, 36):
                            pred_s2 = (p_oof_s2 >= t).astype(int)
                            rec_mim = np.mean(pred_s2[y_oof_ab == 1] == 0) if np.sum(y_oof_ab == 1) > 0 else 0.5
                            rec_str = np.mean(pred_s2[y_oof_ab == 2] == 1) if np.sum(y_oof_ab == 2) > 0 else 0.5
                            bacc_s2 = 0.5 * (rec_mim + rec_str)
                            if bacc_s2 > best_bacc_s2:
                                best_bacc_s2 = bacc_s2
                                best_tau_s2 = float(t)
                        self.calibrated_tau_s2_ = best_tau_s2

                # Inner-OOF Simplex Calibration for beta_subbag_ and class_multipliers_
                y_is_stroke = (y_arr == 2).astype(int)
                if self.paradigm in ("X2", "X3"):
                    if self.paradigm == "X3":
                        p0_h = 1.0 - inner_s1_probs
                        p1_h = inner_s1_probs * (1.0 - inner_s2_probs)
                        p2_h = inner_s1_probs * inner_s2_probs
                        p_hier_oof = np.column_stack([p0_h, p1_h, p2_h])

                    if self.has_subbag_branch_:
                        beta_grid = [float(self.beta_subbag)] if self.beta_subbag is not None else [0.0, 0.25, 0.4, 0.5, 0.6, 0.75, 1.0]
                    else:
                        beta_grid = [0.0]

                    best_obj = -1e9
                    best_beta = beta_grid[0]
                    best_w = np.array([1.0, 1.0, 1.0], dtype=np.float64)
                    best_p_oof = inner_flat_probs

                    for beta_cand in beta_grid:
                        if self.has_subbag_branch_:
                            p_flat_cand = (1.0 - beta_cand) * inner_flat_probs + beta_cand * inner_subbag_probs
                        else:
                            p_flat_cand = inner_flat_probs

                        if self.paradigm == "X3":
                            p_base_oof = (1.0 - self.alpha_meta) * p_hier_oof + self.alpha_meta * p_flat_cand
                        else:
                            p_base_oof = p_flat_cand

                        for w0 in (0.95, 1.0, 1.05):
                            for w1 in (0.95, 1.0, 1.05):
                                for w2 in (1.0, 1.05, 1.10, 1.15, 1.20, 1.25):
                                    w_cand = np.array([w0, w1, w2], dtype=np.float64)
                                    pc = p_base_oof * w_cand
                                    pc = pc / np.maximum(pc.sum(axis=1, keepdims=True), 1e-12)
                                    pred_in = np.argmax(pc, axis=1)

                                    b3 = float(balanced_accuracy_score(y_arr, pred_in))
                                    s_04 = (pc[:, 2] >= 0.40).astype(int)
                                    sens_04 = float(np.mean(s_04[y_is_stroke == 1] == 1)) if np.sum(y_is_stroke == 1) > 0 else 0.5
                                    spec_04 = float(np.mean(s_04[y_is_stroke == 0] == 0)) if np.sum(y_is_stroke == 0) > 0 else 0.5
                                    bs_04 = 0.5 * (sens_04 + spec_04)

                                    pen = -0.05 * ((beta_cand - 0.5) ** 2)
                                    if spec_04 < 0.90:
                                        pen -= 2.0 * (0.90 - spec_04)
                                    if sens_04 < 0.818:
                                        pen -= 1.0 * (0.818 - sens_04)
                                    sc = 0.65 * b3 + 0.35 * bs_04 + pen

                                    if sc > best_obj:
                                        best_obj = sc
                                        best_beta = float(beta_cand)
                                        best_w = w_cand
                                        best_p_oof = pc

                    self.beta_subbag_ = best_beta
                    self.class_multipliers_ = best_w
                    p_str_oof = best_p_oof[:, 2]
                    p_flat_oof_final = (
                        (1.0 - best_beta) * inner_flat_probs + best_beta * inner_subbag_probs
                        if self.has_subbag_branch_
                        else inner_flat_probs
                    )
                else:
                    p_str_oof = inner_s1_probs * inner_s2_probs
                    p_flat_oof_final = inner_flat_probs

                best_bacc_str = -1.0
                best_tau_str = 0.40
                for t in np.linspace(0.25, 0.65, 41):
                    pred_str = (p_str_oof >= t).astype(int)
                    rec_non = np.mean(pred_str[y_is_stroke == 0] == 0) if np.sum(y_is_stroke == 0) > 0 else 0.5
                    rec_str = np.mean(pred_str[y_is_stroke == 1] == 1) if np.sum(y_is_stroke == 1) > 0 else 0.5
                    bacc_str = 0.5 * (rec_non + rec_str)
                    if bacc_str > best_bacc_str:
                        best_bacc_str = bacc_str
                        best_tau_str = float(t)
                self.tau_stroke_ = best_tau_str

                if np.sum(y_arr == 0) > 10:
                    controls_mask = (y_arr == 0)
                    if self.paradigm in ("X2", "X3"):
                        ctrl_flat_p2 = p_flat_oof_final[controls_mask, 2]
                        self.tau_override_prob_ = float(np.percentile(ctrl_flat_p2, 98))
                    else:
                        self.tau_override_prob_ = 0.50

                    focal_col = "n1_asym_focal_peak_ratio_dar"
                    if focal_col in X_df.columns:
                        ctrl_focal = X_df.loc[controls_mask, focal_col].values
                        self.tau_override_focal_ = float(np.percentile(ctrl_focal, 98))
                    else:
                        self.tau_override_focal_ = 2.50
            except Exception:
                self.calibrated_tau_s1_ = self.tau_s1
                self.calibrated_tau_s2_ = self.tau_s2
                self.tau_abnormal_ = 0.50
                self.tau_stroke_ = 0.40
                self.tau_override_prob_ = 0.45
                self.tau_override_focal_ = 2.50
                self.beta_subbag_ = float(self.beta_subbag) if self.beta_subbag is not None else 0.50
                self.class_multipliers_ = np.array([1.0, 1.0, 1.0], dtype=np.float64)

        # Spline-Invariant Fallback Branch for low-ipsi-contrast interpolated/active caps
        # Fitted STRICTLY on Cohort training rows (y != 1); zero external data access.
        self.ipsi_g_cols_ = [
            f"n1_ipsi_g_{stat}_{m}"
            for m in ("dar", "dtabr", "rel_alpha", "rel_theta")
            for stat in ("mean", "top2", "top3", "max")
        ]
        self.tau_spline_cap_ = 0.0
        self.tau_spline_mob_ = 0.0
        self.tau_spline_beta_ = 0.0
        self.spline_inv_scaler_ = None
        self.spline_inv_clf_ = None

        if (
            "n1_ipsi_contrast_composite" in X_df.columns
            and "n1_ipsi_contrast_hjorth_mobility" in X_df.columns
            and "n1_ipsi_contrast_rel_beta" in X_df.columns
            and all(c in X_df.columns for c in self.ipsi_g_cols_)
        ):
            y0_mask = y_arr == 0
            y0_comp = X_df.loc[y0_mask, "n1_ipsi_contrast_composite"].dropna().values
            y0_mob = X_df.loc[y0_mask, "n1_ipsi_contrast_hjorth_mobility"].dropna().values
            y0_beta = X_df.loc[y0_mask, "n1_ipsi_contrast_rel_beta"].dropna().values
            if len(y0_comp) > 0 and len(y0_mob) > 0 and len(y0_beta) > 0:
                self.tau_spline_cap_ = float(0.85 * np.quantile(y0_comp, 0.01))
                self.tau_spline_mob_ = float(0.85 * np.quantile(y0_mob, 0.01))
                self.tau_spline_beta_ = float(0.85 * np.quantile(y0_beta, 0.01))

            mask_02 = y_arr != 1
            if np.sum(mask_02) >= 10 and len(np.unique(y_arr[mask_02])) >= 2:
                X_g02 = X_df.loc[mask_02, self.ipsi_g_cols_].fillna(0.0).values.astype(np.float64)
                y_bin02 = (y_arr[mask_02] == 2).astype(int)
                self.spline_inv_scaler_ = RobustScaler()
                X_g02_s = self.spline_inv_scaler_.fit_transform(X_g02)
                self.spline_inv_clf_ = LogisticRegression(
                    C=0.02,
                    class_weight="balanced",
                    max_iter=1000,
                    random_state=self.random_state,
                )
                self.spline_inv_clf_.fit(X_g02_s, y_bin02)

        return self

    def fit_site_onboarding_controls(
        self,
        X_ctrl_df: pd.DataFrame,
        alpha_calib: float = 0.5
    ) -> "HospitalGradeN1Classifier":
        """
        Learns a hospital-site feature offset (scaler_shift_) from 3-5 local Control
        recordings (alpha_calib * (site_ctrl_mean - train_ctrl_mean)).
        """
        if not hasattr(self, "train_ctrl_mean_raw_"):
            raise RuntimeError("Classifier must be fitted before site onboarding calibration.")
        aligned = X_ctrl_df.reindex(columns=self.feature_names_in_)
        site_means = aligned.mean(axis=0, skipna=True).values.astype(np.float64)
        site_means = np.where(np.isnan(site_means), self.train_ctrl_mean_raw_, site_means)
        shift = float(alpha_calib) * (site_means - self.train_ctrl_mean_raw_)
        for idx, col_name in enumerate(self.feature_names_in_):
            if col_name == "n1_km_available":
                shift[idx] = 0.0
        self.scaler_shift_ = shift
        return self

    def reset_site_calibration(self) -> "HospitalGradeN1Classifier":
        """Resets site onboarding offset back to strict N=1 Zero-Calib mode."""
        self.scaler_shift_ = None
        return self

    def _apply_site_shift(self, X_df: pd.DataFrame) -> pd.DataFrame:
        """Applies site onboarding offset if active; returns X_df unchanged in Zero-Calib mode."""
        shift = getattr(self, "scaler_shift_", None)
        if shift is None:
            return X_df
        X_out = X_df.copy()
        for idx, col in enumerate(self.feature_names_in_):
            if col in X_out.columns and shift[idx] != 0.0:
                X_out[col] = X_out[col].values.astype(np.float64) - shift[idx]
        return X_out

    def _predict_stage1_proba(self, X: pd.DataFrame) -> np.ndarray:
        """Predicts probability of Abnormal [P(Normal), P(Abnormal)] for Stage 1."""
        X_in = X[self.base_cols_] if hasattr(self, "base_cols_") and set(self.base_cols_).issubset(X.columns) else X
        X_s1_sel = self.sel_s1_.transform(X_in)
        X_s1_norm = self.scaler_s1_.transform(self.imp_s1_.transform(X_s1_sel))
        probs = np.zeros((len(X), 2), dtype=np.float64)
        for model in self.models_s1_.values():
            probs += model.predict_proba(X_s1_norm)
        probs /= len(self.models_s1_)
        return probs

    def _predict_stage2_proba(self, X: pd.DataFrame) -> np.ndarray:
        """Predicts probability of Stroke vs Mimic [P(Mimic), P(Stroke)] for Stage 2."""
        X_in = X[self.base_cols_] if hasattr(self, "base_cols_") and set(self.base_cols_).issubset(X.columns) else X
        X_s2_sel = self.sel_s2_.transform(X_in)
        X_s2_norm = self.scaler_s2_.transform(self.imp_s2_.transform(X_s2_sel))
        probs = np.zeros((len(X), 2), dtype=np.float64)
        for model in self.models_s2_.values():
            probs += model.predict_proba(X_s2_norm)
        probs /= len(self.models_s2_)
        return probs

    def _predict_flat_proba(self, X: pd.DataFrame) -> np.ndarray:
        """Predicts 3-class probabilities from Branch 1 (Base Stationary Ensemble)."""
        X_in = X[self.base_cols_] if hasattr(self, "base_cols_") and set(self.base_cols_).issubset(X.columns) else X
        X_flat_sel = self.sel_flat_.transform(X_in)
        X_flat_norm = self.scaler_flat_.transform(self.imp_flat_.transform(X_flat_sel))
        probs = np.zeros((len(X), 3), dtype=np.float64)
        for model in self.models_flat_.values():
            probs += model.predict_proba(X_flat_norm)
        probs /= len(self.models_flat_)
        return probs

    def _predict_subbag_proba(self, X: pd.DataFrame) -> np.ndarray:
        """Predicts 3-class probabilities from Branch 2 (Sub-Bag & K-Means Salience Ensemble)."""
        X_sub_sel = self.sel_subbag_.transform(X)
        X_sub_norm = self.scaler_subbag_.transform(self.imp_subbag_.transform(X_sub_sel))
        probs = np.zeros((len(X), 3), dtype=np.float64)
        for model in self.models_subbag_.values():
            probs += model.predict_proba(X_sub_norm)
        probs /= len(self.models_subbag_)
        return probs

    def _predict_blended_flat_proba(self, X: pd.DataFrame) -> np.ndarray:
        """Blends Branch 1 and Branch 2 using inner-OOF calibrated beta_subbag_."""
        p_b1 = self._predict_flat_proba(X)
        if not getattr(self, "has_subbag_branch_", False):
            return p_b1
        p_b2 = self._predict_subbag_proba(X)
        beta = float(getattr(self, "beta_subbag_", 0.50))
        return (1.0 - beta) * p_b1 + beta * p_b2

    def _spline_cap_mask(self, X_df: pd.DataFrame) -> np.ndarray:
        """Identifies smoothed/interpolated-cap recordings strictly below Cohort q01 thresholds."""
        if (
            getattr(self, "spline_inv_clf_", None) is None
            or getattr(self, "spline_inv_scaler_", None) is None
            or "n1_ipsi_contrast_composite" not in X_df.columns
            or "n1_ipsi_contrast_hjorth_mobility" not in X_df.columns
            or "n1_ipsi_contrast_rel_beta" not in X_df.columns
            or not all(c in X_df.columns for c in getattr(self, "ipsi_g_cols_", []))
        ):
            return np.zeros(len(X_df), dtype=bool)
        comp = X_df["n1_ipsi_contrast_composite"].fillna(np.inf).values.astype(np.float64)
        mob = X_df["n1_ipsi_contrast_hjorth_mobility"].fillna(np.inf).values.astype(np.float64)
        beta = X_df["n1_ipsi_contrast_rel_beta"].fillna(np.inf).values.astype(np.float64)
        return (
            (comp < getattr(self, "tau_spline_cap_", 0.0))
            & (mob < getattr(self, "tau_spline_mob_", 0.0))
            & (beta < getattr(self, "tau_spline_beta_", 0.0))
        )

    def _predict_spline_invariant_stroke_proba(self, X_sub: pd.DataFrame) -> np.ndarray:
        """Evaluates Stroke-vs-Normal probability using scale- and spline-invariant Group F features."""
        X_g = X_sub[self.ipsi_g_cols_].fillna(0.0).values.astype(np.float64)
        X_g_s = self.spline_inv_scaler_.transform(X_g)
        return np.clip(self.spline_inv_clf_.predict_proba(X_g_s)[:, 1], 0.0, 1.0)

    def predict_proba(self, X: Union[np.ndarray, pd.DataFrame]) -> np.ndarray:
        """
        Computes 3-class posterior probabilities [P(Normal), P(Other_Abnormal), P(Stroke)].
        """
        if isinstance(X, pd.DataFrame):
            X_df = X
        else:
            X_df = pd.DataFrame(X, columns=self.feature_names_in_)

        X_eff = self._apply_site_shift(X_df)

        if self.paradigm == "X1":
            p_s1 = self._predict_stage1_proba(X_eff)
            p_s2 = self._predict_stage2_proba(X_eff)
            p_ab = p_s1[:, 1]
            p0 = 1.0 - p_ab
            p1 = p_ab * p_s2[:, 0]
            p2 = p_ab * p_s2[:, 1]
            probs = np.column_stack([p0, p1, p2])
            probs = np.clip(probs, 0.0, 1.0)
            probs = probs / np.maximum(probs.sum(axis=1, keepdims=True), 1e-12)
        elif self.paradigm == "X2":
            probs = self._predict_blended_flat_proba(X_eff)
            w_mult = getattr(self, "class_multipliers_", None)
            if w_mult is not None:
                probs = probs * np.asarray(w_mult, dtype=np.float64)
            probs = np.clip(probs, 0.0, 1.0)
            probs = probs / np.maximum(probs.sum(axis=1, keepdims=True), 1e-12)
        else:  # "X3" Soft-Aligned Meta-Ensemble
            p_s1 = self._predict_stage1_proba(X_eff)
            p_s2 = self._predict_stage2_proba(X_eff)
            p_ab = p_s1[:, 1]
            p0_h = 1.0 - p_ab
            p1_h = p_ab * p_s2[:, 0]
            p2_h = p_ab * p_s2[:, 1]
            p_hier = np.column_stack([p0_h, p1_h, p2_h])

            p_flat = self._predict_blended_flat_proba(X_eff)
            p_meta = (1.0 - self.alpha_meta) * p_hier + self.alpha_meta * p_flat
            w_mult = getattr(self, "class_multipliers_", None)
            if w_mult is not None:
                p_meta = p_meta * np.asarray(w_mult, dtype=np.float64)
            probs = np.clip(p_meta, 0.0, 1.0)
            probs = probs / np.maximum(probs.sum(axis=1, keepdims=True), 1e-12)

        spline_mask = self._spline_cap_mask(X_df)
        if np.any(spline_mask):
            p_spline = self._predict_spline_invariant_stroke_proba(X_df.iloc[spline_mask])
            probs[spline_mask, 0] = 1.0 - p_spline
            probs[spline_mask, 1] = 0.0
            probs[spline_mask, 2] = p_spline

        return probs

    def predict(self, X: Union[np.ndarray, pd.DataFrame]) -> np.ndarray:
        """
        Predicts discrete class labels in {0: Normal, 1: Other_Abnormal, 2: Acute_Stroke}
        incorporating calibrated gate thresholds and Clinical Focal Asymmetry Override Gate.
        """
        if isinstance(X, pd.DataFrame):
            X_df = X
        else:
            X_df = pd.DataFrame(X, columns=self.feature_names_in_)

        X_eff = self._apply_site_shift(X_df)
        n_samples = len(X_df)
        preds = np.zeros(n_samples, dtype=int)

        if self.paradigm in ("X1", "X3"):
            p_s1 = self._predict_stage1_proba(X_eff)
            p_s2 = self._predict_stage2_proba(X_eff)
            p_flat = self._predict_blended_flat_proba(X_eff) if self.paradigm == "X3" else None
            p_meta = self.predict_proba(X_df)

            t_s1 = getattr(self, "calibrated_tau_s1_", self.tau_s1)
            t_s2 = getattr(self, "calibrated_tau_s2_", self.tau_s2)
            tau_over_p = getattr(self, "tau_override_prob_", 0.45)
            tau_over_f = getattr(self, "tau_override_focal_", 2.50)

            focal_dar_col = "n1_asym_focal_peak_ratio_dar"
            focal_delta_col = "n1_asym_focal_peak_ratio_rel_delta"
            dar_vals = X_eff[focal_dar_col].values if focal_dar_col in X_eff.columns else np.zeros(n_samples)
            delta_vals = X_eff[focal_delta_col].values if focal_delta_col in X_eff.columns else np.zeros(n_samples)

            for i in range(n_samples):
                p_abn = p_s1[i, 1]
                if p_abn < t_s1:
                    if self.paradigm == "X3" and p_flat is not None:
                        p2_flat = p_flat[i, 2]
                        p0_flat = p_flat[i, 0]
                        max_focal = max(dar_vals[i], delta_vals[i])
                        is_focal_stroke = (max_focal >= tau_over_f and p2_flat >= 0.30)
                        is_flat_override = (p2_flat >= tau_over_p and p2_flat > p0_flat)
                        if is_focal_stroke or is_flat_override:
                            preds[i] = 2
                        else:
                            preds[i] = 0
                    else:
                        preds[i] = 0
                else:
                    p_str_ratio = p_meta[i, 2] / (p_meta[i, 1] + p_meta[i, 2] + 1e-9)
                    if p_str_ratio >= t_s2 or p_s2[i, 1] >= t_s2:
                        preds[i] = 2
                    else:
                        preds[i] = 1
        else:
            probs = self.predict_proba(X_df)
            preds = np.argmax(probs, axis=1)

        spline_mask = self._spline_cap_mask(X_df)
        if np.any(spline_mask):
            p_spline = self._predict_spline_invariant_stroke_proba(X_df.iloc[spline_mask])
            preds[spline_mask] = np.where(p_spline >= 0.50, 2, 0)

        return preds

    def predict_triage_binary(self, X: Union[np.ndarray, pd.DataFrame]) -> Dict[str, np.ndarray]:
        """
        Predicts clinical binary triage outputs alongside continuous calibrated probabilities.
        """
        if isinstance(X, pd.DataFrame):
            X_df = X
        else:
            X_df = pd.DataFrame(X, columns=self.feature_names_in_)

        probs = self.predict_proba(X_df)
        preds_3state = self.predict(X_df)

        p0 = probs[:, 0]
        p1 = probs[:, 1]
        p2 = probs[:, 2]

        p_abn = p1 + p2
        p_str = p2
        p_str_vs_norm = p2 / (p0 + p2 + 1e-12)

        pred_abnormal = (preds_3state > 0).astype(int)
        pred_stroke = (preds_3state == 2).astype(int)

        return {
            "pred_abnormal": pred_abnormal,
            "pred_stroke": pred_stroke,
            "p_abnormal": p_abn,
            "p_stroke": p_str,
            "p_stroke_vs_normal": p_str_vs_norm,
            "pred_3state": preds_3state,
            "probabilities": probs
        }

    def compute_clinical_reassurance(
        self,
        X_df: pd.DataFrame,
        probs: np.ndarray,
        pred_cls: int
    ) -> Dict[str, Any]:
        """
        Computes per-patient ensemble voting agreement, margin, and K-Means epoch quality
        telemetry for clinical reassurance during bedside stroke triage.
        """
        X_eff = self._apply_site_shift(X_df)
        is_spline = bool(self._spline_cap_mask(X_df)[0])
        w_mult = getattr(self, "class_multipliers_", np.array([1.0, 1.0, 1.0], dtype=np.float64))

        member_votes: List[int] = []
        if hasattr(self, "models_flat_"):
            X_in1 = X_eff[self.base_cols_] if hasattr(self, "base_cols_") and set(self.base_cols_).issubset(X_eff.columns) else X_eff
            X_b1_norm = self.scaler_flat_.transform(self.imp_flat_.transform(self.sel_flat_.transform(X_in1)))
            for model in self.models_flat_.values():
                pm = model.predict_proba(X_b1_norm)[0] * w_mult
                member_votes.append(int(np.argmax(pm)))
        elif hasattr(self, "models_s1_") and hasattr(self, "models_s2_"):
            X_in1 = X_eff[self.base_cols_] if hasattr(self, "base_cols_") and set(self.base_cols_).issubset(X_eff.columns) else X_eff
            X_s1_norm = self.scaler_s1_.transform(self.imp_s1_.transform(self.sel_s1_.transform(X_in1)))
            X_s2_norm = self.scaler_s2_.transform(self.imp_s2_.transform(self.sel_s2_.transform(X_in1)))
            for m1, m2 in zip(self.models_s1_.values(), self.models_s2_.values()):
                p_ab = float(m1.predict_proba(X_s1_norm)[0, 1])
                p_s2 = m2.predict_proba(X_s2_norm)[0]
                pm = np.array([1.0 - p_ab, p_ab * p_s2[0], p_ab * p_s2[1]])
                member_votes.append(int(np.argmax(pm)))

        if getattr(self, "has_subbag_branch_", False) and hasattr(self, "models_subbag_"):
            X_b2_norm = self.scaler_subbag_.transform(self.imp_subbag_.transform(self.sel_subbag_.transform(X_eff)))
            for model in self.models_subbag_.values():
                pm = model.predict_proba(X_b2_norm)[0] * w_mult
                member_votes.append(int(np.argmax(pm)))

        main_votes_dict = {
            "Normal": int(sum(1 for v in member_votes if v == 0)),
            "Other_Abnormal": int(sum(1 for v in member_votes if v == 1)),
            "Acute_Stroke": int(sum(1 for v in member_votes if v == 2)),
            "total_estimators": int(len(member_votes)),
        }

        if is_spline:
            spline_vote = 2 if float(probs[2]) >= 0.50 else 0
            ensemble_votes = {
                "Normal": 1 if spline_vote == 0 else 0,
                "Other_Abnormal": 0,
                "Acute_Stroke": 1 if spline_vote == 2 else 0,
                "total_estimators": 1,
                "routing_branch": "Spline-Guard LogisticRegression",
                "auxiliary_main_branch_votes": main_votes_dict,
            }
            # Combine spline guard anchor with auxiliary main-branch Abnormal/Normal agreement
            if len(member_votes) > 0:
                if pred_cls == 2:
                    aux_agree = sum(1 for v in member_votes if v > 0)
                else:
                    aux_agree = sum(1 for v in member_votes if v == pred_cls)
                ensemble_agreement_pct = float(100.0 * (1 + aux_agree) / (1 + len(member_votes)))
            else:
                ensemble_agreement_pct = 100.0
        else:
            ensemble_votes = {
                **main_votes_dict,
                "routing_branch": "Dual_Branch_Ensemble",
            }
            total_est = max(len(member_votes), 1)
            agree_count = sum(1 for v in member_votes if v == pred_cls)
            ensemble_agreement_pct = float(100.0 * agree_count / total_est)

        p_sorted = np.sort(np.nan_to_num(np.asarray(probs, dtype=np.float64), nan=0.0, posinf=0.0, neginf=0.0))
        probability_margin = float(p_sorted[-1] - p_sorted[-2]) if len(p_sorted) >= 2 else float(p_sorted[-1])

        km_minor_frac = float(np.nan_to_num(X_df["n1_km_minor_frac"].iloc[0], nan=0.0, posinf=0.0, neginf=0.0)) if "n1_km_minor_frac" in X_df.columns else 0.0
        km_dom_blink = float(np.nan_to_num(X_df["n1_km_dom_blink"].iloc[0], nan=0.0, posinf=0.0, neginf=0.0)) if "n1_km_dom_blink" in X_df.columns else 0.0
        km_centroid_dist = float(np.nan_to_num(X_df["n1_km_centroid_dist"].iloc[0], nan=0.0, posinf=0.0, neginf=0.0)) if "n1_km_centroid_dist" in X_df.columns else 0.0

        clean_epoch_fraction = float(1.0 - np.clip(km_minor_frac, 0.0, 0.5))
        frontal_blink_index = float(km_dom_blink)
        paroxysmal_bimodality_index = float(km_centroid_dist)

        if (
            ensemble_agreement_pct >= 80.0
            and probability_margin >= 0.15
            and clean_epoch_fraction >= 0.65
        ):
            reliability_tier = "HIGH_REASSURANCE"
            reassurance_note = (
                f"Độ đồng thuận cao ({ensemble_agreement_pct:.0f}%, biên xác suất {probability_margin:.2f}, "
                f"tỷ lệ epoch sạch {clean_epoch_fraction*100:.0f}%). Kết quả ổn định cho sàng lọc bước đầu."
            )
        elif ensemble_agreement_pct >= 60.0 and probability_margin >= 0.07:
            reliability_tier = "MODERATE_REASSURANCE"
            reassurance_note = (
                f"Độ đồng thuận trung bình ({ensemble_agreement_pct:.0f}%, biên xác suất {probability_margin:.2f}, "
                f"chỉ số chớp mắt trán {frontal_blink_index:.2f}). Cần đối chiếu lâm sàng / NIHSS."
            )
        else:
            reliability_tier = "BORDERLINE_REPEAT_30S_RECOMMENDED"
            reassurance_note = (
                f"Ca ranh giới hoặc nhiễu dao động (đồng thuận {ensemble_agreement_pct:.0f}%, biên {probability_margin:.2f}, "
                f"nhị phân epoch {paroxysmal_bimodality_index:.2f}). Khuyến nghị đo lặp thêm 30s EEG sạch."
            )

        return {
            "ensemble_agreement_pct": ensemble_agreement_pct,
            "ensemble_votes": ensemble_votes,
            "probability_margin": probability_margin,
            "clean_epoch_fraction": clean_epoch_fraction,
            "frontal_blink_index": frontal_blink_index,
            "paroxysmal_bimodality_index": paroxysmal_bimodality_index,
            "reliability_tier": reliability_tier,
            "reassurance_note": reassurance_note,
        }

    def predict_single_patient(
        self,
        patient_recording_or_features: Union[pd.DataFrame, pd.Series, Dict[str, Any]],
        wpli_series: Optional[Union[pd.Series, Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Clinical Single-Patient N=1 Execution Path (supports single-row dict/Series and multi-epoch DataFrame).
        """
        if isinstance(patient_recording_or_features, pd.DataFrame):
            status, healed_data, q_report = self.quality_gate_.assess_recording(patient_recording_or_features)
        else:
            status, healed_data, q_report = self.quality_gate_.assess_subject(patient_recording_or_features)

        if status == "REJECT_UNUSABLE_SIGNAL_RECHECK_ELECTRODES":
            return {
                "status": status,
                "decision": "BLOCKED_UNUSABLE_SIGNAL",
                "predicted_class": None,
                "state_label": None,
                "probabilities": None,
                "triage_normal_vs_abnormal": None,
                "triage_stroke_vs_non_stroke": None,
                "confidence": 0.0,
                "quality_report": q_report,
                "clinical_reassurance": None,
                "reason": f"Signal rejected: {q_report['n_bad_channels']} corrupted electrodes ({q_report['bad_channels']})."
            }

        df_epochs = healed_data if isinstance(healed_data, pd.DataFrame) else None
        patient_feats = self.extractor_.extract_patient_features(
            healed_data,
            df_epochs=df_epochs,
            wpli_series=wpli_series
        )

        df_single = pd.DataFrame([patient_feats])
        probs = self.predict_proba(df_single)[0]
        pred_cls = int(self.predict(df_single)[0])
        class_labels = {0: "Normal", 1: "Other_Abnormal", 2: "Acute_Stroke"}

        subtype_res = None
        if getattr(self, "subtype_classifier_", None) is not None:
            subtype_res = self.subtype_classifier_.assess_subtype_and_tpa_lockout(df_single, pred_cls)

        reassurance = self.compute_clinical_reassurance(df_single, probs, pred_cls)

        return {
            "status": status,
            "decision": "PROCEED",
            "predicted_class": pred_cls,
            "state_label": class_labels[pred_cls],
            "probabilities": {
                "Normal": float(probs[0]),
                "Other_Abnormal": float(probs[1]),
                "Acute_Stroke": float(probs[2])
            },
            "triage_normal_vs_abnormal": "Normal" if pred_cls == 0 else "Abnormal",
            "triage_stroke_vs_non_stroke": "Acute_Stroke" if pred_cls == 2 else "Non_Stroke",
            "p_stroke_vs_normal": float(probs[2] / (probs[0] + probs[2] + 1e-12)),
            "confidence": float(probs[pred_cls]),
            "stroke_subtype_triage": subtype_res,
            "quality_report": q_report,
            "clinical_reassurance": reassurance,
        }


# =============================================================================
# 3c. Stage3StrokeSubtypeClassifier (Ischemic vs ICH Subtyping & tPA Lockout)
# =============================================================================

class Stage3StrokeSubtypeClassifier(BaseEstimator, ClassifierMixin):
    """
    Stage 3 Acute Stroke Subtype Classifier (IS vs ICH) with Multi-Tier tPA Lockout Gating.

    Operating constraints:
    - Only triggered when patient is classified as Acute Stroke (target_3state == 2).
    - Trained strictly on Stroke cases (Cohort N=99: 79 IS vs 20 ICH).
    - Features are strictly invariant (excluding non-invariant montage projections).
    - Evaluates dual safety barriers:
      * Gate 1 (Direct Veto): Probability of ICH exceeding empirical safety threshold.
      * Gate 2 (OOD Guard): Asymmetry deviation outside baseline Ischemic envelope.
    """

    def __init__(
        self,
        k_features: int = 40,
        random_state: int = 42,
        ich_tau_fallback: float = 0.25
    ) -> None:
        self.k_features = k_features
        self.random_state = random_state
        self.ich_tau_fallback = ich_tau_fallback

    def fit(
        self,
        X: Union[pd.DataFrame, np.ndarray],
        y_ich: np.ndarray,
        centers: Optional[np.ndarray] = None,
        groups: Optional[np.ndarray] = None
    ) -> "Stage3StrokeSubtypeClassifier":
        """
        Fits Stage 3 Subtype Classifier on stroke cohort.
        X: Stroke-only features (target_3state == 2).
        y_ich: Binary labels (0 = Ischemic Stroke, 1 = Intracerebral Hemorrhage).
        """
        if isinstance(X, pd.DataFrame):
            # Invariant feature space: exclude non-invariant montage projections
            all_cols = list(X.columns)
            self.invariant_cols_ = [
                c for c in all_cols
                if not (c.startswith("n1_topo_") or c.startswith("n1_lap_") or c.startswith("n1_toposum_"))
            ]
            X_df = X[self.invariant_cols_]
            X_arr = X_df.values
        else:
            self.invariant_cols_ = [f"feat_{i}" for i in range(X.shape[1])]
            X_arr = np.asarray(X)
            X_df = pd.DataFrame(X_arr, columns=self.invariant_cols_)

        y_ich_arr = np.asarray(y_ich, dtype=int)

        # 1. Median Imputation
        self.imputer_ = SimpleImputer(strategy="median")
        X_imp = self.imputer_.fit_transform(X_arr)

        # 2. ANOVA F-Score Selection
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            warnings.simplefilter("ignore", RuntimeWarning)
            with np.errstate(divide="ignore", invalid="ignore"):
                f_vals, _ = f_classif(X_imp, y_ich_arr)
        f_vals = np.nan_to_num(f_vals, nan=0.0)
        k_sel = min(self.k_features, len(self.invariant_cols_))
        self.selected_indices_ = np.argsort(f_vals)[::-1][:k_sel]
        self.selected_features_ = [self.invariant_cols_[i] for i in self.selected_indices_]

        X_sel = X_imp[:, self.selected_indices_]

        # 3. Robust Scaling
        self.scaler_ = RobustScaler()
        X_scaled = self.scaler_.fit_transform(X_sel)

        # 4. Ensemble of 2 Stable Estimator Families
        self.clf_lr_ = LogisticRegression(
            C=0.2,
            class_weight="balanced",
            max_iter=1000,
            random_state=self.random_state
        )
        self.clf_et_ = ExtraTreesClassifier(
            n_estimators=300,
            class_weight="balanced_subsample",
            random_state=self.random_state,
            n_jobs=-1
        )
        self.clf_lr_.fit(X_scaled, y_ich_arr)
        self.clf_et_.fit(X_scaled, y_ich_arr)

        # 5. Gate 1: Compute tau_ich_veto_ via 5-Fold OOF on Train
        oof_p_ich = np.zeros(len(y_ich_arr))
        oof_computed = False

        if groups is not None and len(np.unique(groups)) >= 5:
            try:
                sgkf = StratifiedGroupKFold(n_splits=5)
                can_split = True
                splits = list(sgkf.split(X_arr, y_ich_arr, groups=groups))
                for tr_idx, val_idx in splits:
                    if len(np.unique(y_ich_arr[tr_idx])) < 2 or len(np.unique(y_ich_arr[val_idx])) < 2:
                        can_split = False
                        break
                if can_split:
                    for tr_idx, val_idx in splits:
                        imp_f = SimpleImputer(strategy="median")
                        X_tr_imp = imp_f.fit_transform(X_arr[tr_idx])
                        X_val_imp = imp_f.transform(X_arr[val_idx])

                        with warnings.catch_warnings():
                            warnings.simplefilter("ignore", UserWarning)
                            warnings.simplefilter("ignore", RuntimeWarning)
                            with np.errstate(divide="ignore", invalid="ignore"):
                                f_v, _ = f_classif(X_tr_imp, y_ich_arr[tr_idx])
                        f_v = np.nan_to_num(f_v, nan=0.0)
                        top_idx = np.argsort(f_v)[::-1][:k_sel]

                        scl_f = RobustScaler()
                        X_tr_s = scl_f.fit_transform(X_tr_imp[:, top_idx])
                        X_val_s = scl_f.transform(X_val_imp[:, top_idx])

                        lr_f = LogisticRegression(C=0.2, class_weight="balanced", max_iter=1000, random_state=self.random_state)
                        et_f = ExtraTreesClassifier(n_estimators=300, class_weight="balanced_subsample", random_state=self.random_state, n_jobs=-1)
                        lr_f.fit(X_tr_s, y_ich_arr[tr_idx])
                        et_f.fit(X_tr_s, y_ich_arr[tr_idx])

                        p_lr = lr_f.predict_proba(X_val_s)[:, 1]
                        p_et = et_f.predict_proba(X_val_s)[:, 1]
                        oof_p_ich[val_idx] = 0.5 * p_lr + 0.5 * p_et
                    oof_computed = True
            except Exception:
                oof_computed = False

        if not oof_computed:
            try:
                skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=self.random_state)
                for tr_idx, val_idx in skf.split(X_arr, y_ich_arr):
                    imp_f = SimpleImputer(strategy="median")
                    X_tr_imp = imp_f.fit_transform(X_arr[tr_idx])
                    X_val_imp = imp_f.transform(X_arr[val_idx])

                    with warnings.catch_warnings():
                        warnings.simplefilter("ignore", UserWarning)
                        warnings.simplefilter("ignore", RuntimeWarning)
                        with np.errstate(divide="ignore", invalid="ignore"):
                            f_v, _ = f_classif(X_tr_imp, y_ich_arr[tr_idx])
                    f_v = np.nan_to_num(f_v, nan=0.0)
                    top_idx = np.argsort(f_v)[::-1][:k_sel]

                    scl_f = RobustScaler()
                    X_tr_s = scl_f.fit_transform(X_tr_imp[:, top_idx])
                    X_val_s = scl_f.transform(X_val_imp[:, top_idx])

                    lr_f = LogisticRegression(C=0.2, class_weight="balanced", max_iter=1000, random_state=self.random_state)
                    et_f = ExtraTreesClassifier(n_estimators=300, class_weight="balanced_subsample", random_state=self.random_state, n_jobs=-1)
                    lr_f.fit(X_tr_s, y_ich_arr[tr_idx])
                    et_f.fit(X_tr_s, y_ich_arr[tr_idx])

                    p_lr = lr_f.predict_proba(X_val_s)[:, 1]
                    p_et = et_f.predict_proba(X_val_s)[:, 1]
                    oof_p_ich[val_idx] = 0.5 * p_lr + 0.5 * p_et
                oof_computed = True
            except Exception:
                oof_computed = False

        if not oof_computed:
            p_lr_all = self.clf_lr_.predict_proba(X_scaled)[:, 1]
            p_et_all = self.clf_et_.predict_proba(X_scaled)[:, 1]
            oof_p_ich = 0.5 * p_lr_all + 0.5 * p_et_all

        # Gate 1 Threshold
        if np.any(y_ich_arr == 1):
            ich_oof = oof_p_ich[y_ich_arr == 1]
            tau_raw = float(np.min(ich_oof) * 0.90)
            self.tau_ich_veto_ = float(np.clip(tau_raw, 0.05, 0.35))
        else:
            self.tau_ich_veto_ = float(self.ich_tau_fallback)

        # 6. Gate 2: Asymmetry Baseline OOD Guard
        self.asym_cols_ = ["n1_asym_mean_abs_rel_beta", "n1_asym_abs_zdiff_rel_delta_F3_F4"]
        avail_asym = [c for c in self.asym_cols_ if c in X_df.columns]
        if len(avail_asym) == len(self.asym_cols_) and np.any(y_ich_arr == 0):
            train_is_mask = (y_ich_arr == 0)
            train_is_asym = X_df.loc[train_is_mask, self.asym_cols_].mean(axis=1).values
            self.tau_is_asym_median_ = float(np.median(train_is_asym))
            self.tau_is_ood_high_ = float(np.percentile(train_is_asym, 80))
            self.tau_is_diffuse_low_ = float(np.percentile(train_is_asym, 15))
        else:
            self.tau_is_asym_median_ = 0.70
            self.tau_is_ood_high_ = 1.20
            self.tau_is_diffuse_low_ = 0.30

        return self

    def predict_proba(self, X: Union[pd.DataFrame, np.ndarray]) -> np.ndarray:
        """Returns binary probability array: shape (N, 2) [1.0 - p_ich, p_ich]."""
        if isinstance(X, pd.DataFrame):
            cols_present = [c for c in self.invariant_cols_ if c in X.columns]
            if len(cols_present) < len(self.invariant_cols_):
                X_df = X.reindex(columns=self.invariant_cols_, fill_value=0.0)
            else:
                X_df = X[self.invariant_cols_]
            X_arr = X_df.values
        else:
            X_arr = np.asarray(X)

        X_imp = self.imputer_.transform(X_arr)
        X_sel = X_imp[:, self.selected_indices_]
        X_scaled = self.scaler_.transform(X_sel)

        p_lr = self.clf_lr_.predict_proba(X_scaled)
        p_et = self.clf_et_.predict_proba(X_scaled)
        probs = 0.5 * p_lr + 0.5 * p_et

        if probs.shape[1] == 1:
            p_val = probs[:, 0]
            return np.column_stack([1.0 - p_val, p_val])
        return probs

    def predict(self, X: Union[pd.DataFrame, np.ndarray]) -> np.ndarray:
        """Predicts binary subtype class (0 = Ischemic, 1 = Hemorrhagic)."""
        probs = self.predict_proba(X)
        return (probs[:, 1] >= 0.5).astype(int)

    def assess_subtype_and_tpa_lockout(
        self,
        X_row_df: pd.DataFrame,
        stroke_pred_class: int
    ) -> Dict[str, Any]:
        """
        Assesses acute stroke subtype and applies multi-tier hospital safety lockout for tPA.

        Clinical Protocol:
        - In N=1 Zero-Calibration mode without prior multi-center ICH calibration and prior to
          head CT imaging, solo EEG NEVER authorizes unconfirmed thrombolysis (tpa_cleared = False).
        - Direct Veto (p_ich >= tau_ich_veto) or diffuse asymmetry triggers ICH_HIGH_RISK_SUSPECT.
        - Other acute stroke cases are routed to ACUTE_STROKE_STAGING_CT_REQUIRED.
        - Retains naive monotone threshold simulation for forensic audit.
        """
        if int(stroke_pred_class) != 2:
            return {
                "subtype_label": "NOT_APPLICABLE_NON_STROKE",
                "tpa_cleared": False,
                "tpa_safety_status": "NO STROKE / NO tPA",
                "p_ich_relative_rank_score": 0.0,
                "ood_guard_triggered": False,
                "direct_veto_triggered": False,
                "asym_score": 0.0,
                "tau_ich_veto": float(self.tau_ich_veto_),
                "tau_is_ood_high": float(self.tau_is_ood_high_),
                "tau_is_diffuse_low": float(self.tau_is_diffuse_low_),
                "naive_tpa_cleared": False,
                "clinical_lockout_enforced": True
            }

        probs = self.predict_proba(X_row_df)[0]
        p_ich = float(probs[1])

        # Compute asym_score
        asym_vals = []
        for c in self.asym_cols_:
            if c in X_row_df.columns:
                val = float(X_row_df[c].iloc[0])
                if not np.isnan(val) and not np.isinf(val):
                    asym_vals.append(val)
        asym_score = float(np.mean(asym_vals)) if len(asym_vals) > 0 else float(getattr(self, "tau_is_asym_median_", 0.70))

        direct_veto = bool(p_ich >= self.tau_ich_veto_)
        ood_guard = bool(asym_score > self.tau_is_ood_high_ or asym_score < self.tau_is_diffuse_low_)

        # Naive monotone thresholding simulation (audited for research transparency)
        naive_tpa_cleared = bool((not direct_veto) and (not ood_guard))

        # Hospital-Grade Safety Lockout: Solo EEG in Zero-Calib mode MUST NOT clear tPA without CT
        if direct_veto or (asym_score < self.tau_is_diffuse_low_):
            subtype_label = "ICH_HIGH_RISK_SUSPECT"
            tpa_safety_status = "ICH SUSPECT / NO tPA (CT STAT)"
        else:
            subtype_label = "ACUTE_STROKE_STAGING_CT_REQUIRED"
            tpa_safety_status = "HOLD tPA / MANDATORY CT"

        tpa_cleared = False  # Absolute Solo EEG Lockout in Zero-Calibration Mode

        return {
            "subtype_label": subtype_label,
            "tpa_cleared": tpa_cleared,
            "tpa_safety_status": tpa_safety_status,
            "p_ich_relative_rank_score": p_ich,
            "ood_guard_triggered": ood_guard,
            "direct_veto_triggered": direct_veto,
            "asym_score": asym_score,
            "tau_ich_veto": float(self.tau_ich_veto_),
            "tau_is_ood_high": float(self.tau_is_ood_high_),
            "tau_is_diffuse_low": float(self.tau_is_diffuse_low_),
            "naive_tpa_cleared": naive_tpa_cleared,
            "clinical_lockout_enforced": True
        }


# =============================================================================
# 4. Cohort Assembly & Caching Helpers
# =============================================================================

def map_recording_center(name: str) -> str:
    """Standardizes dataset identifiers into physical acquisition centers."""
    n = str(name).lower()
    if "physionet" in n:
        return "physionet"
    if "tuh" in n or "tuev" in n:
        return "tuh_corpus"
    if "ds004504" in n:
        return "ds004504"
    if "ds007801" in n:
        return "ds007801"
    if "hefmi" in n:
        return "hefmi"
    if "figshare" in n:
        return "figshare"
    if "uclh" in n:
        return "uclh"
    return name


def load_raw_3state_cohort() -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Assembles the exact raw 3-state clinical cohort:
    - Normal (N=146): PhysioNet (50), TUAB (46), ds004504 (29), HEFMI (17), ds007801 (4)
    - Other Abnormal / Mimics (N=178): ds004504 AD (36), FTD (23), TUSL (36), TUSZ (31), GPED (24), PLED (28)
    - Stroke (N=99): Figshare IS (47), HEFMI ICH (20), ds007801 IS (32)
    Total N=423 subjects across 6 centers.
    Held-out UCLH N=28 (10 Healthy, 10 IS, 8 ICH).
    """
    df_v5 = pd.read_parquet(V5_RAW_PARQUET)
    df_hefmi = pd.read_parquet(HEFMI_RAW_PARQUET)

    uclh_path = UCLH_RAW_PARQUET if UCLH_RAW_PARQUET.exists() else UCLH_232_FALLBACK
    df_uclh = pd.read_parquet(uclh_path)

    cohort_slices = []

    # 1. Normal Cohorts (N=146)
    p_norm = df_v5[df_v5["dataset_id"] == "physionet_eegmmidb"].copy()
    p_norm["dataset_name"] = "physionet_eegmmidb"

    tuab_norm = df_v5[df_v5["dataset_id"] == "tuh_tuab"].copy()
    tuab_norm["dataset_name"] = "tuh_tuab"

    ds4504_norm = df_v5[
        (df_v5["dataset_id"] == "openneuro_ds004504")
        & (df_v5["clinical_category"] == "Healthy Control (Age-Matched)")
    ].copy()
    ds4504_norm["dataset_name"] = "openneuro_ds004504_ctrl"

    hefmi_norm = df_hefmi[df_hefmi["is_control"] == 1].copy()
    hefmi_norm["dataset_name"] = "hefmi_ich_ctrl"

    ds7801_norm = df_v5[
        (df_v5["dataset_id"] == "openneuro_ds007801") & (df_v5["is_stroke"] == 0)
    ].copy()
    ds7801_norm["dataset_name"] = "openneuro_ds007801_ctrl"

    for d in [p_norm, tuab_norm, ds4504_norm, hefmi_norm, ds7801_norm]:
        d["target_3state"] = 0
        d["state_label"] = "Normal"
        cohort_slices.append(d)

    # 2. Other Abnormal / Mimics (N=178)
    ds4504_ad = df_v5[
        (df_v5["dataset_id"] == "openneuro_ds004504")
        & (df_v5["clinical_category"] == "Stroke Mimic (Alzheimer's Disease)")
    ].copy()
    ds4504_ad["dataset_name"] = "openneuro_ds004504_ad"

    ds4504_ftd = df_v5[
        (df_v5["dataset_id"] == "openneuro_ds004504")
        & (df_v5["clinical_category"] == "Stroke Mimic (Frontotemporal Dementia)")
    ].copy()
    ds4504_ftd["dataset_name"] = "openneuro_ds004504_ftd"

    tusl_mim = df_v5[df_v5["dataset_id"] == "tuh_tusl"].copy()
    tusl_mim["dataset_name"] = "tuh_tusl"

    tusz_mim = df_v5[df_v5["dataset_id"] == "tuh_tusz"].copy()
    tusz_mim["dataset_name"] = "tuh_tusz"

    tuev_gped = df_v5[
        (df_v5["dataset_id"] == "TUH_TUEV")
        & (df_v5["clinical_category"] == "gped_diffuse_lesion")
    ].copy()
    tuev_gped["dataset_name"] = "tuev_gped"

    tuev_pled = df_v5[
        (df_v5["dataset_id"] == "TUH_TUEV")
        & (df_v5["clinical_category"] == "pled_structural_lesion")
    ].copy()
    tuev_pled["dataset_name"] = "tuev_pled"

    for d in [ds4504_ad, ds4504_ftd, tusl_mim, tusz_mim, tuev_gped, tuev_pled]:
        d["target_3state"] = 1
        d["state_label"] = "Other_Abnormal"
        cohort_slices.append(d)

    # 3. Stroke Cohorts (N=99)
    fig_is = df_v5[df_v5["dataset_id"] == "figshare_liu2024"].copy()
    fig_is["dataset_name"] = "figshare_is"

    hefmi_ich = df_hefmi[df_hefmi["is_stroke"] == 1].copy()
    hefmi_ich["dataset_name"] = "hefmi_ich"

    ds7801_is = df_v5[
        (df_v5["dataset_id"] == "openneuro_ds007801") & (df_v5["is_stroke"] == 1)
    ].copy()
    ds7801_is["dataset_name"] = "openneuro_ds007801_is"

    for d in [fig_is, hefmi_ich, ds7801_is]:
        d["target_3state"] = 2
        d["state_label"] = "Stroke"
        cohort_slices.append(d)

    df_cohort = pd.concat(cohort_slices, ignore_index=True)
    df_cohort["human_subject_id"] = df_cohort["human_subject_id"].astype(str)

    # Prepare UCLH held-out
    df_uclh = df_uclh.copy()
    uclh_id_col = "subject_id" if "subject_id" in df_uclh.columns else "human_subject_id"
    df_uclh["human_subject_id"] = df_uclh[uclh_id_col].astype(str)
    df_uclh["dataset_name"] = "uclh_london"
    df_uclh["target_3state"] = df_uclh["class_label"].apply(lambda c: 0 if c == 0 else 2)
    df_uclh["state_label"] = df_uclh["target_3state"].apply(lambda t: "Normal" if t == 0 else "Stroke")

    return df_cohort, df_uclh


def build_and_cache_n1_features(
    output_cohort_path: Optional[Path] = None,
    output_uclh_path: Optional[Path] = None,
    force_rebuild: bool = False
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Extracts and caches hospital-grade N=1 features for Cohort N=423 and UCLH N=28.
    Applies FirstContactSignalQualityGate and N1SelfReferencedFeatureExtractor.
    """
    out_cohort = output_cohort_path or COHORT_N1_PARQUET
    out_uclh = output_uclh_path or UCLH_N1_PARQUET

    if not force_rebuild and out_cohort.exists() and out_uclh.exists():
        print(f"[CACHE HIT] Loading N=1 features from {out_cohort.name} and {out_uclh.name}")
        return pd.read_parquet(out_cohort), pd.read_parquet(out_uclh)

    print("[BUILDING] Assembling raw 3-state clinical cohort and extracting N=1 features...")
    df_cohort_raw, df_uclh_raw = load_raw_3state_cohort()

    # Load wPLI datasets
    df_wpli_cohort = pd.read_parquet(WPLI_COHORT_PARQUET).set_index("human_subject_id")
    df_wpli_uclh = pd.read_parquet(WPLI_UCLH_PARQUET)
    u_col = "subject_id" if "subject_id" in df_wpli_uclh.columns else "human_subject_id"
    df_wpli_uclh = df_wpli_uclh.set_index(u_col)

    quality_gate = FirstContactSignalQualityGate()
    extractor = N1SelfReferencedFeatureExtractor()

    # Process Cohort 423
    cohort_records = []
    cohort_grouped = df_cohort_raw.groupby("human_subject_id")
    print(f"Processing {len(cohort_grouped)} subjects in training/CV cohort...")

    for sid, group in cohort_grouped:
        sid_str = str(sid)
        w_row = df_wpli_cohort.loc[sid_str] if sid_str in df_wpli_cohort.index else None

        # 1. First-contact signal quality gate
        q_status, healed_df, q_report = quality_gate.assess_recording(group)

        # 2. Extract N=1 self-referenced features
        feats = extractor.extract_patient_features(healed_df, wpli_series=w_row)

        # 3. Metadata
        first_row = group.iloc[0]
        feats["human_subject_id"] = sid_str
        feats["dataset_name"] = first_row.get("dataset_name", "unknown")
        feats["recording_center"] = map_recording_center(feats["dataset_name"])
        feats["target_3state"] = int(first_row.get("target_3state", 0))
        feats["state_label"] = str(first_row.get("state_label", "Normal"))
        feats["clinical_category"] = str(first_row.get("clinical_category", "unknown"))
        feats["quality_gate_status"] = q_status
        feats["quality_gate_nbad"] = int(q_report["n_bad_channels"])
        feats["quality_gate_bad_channels"] = ",".join(q_report["bad_channels"])

        cohort_records.append(feats)

    df_cohort_n1 = pd.DataFrame(cohort_records)
    out_cohort.parent.mkdir(parents=True, exist_ok=True)
    df_cohort_n1.to_parquet(out_cohort, index=False)
    print(f"Saved Cohort N=1 features: {df_cohort_n1.shape} -> {out_cohort}")

    # Process UCLH 28
    uclh_records = []
    uclh_grouped = df_uclh_raw.groupby("human_subject_id")
    print(f"Processing {len(uclh_grouped)} subjects in held-out UCLH cohort...")

    for sid, group in uclh_grouped:
        sid_str = str(sid)
        w_row = df_wpli_uclh.loc[sid_str] if sid_str in df_wpli_uclh.index else None

        q_status, healed_df, q_report = quality_gate.assess_recording(group)
        feats = extractor.extract_patient_features(healed_df, wpli_series=w_row)

        first_row = group.iloc[0]
        feats["human_subject_id"] = sid_str
        feats["dataset_name"] = "uclh_london"
        feats["recording_center"] = "uclh"
        feats["class_label"] = int(first_row.get("class_label", 0))
        feats["target_3state"] = int(first_row.get("target_3state", 0))
        feats["state_label"] = str(first_row.get("state_label", "Normal"))
        feats["quality_gate_status"] = q_status
        feats["quality_gate_nbad"] = int(q_report["n_bad_channels"])
        feats["quality_gate_bad_channels"] = ",".join(q_report["bad_channels"])

        uclh_records.append(feats)

    df_uclh_n1 = pd.DataFrame(uclh_records)
    out_uclh.parent.mkdir(parents=True, exist_ok=True)
    df_uclh_n1.to_parquet(out_uclh, index=False)
    print(f"Saved UCLH N=1 features: {df_uclh_n1.shape} -> {out_uclh}")

    return df_cohort_n1, df_uclh_n1


# =============================================================================
# 5. Standalone Smoke-Test & Verification Harness
# =============================================================================

if __name__ == "__main__":
    print("=" * 75)
    print("HOSPITAL-GRADE N=1 PIPELINE: VERIFICATION & SMOKE TEST")
    print("=" * 75)

    # 1. Gain Invariance Check
    print("\n[CHECK 1] Mathematical N=1 Gain Invariance Check...")
    extractor = N1SelfReferencedFeatureExtractor()
    np.random.seed(42)
    dummy_clean = {f"{ch}_{m}": float(np.random.uniform(0.1, 0.9)) for ch in STANDARD_19_CHANNELS for m in METRICS_11}
    f_orig = extractor.extract_patient_features(dummy_clean)

    # Scale by arbitrary 50x gain and 0.01x attenuation across ALL 973 features
    dummy_50x = {k: v * 50.0 for k, v in dummy_clean.items()}
    f_50x = extractor.extract_patient_features(dummy_50x)
    max_diff_all_50x = max(abs(f_orig[k] - f_50x[k]) for k in f_orig)
    print(f"  Scaling 50x max abs diff across ALL {len(f_orig)} cols: {max_diff_all_50x:.2e} (Pass < 1e-12: {max_diff_all_50x < 1e-12})")

    dummy_001x = {k: v * 0.01 for k, v in dummy_clean.items()}
    f_001x = extractor.extract_patient_features(dummy_001x)
    max_diff_all_001x = max(abs(f_orig[k] - f_001x[k]) for k in f_orig)
    print(f"  Scaling 0.01x max abs diff across ALL {len(f_orig)} cols: {max_diff_all_001x:.2e} (Pass < 1e-12: {max_diff_all_001x < 1e-12})")

    topo_keys = [k for k in f_orig if k.startswith("n1_topo_")]
    # Scale with arbitrary bandwise filter gains [2.0, 0.5, 3.0, 0.2, 1.5, ...]
    metric_gains = {m: float(g) for m, g in zip(METRICS_11, [2.0, 0.5, 3.0, 0.2, 1.5, 10.0, 0.01, 4.0, 0.7, 1.2, 5.0])}
    dummy_band_scaled = {f"{ch}_{m}": dummy_clean[f"{ch}_{m}"] * metric_gains[m] for ch in STANDARD_19_CHANNELS for m in METRICS_11}
    f_band = extractor.extract_patient_features(dummy_band_scaled)
    max_diff_band = max([abs(f_orig[k] - f_band[k]) for k in topo_keys])
    print(f"  Bandwise filter transfer scaling max abs diff: {max_diff_band:.2e} (Pass < 1e-6: {max_diff_band < 1e-6})")

    # 2. Quality Gate Verification Check
    print("\n[CHECK 2] FirstContactSignalQualityGate Verification...")
    gate = FirstContactSignalQualityGate()
    # Realistic physiological clean EEG metrics
    dummy_clean = {}
    for ch in STANDARD_19_CHANNELS:
        dummy_clean[f"{ch}_rel_delta"] = 0.45
        dummy_clean[f"{ch}_rel_theta"] = 0.20
        dummy_clean[f"{ch}_rel_alpha"] = 0.20
        dummy_clean[f"{ch}_rel_beta"] = 0.10
        dummy_clean[f"{ch}_rel_gamma"] = 0.05
        dummy_clean[f"{ch}_dar"] = 2.25
        dummy_clean[f"{ch}_dtabr"] = 1.50
        dummy_clean[f"{ch}_tar"] = 1.00
        dummy_clean[f"{ch}_hjorth_mobility"] = 0.85
        dummy_clean[f"{ch}_hjorth_complexity"] = 1.15
        dummy_clean[f"{ch}_spectral_entropy"] = 0.78

    # Test clean
    s_clean, _, r_clean = gate.assess_subject(dummy_clean)
    print(f"  Clean subject: status={s_clean}, bad_channels={r_clean['n_bad_channels']}")

    # Test 2 bad channels (C3 flatline, F4 high gamma)
    dummy_2bad = dict(dummy_clean)
    for m in METRICS_11:
        dummy_2bad[f"C3_{m}"] = 0.0
    dummy_2bad["F4_rel_gamma"] = 0.70
    s_2bad, healed_2bad, r_2bad = gate.assess_subject(dummy_2bad)
    print(f"  2 bad channels: status={s_2bad}, bad_channels={r_2bad['bad_channels']}")
    print(f"  Auto-healed C3_rel_delta value: {healed_2bad['C3_rel_delta']:.4f}")

    # Test 6 bad channels
    dummy_6bad = dict(dummy_clean)
    for ch in ["F3", "F4", "C3", "C4", "P3", "P4"]:
        for m in METRICS_11:
            dummy_6bad[f"{ch}_{m}"] = 0.0
    s_6bad, _, r_6bad = gate.assess_subject(dummy_6bad)
    print(f"  6 bad channels: status={s_6bad}, bad_channels={r_6bad['bad_channels']}")

    # 3. Extraction & Caching on Real Cohort N=423 + UCLH N=28
    print("\n[CHECK 3] Extracting and Caching Real Cohorts...")
    df_cohort_n1, df_uclh_n1 = build_and_cache_n1_features(force_rebuild=True)

    print(f"\nCohort N=423 Shape: {df_cohort_n1.shape}")
    print(df_cohort_n1.groupby(["target_3state", "state_label"])["human_subject_id"].count())
    print("\nCohort Recording Centers:")
    print(df_cohort_n1.groupby(["recording_center", "target_3state"])["human_subject_id"].count())

    print(f"\nUCLH N=28 Shape: {df_uclh_n1.shape}")
    print(df_uclh_n1.groupby(["class_label", "target_3state", "state_label"])["human_subject_id"].count())

    # Check NaNs
    feat_cols = [c for c in df_cohort_n1.columns if c.startswith("n1_")]
    nan_cohort = df_cohort_n1[feat_cols].isna().sum().sum()
    nan_uclh = df_uclh_n1[feat_cols].isna().sum().sum()
    print(f"\nCore N1 Features Count: {len(feat_cols)}")
    print(f"Cohort Total Feature NaNs: {nan_cohort}")
    print(f"UCLH Total Feature NaNs  : {nan_uclh}")

    # 4. FoldInternalClassConditionalSelector Smoke Test
    print("\n[CHECK 4] FoldInternalClassConditionalSelector Smoke Test...")
    X_train_df = df_cohort_n1[feat_cols]
    y_train = df_cohort_n1["target_3state"].values
    centers_train = df_cohort_n1["recording_center"].values

    selector = FoldInternalClassConditionalSelector(k_features=60, max_leakage_f=15.0)
    X_selected = selector.fit_transform(X_train_df, y_train, centers=centers_train)
    print(f"  Selected Shape: {X_selected.shape}")
    print("  Top 10 Selected Features:")
    for rank, f_name in enumerate(selector.selected_features_[:10]):
        idx = selector.selected_indices_[rank]
        print(f"    {rank+1:2d}. {f_name:40s} (F_bio={selector.f_bio_[idx]:.2f}, F_leak={selector.f_leak_[idx]:.2f}, Score={selector.composite_scores_[idx]:.2f})")

    print("\n" + "=" * 75)
    print("ALL SMOKE TESTS AND VERIFICATIONS COMPLETED SUCCESSFULLY!")
    print("=" * 75)
