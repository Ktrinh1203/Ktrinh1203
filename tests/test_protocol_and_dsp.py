"""Unit tests for binary protocol, stream parser, DSP filters, and Holter BIN decoder."""

from __future__ import annotations

import csv
import struct
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from dsp_filters import MultichannelBiopotentialFilter
from protocol_codec import (
    HOLTER_HEADER_FMT,
    HOLTER_MAGIC,
    HOLTER_RECORD_FMT,
    HOLTER_RECORD_SIZE,
    HOLTER_SYNC,
    StreamFrameParser,
    build_set_params_cmd,
    build_stream_ctrl_cmd,
    convert_holter_bin_to_csv,
    decode_eeg_payload,
)


def test_command_packing_and_stream_parser_with_noise() -> None:
    """Verify binary commands and resilient 0xA5..0x5A stream framing."""
    cmd_start = build_stream_ctrl_cmd(True)
    assert cmd_start == bytes([0xAA, 0x04, 0x80, 0x11, 0x01, 0x94, 0xBB])

    cmd_params = build_set_params_cmd(500, 12, "test")
    assert cmd_params[:4] == bytes([0xAA, 0x06, 0x80, 0x10])
    assert cmd_params[4:7] == bytes([0x01, 0x05, 0x02])
    assert cmd_params[-1] == 0xBB

    samples = np.arange(48, dtype="<f4").reshape(6, 8) * 10.5
    payload = samples.tobytes()
    frame = bytes([0xA5, 0xC2, 0x11, 0xD3]) + payload + bytes([0x5A])

    noisy_stream = b"\x00\xFF\xA5\x05\x11\x00garbage" + frame[:40]
    parser = StreamFrameParser()
    out1 = parser.feed(noisy_stream)
    assert out1 == []

    out2 = parser.feed(frame[40:] + b"\xA5\x03\x09\x0A\x01\x5A")
    assert len(out2) == 2
    assert out2[0][0] == 0x11
    decoded = decode_eeg_payload(out2[0][1])
    np.testing.assert_allclose(decoded, samples, rtol=1e-6)
    assert out2[1] == (0x09, b"\x01")


def test_eeg_filter_removes_dc_and_50hz_preserves_10hz() -> None:
    """EEG SOS filter must strip DC + 50 Hz mains while keeping 10 Hz amplitude accurate."""
    fs = 500.0
    t = np.arange(int(fs * 4)) / fs
    sig_10hz = 100.0 * np.sin(2.0 * np.pi * 10.0 * t)
    noise_50hz = 300.0 * np.sin(2.0 * np.pi * 50.0 * t)
    dc_offset = 10000.0
    raw = np.tile((sig_10hz + noise_50hz + dc_offset)[:, None], (1, 8))

    flt = MultichannelBiopotentialFilter(fs, preset="eeg", n_channels=8)
    y1 = flt.process(raw[:1000])
    y2 = flt.process(raw[1000:])
    steady = y2[500:]

    assert abs(float(np.mean(steady[:, 0]))) < 1.0
    pp = float(np.ptp(steady[:, 0]))
    assert 190.0 <= pp <= 210.0
    assert y1.shape == (1000, 8)


def test_holter_bin_to_csv_roundtrip(tmp_path: Path) -> None:
    """Verify 64B Holter header + 44B sample records convert losslessly to CSV."""
    bin_path = tmp_path / "EEG_0001.BIN"
    csv_path = tmp_path / "EEG_0001.CSV"

    lsb_uv = 4500000.0 / (24.0 * 8388607.0)
    hdr = struct.pack(
        HOLTER_HEADER_FMT,
        HOLTER_MAGIC,
        1,
        HOLTER_RECORD_SIZE,
        500,
        24,
        0,
        1,
        1,
        lsb_uv,
        b"\x00" * 40,
    )
    rec1 = struct.pack(HOLTER_RECORD_FMT, HOLTER_SYNC, 0, 1, 0xC00000, 100, -200, 0, 0, 0, 0, 0, 1000)
    rec2 = struct.pack(HOLTER_RECORD_FMT, HOLTER_SYNC, 3, 2, 0xC01000, 500, -500, 0, 0, 0, 0, 0, -1000)
    bin_path.write_bytes(hdr + rec1 + rec2)

    count = convert_holter_bin_to_csv(bin_path, csv_path)
    assert count == 2

    with csv_path.open("r", encoding="utf-8") as fh:
        rows = list(csv.reader(fh))
    assert len(rows) == 3
    assert rows[2][2] == "3"
    assert rows[2][3] == "0xC01000"
    assert abs(float(rows[2][4]) - 500 * lsb_uv) < 1e-3


def test_uart_bandwidth_guard_for_4000sps(tmp_path: Path) -> None:
    """4000 SPS binary live stream over 921600 bps UART must fail fast before opening serial port."""
    from pc_eeg_studio import cmd_record

    rc = cmd_record("COM11", 921600, 1.0, 4000, 12, "test", "none", tmp_path / "x.csv")
    assert rc == 2
