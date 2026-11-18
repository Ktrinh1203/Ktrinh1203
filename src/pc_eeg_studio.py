"""PC EEG Studio CLI for ESP32 + ADS1299 V1.4 (Live 921600 bps Capture, DSP & Holter BIN)."""

from __future__ import annotations

import argparse
import csv
import json
import time
from pathlib import Path
from typing import Any

import numpy as np
import serial  # type: ignore[import-untyped]

from dsp_filters import FilterPreset, MultichannelBiopotentialFilter
from protocol_codec import (
    StreamFrameParser,
    build_conn_status_cmd,
    build_set_params_cmd,
    build_stream_ctrl_cmd,
    convert_holter_bin_to_csv,
    decode_eeg_payload,
)


def _open_port_no_hang(port: str, baud: int) -> serial.Serial:
    ser = serial.Serial()
    ser.port = port
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


def cmd_info(port: str, baud: int) -> int:
    """Fetch runtime JSON diagnostics from ESP32 via 'I' command."""
    ser = _open_port_no_hang(port, baud)
    try:
        _wait_boot_if_reset(ser)
        ser.write(b"I\n")
        ser.flush()
        deadline = time.monotonic() + 2.0
        while time.monotonic() < deadline:
            ln = ser.readline().decode("utf-8", errors="replace").strip()
            if ln.startswith("{") and '"info":1' in ln:
                parsed: dict[str, Any] = json.loads(ln)
                print(json.dumps(parsed, indent=2, ensure_ascii=False))
                return 0
    finally:
        ser.close()
    print("ERROR: Timeout waiting for runtime info JSON.")
    return 1


def cmd_record(
    port: str,
    baud: int,
    duration: float,
    rate_sps: int,
    gain: int,
    input_mode: str,
    filter_preset: FilterPreset,
    out_csv: Path,
) -> int:
    """Configure ADS1299 over binary protocol, stream 8 channels at 921600 bps, and save CSV."""
    if rate_sps == 4000 and baud < 1500000:
        print(
            "ERROR: Live binary UART stream at 4000 SPS (~131 KB/s) exceeds 921600 bps UART capacity (~92 KB/s). "
            "Use --rate <= 2000 for USB UART, or record 4000 SPS offline to MicroSD Holter."
        )
        return 2

    ser = _open_port_no_hang(port, baud)
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
    cols = ["timestamp_s", "sample_idx"] + [f"CH{i}_uV" for i in range(1, 9)]
    with out_csv.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(cols)
        for idx, row in enumerate(data):
            t_s = round(idx / float(rate_sps), 6)
            writer.writerow([t_s, idx] + [round(float(v), 4) for v in row])

    actual_sps = data.shape[0] / elapsed
    pp_vals = [round(float(np.ptp(data[:, ch])), 2) for ch in range(8)]
    rms_vals = [round(float(np.std(data[:, ch])), 2) for ch in range(8)]
    print(f"Saved CSV: {out_csv}")
    print(
        f"Captured {data.shape[0]} samples in {elapsed:.2f}s (~{actual_sps:.1f} SPS, "
        f"rate={rate_sps}, gain=x{gain}, mode={input_mode}, filter={filter_preset})"
    )
    print(f"Peak-to-Peak (uVpp): {pp_vals}")
    print(f"AC RMS       (uV)  : {rms_vals}")
    return 0


def main() -> int:
    """CLI entrypoint for PC EEG Studio."""
    parser = argparse.ArgumentParser(description="ESP32 + ADS1299 V1.4 PC EEG Studio")
    parser.add_argument("--port", default="COM11", help="Serial port (default: COM11)")
    parser.add_argument("--baud", type=int, default=921600, help="Baud rate (default: 921600)")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("info", help="Query live firmware JSON status")

    rec = sub.add_parser("record", help="Capture live 8-channel stream to CSV")
    rec.add_argument("--duration", type=float, default=3.0, help="Capture duration in seconds")
    rec.add_argument("--rate", type=int, default=500, choices=[250, 500, 1000, 2000, 4000])
    rec.add_argument("--gain", type=int, default=12, choices=[1, 2, 4, 6, 8, 12, 24])
    rec.add_argument("--input", default="test", choices=["eeg", "short", "test", "emg"])
    rec.add_argument("--filter", default="none", choices=["none", "eeg", "emg"])
    rec.add_argument("--out", default="docs/live_capture.csv", help="Output CSV path")

    conv = sub.add_parser("convert-bin", help="Convert MicroSD Holter .BIN file to CSV")
    conv.add_argument("bin_file", help="Input .BIN file path")
    conv.add_argument("csv_file", help="Output .CSV file path")

    args = parser.parse_args()
    if args.command == "info":
        return cmd_info(args.port, args.baud)
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
        )
    if args.command == "convert-bin":
        n = convert_holter_bin_to_csv(Path(args.bin_file), Path(args.csv_file))
        print(f"Converted {n} samples -> {args.csv_file}")
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
