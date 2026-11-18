"""Zero-distortion real-time IIR/SOS bandpass & notch filters for 8-channel EEG/EMG."""

from __future__ import annotations

from typing import Literal

import numpy as np
from scipy import signal  # type: ignore[import-untyped]

FilterPreset = Literal["none", "eeg", "emg"]


class MultichannelBiopotentialFilter:
    """Stateful SOS digital filter supporting 'eeg', 'emg', and 'none' presets."""

    def __init__(
        self, sample_rate: float, preset: FilterPreset = "eeg", n_channels: int = 8
    ) -> None:
        self.sample_rate = float(sample_rate)
        self.preset = preset
        self.n_channels = n_channels
        self._stages: list[tuple[np.ndarray, np.ndarray]] = []
        self._initialized = False
        self._build_stages()

    def _add_stage(self, sos: np.ndarray) -> None:
        zi_unit = signal.sosfilt_zi(sos)
        self._stages.append((sos, zi_unit))

    def _build_stages(self) -> None:
        self._stages.clear()
        self._initialized = False
        if self.preset == "none":
            return

        nyq = 0.5 * self.sample_rate
        if self.preset == "eeg":
            high_cut = min(45.0, 0.85 * nyq)
            if 0.5 < high_cut < nyq:
                sos_bp = signal.butter(
                    4, [0.5, high_cut], btype="bandpass", fs=self.sample_rate, output="sos"
                )
                self._add_stage(sos_bp)
            if 50.0 < 0.96 * nyq:
                b_n, a_n = signal.iirnotch(50.0, 30.0, fs=self.sample_rate)
                self._add_stage(signal.tf2sos(b_n, a_n))
        elif self.preset == "emg":
            low_cut = min(20.0, 0.35 * nyq)
            high_cut = min(200.0, 0.85 * nyq)
            if low_cut < high_cut < nyq:
                sos_bp = signal.butter(
                    4, [low_cut, high_cut], btype="bandpass", fs=self.sample_rate, output="sos"
                )
                self._add_stage(sos_bp)
            for freq in (50.0, 100.0, 150.0):
                if freq < 0.96 * nyq:
                    b_n, a_n = signal.iirnotch(freq, 30.0, fs=self.sample_rate)
                    self._add_stage(signal.tf2sos(b_n, a_n))
        else:
            raise ValueError(f"Unsupported filter preset: {self.preset}")

    def process(self, block_uv: np.ndarray) -> np.ndarray:
        """Filter an (N, n_channels) microvolt array preserving SOS state across chunks."""
        if block_uv.ndim != 2 or block_uv.shape[1] != self.n_channels:
            raise ValueError(
                f"Expected shape (N, {self.n_channels}), got {block_uv.shape}"
            )
        if block_uv.shape[0] == 0 or not self._stages:
            return block_uv.copy()

        data = block_uv.astype(np.float64, copy=True)
        init_now = not self._initialized
        for idx, (sos, state_or_unit) in enumerate(self._stages):
            if init_now:
                # Scale steady-state unit step zi by the initial sample value per channel
                zi = state_or_unit[:, :, np.newaxis] * data[0:1, :]
            else:
                zi = state_or_unit
            data, new_zi = signal.sosfilt(sos, data, axis=0, zi=zi)
            self._stages[idx] = (sos, new_zi)
        self._initialized = True
        return data
