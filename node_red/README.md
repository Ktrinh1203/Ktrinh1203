# NeuroLink IoT Visual Gateway (`node_red/`)

Self-contained **Node-RED v5** visual hardware gateway bridging physical **ESP32-ADS1299 v3** EEG Holter devices with the **NeuroLink Express API** (`http://127.0.0.1:4000`) using **100% built-in Node-RED core nodes** (zero third-party palette dependencies).

---

## 1. Visual Flow Architecture (4 Tabs)

Open `http://127.0.0.1:1880` once launched to inspect or interact with all 4 flows:

| Tab | Role & Wiring |
|---|---|
| **1. ESP32 Hardware Gateway** | Listens on WebSocket `/ws/hardware` (`websocket-listener`), decodes both **197-byte binary ADS1299 frames** (`0xA5 0xC2 0x11 0xD3 [48 × float32 LE = 6 samples × 8 ch µV] 0x5A`) and **JSON telemetry heartbeats**, and forwards authenticated `POST` payloads (`x-nodered-secret`) to `:4000/api/devices/ingest/samples` and `:4000/api/devices/ingest/telemetry`. Exposes `POST /device/command` (forwards ASCII CLI commands like `MKR`, `REC_START`, `PWR` down `/ws/hardware`) and `GET /gateway/status`. |
| **2. Edge AI & Alert Router** | Inspects incoming ESP32 telemetry for `ai_state === 'STROKE_ALERT'` (`CRITICAL`), `0 < vbat_mv < 3450` (`LOW_BATTERY`), and `loff_p > 0` (`LEAD_OFF`) with 30-second per-code debounce, posting structured alerts to `:4000/api/devices/ingest/alert`. |
| **3. qEEG Epoch Forwarder** | Buffers rolling 4-second 8-channel epochs (`F3,F4,C3,C4,O1,O2,T3,T4`) in flow memory, submits CSV to `POST :4000/api/qeeg/analyze-csv`, and persists the resulting session via `POST :4000/api/devices/ingest/epoch`. Includes a manual **Flush Buffered Epoch Now** trigger. |
| **4. ESP32 Test Simulator** | Three one-click `inject` buttons (`Sim: Normal Sinusoidal EEG`, `Sim: Acute Stroke Alert`, `Sim: Critical Battery 3.38V`) posting realistic 250-sample 8-channel waveforms, telemetry, and alerts directly to Express `:4000` for hardware-free demonstrations. |

---

## 2. Launching

### Automatic (Unified Mega-Server)
```powershell
python start_unified_server.py
```
To skip Node-RED while running the rest of the stack:
```powershell
python start_unified_server.py --no-nodered
```

### Standalone
```powershell
node-red -u node_red -s node_red/settings.js --no-telemetry
```

---

## 3. Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NODERED_PORT` | `1880` | HTTP editor & WebSocket listener port |
| `NEUROLINK_API_URL` | `http://127.0.0.1:4000` | Target NeuroLink Express API base URL |
| `NODERED_INGEST_SECRET` | `neurolink-nodered-dev-secret` | Shared secret sent in `x-nodered-secret` header (must match `server/.env`) |
| `NODERED_DEFAULT_DEVICE_CODE` | `NL-HOLTER-01` | Fallback device code when hardware frames omit explicit `deviceCode` |

---

## 4. Direct Express WS vs Node-RED WS

- **Direct RFC 6455 WebSocket (Lowest Latency):** Point ESP32 firmware to `ws://<server-ip>:4000/ws/hardware?deviceCode=NL-HOLTER-01&key=<apiKey>` (or `/ws/hardware` plug-and-play in dev).
- **Node-RED Visual Gateway (Visual Routing & Alerts):** Point ESP32 firmware to `ws://<server-ip>:1880/ws/hardware` (`WIFI_SET <ssid> <pass> <host> 1880 /ws/hardware`) to inspect live packets, route Edge AI alerts, and run rolling 4s qEEG epoch pipelines visually.
