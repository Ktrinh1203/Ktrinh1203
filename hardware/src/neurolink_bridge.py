"""Lightweight RFC 6455 WebSocket Hardware Receiver & NeuroLink Live qEEG HTTP Bridge.

Zero external dependencies beyond Python stdlib + numpy/pyserial:
- Matches ESP32 Firmware v3 `wifi_ws_link.h` (RFC 6455 client on `/ws/hardware`,
  197-byte binary `0xA5..0x5A` EEG frames & 2s JSON telemetry heartbeats).
- Supports USB Serial (921600 bps) or Wi-Fi WebSocket ingestion with optional SOS DSP.
- Periodically posts sliding/tumbling EEG CSV epochs to NeuroLink `/api/qeeg/analyze-csv`
  with offline resilience and side-by-side Tier-1 Edge AI / Tier-2 Server AI triage output.
"""

from __future__ import annotations

import base64
import csv
import hashlib
import json
import os
import socket
import struct
import threading
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from pathlib import Path
from typing import Any

import numpy as np
import serial  # type: ignore[import-untyped]

try:
    from dsp_filters import FilterPreset, MultichannelBiopotentialFilter
    from protocol_codec import (
        StreamFrameParser,
        assert_allowed_serial_port,
        build_conn_status_cmd,
        build_set_params_cmd,
        build_stream_ctrl_cmd,
        decode_eeg_payload,
        format_eeg_matrix_to_csv_text,
        resolve_montage_columns,
    )
except ImportError:  # pragma: no cover
    from src.dsp_filters import FilterPreset, MultichannelBiopotentialFilter
    from src.protocol_codec import (
        StreamFrameParser,
        assert_allowed_serial_port,
        build_conn_status_cmd,
        build_set_params_cmd,
        build_stream_ctrl_cmd,
        decode_eeg_payload,
        format_eeg_matrix_to_csv_text,
        resolve_montage_columns,
    )

WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
WS_MAX_PAYLOAD_BYTES = 65536


def compute_ws_accept_key(sec_websocket_key: str) -> str:
    """Compute RFC 6455 Sec-WebSocket-Accept header value from client key."""
    digest = hashlib.sha1((sec_websocket_key.strip() + WS_GUID).encode("ascii")).digest()
    return base64.b64encode(digest).decode("ascii")


def parse_ws_upgrade_request(raw_headers: bytes) -> tuple[str, dict[str, str]]:
    """Parse HTTP/1.1 WebSocket upgrade request into (path, lowercase_headers)."""
    text = raw_headers.decode("iso-8859-1", errors="replace")
    lines = text.split("\r\n")
    if not lines:
        raise ValueError("Empty WebSocket upgrade request.")
    req_parts = lines[0].split(" ")
    if len(req_parts) < 2 or req_parts[0].upper() != "GET":
        raise ValueError(f"Invalid WebSocket request line: {lines[0]!r}")
    path = req_parts[1].split("?", 1)[0]
    headers: dict[str, str] = {}
    for line in lines[1:]:
        if ":" in line:
            k, v = line.split(":", 1)
            headers[k.strip().lower()] = v.strip()
    return path, headers


def build_ws_handshake_response(sec_websocket_key: str) -> bytes:
    """Build RFC 6455 HTTP/1.1 101 Switching Protocols response."""
    accept = compute_ws_accept_key(sec_websocket_key)
    return (
        "HTTP/1.1 101 Switching Protocols\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Accept: {accept}\r\n\r\n"
    ).encode("ascii")


def encode_ws_frame(
    opcode: int,
    payload: bytes,
    masked: bool = False,
    mask_key: bytes | None = None,
) -> bytes:
    """Encode a single FIN=1 RFC 6455 WebSocket frame."""
    header = bytearray()
    header.append(0x80 | (opcode & 0x0F))
    length = len(payload)
    mask_bit = 0x80 if masked else 0x00
    if length < 126:
        header.append(mask_bit | length)
    elif length < 65536:
        header.append(mask_bit | 126)
        header.extend(struct.pack("!H", length))
    else:
        header.append(mask_bit | 127)
        header.extend(struct.pack("!Q", length))

    if masked:
        key = mask_key if (mask_key is not None and len(mask_key) == 4) else os.urandom(4)
        header.extend(key)
        masked_body = bytes(b ^ key[idx & 3] for idx, b in enumerate(payload))
        return bytes(header) + masked_body
    return bytes(header) + payload


def read_exact(sock: socket.socket, n: int) -> bytes:
    """Read exactly n bytes from a TCP socket, returning b'' on clean EOF."""
    buf = bytearray()
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            return b""
        buf.extend(chunk)
    return bytes(buf)


def recv_ws_frame(sock: socket.socket) -> tuple[int, bytes] | None:
    """Read one RFC 6455 WebSocket frame; return (opcode, unmasked_payload) or None on EOF."""
    hdr = read_exact(sock, 2)
    if len(hdr) < 2:
        return None
    b0, b1 = hdr[0], hdr[1]
    opcode = b0 & 0x0F
    masked = (b1 & 0x80) != 0
    length = b1 & 0x7F

    if length == 126:
        ext = read_exact(sock, 2)
        if len(ext) < 2:
            return None
        length = struct.unpack("!H", ext)[0]
    elif length == 127:
        ext = read_exact(sock, 8)
        if len(ext) < 8:
            return None
        length = struct.unpack("!Q", ext)[0]

    if length > WS_MAX_PAYLOAD_BYTES:
        raise ValueError(f"WebSocket payload exceeds safety limit ({length} > {WS_MAX_PAYLOAD_BYTES})")

    mask_key = b""
    if masked:
        mask_key = read_exact(sock, 4)
        if len(mask_key) < 4:
            return None

    payload = read_exact(sock, length) if length > 0 else b""
    if len(payload) < length:
        return None

    if masked and payload:
        payload = bytes(b ^ mask_key[idx & 3] for idx, b in enumerate(payload))
    return opcode, payload


class EegEpochBuffer:
    """Sliding or tumbling 8-channel EEG epoch buffer emitting fixed-length (N, 8) windows."""

    def __init__(self, sample_rate: int, epoch_sec: float = 4.0, step_sec: float | None = None) -> None:
        if sample_rate <= 0:
            raise ValueError(f"sample_rate must be positive, got {sample_rate}")
        if epoch_sec <= 0.0:
            raise ValueError(f"epoch_sec must be positive, got {epoch_sec}")
        self.sample_rate = int(sample_rate)
        self.epoch_samples = max(1, int(round(self.sample_rate * epoch_sec)))
        step = epoch_sec if step_sec is None else step_sec
        if step <= 0.0:
            raise ValueError(f"step_sec must be positive, got {step}")
        self.step_samples = max(1, int(round(self.sample_rate * step)))
        self._buf = np.empty((0, 8), dtype=np.float64)

    def push(self, block_uv: np.ndarray) -> list[np.ndarray]:
        """Append an (M, 8) block and return any newly completed (epoch_samples, 8) windows."""
        arr = np.asarray(block_uv, dtype=np.float64)
        if arr.size == 0:
            return []
        if arr.ndim != 2 or arr.shape[1] != 8:
            raise ValueError(f"Expected (M, 8) array, got {arr.shape}")
        self._buf = np.vstack([self._buf, arr]) if self._buf.shape[0] > 0 else arr.copy()
        ready: list[np.ndarray] = []
        while self._buf.shape[0] >= self.epoch_samples:
            ready.append(self._buf[: self.epoch_samples].copy())
            self._buf = self._buf[self.step_samples :]
        return ready

    @property
    def buffered_samples(self) -> int:
        return int(self._buf.shape[0])


def post_eeg_epoch(
    server_url: str,
    csv_text: str,
    sampling_rate_hz: int,
    filename: str = "holter_live_epoch.csv",
    clinical_category: str = "HARDWARE_BCI",
    timeout_s: float = 5.0,
    max_retries: int = 2,
    retry_backoff_s: float = 0.3,
) -> dict[str, Any]:
    """POST an EEG CSV epoch to NeuroLink `/api/qeeg/analyze-csv` with retry & offline resilience."""
    endpoint = f"{server_url.rstrip('/')}/api/qeeg/analyze-csv"
    body = json.dumps(
        {
            "filename": filename,
            "csvText": csv_text,
            "samplingRateHz": int(sampling_rate_hz),
            "clinicalCategory": clinical_category,
        }
    ).encode("utf-8")

    last_error = ""
    last_status: int | None = None
    attempts = max(1, max_retries + 1)

    for attempt in range(attempts):
        req = urllib.request.Request(
            endpoint,
            data=body,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout_s) as resp:
                status = int(resp.status)
                raw = resp.read().decode("utf-8", errors="replace")
                parsed: Any = json.loads(raw) if raw.strip() else {}
                return {
                    "ok": 200 <= status < 300,
                    "status": status,
                    "data": parsed,
                    "offline": False,
                    "attempts": attempt + 1,
                }
        except urllib.error.HTTPError as exc:
            last_status = int(exc.code)
            err_body = exc.read().decode("utf-8", errors="replace")[:300]
            last_error = f"HTTP {exc.code}: {err_body or exc.reason}"
            if 400 <= last_status < 500:
                return {
                    "ok": False,
                    "status": last_status,
                    "error": last_error,
                    "offline": False,
                    "attempts": attempt + 1,
                }
        except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as exc:
            last_error = str(exc)

        if attempt + 1 < attempts and retry_backoff_s > 0:
            time.sleep(retry_backoff_s * (attempt + 1))

    return {
        "ok": False,
        "status": last_status,
        "error": last_error or "NeuroLink server unreachable",
        "offline": True,
        "attempts": attempts,
    }


def format_triage_status_line(
    epoch_idx: int,
    server_res: dict[str, Any],
    edge_telemetry: dict[str, Any] | None = None,
) -> str:
    """Format a compact status line combining Tier-1 Edge TinyML and Tier-2 NeuroLink Server AI."""
    if edge_telemetry:
        ai_state = edge_telemetry.get("ai_state", edge_telemetry.get("state", "N/A"))
        rf_prob = edge_telemetry.get("ai_rf_prob", edge_telemetry.get("rf_prob"))
        rf_str = f"{float(rf_prob) * 100.0:.1f}%" if rf_prob is not None else "--"
        usb_only = edge_telemetry.get("usb_only")
        vbat_mv = edge_telemetry.get("vbat_mv")
        bat_pct = edge_telemetry.get("bat_pct")
        if usb_only:
            pwr_str = "USB"
        elif vbat_mv is not None:
            pwr_str = f"{int(vbat_mv) / 1000.0:.2f}V({bat_pct}%)"
        else:
            pwr_str = "--"
        tier1 = f"Tier1[state={ai_state}, rf={rf_str}, pwr={pwr_str}]"
    else:
        tier1 = "Tier1[no-telemetry]"

    if server_res.get("ok"):
        data = server_res.get("data") or {}
        if isinstance(data, dict):
            triage = (
                data.get("triage")
                or data.get("classification")
                or data.get("riskLevel")
                or data.get("status")
                or "OK"
            )
            prob = data.get("strokeProbability", data.get("probability", data.get("score")))
            prob_str = f", prob={float(prob):.3f}" if isinstance(prob, (int, float)) else ""
            tier2 = f"Tier2[HTTP {server_res.get('status')}: {triage}{prob_str}]"
        else:
            tier2 = f"Tier2[HTTP {server_res.get('status')}: OK]"
    elif server_res.get("offline"):
        tier2 = f"Tier2[OFFLINE: {server_res.get('error', 'unreachable')}]"
    else:
        tier2 = f"Tier2[ERR {server_res.get('status')}: {server_res.get('error', '')}]"

    return f"[Epoch #{epoch_idx:04d}] {tier1} | {tier2}"


class HardwareWsServer:
    """Lightweight RFC 6455 WebSocket server receiving ESP32 v3 EEG binary + JSON telemetry."""

    def __init__(
        self,
        host: str = "0.0.0.0",
        port: int = 4000,
        path: str = "/ws/hardware",
        on_samples: Callable[[np.ndarray], None] | None = None,
        on_telemetry: Callable[[dict[str, Any]], None] | None = None,
    ) -> None:
        self.host = host
        self.port = int(port)
        self.path = path if path.startswith("/") else f"/{path}"
        self._on_samples = on_samples
        self._on_telemetry = on_telemetry

        self._srv_sock: socket.socket | None = None
        self._client_sock: socket.socket | None = None
        self._client_lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None

        self.bound_port: int = self.port
        self.connected_device_id: str | None = None
        self.latest_telemetry: dict[str, Any] | None = None
        self.frames_received: int = 0
        self.samples_received: int = 0

    def start(self) -> tuple[str, int]:
        """Bind TCP socket and start background accept/receive thread."""
        srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        srv.bind((self.host, self.port))
        srv.listen(2)
        srv.settimeout(0.2)
        self._srv_sock = srv
        addr = srv.getsockname()
        self.bound_port = int(addr[1])
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._serve_loop, name="esp32-ws-rx", daemon=True)
        self._thread.start()
        return str(addr[0]), self.bound_port

    def stop(self) -> None:
        """Stop server and cleanly close active sockets."""
        self._stop_event.set()
        with self._client_lock:
            if self._client_sock is not None:
                try:
                    self._client_sock.shutdown(socket.SHUT_RDWR)
                except OSError:
                    pass
                try:
                    self._client_sock.close()
                except OSError:
                    pass
                self._client_sock = None
        if self._srv_sock is not None:
            try:
                self._srv_sock.close()
            except OSError:
                pass
            self._srv_sock = None
        if self._thread is not None:
            self._thread.join(timeout=2.0)
            self._thread = None

    def send_command(self, ascii_cmd: str) -> bool:
        """Send an ASCII command to the connected ESP32 via RFC 6455 Text frame (opcode 0x01)."""
        clean = ascii_cmd.strip()
        if not clean:
            return False
        frame = encode_ws_frame(0x01, clean.encode("utf-8"), masked=False)
        with self._client_lock:
            if self._client_sock is None:
                return False
            try:
                self._client_sock.sendall(frame)
                return True
            except OSError:
                return False

    def __enter__(self) -> HardwareWsServer:
        self.start()
        return self

    def __exit__(self, *_: Any) -> None:
        self.stop()

    def _serve_loop(self) -> None:
        assert self._srv_sock is not None
        while not self._stop_event.is_set():
            try:
                conn, _peer = self._srv_sock.accept()
            except TimeoutError:
                continue
            except OSError:
                break
            self._handle_client(conn)

    def _read_http_headers(self, conn: socket.socket) -> bytes:
        buf = bytearray()
        conn.settimeout(2.0)
        while b"\r\n\r\n" not in buf:
            chunk = conn.recv(1024)
            if not chunk:
                break
            buf.extend(chunk)
            if len(buf) > 4096:
                raise ValueError("HTTP upgrade header too large")
        return bytes(buf)

    def _handle_client(self, conn: socket.socket) -> None:
        try:
            raw_hdr = self._read_http_headers(conn)
            if b"\r\n\r\n" not in raw_hdr:
                return
            req_path, headers = parse_ws_upgrade_request(raw_hdr)
            if self.path and req_path != self.path:
                conn.sendall(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n")
                return
            ws_key = headers.get("sec-websocket-key", "")
            if not ws_key:
                conn.sendall(b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n")
                return

            conn.sendall(build_ws_handshake_response(ws_key))
            self.connected_device_id = headers.get("x-device-id", "unknown")
            with self._client_lock:
                self._client_sock = conn

            conn.settimeout(0.25)
            parser = StreamFrameParser()

            while not self._stop_event.is_set():
                try:
                    frame = recv_ws_frame(conn)
                except TimeoutError:
                    continue
                if frame is None:
                    break
                opcode, payload = frame
                if opcode == 0x08:  # Close
                    try:
                        conn.sendall(encode_ws_frame(0x08, b"", masked=False))
                    except OSError:
                        pass
                    break
                if opcode == 0x09:  # Ping -> Pong
                    try:
                        conn.sendall(encode_ws_frame(0x0A, payload, masked=False))
                    except OSError:
                        pass
                    continue
                if opcode == 0x01 and payload:  # Text telemetry JSON
                    try:
                        parsed = json.loads(payload.decode("utf-8", errors="replace"))
                        if isinstance(parsed, dict):
                            self.latest_telemetry = parsed
                            if self._on_telemetry is not None:
                                self._on_telemetry(parsed)
                    except json.JSONDecodeError:
                        continue
                elif opcode == 0x02 and payload:  # Binary 0xA5..0x5A EEG stream
                    for addr, eeg_payload in parser.feed(payload):
                        if addr == 0x11 and len(eeg_payload) >= 32:
                            block = decode_eeg_payload(eeg_payload)
                            self.frames_received += 1
                            self.samples_received += int(block.shape[0])
                            if self._on_samples is not None:
                                self._on_samples(block)
        except (OSError, ValueError):
            pass
        finally:
            with self._client_lock:
                if self._client_sock is conn:
                    self._client_sock = None
            try:
                conn.close()
            except OSError:
                pass


def _write_captured_csv(
    out_csv: Path, data: np.ndarray, sample_rate: int, montage: str
) -> None:
    """Persist an (N, 8) array to a montage-labeled CSV file."""
    ch_cols = resolve_montage_columns(montage)
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    with out_csv.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["timestamp_s", "sample_idx"] + ch_cols)
        fs = float(max(1, sample_rate))
        for idx, row in enumerate(data):
            t_s = round(idx / fs, 6)
            writer.writerow([t_s, idx] + [round(float(v), 4) for v in row])


def run_ws_bridge(
    neurolink_url: str,
    ws_host: str = "0.0.0.0",
    ws_port: int = 4000,
    ws_path: str = "/ws/hardware",
    rate_sps: int = 500,
    montage: str = "neurolink6",
    filter_preset: FilterPreset = "eeg",
    epoch_sec: float = 4.0,
    step_sec: float | None = None,
    duration_s: float = 0.0,
    clinical_category: str = "HARDWARE_BCI",
    out_csv: Path | None = None,
) -> int:
    """Run live Wi-Fi WebSocket -> NeuroLink HTTP qEEG bridge."""
    resolve_montage_columns(montage)
    effective_rate = min(rate_sps, 500)
    dsp = MultichannelBiopotentialFilter(effective_rate, preset=filter_preset)
    epoch_buf = EegEpochBuffer(effective_rate, epoch_sec=epoch_sec, step_sec=step_sec)
    recorded_chunks: list[np.ndarray] = []
    lock = threading.Lock()
    state = {"epochs_posted": 0}

    def _on_samples(block: np.ndarray) -> None:
        proc = dsp.process(block) if filter_preset != "none" else block
        with lock:
            if out_csv is not None:
                recorded_chunks.append(proc.copy())
            windows = epoch_buf.push(proc)
        for win in windows:
            state["epochs_posted"] += 1
            idx = state["epochs_posted"]
            csv_text = format_eeg_matrix_to_csv_text(
                win, sample_rate=effective_rate, montage=montage
            )
            res = post_eeg_epoch(
                server_url=neurolink_url,
                csv_text=csv_text,
                sampling_rate_hz=effective_rate,
                filename=f"holter_ws_epoch_{idx:04d}.csv",
                clinical_category=clinical_category,
            )
            print(format_triage_status_line(idx, res, srv.latest_telemetry))

    srv = HardwareWsServer(
        host=ws_host,
        port=ws_port,
        path=ws_path,
        on_samples=_on_samples,
    )
    bound_host, bound_port = srv.start()
    print(
        f"NeuroLink WS Bridge listening on ws://{bound_host}:{bound_port}{ws_path} "
        f"-> {neurolink_url.rstrip('/')}/api/qeeg/analyze-csv "
        f"(montage={montage}, epoch={epoch_sec}s, fs={effective_rate}Hz)"
    )

    t0 = time.monotonic()
    try:
        while True:
            if duration_s > 0.0 and (time.monotonic() - t0) >= duration_s:
                break
            time.sleep(0.1)
    except KeyboardInterrupt:
        pass
    finally:
        srv.stop()

    if out_csv is not None and recorded_chunks:
        _write_captured_csv(out_csv, np.vstack(recorded_chunks), effective_rate, montage)
        print(f"Saved WS bridge CSV: {out_csv}")
    return 0


def run_serial_bridge(
    port: str,
    baud: int,
    neurolink_url: str,
    rate_sps: int = 500,
    gain: int = 12,
    input_mode: str = "eeg",
    montage: str = "neurolink6",
    filter_preset: FilterPreset = "eeg",
    epoch_sec: float = 4.0,
    step_sec: float | None = None,
    duration_s: float = 0.0,
    clinical_category: str = "HARDWARE_BCI",
    out_csv: Path | None = None,
) -> int:
    """Run live USB Serial (921600 bps) -> NeuroLink HTTP qEEG bridge."""
    safe_port = assert_allowed_serial_port(port)
    resolve_montage_columns(montage)
    if rate_sps == 4000 and baud < 1500000:
        print(
            "ERROR: Live binary UART stream at 4000 SPS (~131 KB/s) exceeds 921600 bps UART capacity (~92 KB/s). "
            "Use --rate <= 2000 for USB UART, or record 4000 SPS offline to MicroSD Holter."
        )
        return 2

    ser = serial.Serial()
    ser.port = safe_port
    ser.baudrate = baud
    ser.timeout = 0.05
    ser.dtr = False
    ser.rts = False
    ser.open()

    parser = StreamFrameParser()
    dsp = MultichannelBiopotentialFilter(rate_sps, preset=filter_preset)
    epoch_buf = EegEpochBuffer(rate_sps, epoch_sec=epoch_sec, step_sec=step_sec)
    recorded_chunks: list[np.ndarray] = []
    edge_telemetry: dict[str, Any] | None = None
    epochs_posted = 0

    try:
        ser.write(build_stream_ctrl_cmd(False))
        ser.flush()
        time.sleep(0.05)
        ser.reset_input_buffer()

        # Query initial Tier-1 Edge AI status before enabling binary stream
        ser.write(b"AI\n")
        ser.flush()
        ai_deadline = time.monotonic() + 0.5
        while time.monotonic() < ai_deadline:
            ln = ser.readline().decode("utf-8", errors="replace").strip()
            if ln.startswith("{") and '"ai":1' in ln:
                try:
                    edge_telemetry = json.loads(ln)
                except json.JSONDecodeError:
                    pass
                break

        ser.write(build_conn_status_cmd(1))
        ser.write(build_set_params_cmd(rate_sps, gain, input_mode))
        ser.flush()
        time.sleep(0.12)
        ser.reset_input_buffer()

        print(
            f"NeuroLink Serial Bridge streaming from {safe_port}@{baud} "
            f"-> {neurolink_url.rstrip('/')}/api/qeeg/analyze-csv "
            f"(montage={montage}, epoch={epoch_sec}s, rate={rate_sps}Hz)"
        )
        t0 = time.monotonic()
        ser.write(build_stream_ctrl_cmd(True))
        ser.flush()

        while duration_s <= 0.0 or (time.monotonic() - t0) < duration_s:
            raw = ser.read(2048)
            if not raw:
                continue
            for addr, payload in parser.feed(raw):
                if addr == 0x11 and len(payload) >= 32:
                    block = decode_eeg_payload(payload)
                    if filter_preset != "none":
                        block = dsp.process(block)
                    if out_csv is not None:
                        recorded_chunks.append(block.copy())
                    for win in epoch_buf.push(block):
                        epochs_posted += 1
                        csv_text = format_eeg_matrix_to_csv_text(
                            win, sample_rate=rate_sps, montage=montage
                        )
                        res = post_eeg_epoch(
                            server_url=neurolink_url,
                            csv_text=csv_text,
                            sampling_rate_hz=rate_sps,
                            filename=f"holter_serial_epoch_{epochs_posted:04d}.csv",
                            clinical_category=clinical_category,
                        )
                        print(format_triage_status_line(epochs_posted, res, edge_telemetry))

        ser.write(build_stream_ctrl_cmd(False))
        ser.flush()
    except KeyboardInterrupt:
        try:
            ser.write(build_stream_ctrl_cmd(False))
            ser.flush()
        except OSError:
            pass
    finally:
        ser.close()

    if out_csv is not None and recorded_chunks:
        _write_captured_csv(out_csv, np.vstack(recorded_chunks), rate_sps, montage)
        print(f"Saved Serial bridge CSV: {out_csv}")
    return 0
