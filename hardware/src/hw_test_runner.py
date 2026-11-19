"""Hardware Bring-Up & POST Diagnostics Runner for ESP32 + ADS1299 V1.4 (v2/v3)."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Any

import serial  # type: ignore[import-untyped]

try:
    from protocol_codec import assert_allowed_serial_port
except ImportError:  # pragma: no cover
    from src.protocol_codec import assert_allowed_serial_port

POST_BEGIN = "=== POST_REPORT_BEGIN ==="
POST_END = "=== POST_REPORT_END ==="

LOW_BAT_SAFE_CUTOFF_MV = 3420
VALID_AI_STATES: frozenset[str] = frozenset(
    {"SIM_MODE", "WARMUP", "SQI_ABSTAIN", "NORMAL", "BORDERLINE", "STROKE_ALERT"}
)


def extract_post_report(log_text: str) -> dict[str, Any] | None:
    """Extract and parse the JSON block delimited by POST_REPORT markers."""
    start_idx = log_text.find(POST_BEGIN)
    if start_idx == -1:
        return None
    end_idx = log_text.find(POST_END, start_idx)
    if end_idx == -1:
        return None
    payload = log_text[start_idx + len(POST_BEGIN) : end_idx].strip()
    for line in payload.splitlines():
        candidate = line.strip()
        if candidate.startswith("{") and candidate.endswith("}"):
            data = json.loads(candidate)
            if isinstance(data, dict):
                return data
    return None


def extract_json_marker(
    log_text: str, marker_key: str, expected_val: Any = 1
) -> dict[str, Any] | None:
    """Extract the latest single-line JSON object where parsed[marker_key] == expected_val."""
    latest: dict[str, Any] | None = None
    for line in log_text.splitlines():
        candidate = line.strip()
        if not (candidate.startswith("{") and candidate.endswith("}")):
            continue
        if f'"{marker_key}"' not in candidate:
            continue
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict) and parsed.get(marker_key) == expected_val:
            latest = parsed
    return latest


def extract_stream_info(log_text: str) -> dict[str, Any] | None:
    """Extract the latest runtime streaming status JSON emitted by command 'I'."""
    return extract_json_marker(log_text, "info", 1)


def extract_ai_report(log_text: str) -> dict[str, Any] | None:
    """Extract the latest Tier-1 TinyML triage JSON emitted by command 'AI'."""
    return extract_json_marker(log_text, "ai", 1)


def extract_power_report(log_text: str) -> dict[str, Any] | None:
    """Extract the latest battery/power telemetry JSON emitted by command 'PWR'."""
    return extract_json_marker(log_text, "pwr", 1)


def extract_wifi_status(log_text: str) -> dict[str, Any] | None:
    """Extract the latest Wi-Fi/WebSocket status JSON emitted by command 'WIFI_STATUS'."""
    return extract_json_marker(log_text, "wifi", 1)


def extract_sd_list(log_text: str) -> dict[str, Any] | None:
    """Extract the latest MicroSD file listing JSON emitted by command 'SD_LIST'."""
    return extract_json_marker(log_text, "sd_list", 1)


def extract_recover_report(log_text: str) -> dict[str, Any] | None:
    """Extract the latest hardware recovery JSON emitted by command 'RECOVER'."""
    return extract_json_marker(log_text, "recover", 1)


def _check_channels_within(values: list[float], low: float, high: float) -> list[int]:
    """Return 1-based indices of channels falling outside [low, high]."""
    bad: list[int] = []
    for idx, val in enumerate(values[:8]):
        if val < low or val > high:
            bad.append(idx + 1)
    return bad


def _extract_v3_telemetry(
    report: dict[str, Any], info: dict[str, Any] | None
) -> dict[str, Any]:
    """Normalize optional Firmware v3 power, Edge AI, SD, and Wi-Fi telemetry fields."""
    merged: dict[str, Any] = {}
    src_info = info or {}

    vbat_mv: int | None = None
    vbat_v: float | None = None
    if "vbat_mv" in src_info or "vbat_mv" in report:
        raw_mv = src_info.get("vbat_mv", report.get("vbat_mv"))
        if raw_mv is not None:
            vbat_mv = int(raw_mv)
            vbat_v = round(vbat_mv / 1000.0, 3)
    elif "vbat_v" in src_info or "vbat_v" in report:
        raw_v = src_info.get("vbat_v", report.get("vbat_v"))
        if raw_v is not None:
            vbat_v = round(float(raw_v), 3)
            vbat_mv = int(round(vbat_v * 1000.0))

    if vbat_mv is not None:
        merged["vbat_mv"] = vbat_mv
        merged["vbat_v"] = vbat_v

    for key_out, keys_in in (
        ("vbat_pct", ("vbat_pct", "bat_pct")),
        ("usb_only", ("usb_only",)),
        ("charging", ("charging",)),
        ("low_bat", ("low_bat",)),
        ("crit_bat", ("crit_bat",)),
        ("wifi_state", ("wifi_state",)),
        ("wifi_ip", ("wifi_ip",)),
        ("sd_ready", ("sd_ready",)),
        ("sd_mb", ("sd_mb",)),
        ("tinyml_features", ("tinyml_features",)),
        ("tinyml_trees", ("tinyml_trees",)),
        ("ai_state", ("ai_state",)),
        ("ai_rf_prob", ("ai_rf_prob",)),
        ("ai_lr_prob", ("ai_lr_prob",)),
        ("ai_bsi", ("ai_bsi",)),
        ("ai_dar", ("ai_dar",)),
        ("ai_usable_ch", ("ai_usable_ch",)),
        ("ai_us", ("ai_us",)),
    ):
        for k in keys_in:
            if k in src_info:
                merged[key_out] = src_info[k]
                break
            if k in report:
                merged[key_out] = report[k]
                break

    if "ai_ok" in src_info:
        merged["ai_ok"] = bool(src_info["ai_ok"])
    elif "ai_ok" in report:
        merged["ai_ok"] = bool(report["ai_ok"])
    elif "ai_state" in merged or "tinyml_features" in merged:
        state_ok = str(merged.get("ai_state", "SIM_MODE")) in VALID_AI_STATES
        model_ok = (
            merged.get("tinyml_features", 98) == 98 and merged.get("tinyml_trees", 16) == 16
        )
        merged["ai_ok"] = state_ok and model_ok

    return merged


def evaluate_hardware_report(
    report: dict[str, Any], info: dict[str, Any] | None = None
) -> dict[str, Any]:
    """Evaluate PASS/FAIL status and pinpoint probable wiring faults (v2 & v3 compatible)."""
    checks: dict[str, bool] = {}
    issues: list[str] = []

    checks["sd_cs_isolated"] = bool(report.get("sd_cs_isolated"))
    checks["tft_ok"] = bool(report.get("tft_ok"))
    checks["ads_id_ok"] = bool(report.get("id_ok"))
    checks["drdy_ok"] = bool(report.get("drdy_ok"))

    if not checks["ads_id_ok"]:
        issues.append(
            f"ADS1299 ID khong hop le ({report.get('id_raw')}); kiem tra day HSPI (G14/G13/G34/G27) va 3V3/GND."
        )
    if not checks["drdy_ok"]:
        issues.append(
            f"Tan so DRDY luc khoi dong bat thuong ({report.get('drdy_boot_hz')} Hz); kiem tra day DRDY (G35), PWDN (G2), REST (G25)."
        )

    rms_vals = [float(x) for x in report.get("short_rms_uV", [])]
    bad_short = (
        _check_channels_within(rms_vals, 0.01, 15.0)
        if len(rms_vals) == 8
        else list(range(1, 9))
    )
    checks["short_noise_ok"] = bool(report.get("short_cfg_ok")) and len(bad_short) == 0
    if not checks["short_noise_ok"]:
        issues.append(f"Shorted noise bat thuong o kenh: {bad_short} (RMS={rms_vals}).")

    test_pp = [float(x) for x in report.get("test_pp_uV", [])]
    bad_test = (
        _check_channels_within(test_pp, 2800.0, 4700.0)
        if len(test_pp) == 8
        else list(range(1, 9))
    )
    checks["test_signal_ok"] = bool(report.get("test_cfg_ok")) and len(bad_test) == 0
    if not checks["test_signal_ok"]:
        issues.append(f"Test signal 3750 uVpp lech nguong o kenh: {bad_test} (PP={test_pp}).")

    btns = report.get("buttons_idle", {})
    stuck = [name for name, val in btns.items() if int(val) == 0]
    checks["buttons_idle_ok"] = len(btns) == 6 and len(stuck) == 0
    if stuck:
        issues.append(f"Nut nhan bi keo LOW san (kiem tra day/cham mass): {stuck}.")

    if info is not None:
        sps = float(info.get("sps", 0.0))
        checks["stream_sps_ok"] = 450.0 <= sps <= 550.0
        if not checks["stream_sps_ok"]:
            issues.append(f"Toc do stream khong dat ~500 SPS (do duoc {sps:.1f} SPS).")

    v3 = _extract_v3_telemetry(report, info)
    if "ai_ok" in v3:
        checks["ai_ok"] = bool(v3["ai_ok"])
        if not checks["ai_ok"]:
            issues.append(
                f"Tier-1 Edge AI loi trang thai/model (state={v3.get('ai_state')}, "
                f"features={v3.get('tinyml_features')}, trees={v3.get('tinyml_trees')})."
            )

    if "vbat_mv" in v3:
        usb_only = bool(v3.get("usb_only", False))
        vbat_mv = int(v3["vbat_mv"])
        crit_bat = bool(v3.get("crit_bat", False))
        bat_ok = usb_only or (not crit_bat and vbat_mv >= LOW_BAT_SAFE_CUTOFF_MV)
        checks["battery_safe_ok"] = bat_ok
        if not bat_ok:
            issues.append(
                f"Pin LiPo qua thap ({vbat_mv / 1000.0:.2f}V, {v3.get('vbat_pct', 0)}%); "
                f"nguong an toan >= {LOW_BAT_SAFE_CUTOFF_MV / 1000.0:.2f}V."
            )

    result: dict[str, Any] = {
        "overall_pass": all(checks.values()),
        "checks": checks,
        "issues": issues,
    }
    if v3:
        result["v3_telemetry"] = v3
    return result


def _pulse_reset(ser: serial.Serial) -> None:
    """Reset ESP32 via EN (RTS) while keeping GPIO0 (DTR) de-asserted."""
    ser.dtr = False
    ser.rts = True
    time.sleep(0.12)
    ser.rts = False
    time.sleep(0.05)


def run_serial_diagnostics(
    port: str, baud: int = 921600, timeout_s: float = 15.0
) -> tuple[dict[str, Any] | None, dict[str, Any] | None, list[str]]:
    """Open serial port, trigger POST if needed, and collect diagnostics + live stream info."""
    safe_port = assert_allowed_serial_port(port)
    lines: list[str] = []
    report: dict[str, Any] | None = None
    info: dict[str, Any] | None = None

    ser = serial.Serial()
    ser.port = safe_port
    ser.baudrate = baud
    ser.timeout = 0.15
    ser.dtr = False
    ser.rts = False
    ser.open()

    try:
        ser.reset_input_buffer()
        _pulse_reset(ser)

        deadline = time.monotonic() + timeout_s
        r_sent = False
        info_sent = False
        post_found_at = 0.0
        t_start = time.monotonic()

        while time.monotonic() < deadline:
            raw = ser.readline()
            if raw:
                text = raw.replace(b"\x00", b"").decode("utf-8", errors="replace").rstrip("\r\n")
                lines.append(text)
                joined = "\n".join(lines)
                if report is None:
                    report = extract_post_report(joined)
                    if report is not None:
                        post_found_at = time.monotonic()
                else:
                    info = extract_stream_info(joined)
                    if info is not None:
                        break
            if report is None and not r_sent and (time.monotonic() - t_start) > 4.8:
                ser.reset_input_buffer()
                ser.write(b"R\n")
                ser.flush()
                r_sent = True
            if report is not None and not info_sent and (time.monotonic() - post_found_at) >= 2.4:
                ser.write(b"I\n")
                ser.flush()
                info_sent = True
    finally:
        ser.close()

    joined_all = "\n".join(lines)
    if report is None:
        report = extract_post_report(joined_all)
    if info is None:
        info = extract_stream_info(joined_all)
    return report, info, lines


def main() -> int:
    """CLI entrypoint to run hardware POST on COM port and save JSON summary."""
    parser = argparse.ArgumentParser(description="ESP32 + ADS1299 V1.4 Hardware Diagnostics (v2/v3)")
    parser.add_argument("--port", default="COM11", help="Serial port (default: COM11)")
    parser.add_argument("--baud", type=int, default=921600, help="Baud rate (default: 921600)")
    parser.add_argument(
        "--out",
        default=str(Path(__file__).resolve().parent.parent / "docs" / "last_hw_report.json"),
        help="Output JSON report path",
    )
    args = parser.parse_args()

    safe_port = assert_allowed_serial_port(args.port)
    report, info, raw_lines = run_serial_diagnostics(safe_port, args.baud)
    if report is None:
        print(f"ERROR: Khong nhan duoc POST_REPORT tu {safe_port}. Raw lines ({len(raw_lines)}):")
        for ln in raw_lines[-20:]:
            print("  ", ln)
        return 2

    verdict = evaluate_hardware_report(report, info)
    out_obj = {"report": report, "stream_info": info, "verdict": verdict}

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out_obj, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Report saved: {out_path}")
    print("Checks:", json.dumps(verdict["checks"], ensure_ascii=False))
    print(f"ID={report.get('id_raw')} (masked={report.get('id_masked')}), DRDY={report.get('drdy_boot_hz')} Hz")
    print(f"Short RMS (uV): {report.get('short_rms_uV')}")
    print(f"Test  PP  (uV): {report.get('test_pp_uV')}")
    print(f"Buttons idle  : {report.get('buttons_idle')}")
    if info:
        print(f"Live stream   : sps={info.get('sps')} Hz, fps={info.get('fps')}, samples={info.get('total')}")
    if "v3_telemetry" in verdict:
        v3 = verdict["v3_telemetry"]
        print("v3 Telemetry  :", json.dumps(v3, ensure_ascii=False))
    if verdict["issues"]:
        print("Issues:", verdict["issues"])
    return 0 if verdict["overall_pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
