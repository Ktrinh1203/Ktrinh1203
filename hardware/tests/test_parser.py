"""Unit tests for POST report parsing and hardware validation thresholds."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from hw_test_runner import evaluate_hardware_report, extract_post_report, extract_stream_info


SAMPLE_LOG = """
[BOOT] esp32_ads1299_bringup starting...
=== POST_REPORT_BEGIN ===
{"fw":"esp32_ads1299_bringup_v1","sd_cs_isolated":true,"tft_ok":true,"tft_preset":"G-Tab (2,1,BGR)","id_raw":"0x3E","id_masked":"0x1E","id_ok":true,"drdy_boot_hz":250.0,"drdy_ok":true,"regs_hex":"3E95D1EC0055555555555555550000000000000000000000","short_cfg_ok":true,"short_samples":128,"short_mean_uV":[1.2,-0.8,0.5,0.2,-0.1,0.4,0.9,-0.3],"short_rms_uV":[0.35,0.38,0.34,0.37,0.36,0.39,0.33,0.41],"short_pp_uV":[1.8,1.9,1.7,2.0,1.8,2.1,1.7,2.2],"test_cfg_ok":true,"test_samples":350,"expected_test_pp_uV":3750.0,"test_pp_uV":[3748.5,3751.2,3749.0,3752.1,3747.8,3750.4,3749.9,3751.0],"buttons_idle":{"UP":1,"DWN":1,"LET":1,"RHT":1,"MID":1,"SET":1}}
=== POST_REPORT_END ===
{"info":1,"ads_ok":true,"id":"0x3E","mode":0,"sps":500.0,"fps":20,"total":750,"pp_ch1":3750.0,"pp_ch8":3749.8}
"""


def test_parse_and_pass_verdict() -> None:
    """Valid POST + stream info should pass all checks."""
    report = extract_post_report(SAMPLE_LOG)
    assert report is not None
    assert report["id_masked"] == "0x1E"

    info = extract_stream_info(SAMPLE_LOG)
    assert info is not None
    assert info["sps"] == 500.0

    verdict = evaluate_hardware_report(report, info)
    assert verdict["overall_pass"] is True
    assert verdict["issues"] == []


def test_detect_stuck_button_and_bad_id() -> None:
    """Faulty ADS ID and stuck button must fail cleanly with actionable diagnostics."""
    report = extract_post_report(SAMPLE_LOG)
    assert report is not None
    report["id_ok"] = False
    report["id_raw"] = "0x00"
    report["buttons_idle"]["UP"] = 0

    verdict = evaluate_hardware_report(report, None)
    assert verdict["overall_pass"] is False
    assert verdict["checks"]["ads_id_ok"] is False
    assert verdict["checks"]["buttons_idle_ok"] is False
    assert len(verdict["issues"]) == 2
