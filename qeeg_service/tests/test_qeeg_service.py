"""
Comprehensive tests for the NeuroLink Python qEEG Clinical Workstation Service.
Covers /api/qeeg/health, /api/qeeg/cases, /api/qeeg/analyze-case, /api/qeeg/analyze-csv,
/api/qeeg/export-pdf-summary, determinism of featureVector80, and static Dual-Mode UI checks.
"""

from __future__ import annotations

import json
import math
import os
import re
import sys
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("QEEG_DISABLE_N1_BG", "1")

QEEG_ROOT = Path(__file__).resolve().parents[1]
if str(QEEG_ROOT) not in sys.path:
    sys.path.insert(0, str(QEEG_ROOT))

from app import app  # noqa: E402

client = TestClient(app)


def _assert_analysis_shape(payload: dict) -> None:
    """Validates exact QeegAnalysisResult shape matching client/src/api/types.ts."""
    required_top = {
        "status",
        "engineSource",
        "caseId",
        "clinicalCategory",
        "classificationLabel",
        "classificationTitle",
        "trafficLight",
        "tpaBadge",
        "tpaCountdownMin",
        "safetyStatus",
        "decisionReason",
        "latencyMs",
        "samplingRateHz",
        "channelsCount",
        "montage",
        "biomarkers",
        "bandPowers",
        "probabilities",
        "featureVector80",
        "waveforms",
        "topomap",
        "telemetryQr",
    }
    assert required_top.issubset(payload.keys())
    assert payload["status"] == "SUCCESS"
    assert payload["engineSource"] == "python_qeeg_service"
    assert payload["trafficLight"] in {"green", "yellow", "red", "purple"}

    bm = payload["biomarkers"]
    for key in (
        "meanDar",
        "meanTar",
        "meanBsi",
        "pri",
        "wpli",
        "alphaPeakHz",
        "signalQualityScore",
        "cusumAlarm",
        "tpaLockoutTriggered",
    ):
        assert key in bm
    assert 0.0 <= bm["wpli"] <= 1.0
    assert 0.0 <= bm["signalQualityScore"] <= 1.0
    assert isinstance(bm["cusumAlarm"], bool)
    assert isinstance(bm["tpaLockoutTriggered"], bool)

    bp = payload["bandPowers"]
    assert set(bp.keys()) == {"delta", "theta", "alpha", "beta"}
    assert abs(sum(bp.values()) - 1.0) < 0.02

    probs = payload["probabilities"]
    assert set(probs.keys()) == {"control", "ischemic", "hemorrhagic", "epileptiform", "cognitiveFatigue"}
    assert all(0.0 <= v <= 1.0 for v in probs.values())
    assert abs(sum(probs.values()) - 1.0) < 0.01

    fv = payload["featureVector80"]
    assert isinstance(fv, list)
    assert len(fv) == 80
    assert all(isinstance(v, (int, float)) and math.isfinite(v) for v in fv)

    wf = payload["waveforms"]
    assert wf["channels"] == ["F3", "F4", "C3", "C4", "O1", "O2"]
    n_pts = len(wf["time"])
    assert n_pts >= 32
    for ch in wf["channels"]:
        assert len(wf["raw"][ch]) == n_pts
        assert len(wf["filtered"][ch]) == n_pts

    topo = payload["topomap"]
    assert len(topo) == 19
    physical_count = sum(1 for n in topo if n["isPhysical"])
    assert physical_count == 6
    for node in topo:
        assert set(node.keys()) == {"name", "x", "y", "isPhysical", "value", "dar"}
        assert isinstance(node["isPhysical"], bool)
        assert math.isfinite(node["value"]) and math.isfinite(node["dar"])

    qr_data = json.loads(payload["telemetryQr"])
    assert qr_data["device"] == "TI_ADS1299_EEG"


def test_qeeg_health() -> None:
    res = client.get("/api/qeeg/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["engineSource"] == "python_qeeg_service"
    assert data["categories"] == [
        "VASCULAR_STROKE",
        "EPILEPSY_ICU",
        "SLEEP_COGNITIVE",
        "HARDWARE_BCI",
    ]

    # Compatibility alias
    legacy = client.get("/api/health")
    assert legacy.status_code == 200
    assert legacy.json()["status"] == "ok"


def test_qeeg_cases_all_categories() -> None:
    res = client.get("/api/qeeg/cases")
    assert res.status_code == 200
    cases = res.json()["cases"]
    assert len(cases) == 6

    expected_ids = {
        "case_ischemia_lvo",
        "case_ich_hemorrhage",
        "case_epilepsy_temporal",
        "case_sleep_fatigue_n3",
        "case_healthy_alpha",
        "case_ads1299_hardware",
    }
    assert {c["id"] for c in cases} == expected_ids
    assert {c["clinicalCategory"] for c in cases} == {
        "VASCULAR_STROKE",
        "EPILEPSY_ICU",
        "SLEEP_COGNITIVE",
        "HARDWARE_BCI",
    }

    required_keys = {
        "id",
        "name",
        "subjectId",
        "clinicalCategory",
        "groundTruthLabel",
        "clinicalPresentation",
        "trafficLight",
        "tpaStatus",
        "badge",
        "samplingRateHz",
        "channelsCount",
    }
    for c in cases:
        assert required_keys.issubset(c.keys())
        assert "AI" not in c["name"]
        assert "Stroke AI" not in c["badge"]


@pytest.mark.parametrize(
    ("case_id", "expected_label", "expected_light", "expected_lockout"),
    [
        ("case_ischemia_lvo", "ISCHEMIC_STROKE", "red", False),
        ("case_ich_hemorrhage", "HEMORRHAGIC_STROKE", "purple", True),
        ("case_epilepsy_temporal", "EPILEPTIFORM_SLOWING", "yellow", False),
        ("case_sleep_fatigue_n3", "COGNITIVE_FATIGUE", "yellow", False),
        ("case_healthy_alpha", "CONTROL", "green", False),
        ("case_ads1299_hardware", "CONTROL", "green", False),
    ],
)
def test_analyze_case_all_six(
    case_id: str,
    expected_label: str,
    expected_light: str,
    expected_lockout: bool,
) -> None:
    res = client.post(
        "/api/qeeg/analyze-case",
        json={"caseId": case_id, "timeWindowSec": 6.0, "notch50Hz": True},
    )
    assert res.status_code == 200
    data = res.json()
    _assert_analysis_shape(data)
    assert data["caseId"] == case_id
    assert data["classificationLabel"] == expected_label
    assert data["trafficLight"] == expected_light
    assert data["biomarkers"]["tpaLockoutTriggered"] is expected_lockout

    if case_id == "case_ischemia_lvo":
        topo_map = {n["name"]: n for n in data["topomap"]}
        left_avg_dar = sum(topo_map[k]["dar"] for k in ("FP1", "F7", "F3", "T3", "C3", "T5", "P3", "O1")) / 8.0
        right_avg_dar = sum(topo_map[k]["dar"] for k in ("FP2", "F8", "F4", "T4", "C4", "T6", "P4", "O2")) / 8.0
        assert topo_map["F3"]["dar"] > topo_map["F4"]["dar"] * 3.0
        assert topo_map["C3"]["dar"] > topo_map["C4"]["dar"] * 3.0
        assert left_avg_dar > right_avg_dar * 2.5
    if case_id == "case_healthy_alpha":
        assert 8.0 <= data["biomarkers"]["alphaPeakHz"] <= 12.5
    if case_id == "case_sleep_fatigue_n3":
        assert data["biomarkers"]["meanBsi"] < 0.14


def test_analyze_case_feature_vector_deterministic() -> None:
    payload = {"caseId": "case_ischemia_lvo", "timeWindowSec": 5.0, "notch50Hz": True}
    r1 = client.post("/api/qeeg/analyze-case", json=payload).json()
    r2 = client.post("/api/qeeg/analyze-case", json=payload).json()
    assert r1["featureVector80"] == r2["featureVector80"]


def test_analyze_csv_vascular_and_control_and_validation() -> None:
    sfreq = 250.0
    t = np.linspace(0.0, 4.0, int(4.0 * sfreq), endpoint=False)

    # 1. Focal left ischemia CSV
    f3 = 42.0 * np.sin(2 * np.pi * 1.3 * t) + 12.0 * np.sin(2 * np.pi * 5.2 * t)
    c3 = 38.0 * np.sin(2 * np.pi * 1.4 * t) + 10.0 * np.sin(2 * np.pi * 5.0 * t)
    f4 = 12.0 * np.sin(2 * np.pi * 9.8 * t) + 4.0 * np.sin(2 * np.pi * 1.8 * t)
    c4 = 12.0 * np.sin(2 * np.pi * 10.0 * t) + 4.0 * np.sin(2 * np.pi * 1.9 * t)
    o1 = 10.0 * np.sin(2 * np.pi * 9.5 * t)
    o2 = 14.0 * np.sin(2 * np.pi * 10.1 * t)
    rows = ["F3,F4,C3,C4,O1,O2"] + [
        f"{f3[i]:.3f},{f4[i]:.3f},{c3[i]:.3f},{c4[i]:.3f},{o1[i]:.3f},{o2[i]:.3f}"
        for i in range(len(t))
    ]
    res = client.post(
        "/api/qeeg/analyze-csv",
        json={
            "filename": "focal_ischemia_test.csv",
            "csvText": "\n".join(rows),
            "samplingRateHz": sfreq,
            "clinicalCategory": "VASCULAR_STROKE",
        },
    )
    assert res.status_code == 200
    data = res.json()
    _assert_analysis_shape(data)
    assert data["classificationLabel"] == "ISCHEMIC_STROKE"
    assert data["biomarkers"]["meanBsi"] > 0.18

    # 2. Normal alpha CSV
    ctrl_rows = ["F3,F4,C3,C4,O1,O2"] + [
        (
            f"{8*np.sin(2*np.pi*10.2*t[i]):.3f},"
            f"{8*np.sin(2*np.pi*10.2*t[i]):.3f},"
            f"{10*np.sin(2*np.pi*10.2*t[i]):.3f},"
            f"{10*np.sin(2*np.pi*10.2*t[i]):.3f},"
            f"{26*np.sin(2*np.pi*10.2*t[i]):.3f},"
            f"{26*np.sin(2*np.pi*10.2*t[i]):.3f}"
        )
        for i in range(len(t))
    ]
    res_ctrl = client.post(
        "/api/qeeg/analyze-csv",
        json={
            "filename": "healthy_alpha_test.csv",
            "csvText": "\n".join(ctrl_rows),
            "samplingRateHz": sfreq,
            "clinicalCategory": "SLEEP_COGNITIVE",
        },
    )
    assert res_ctrl.status_code == 200
    ctrl_data = res_ctrl.json()
    _assert_analysis_shape(ctrl_data)
    assert ctrl_data["classificationLabel"] == "CONTROL"

    # 3. Empty CSV rejected
    bad_res = client.post(
        "/api/qeeg/analyze-csv",
        json={"filename": "empty.csv", "csvText": "   ", "samplingRateHz": 500},
    )
    assert bad_res.status_code == 400


@pytest.mark.parametrize("case_id", ["case_ischemia_lvo", "case_ich_hemorrhage", "case_epilepsy_temporal"])
def test_export_pdf_summary_valid_single_page(case_id: str) -> None:
    res = client.get(f"/api/qeeg/export-pdf-summary?caseId={case_id}")
    assert res.status_code == 200
    assert "application/pdf" in res.headers.get("content-type", "")
    pdf_bytes = res.content
    assert pdf_bytes.startswith(b"%PDF")
    assert len(pdf_bytes) > 10240
    # Verify single-page output (ReportLab emits /Type /Page per page plus /Type /Pages catalog)
    page_count = pdf_bytes.count(b"/Type /Page") - pdf_bytes.count(b"/Type /Pages")
    assert page_count == 1


def test_static_workstation_html_clean_and_dual_mode() -> None:
    html_path = QEEG_ROOT / "static" / "index.html"
    assert html_path.exists()
    html = html_path.read_text(encoding="utf-8")

    # Forbidden artifacts and buzzwords
    forbidden_substrings = [
        ".mindbridge-ambient",
        "mindbridge-ambient",
        "MindBridge",
        "acute-stroke-eeg.bme.dut.edu.vn",
        "Stroke AI",
        "AI-Powered",
        "👋",
        "🤖",
        "✨",
        "🚨",
        "⛔",
    ]
    for token in forbidden_substrings:
        assert token not in html, f"Forbidden token found in static/index.html: {token}"

    assert re.search(r"\bAI\b", html) is None, "Standalone 'AI' buzzword must not appear in static/index.html"

    # Required Dual-Mode styling & typography
    for expected in (
        "#f8fafb",
        "#0d9488",
        "#162b47",
        "#f1f5f9",
        "#2c6865",
        "Plus Jakarta Sans",
        "JetBrains Mono",
        'data-mode="general"',
        'data-mode="professional"',
        "URLSearchParams",
        "/api/qeeg/cases",
        "/api/qeeg/analyze-case",
        "/api/qeeg/analyze-csv",
        "/api/qeeg/export-pdf-summary",
        "/api/auth/me",
        "X-CSRF-Token",
        "/api/qeeg/save-to-platform",
        "/eeg-hub",
        "/consultations",
        "Dữ liệu chi tiết: Phổ tần số &amp; 80 chỉ số đặc trưng",
        "<details ",
    ):
        assert expected in html, f"Missing required element in static/index.html: {expected}"

    assert "<details open" not in html, "Secondary 80-feature accordion must start collapsed on load"

    # Verify root HTML endpoint serves it cleanly
    root_res = client.get("/")
    assert root_res.status_code == 200
    assert "Trạm Điện Não Định Lượng Lâm Sàng NeuroLink" in root_res.text
