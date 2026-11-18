"""Binary UART protocol codec (1 Mbps) & MicroSD Holter .BIN decoder."""

from __future__ import annotations

import csv
import struct
from pathlib import Path
from typing import Any

import numpy as np

RATE_MAP: dict[int, int] = {250: 0, 500: 1, 1000: 2, 2000: 3, 4000: 4}
PGA_MAP: dict[int, int] = {1: 0, 2: 1, 4: 2, 6: 3, 8: 4, 12: 5, 24: 6}
INPUT_MAP: dict[str, int] = {"eeg": 0, "short": 1, "test": 2, "emg": 3}

HOLTER_HEADER_FMT = "<8sHHIBBBBf40s"
HOLTER_HEADER_SIZE = struct.calcsize(HOLTER_HEADER_FMT)
HOLTER_RECORD_FMT = "<HHII8i"
HOLTER_RECORD_SIZE = struct.calcsize(HOLTER_RECORD_FMT)
HOLTER_MAGIC = b"EEGHOLT1"
HOLTER_SYNC = 0xEE61


def pack_cmd(addr: int, data: bytes = b"", write: bool = True) -> bytes:
    """Pack a command frame: 0xAA [len] [rw] [addr] [data...] [xor] 0xBB."""
    rw = 0x80 if write else 0x81
    length = 3 + len(data)
    body = bytes([length, rw, addr & 0xFF]) + data
    xor_byte = 0
    for b in body:
        xor_byte ^= b
    return bytes([0xAA]) + body + bytes([xor_byte, 0xBB])


def build_conn_status_cmd(status: int = 1) -> bytes:
    """Build connection status keep-alive/handshake packet (addr 0x09)."""
    return pack_cmd(0x09, bytes([status & 0xFF]), write=True)


def build_set_params_cmd(rate_sps: int, gain: int, input_mode: str) -> bytes:
    """Build SamplePar command (addr 0x10) for rate, PGA gain, and input mode."""
    if rate_sps not in RATE_MAP:
        raise ValueError(f"Unsupported sample rate: {rate_sps}. Choose from {list(RATE_MAP)}")
    if gain not in PGA_MAP:
        raise ValueError(f"Unsupported PGA gain: {gain}. Choose from {list(PGA_MAP)}")
    mode_key = input_mode.lower().strip()
    if mode_key not in INPUT_MAP:
        raise ValueError(f"Unsupported input mode: {input_mode}. Choose from {list(INPUT_MAP)}")
    payload = bytes([RATE_MAP[rate_sps], PGA_MAP[gain], INPUT_MAP[mode_key]])
    return pack_cmd(0x10, payload, write=True)


def build_stream_ctrl_cmd(start: bool) -> bytes:
    """Build SampleControl command (addr 0x11) to start or stop streaming."""
    return pack_cmd(0x11, bytes([0x01 if start else 0x00]), write=True)


class StreamFrameParser:
    """Stateful incremental parser for 0xA5 [len] [addr] [check] [data] 0x5A frames."""

    def __init__(self) -> None:
        self._buf = bytearray()

    def feed(self, chunk: bytes) -> list[tuple[int, bytes]]:
        """Feed incoming serial bytes and return list of (addr, payload_bytes)."""
        if chunk:
            self._buf.extend(chunk)
        frames: list[tuple[int, bytes]] = []

        while len(self._buf) >= 5:
            start = self._buf.find(b"\xA5")
            if start == -1:
                self._buf.clear()
                break
            if start > 0:
                del self._buf[:start]
            if len(self._buf) < 5:
                break

            length_field = self._buf[1]
            frame_len = length_field + 3
            if length_field < 2 or frame_len > 240:
                del self._buf[:1]
                continue
            if len(self._buf) < frame_len:
                break

            addr = self._buf[2]
            chk = self._buf[3]
            if (length_field ^ addr) != chk or self._buf[frame_len - 1] != 0x5A:
                del self._buf[:1]
                continue

            payload = bytes(self._buf[4 : frame_len - 1])
            frames.append((addr, payload))
            del self._buf[:frame_len]

        return frames


def decode_eeg_payload(payload: bytes) -> np.ndarray:
    """Decode 0x11 payload (multiple of 32 bytes = 8 float32 LE) into (N, 8) float32 array."""
    if len(payload) % 32 != 0 or len(payload) == 0:
        raise ValueError(f"Invalid EEG payload byte length: {len(payload)}")
    arr = np.frombuffer(payload, dtype="<f4")
    return arr.reshape(-1, 8).copy()


def read_holter_bin(bin_path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Read MicroSD Holter .BIN file (64-byte header + 44-byte sample records)."""
    raw_bytes = bin_path.read_bytes()
    if len(raw_bytes) < HOLTER_HEADER_SIZE:
        raise ValueError(f"File too small for Holter header: {len(raw_bytes)} bytes")

    hdr_tuple = struct.unpack(HOLTER_HEADER_FMT, raw_bytes[:HOLTER_HEADER_SIZE])
    magic, version, rec_size, sample_rate, pga_gain, input_mode, srb1, bias_on, lsb_uv, _ = hdr_tuple
    if magic != HOLTER_MAGIC:
        raise ValueError(f"Invalid Holter magic header: {magic!r}")
    if rec_size != HOLTER_RECORD_SIZE:
        raise ValueError(f"Unexpected record size: {rec_size}")

    header = {
        "version": version,
        "sample_rate": sample_rate,
        "pga_gain": pga_gain,
        "input_mode": input_mode,
        "srb1": bool(srb1),
        "bias_on": bool(bias_on),
        "lsb_uV": float(lsb_uv),
    }

    records: list[dict[str, Any]] = []
    offset = HOLTER_HEADER_SIZE
    total_len = len(raw_bytes)
    while offset + HOLTER_RECORD_SIZE <= total_len:
        unpacked = struct.unpack(
            HOLTER_RECORD_FMT, raw_bytes[offset : offset + HOLTER_RECORD_SIZE]
        )
        offset += HOLTER_RECORD_SIZE
        sync, marker, seq, status24 = unpacked[:4]
        raw24 = unpacked[4:]
        if sync != HOLTER_SYNC:
            continue
        ch_uv = [round(r * lsb_uv, 4) for r in raw24]
        records.append(
            {
                "seq": seq,
                "marker": marker,
                "status24": status24,
                "ch_uV": ch_uv,
            }
        )
    return header, records


def convert_holter_bin_to_csv(bin_path: Path, csv_path: Path) -> int:
    """Convert a MicroSD Holter .BIN file to standard CSV and return sample count."""
    header, records = read_holter_bin(bin_path)
    fs = float(header["sample_rate"]) if header["sample_rate"] > 0 else 500.0
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    cols = ["timestamp_s", "sample_idx", "marker", "status24_hex"] + [
        f"CH{i}_uV" for i in range(1, 9)
    ]

    with csv_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(cols)
        for idx, rec in enumerate(records):
            t_sec = round(idx / fs, 6)
            row = [t_sec, rec["seq"], rec["marker"], f"0x{rec['status24']:06X}"] + rec["ch_uV"]
            writer.writerow(row)
    return len(records)
