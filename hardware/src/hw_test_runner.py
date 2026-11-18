"""Hardware Bring-Up & POST Diagnostics Runner for ESP32 + ADS1299 V1.4."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Any

import serial  # type: ignore[import-untyped]

POST_BEGIN = "=== POST_REPORT_BEGIN ==="
POST_END = "=== POST_REPORT_END ==="


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


def extract_stream_info(log_text: str) -> dict[str, Any] | None:
    """Extract the latest runtime streaming status JSON emitted by command 'I'."""
    latest: dict[str, Any] | None = None
    for line in log_text.splitlines():
        candidate = line.strip()
        if candidate.startswith("{") and '"info":1' in candidate:
            try:
                parsed = json.loads(candidate)
                if isinstance(parsed, dict):
                    latest = parsed
            except json.JSONDecodeError:
                continue
    return latest


def _check_channels_within(values: list[float], low: float, high: float) -> list[int]:
    """Return 1-based indices of channels falling outside [low, high]."""
    bad: list[int] = []
    for idx, val in enumerate(values[:8]):
        if val < low or val > high:
            bad.append(idx + 1)
    return bad


def evaluate_hardware_report(
    report: dict[str, Any], info: dict[str, Any] | None = None
) -> dict[str, Any]:
    """Evaluate PASS/FAIL status and pinpoint probable wiring faults."""
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
    bad_short = _check_channels_within(rms_vals, 0.01, 15.0) if len(rms_vals) == 8 else list(range(1, 9))
    checks["short_noise_ok"] = bool(report.get("short_cfg_ok")) and len(bad_short) == 0
    if not checks["short_noise_ok"]:
        issues.append(f"Shorted noise bat thuong o kenh: {bad_short} (RMS={rms_vals}).")

    test_pp = [float(x) for x in report.get("test_pp_uV", [])]
    bad_test = _check_channels_within(test_pp, 2800.0, 4700.0) if len(test_pp) == 8 else list(range(1, 9))
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

    return {
        "overall_pass": all(checks.values()),
        "checks": checks,
        "issues": issues,
    }


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
    lines: list[str] = []
    report: dict[str, Any] | None = None
    info: dict[str, Any] | None = None

    ser = serial.Serial()
    ser.port = port
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
    parser = argparse.ArgumentParser(description="ESP32 + ADS1299 V1.4 Hardware Diagnostics")
    parser.add_argument("--port", default="COM11", help="Serial port (default: COM11)")
    parser.add_argument("--baud", type=int, default=921600, help="Baud rate (default: 921600)")
    parser.add_argument(
        "--out",
        default=str(Path(__file__).resolve().parent.parent / "docs" / "last_hw_report.json"),
        help="Output JSON report path",
    )
    args = parser.parse_args()

    report, info, raw_lines = run_serial_diagnostics(args.port, args.baud)
    if report is None:
        print(f"ERROR: Khong nhan duoc POST_REPORT tu {args.port}. Raw lines ({len(raw_lines)}):")
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
    if verdict["issues"]:
        print("Issues:", verdict["issues"])
    return 0 if verdict["overall_pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
