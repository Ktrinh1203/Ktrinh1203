"""Comprehensive deterministic unit & localhost integration tests for Firmware v3 PC Studio & Bridge."""

from __future__ import annotations

import csv
import http.server
import json
import socket
import struct
import sys
import threading
import time
from pathlib import Path
from typing import Any

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from dsp_filters import MultichannelBiopotentialFilter
from hw_test_runner import (
    evaluate_hardware_report,
    extract_ai_report,
    extract_post_report,
    extract_power_report,
    extract_recover_report,
    extract_sd_list,
    extract_stream_info,
    extract_wifi_status,
    run_serial_diagnostics,
)
from neurolink_bridge import (
    EegEpochBuffer,
    HardwareWsServer,
    compute_ws_accept_key,
    encode_ws_frame,
    format_triage_status_line,
    post_eeg_epoch,
    recv_ws_frame,
    run_serial_bridge,
)
from pc_eeg_studio import (
    build_cli_parser,
    cmd_ai,
    cmd_info,
    cmd_pwr,
    cmd_record,
    cmd_recover,
    cmd_sd_list,
    cmd_wifi_config,
)
from protocol_codec import (
    HOLTER_HEADER_FMT,
    HOLTER_MAGIC,
    HOLTER_RECORD_FMT,
    HOLTER_RECORD_SIZE,
    HOLTER_SYNC,
    assert_allowed_serial_port,
    build_eeg_stream_frame,
    build_wifi_set_cmd,
    convert_holter_bin_to_csv,
    format_eeg_matrix_to_csv_text,
    resolve_montage_columns,
)


V3_SAMPLE_LOG = """
[BOOT] esp32_ads1299_holter v3 starting @ 921600 bps...
=== POST_REPORT_BEGIN ===
{"fw":"esp32_ads1299_holter_v3","sd_cs_isolated":true,"sd_ready":true,"sd_mb":15200,"tft_ok":true,"tft_preset":"G-Tab (2,1,BGR)","id_raw":"0x3E","id_masked":"0x1E","id_ok":true,"drdy_boot_hz":250.0,"drdy_ok":true,"usb_only":false,"vbat_mv":3920,"bat_pct":74,"tinyml_features":98,"tinyml_trees":16,"regs_hex":"3E95D1EC0055555555555555550000000000000000000000","short_cfg_ok":true,"short_samples":128,"short_mean_uV":[0.1,-0.2,0.0,0.3,-0.1,0.2,0.1,-0.1],"short_rms_uV":[0.24,0.26,0.25,0.23,0.25,0.28,0.29,0.26],"short_pp_uV":[1.2,1.3,1.2,1.1,1.3,1.4,1.5,1.2],"test_cfg_ok":true,"test_samples":350,"expected_test_pp_uV":3750.0,"test_pp_uV":[3752.1,3749.4,3750.2,3748.9,3751.0,3750.5,3749.8,3750.7],"buttons_idle":{"UP":1,"DWN":1,"LET":1,"RHT":1,"MID":1,"SET":1}}
=== POST_REPORT_END ===
{"info":1,"fw":"V3.0.0","ads_ok":true,"id":"0x3E","mode":2,"mode_name":"TEST","rate_sps":500,"pga":12,"bias":true,"loff":false,"ch_mask":"0xFF","spi_err":0,"recoveries":0,"sd_ready":true,"sd_rec":false,"sd_samples":0,"sd_err":0,"markers":0,"sps":500.0,"fps":20,"total":1200,"dropped":0,"loff_stat_p":0,"loff_stat_n":0,"usb_only":false,"vbat_mv":3920,"bat_pct":74,"wifi_state":"WS_ONLINE","wifi_ip":"192.168.1.42","ai_state":"NORMAL","ai_rf_prob":0.1820,"ai_lr_prob":0.1450,"ai_bsi":0.0620,"ai_dar":1.25,"ai_usable_ch":8,"ai_us":1420,"pp_uV":[3750.0,3750.0,3750.0,3750.0,3750.0,3750.0,3750.0,3750.0],"buttons_idle":{"UP":1,"DWN":1,"LET":1,"RHT":1,"MID":1,"SET":1}}
{"ai":1,"state":"BORDERLINE","rf_prob":0.4512,"lr_prob":0.3980,"mean_dar":2.410,"bsi_dar":0.2140,"bsi_delta":0.1890,"usable_ch":8,"eval_count":12,"latency_us":1385}
{"pwr":1,"usb_only":false,"charging":true,"vbat_mv":4010,"bat_pct":85,"low_bat":false,"crit_bat":false}
{"wifi":1,"state":"WS_ONLINE","ip":"192.168.1.42","ssid":"NeuroLab","host":"192.168.1.100","port":4000,"path":"/ws/hardware"}
{"sd_list":1,"mounted":true,"card_mb":15200,"files":[{"name":"/EEG_0001.BIN","bytes":44064}]}
{"recover":1,"ads_ok":true,"recoveries":1}
"""


class _FakeSerial:
    """Deterministic in-memory mock for serial.Serial used to test PC Studio without COM ports."""

    def __init__(self, rx_bytes: bytes = b"") -> None:
        self.port: str = ""
        self.baudrate: int = 921600
        self.timeout: float = 0.05
        self.dtr: bool = False
        self.rts: bool = False
        self.is_open: bool = False
        self.written = bytearray()
        self._rx = bytearray(rx_bytes)

    def open(self) -> None:
        self.is_open = True

    def close(self) -> None:
        self.is_open = False

    def reset_input_buffer(self) -> None:
        pass

    def flush(self) -> None:
        pass

    def write(self, data: bytes) -> int:
        self.written.extend(data)
        return len(data)

    def read(self, size: int = 1) -> bytes:
        if not self._rx:
            time.sleep(0.01)
            return b""
        chunk = bytes(self._rx[:size])
        del self._rx[:size]
        return chunk

    def readline(self) -> bytes:
        if not self._rx:
            time.sleep(0.01)
            return b""
        nl = self._rx.find(b"\n")
        if nl == -1:
            out = bytes(self._rx)
            self._rx.clear()
            return out
        out = bytes(self._rx[: nl + 1])
        del self._rx[: nl + 1]
        return out


# ---------------------------------------------------------------------------
# 1. COM10 Hardware Safety Guard Tests
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "forbidden_port",
    ["COM10", "com10", "  Com10  ", r"\\.\COM10", r"\\.\com10", "//./COM10", "/dev/com10"],
)
def test_com10_port_guard_rejects_all_formats(forbidden_port: str) -> None:
    """COM10 must be rejected with PermissionError regardless of case or device-path prefix."""
    with pytest.raises(PermissionError, match="COM10"):
        assert_allowed_serial_port(forbidden_port)


def test_com10_guard_enforced_across_all_serial_entrypoints(tmp_path: Path) -> None:
    """Every serial-opening function in hw_test_runner, pc_eeg_studio & neurolink_bridge blocks COM10."""
    with pytest.raises(PermissionError):
        run_serial_diagnostics("COM10")
    with pytest.raises(PermissionError):
        cmd_info(r"\\.\COM10", 921600)
    with pytest.raises(PermissionError):
        cmd_ai("com10", 921600)
    with pytest.raises(PermissionError):
        cmd_pwr("COM10", 921600)
    with pytest.raises(PermissionError):
        cmd_sd_list("COM10", 921600)
    with pytest.raises(PermissionError):
        cmd_recover("COM10", 921600)
    with pytest.raises(PermissionError):
        cmd_wifi_config("COM10", 921600, action="status")
    with pytest.raises(PermissionError):
        cmd_record("COM10", 921600, 1.0, 500, 12, "test", "none", tmp_path / "x.csv")
    with pytest.raises(PermissionError):
        run_serial_bridge("COM10", 921600, "http://127.0.0.1:4000")


def test_allowed_serial_ports_pass_guard() -> None:
    """Non-forbidden ports like COM11 or /dev/ttyUSB0 pass cleanly, empty raises ValueError."""
    assert assert_allowed_serial_port("COM11") == "COM11"
    assert assert_allowed_serial_port(r"\\.\COM12") == r"\\.\COM12"
    with pytest.raises(ValueError):
        assert_allowed_serial_port("   ")


# ---------------------------------------------------------------------------
# 2. Montage Resolution (Live Capture & Holter .BIN -> .CSV)
# ---------------------------------------------------------------------------


def test_montage_column_resolution_and_validation() -> None:
    """Verify exact channel labels for raw, glasses (EEG Glasses), and neurolink6 montages."""
    assert resolve_montage_columns("raw") == [f"CH{i}_uV" for i in range(1, 9)]
    assert resolve_montage_columns("glasses") == ["FP1", "FP2", "F3", "F4", "F7", "F8", "T3", "T4"]
    assert resolve_montage_columns("neurolink6") == ["F3", "F4", "C3", "C4", "O1", "O2", "T3", "T4"]
    with pytest.raises(ValueError, match="Unsupported montage"):
        resolve_montage_columns("10-20-full")


@pytest.mark.parametrize(
    ("montage", "expected_ch"),
    [
        ("raw", ["CH1_uV", "CH2_uV", "CH3_uV", "CH4_uV", "CH5_uV", "CH6_uV", "CH7_uV", "CH8_uV"]),
        ("glasses", ["FP1", "FP2", "F3", "F4", "F7", "F8", "T3", "T4"]),
        ("neurolink6", ["F3", "F4", "C3", "C4", "O1", "O2", "T3", "T4"]),
    ],
)
def test_holter_bin_to_csv_montage_headers(
    tmp_path: Path, montage: str, expected_ch: list[str]
) -> None:
    """convert_holter_bin_to_csv must emit exact montage headers for raw/glasses/neurolink6."""
    bin_path = tmp_path / f"rec_{montage}.bin"
    csv_path = tmp_path / f"rec_{montage}.csv"
    lsb_uv = 4500000.0 / (12.0 * 8388607.0)
    hdr = struct.pack(
        HOLTER_HEADER_FMT, HOLTER_MAGIC, 1, HOLTER_RECORD_SIZE, 500, 12, 0, 1, 1, lsb_uv, b"\xFF" + b"\x00" * 39
    )
    rec = struct.pack(HOLTER_RECORD_FMT, HOLTER_SYNC, 1, 10, 0xC00000, 10, 20, 30, 40, 50, 60, 70, 80)
    bin_path.write_bytes(hdr + rec)

    count = convert_holter_bin_to_csv(bin_path, csv_path, montage=montage)
    assert count == 1
    with csv_path.open("r", encoding="utf-8") as fh:
        rows = list(csv.reader(fh))
    assert rows[0] == ["timestamp_s", "sample_idx", "marker", "status24_hex"] + expected_ch


def test_live_record_with_montage_glasses(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """cmd_record with --montage glasses writes FP1..T4 CSV columns from 0xA5..0x5A stream."""
    samples = np.arange(48, dtype="<f4").reshape(6, 8) + 1.0
    frame = build_eeg_stream_frame(samples)
    fake_ser = _FakeSerial(rx_bytes=frame * 3)

    monkeypatch.setattr("pc_eeg_studio._open_port_no_hang", lambda p, b: fake_ser)
    monkeypatch.setattr("pc_eeg_studio._wait_boot_if_reset", lambda s, wait_s=3.2: None)

    out_csv = tmp_path / "live_glasses.csv"
    rc = cmd_record("COM11", 921600, 0.12, 500, 12, "eeg", "none", out_csv, montage="glasses")
    assert rc == 0
    with out_csv.open("r", encoding="utf-8") as fh:
        rows = list(csv.reader(fh))
    assert rows[0] == ["timestamp_s", "sample_idx", "FP1", "FP2", "F3", "F4", "F7", "F8", "T3", "T4"]
    assert len(rows) == 19  # header + 18 samples


# ---------------------------------------------------------------------------
# 3. Firmware v3 JSON Telemetry Extraction & Hardware Evaluation
# ---------------------------------------------------------------------------


def test_v3_json_extractors_match_firmware_schema() -> None:
    """All v3 JSON extractors parse exact Firmware v3 single-line outputs (POST, I, AI, PWR, WIFI, SD, RECOVER)."""
    post = extract_post_report(V3_SAMPLE_LOG)
    info = extract_stream_info(V3_SAMPLE_LOG)
    ai = extract_ai_report(V3_SAMPLE_LOG)
    pwr = extract_power_report(V3_SAMPLE_LOG)
    wifi = extract_wifi_status(V3_SAMPLE_LOG)
    sd = extract_sd_list(V3_SAMPLE_LOG)
    rec = extract_recover_report(V3_SAMPLE_LOG)

    assert post is not None and post["fw"] == "esp32_ads1299_holter_v3"
    assert post["tinyml_features"] == 98 and post["tinyml_trees"] == 16
    assert info is not None and info["wifi_state"] == "WS_ONLINE" and info["ai_state"] == "NORMAL"
    assert ai is not None and ai["state"] == "BORDERLINE" and ai["usable_ch"] == 8
    assert pwr is not None and pwr["charging"] is True and pwr["vbat_mv"] == 4010
    assert wifi is not None and wifi["path"] == "/ws/hardware" and wifi["port"] == 4000
    assert sd is not None and sd["mounted"] is True and len(sd["files"]) == 1
    assert rec is not None and rec["ads_ok"] is True and rec["recoveries"] == 1


def test_v3_hardware_evaluation_pass_and_low_battery_fail() -> None:
    """v3 evaluation validates battery & TinyML health and flags <3.42V LiPo battery safely."""
    post = extract_post_report(V3_SAMPLE_LOG)
    info = extract_stream_info(V3_SAMPLE_LOG)
    assert post is not None and info is not None

    verdict_ok = evaluate_hardware_report(post, info)
    assert verdict_ok["overall_pass"] is True
    assert verdict_ok["checks"]["ai_ok"] is True
    assert verdict_ok["checks"]["battery_safe_ok"] is True
    assert verdict_ok["v3_telemetry"]["vbat_v"] == 3.92
    assert verdict_ok["v3_telemetry"]["vbat_pct"] == 74
    assert verdict_ok["v3_telemetry"]["wifi_state"] == "WS_ONLINE"

    # Simulate low battery below 3.42 V safe cutoff
    low_info = dict(info)
    low_info["vbat_mv"] = 3380
    low_info["bat_pct"] = 4
    low_info["usb_only"] = False
    verdict_low = evaluate_hardware_report(post, low_info)
    assert verdict_low["overall_pass"] is False
    assert verdict_low["checks"]["battery_safe_ok"] is False
    assert any("3.38V" in msg for msg in verdict_low["issues"])


def test_v3_cli_control_subcommands_send_exact_firmware_commands(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Verify info, ai, pwr, sd-list, recover, and wifi-config commands send exact Firmware v3 CLI strings."""
    cases = [
        (lambda: cmd_info("COM11", 921600), b'{"info":1,"fw":"V3.0.0","sps":500.0}\n', b"I\n"),
        (lambda: cmd_ai("COM11", 921600), b'{"ai":1,"state":"NORMAL","rf_prob":0.12}\n', b"AI\n"),
        (
            lambda: cmd_pwr("COM11", 921600),
            b'{"pwr":1,"usb_only":false,"charging":true,"vbat_mv":4050,"bat_pct":89}\n',
            b"PWR\n",
        ),
        (
            lambda: cmd_sd_list("COM11", 921600),
            b'{"sd_list":1,"mounted":true,"card_mb":8192,"files":[]}\n',
            b"SD_LIST\n",
        ),
        (
            lambda: cmd_recover("COM11", 921600),
            b'{"recover":1,"ads_ok":true,"recoveries":2}\n',
            b"RECOVER\n",
        ),
        (
            lambda: cmd_wifi_config("COM11", 921600, action="status"),
            b'{"wifi":1,"state":"OFF","ip":"0.0.0.0","ssid":"Lab","host":"192.168.1.100","port":4000,"path":"/ws/hardware"}\n',
            b"WIFI_STATUS\n",
        ),
        (
            lambda: cmd_wifi_config("COM11", 921600, action="on"),
            b'{"wifi_en":true,"state":"WIFI_WAIT"}\n',
            b"WIFI_ON\n",
        ),
        (
            lambda: cmd_wifi_config("COM11", 921600, action="off"),
            b'{"wifi_en":false,"state":"OFF"}\n',
            b"WIFI_OFF\n",
        ),
        (
            lambda: cmd_wifi_config(
                "COM11",
                921600,
                action="set",
                ssid="LabWiFi",
                password="secret",
                host="10.0.0.5",
                ws_port=4000,
                path="/ws/hardware",
            ),
            b'{"wifi_cfg":1,"ssid":"LabWiFi","host":"10.0.0.5","port":4000,"path":"/ws/hardware"}\n',
            b"WIFI_SET LabWiFi|secret|10.0.0.5|4000|/ws/hardware\n",
        ),
    ]

    for fn, reply, expected_ascii in cases:
        fake = _FakeSerial(rx_bytes=reply)
        monkeypatch.setattr("pc_eeg_studio._open_port_no_hang", lambda p, b, f=fake: f)
        monkeypatch.setattr("pc_eeg_studio._wait_boot_if_reset", lambda s, wait_s=3.2: None)
        rc = fn()
        assert rc == 0
        assert expected_ascii in bytes(fake.written)
        out = capsys.readouterr().out
        parsed = json.loads(out)
        assert isinstance(parsed, dict)


def test_wifi_set_cmd_builder_validation() -> None:
    """build_wifi_set_cmd rejects pipe/newline injection and formats clean v3 command."""
    assert (
        build_wifi_set_cmd("MySSID", "pw123", "192.168.1.50", 4000, "ws/hardware")
        == "WIFI_SET MySSID|pw123|192.168.1.50|4000|/ws/hardware"
    )
    with pytest.raises(ValueError):
        build_wifi_set_cmd("Bad|SSID", "pw", "127.0.0.1", 4000)


# ---------------------------------------------------------------------------
# 4. RFC 6455 WebSocket Handshake + Binary EEG + Local HTTP Mock Bridge Tests
# ---------------------------------------------------------------------------


def test_rfc6455_ws_accept_key_vector() -> None:
    """Verify exact RFC 6455 Section 1.3 test vector (matching ESP32 wifi_ws_link.h key!)."""
    assert compute_ws_accept_key("dGhlIHNhbXBsZSBub25jZQ==") == "s3pPLMBiTxaQ9kYGzzhZRbK+xOo="


def test_ws_server_handshake_binary_eeg_telemetry_and_http_post_e2e() -> None:
    """End-to-end localhost test: ESP32 WS client -> HardwareWsServer -> EegEpochBuffer -> HTTP /api/qeeg/analyze-csv."""
    received_http: list[dict[str, Any]] = []

    class _MockNeuroLinkHandler(http.server.BaseHTTPRequestHandler):
        def do_POST(self) -> None:  # noqa: N802
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode("utf-8"))
            received_http.append({"path": self.path, "payload": payload})
            resp = json.dumps(
                {"status": "ok", "triage": "NORMAL", "strokeProbability": 0.14}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)

        def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
            return

    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _MockNeuroLinkHandler)
    http_port = httpd.server_address[1]
    http_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    http_thread.start()

    epoch_buf = EegEpochBuffer(sample_rate=250, epoch_sec=0.048)  # 12 samples = 2 binary frames
    received_samples: list[np.ndarray] = []
    received_telem: list[dict[str, Any]] = []
    http_results: list[dict[str, Any]] = []
    done_evt = threading.Event()

    def _on_samples(block: np.ndarray) -> None:
        received_samples.append(block)
        for win in epoch_buf.push(block):
            csv_txt = format_eeg_matrix_to_csv_text(win, sample_rate=250, montage="neurolink6")
            res = post_eeg_epoch(
                server_url=f"http://127.0.0.1:{http_port}",
                csv_text=csv_txt,
                sampling_rate_hz=250,
                filename="holter_ws_test_0001.csv",
                clinical_category="HARDWARE_BCI",
            )
            http_results.append(res)
            done_evt.set()

    with HardwareWsServer(
        host="127.0.0.1",
        port=0,
        path="/ws/hardware",
        on_samples=_on_samples,
        on_telemetry=received_telem.append,
    ) as ws_srv:
        cli = socket.create_connection(("127.0.0.1", ws_srv.bound_port), timeout=3.0)
        cli.settimeout(3.0)
        try:
            # Exact handshake sent by firmware wifi_ws_link.h
            req = (
                "GET /ws/hardware HTTP/1.1\r\n"
                f"Host: 127.0.0.1:{ws_srv.bound_port}\r\n"
                "Upgrade: websocket\r\n"
                "Connection: Upgrade\r\n"
                "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
                "Sec-WebSocket-Version: 13\r\n"
                "X-Device-Id: esp32-ads1299-holter-v3\r\n\r\n"
            ).encode("ascii")
            cli.sendall(req)

            hs_resp = cli.recv(1024).decode("ascii")
            assert "101 Switching Protocols" in hs_resp
            assert "Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=" in hs_resp

            # 1) Send JSON telemetry heartbeat (masked text frame opcode 0x01)
            telem_json = json.dumps(
                {
                    "type": "telemetry",
                    "fw": "V3.0.0",
                    "mode": "EEG",
                    "rate_sps": 250,
                    "usb_only": False,
                    "vbat_mv": 3890,
                    "bat_pct": 70,
                    "ai_state": "NORMAL",
                    "ai_rf_prob": 0.16,
                }
            ).encode("utf-8")
            cli.sendall(encode_ws_frame(0x01, telem_json, masked=True))

            # 2) Send Ping -> verify server replies Pong (opcode 0x0A)
            cli.sendall(encode_ws_frame(0x09, b"hb", masked=True))
            pong = recv_ws_frame(cli)
            assert pong == (0x0A, b"hb")

            # 3) Server -> ESP32 remote ASCII command (opcode 0x01 unmasked)
            assert ws_srv.send_command("MKR") is True
            cmd_frame = recv_ws_frame(cli)
            assert cmd_frame == (0x01, b"MKR")

            # 4) Send two 197-byte binary 0xA5..0x5A EEG frames (12 samples total)
            s1 = np.arange(48, dtype="<f4").reshape(6, 8) * 1.5
            s2 = np.arange(48, dtype="<f4").reshape(6, 8) * 2.0
            cli.sendall(encode_ws_frame(0x02, build_eeg_stream_frame(s1), masked=True))
            cli.sendall(encode_ws_frame(0x02, build_eeg_stream_frame(s2), masked=True))

            assert done_evt.wait(timeout=3.0)
            assert ws_srv.connected_device_id == "esp32-ads1299-holter-v3"
            assert ws_srv.frames_received == 2
            assert ws_srv.samples_received == 12
            assert len(received_telem) == 1
            assert received_telem[0]["ai_state"] == "NORMAL"
            np.testing.assert_allclose(received_samples[0], s1, rtol=1e-5)
            np.testing.assert_allclose(received_samples[1], s2, rtol=1e-5)

            # Verify HTTP POST payload to /api/qeeg/analyze-csv
            assert len(received_http) == 1
            assert received_http[0]["path"] == "/api/qeeg/analyze-csv"
            post_body = received_http[0]["payload"]
            assert post_body["filename"] == "holter_ws_test_0001.csv"
            assert post_body["samplingRateHz"] == 250
            assert post_body["clinicalCategory"] == "HARDWARE_BCI"
            header_line = post_body["csvText"].splitlines()[0]
            assert header_line == "timestamp_s,sample_idx,F3,F4,C3,C4,O1,O2,T3,T4"

            status_line = format_triage_status_line(1, http_results[0], ws_srv.latest_telemetry)
            assert "Tier1[state=NORMAL" in status_line
            assert "Tier2[HTTP 200: NORMAL" in status_line
        finally:
            cli.close()
            httpd.shutdown()
            httpd.server_close()


def test_http_forwarder_offline_resilience_and_retry() -> None:
    """Unreachable NeuroLink server must fail gracefully with offline=True instead of crashing."""
    # Find an unused localhost port so connection is refused immediately
    tmp_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    tmp_sock.bind(("127.0.0.1", 0))
    closed_port = tmp_sock.getsockname()[1]
    tmp_sock.close()

    res = post_eeg_epoch(
        server_url=f"http://127.0.0.1:{closed_port}",
        csv_text="timestamp_s,sample_idx,F3,F4,C3,C4,O1,O2,T3,T4\n0.0,0,1,2,3,4,5,6,7,8\n",
        sampling_rate_hz=250,
        timeout_s=0.5,
        max_retries=1,
        retry_backoff_s=0.01,
    )
    assert res["ok"] is False
    assert res["offline"] is True
    assert res["attempts"] == 2
    line = format_triage_status_line(3, res, None)
    assert "Tier2[OFFLINE:" in line


def test_sliding_epoch_buffer_window_step() -> None:
    """EegEpochBuffer supports sliding overlap windows (e.g. 4s window, 2s step)."""
    buf = EegEpochBuffer(sample_rate=10, epoch_sec=1.0, step_sec=0.5)  # 10 samples, step 5
    data = np.arange(15 * 8, dtype=np.float64).reshape(15, 8)
    windows = buf.push(data)
    assert len(windows) == 2
    assert windows[0].shape == (10, 8)
    assert windows[1].shape == (10, 8)
    assert windows[0][0, 0] == 0.0
    assert windows[1][0, 0] == 40.0  # row 5 * 8 channels
    assert buf.buffered_samples == 5


# ---------------------------------------------------------------------------
# 5. SOS Zero-Transient DSP & 4000 SPS UART Bandwidth Guard
# ---------------------------------------------------------------------------


def test_sos_filter_zero_transient_at_t0_under_large_dc_offset() -> None:
    """SOS filter initialized with sosfilt_zi*x[0] must suppress 10,000 uV DC step from sample 0."""
    fs = 500.0
    t = np.arange(500) / fs
    sig_10hz = 50.0 * np.sin(2.0 * np.pi * 10.0 * t)
    dc_step = 10000.0
    block = np.tile((sig_10hz + dc_step)[:, None], (1, 8))

    flt = MultichannelBiopotentialFilter(fs, preset="eeg", n_channels=8)
    out = flt.process(block)
    # Without steady-state zi scaling, sample 0..20 would spike to ~10,000 uV!
    assert float(np.max(np.abs(out[:25, 0]))) < 120.0

    # EMG preset also suppresses DC & 50/100/150 Hz harmonics without transient explosion
    emg_flt = MultichannelBiopotentialFilter(1000.0, preset="emg", n_channels=8)
    emg_in = np.full((200, 8), 5000.0, dtype=np.float64)
    emg_out = emg_flt.process(emg_in)
    assert float(np.max(np.abs(emg_out))) < 1e-6


def test_uart_bandwidth_guard_blocks_4000sps_in_bridge_and_cli_parser() -> None:
    """4000 SPS over 921600 bps UART fails fast in serial bridge; CLI parses all v3 subcommands."""
    rc = run_serial_bridge("COM11", 921600, "http://127.0.0.1:4000", rate_sps=4000)
    assert rc == 2

    parser = build_cli_parser()
    args = parser.parse_args(
        [
            "--port",
            "COM11",
            "bridge",
            "--source",
            "ws",
            "--montage",
            "glasses",
            "--epoch-sec",
            "6.0",
            "--neurolink-url",
            "http://localhost:4000",
        ]
    )
    assert args.command == "bridge"
    assert args.source == "ws"
    assert args.montage == "glasses"
    assert args.epoch_sec == 6.0
