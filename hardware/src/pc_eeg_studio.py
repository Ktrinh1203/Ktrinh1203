"""PC EEG Studio CLI for ESP32 + ADS1299 V1.4 (Firmware v3 Control, DSP, Holter BIN & NeuroLink Bridge)."""

from __future__ import annotations

import argparse
import csv
import json
import time
from pathlib import Path
from typing import Any

import numpy as np
import serial  # type: ignore[import-untyped]

try:
    from dsp_filters import FilterPreset, MultichannelBiopotentialFilter
    from neurolink_bridge import (
        format_triage_status_line,
        post_eeg_epoch,
        run_serial_bridge,
        run_ws_bridge,
    )
    from protocol_codec import (
        MONTAGE_CHANNEL_NAMES,
        StreamFrameParser,
        assert_allowed_serial_port,
        build_conn_status_cmd,
        build_set_params_cmd,
        build_stream_ctrl_cmd,
        build_wifi_set_cmd,
        convert_holter_bin_to_csv,
        decode_eeg_payload,
        format_eeg_matrix_to_csv_text,
        resolve_montage_columns,
    )
except ImportError:  # pragma: no cover
    from src.dsp_filters import FilterPreset, MultichannelBiopotentialFilter
    from src.neurolink_bridge import (
        format_triage_status_line,
        post_eeg_epoch,
        run_serial_bridge,
        run_ws_bridge,
    )
    from src.protocol_codec import (
        MONTAGE_CHANNEL_NAMES,
        StreamFrameParser,
        assert_allowed_serial_port,
        build_conn_status_cmd,
        build_set_params_cmd,
        build_stream_ctrl_cmd,
        build_wifi_set_cmd,
        convert_holter_bin_to_csv,
        decode_eeg_payload,
        format_eeg_matrix_to_csv_text,
        resolve_montage_columns,
    )


def _open_port_no_hang(port: str, baud: int) -> serial.Serial:
    safe_port = assert_allowed_serial_port(port)
    ser = serial.Serial()
    ser.port = safe_port
    ser.baudrate = baud
    ser.timeout = 0.05
    ser.dtr = False
    ser.rts = False
    ser.open()
    return ser


def _wait_boot_if_reset(ser: serial.Serial, wait_s: float = 3.2) -> None:
    """Drain boot/POST output if opening port triggered CP210x auto-reset."""
    t0 = time.monotonic()
    saw_boot = False
    buf = bytearray()
    while time.monotonic() - t0 < wait_s:
        chunk = ser.read(512)
        if chunk:
            buf.extend(chunk)
            text = buf.decode("utf-8", errors="ignore")
            if "[BOOT]" in text or "POST_REPORT_BEGIN" in text:
                saw_boot = True
            if "=== POST_REPORT_END ===" in text:
                time.sleep(0.15)
                ser.reset_input_buffer()
                return
        elif not saw_boot and (time.monotonic() - t0) > 0.35:
            return
    ser.reset_input_buffer()


def query_device_json(
    port: str,
    baud: int,
    ascii_cmd: str,
    expected_key: str,
    timeout_s: float = 2.5,
) -> dict[str, Any] | None:
    """Send an ASCII CLI command to ESP32 v3 and wait for its single-line JSON response."""
    safe_port = assert_allowed_serial_port(port)
    ser = _open_port_no_hang(safe_port, baud)
    try:
        _wait_boot_if_reset(ser)
        ser.write(build_stream_ctrl_cmd(False))
        ser.flush()
        time.sleep(0.03)
        ser.reset_input_buffer()

        ser.write((ascii_cmd.strip() + "\n").encode("utf-8"))
        ser.flush()
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            raw = ser.readline()
            if not raw:
                continue
            ln = raw.decode("utf-8", errors="replace").strip()
            if ln.startswith("{") and f'"{expected_key}"' in ln:
                try:
                    parsed = json.loads(ln)
                except json.JSONDecodeError:
                    continue
                if isinstance(parsed, dict) and expected_key in parsed:
                    return parsed
    finally:
        ser.close()
    return None


def _run_json_cmd(
    port: str, baud: int, ascii_cmd: str, expected_key: str, label: str, timeout_s: float = 2.5
) -> int:
    parsed = query_device_json(port, baud, ascii_cmd, expected_key, timeout_s=timeout_s)
    if parsed is None:
        print(f"ERROR: Timeout waiting for {label} JSON ('{ascii_cmd}').")
        return 1
    print(json.dumps(parsed, indent=2, ensure_ascii=False))
    return 0


def cmd_info(port: str, baud: int) -> int:
    """Fetch runtime JSON diagnostics from ESP32 via 'I' command."""
    return _run_json_cmd(port, baud, "I", "info", "runtime info")


def cmd_ai(port: str, baud: int) -> int:
    """Fetch Tier-1 TinyML stroke triage JSON from ESP32 via 'AI' command."""
    return _run_json_cmd(port, baud, "AI", "ai", "Tier-1 Edge AI")


def cmd_pwr(port: str, baud: int) -> int:
    """Fetch 1S LiPo battery & charging JSON telemetry from ESP32 via 'PWR' command."""
    return _run_json_cmd(port, baud, "PWR", "pwr", "power telemetry")


def cmd_sd_list(port: str, baud: int) -> int:
    """List MicroSD Holter .BIN files on ESP32 via 'SD_LIST' command."""
    return _run_json_cmd(port, baud, "SD_LIST", "sd_list", "MicroSD file list", timeout_s=3.5)


def cmd_recover(port: str, baud: int) -> int:
    """Trigger ADS1299 hardware recovery routine via 'RECOVER' command."""
    return _run_json_cmd(port, baud, "RECOVER", "recover", "ADS1299 recovery", timeout_s=3.5)


def cmd_wifi_config(
    port: str,
    baud: int,
    action: str = "status",
    ssid: str = "",
    password: str = "",
    host: str = "192.168.1.100",
    ws_port: int = 4000,
    path: str = "/ws/hardware",
) -> int:
    """Configure or query ESP32 v3 Wi-Fi WebSocket link (WIFI_SET/ON/OFF/STATUS)."""
    act = action.strip().lower()
    if act == "status":
        return _run_json_cmd(port, baud, "WIFI_STATUS", "wifi", "Wi-Fi status")
    if act == "on":
        return _run_json_cmd(port, baud, "WIFI_ON", "wifi_en", "Wi-Fi enable")
    if act == "off":
        return _run_json_cmd(port, baud, "WIFI_OFF", "wifi_en", "Wi-Fi disable")
    if act == "set":
        cmd_str = build_wifi_set_cmd(ssid, password, host, ws_port, path)
        return _run_json_cmd(port, baud, cmd_str, "wifi_cfg", "Wi-Fi config")
    raise ValueError(f"Unsupported wifi-config action: {action}")


def cmd_record(
    port: str,
    baud: int,
    duration: float,
    rate_sps: int,
    gain: int,
    input_mode: str,
    filter_preset: FilterPreset,
    out_csv: Path,
    montage: str = "raw",
    neurolink_url: str | None = None,
) -> int:
    """Configure ADS1299 over binary protocol, stream 8 channels at 921600 bps, and save CSV."""
    safe_port = assert_allowed_serial_port(port)
    ch_cols = resolve_montage_columns(montage)

    if rate_sps == 4000 and baud < 1500000:
        print(
            "ERROR: Live binary UART stream at 4000 SPS (~131 KB/s) exceeds 921600 bps UART capacity (~92 KB/s). "
            "Use --rate <= 2000 for USB UART, or record 4000 SPS offline to MicroSD Holter."
        )
        return 2

    ser = _open_port_no_hang(safe_port, baud)
    parser = StreamFrameParser()
    dsp = MultichannelBiopotentialFilter(rate_sps, preset=filter_preset)
    chunks: list[np.ndarray] = []

    try:
        _wait_boot_if_reset(ser)
        ser.write(build_stream_ctrl_cmd(False))
        ser.flush()
        time.sleep(0.05)
        ser.reset_input_buffer()

        ser.write(build_conn_status_cmd(1))
        ser.write(build_set_params_cmd(rate_sps, gain, input_mode))
        ser.flush()
        time.sleep(0.12)
        ser.reset_input_buffer()

        t_start = time.monotonic()
        ser.write(build_stream_ctrl_cmd(True))
        ser.flush()

        while (time.monotonic() - t_start) < duration:
            raw = ser.read(2048)
            if not raw:
                continue
            for addr, payload in parser.feed(raw):
                if addr == 0x11 and len(payload) >= 32:
                    block = decode_eeg_payload(payload)
                    if filter_preset != "none":
                        block = dsp.process(block)
                    chunks.append(block)

        elapsed = max(0.001, time.monotonic() - t_start)
        ser.write(build_stream_ctrl_cmd(False))
        ser.flush()
    finally:
        ser.close()

    if not chunks:
        print("ERROR: No binary EEG frames received.")
        return 2

    data = np.vstack(chunks)
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    cols = ["timestamp_s", "sample_idx"] + ch_cols
    with out_csv.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(cols)
        for idx, row in enumerate(data):
            t_s = round(idx / float(rate_sps), 6)
            writer.writerow([t_s, idx] + [round(float(v), 4) for v in row])

    actual_sps = data.shape[0] / elapsed
    pp_vals = [round(float(np.ptp(data[:, ch])), 2) for ch in range(8)]
    rms_vals = [round(float(np.std(data[:, ch])), 2) for ch in range(8)]
    print(f"Saved CSV: {out_csv} (montage={montage})")
    print(
        f"Captured {data.shape[0]} samples in {elapsed:.2f}s (~{actual_sps:.1f} SPS, "
        f"rate={rate_sps}, gain=x{gain}, mode={input_mode}, filter={filter_preset})"
    )
    print(f"Peak-to-Peak (uVpp): {pp_vals}")
    print(f"AC RMS       (uV)  : {rms_vals}")

    if neurolink_url:
        csv_text = format_eeg_matrix_to_csv_text(data, sample_rate=rate_sps, montage=montage)
        res = post_eeg_epoch(
            server_url=neurolink_url,
            csv_text=csv_text,
            sampling_rate_hz=rate_sps,
            filename=out_csv.name,
        )
        print(format_triage_status_line(1, res, None))
    return 0


def build_cli_parser() -> argparse.ArgumentParser:
    """Build argument parser for PC EEG Studio v3."""
    montage_choices = list(MONTAGE_CHANNEL_NAMES.keys())
    parser = argparse.ArgumentParser(description="ESP32 + ADS1299 V1.4 PC EEG Studio (v3)")
    parser.add_argument("--port", default="COM11", help="Serial port (default: COM11; COM10 blocked)")
    parser.add_argument("--baud", type=int, default=921600, help="Baud rate (default: 921600)")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("info", help="Query live firmware v3 JSON status ('I')")
    sub.add_parser("ai", help="Query Tier-1 TinyML stroke triage JSON ('AI')")
    sub.add_parser("pwr", help="Query 1S LiPo battery & charging JSON ('PWR')")
    sub.add_parser("sd-list", help="List Holter .BIN files on MicroSD ('SD_LIST')")
    sub.add_parser("recover", help="Trigger ADS1299 hardware recovery ('RECOVER')")

    wifi = sub.add_parser("wifi-config", help="Configure/toggle/query ESP32 Wi-Fi WebSocket link")
    wifi.add_argument(
        "--action",
        default="status",
        choices=["status", "on", "off", "set"],
        help="Wi-Fi action (default: status)",
    )
    wifi.add_argument("--ssid", default="", help="Wi-Fi SSID (required for --action set)")
    wifi.add_argument("--password", default="", help="Wi-Fi password")
    wifi.add_argument("--host", default="192.168.1.100", help="NeuroLink/Bridge WebSocket host")
    wifi.add_argument("--ws-port", type=int, default=4000, help="WebSocket port (default: 4000)")
    wifi.add_argument("--path", default="/ws/hardware", help="WebSocket path (default: /ws/hardware)")

    rec = sub.add_parser("record", help="Capture live 8-channel stream to montage-aware CSV")
    rec.add_argument("--duration", type=float, default=3.0, help="Capture duration in seconds")
    rec.add_argument("--rate", type=int, default=500, choices=[250, 500, 1000, 2000, 4000])
    rec.add_argument("--gain", type=int, default=12, choices=[1, 2, 4, 6, 8, 12, 24])
    rec.add_argument("--input", default="test", choices=["eeg", "short", "test", "emg"])
    rec.add_argument("--filter", default="none", choices=["none", "eeg", "emg"])
    rec.add_argument("--montage", default="raw", choices=montage_choices)
    rec.add_argument("--out", default="docs/live_capture.csv", help="Output CSV path")
    rec.add_argument(
        "--neurolink-url",
        default=None,
        help="Optional NeuroLink server base URL (e.g. http://localhost:4000) to push CSV after capture",
    )

    conv = sub.add_parser("convert-bin", help="Convert MicroSD Holter .BIN file to montage-aware CSV")
    conv.add_argument("bin_file", help="Input .BIN file path")
    conv.add_argument("csv_file", help="Output .CSV file path")
    conv.add_argument("--montage", default="raw", choices=montage_choices)

    br = sub.add_parser("bridge", help="Live USB Serial or Wi-Fi WebSocket -> NeuroLink qEEG bridge")
    br.add_argument("--source", default="serial", choices=["serial", "ws"], help="Hardware input link")
    br.add_argument(
        "--neurolink-url",
        default="http://localhost:4000",
        help="NeuroLink Web Server base URL (default: http://localhost:4000)",
    )
    br.add_argument("--montage", default="neurolink6", choices=montage_choices)
    br.add_argument("--epoch-sec", type=float, default=4.0, help="EEG epoch length in seconds")
    br.add_argument(
        "--step-sec",
        type=float,
        default=None,
        help="Sliding window step in seconds (default: same as --epoch-sec)",
    )
    br.add_argument(
        "--duration",
        type=float,
        default=0.0,
        help="Total bridge runtime in seconds (0 = continuous until Ctrl+C)",
    )
    br.add_argument("--rate", type=int, default=500, choices=[250, 500, 1000, 2000, 4000])
    br.add_argument("--gain", type=int, default=12, choices=[1, 2, 4, 6, 8, 12, 24])
    br.add_argument("--input", default="eeg", choices=["eeg", "short", "test", "emg"])
    br.add_argument("--filter", default="eeg", choices=["none", "eeg", "emg"])
    br.add_argument("--ws-host", default="0.0.0.0", help="WebSocket bind host (for --source ws)")
    br.add_argument("--ws-port", type=int, default=4000, help="WebSocket bind port (for --source ws)")
    br.add_argument("--ws-path", default="/ws/hardware", help="WebSocket endpoint path")
    br.add_argument("--category", default="HARDWARE_BCI", help="NeuroLink clinicalCategory value")
    br.add_argument("--out", default=None, help="Optional CSV path to tee live samples")

    return parser


def main(argv: list[str] | None = None) -> int:
    """CLI entrypoint for PC EEG Studio v3."""
    parser = build_cli_parser()
    args = parser.parse_args(argv)

    if args.command == "info":
        return cmd_info(args.port, args.baud)
    if args.command == "ai":
        return cmd_ai(args.port, args.baud)
    if args.command == "pwr":
        return cmd_pwr(args.port, args.baud)
    if args.command == "sd-list":
        return cmd_sd_list(args.port, args.baud)
    if args.command == "recover":
        return cmd_recover(args.port, args.baud)
    if args.command == "wifi-config":
        return cmd_wifi_config(
            port=args.port,
            baud=args.baud,
            action=args.action,
            ssid=args.ssid,
            password=args.password,
            host=args.host,
            ws_port=args.ws_port,
            path=args.path,
        )
    if args.command == "record":
        return cmd_record(
            args.port,
            args.baud,
            args.duration,
            args.rate,
            args.gain,
            args.input,
            args.filter,
            Path(args.out),
            montage=args.montage,
            neurolink_url=args.neurolink_url,
        )
    if args.command == "convert-bin":
        n = convert_holter_bin_to_csv(Path(args.bin_file), Path(args.csv_file), montage=args.montage)
        print(f"Converted {n} samples ({args.montage}) -> {args.csv_file}")
        return 0
    if args.command == "bridge":
        out_path = Path(args.out) if args.out else None
        if args.source == "ws":
            return run_ws_bridge(
                neurolink_url=args.neurolink_url,
                ws_host=args.ws_host,
                ws_port=args.ws_port,
                ws_path=args.ws_path,
                rate_sps=args.rate,
                montage=args.montage,
                filter_preset=args.filter,
                epoch_sec=args.epoch_sec,
                step_sec=args.step_sec,
                duration_s=args.duration,
                clinical_category=args.category,
                out_csv=out_path,
            )
        return run_serial_bridge(
            port=args.port,
            baud=args.baud,
            neurolink_url=args.neurolink_url,
            rate_sps=args.rate,
            gain=args.gain,
            input_mode=args.input,
            montage=args.montage,
            filter_preset=args.filter,
            epoch_sec=args.epoch_sec,
            step_sec=args.step_sec,
            duration_s=args.duration,
            clinical_category=args.category,
            out_csv=out_path,
        )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
