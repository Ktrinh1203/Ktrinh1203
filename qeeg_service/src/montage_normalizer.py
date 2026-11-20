"""
Montage Normalizer & Spherical Splines Interpolator (Milestone 2 - Pillar 1)
Project: Acute Stroke EEG AI Research (19-Channel Real-time Detection & Benchmarking)
Location: D:/PRJ_Personal/eeg_projects/acute_stroke_eeg/src/montage_normalizer.py

Key Capabilities & Electrophysiological Foundations:
1. Global Average Reference (GAR):
   - Mathematically removes reference drift: \tilde{v}_i(t) = v_i(t) - (1/C) \\sum_{j=1}^C v_j(t)
   - Eliminates reference electrode offsets (BioSemi CMS/DRL, linked-ear, mastoid, average).
   - Invariance guarantee: \\sum_{i=1}^C \tilde{v}_i(t) = 0.000000 +- 1e-10 uV for all time samples.

2. Spherical Splines Interpolation (Perrin et al. 1989):
   - Reference: Perrin, F., Pernier, J., Bertrand, O., & Echallier, J. F. (1989).
     Spherical splines for scalp potential and current density mapping.
     Electroencephalography and Clinical Neurophysiology, 72(2), 184-187. Corrigenda (1990), 76(6), 565.
   - Normalized unit sphere electrode coordinates (r = 1.0).
   - Legendre polynomial series expansion:
     g_m(cos \theta) = (1 / 4\\pi) * \\sum_{n=1}^{N} [ (2n + 1) / (n(n+1))^m ] * P_n(cos \theta)
     where m = 4 (spline order), \\lambda = 10^-4 (regularization parameter), N = 50 terms.
   - Closed-form linear mapping: V_dst = W * V_src.

3. Faulty Channel Recovery & Energy Invariance:
   - Detects corrupted channels (NaN, Inf, flatline std < 1e-6, extreme saturation spikes > 1000 uV).
   - Reconstructs corrupted channels via spherical spline interpolation from valid surrounding sensors.
   - Signal energy preservation verification ensuring variance and RMS power stability.
"""

import re
import warnings
from typing import Dict, List, Optional, Tuple
import numpy as np
import scipy.special as sp

# Standard 19 channels locked order (10-20 system)
STANDARD_19_CHANNELS = [
    "FP1", "FP2", "F3", "F4", "C3", "C4", "P3", "P4", "O1", "O2",
    "F7", "F8", "T3", "T4", "T5", "T6", "FZ", "CZ", "PZ"
]

# Standard synonyms mapping 10-10 names to standard 10-20
STANDARD_CHANNEL_SYNONYMS = {
    "T7": "T3",
    "T8": "T4",
    "P7": "T5",
    "P8": "T6",
}

# Standard 3D coordinates on unit sphere (r = 1.0) for 10-20 and common 10-10 / BioSemi electrodes
# Derived from Colin27 standard 1020/1005 template and normalized to ||r|| = 1.0
STANDARD_ELECTRODE_SPHERICAL_COORDS: Dict[str, np.ndarray] = {
    # 19 Standard 10-20 Channels
    "FP1": np.array([-0.329991, 0.940726, -0.078359], dtype=np.float64),
    "FP2": np.array([0.330899, 0.940402, -0.078426], dtype=np.float64),
    "F3":  np.array([-0.595220, 0.629189, 0.499834], dtype=np.float64),
    "F4":  np.array([0.606623, 0.635512, 0.477633], dtype=np.float64),
    "C3":  np.array([-0.706876, -0.125802, 0.696060], dtype=np.float64),
    "C4":  np.array([0.720988, -0.117092, 0.682983], dtype=np.float64),
    "P3":  np.array([-0.480960, -0.714878, 0.507570], dtype=np.float64),
    "P4":  np.array([0.498504, -0.703519, 0.506513], dtype=np.float64),
    "O1":  np.array([-0.252329, -0.964666, 0.075827], dtype=np.float64),
    "O2":  np.array([0.256398, -0.963610, 0.075607], dtype=np.float64),
    "F7":  np.array([-0.847627, 0.512395, -0.137767], dtype=np.float64),
    "F8":  np.array([0.846108, 0.514567, -0.139004], dtype=np.float64),
    "T3":  np.array([-0.976571, -0.185874, -0.108447], dtype=np.float64),
    "T4":  np.array([0.978884, -0.172815, -0.109187], dtype=np.float64),
    "T5":  np.array([-0.701950, -0.711819, -0.024101], dtype=np.float64),
    "T6":  np.array([0.706832, -0.706954, -0.024575], dtype=np.float64),
    "FZ":  np.array([0.003526, 0.660786, 0.750566], dtype=np.float64),
    "CZ":  np.array([0.003983, -0.091066, 0.995837], dtype=np.float64),
    "PZ":  np.array([0.002804, -0.700597, 0.713552], dtype=np.float64),

    # Common Extended 10-10 & BioSemi 32 Channels
    "FPZ": np.array([0.001272, 0.999811, -0.019408], dtype=np.float64),
    "OZ":  np.array([0.000929, -0.991960, 0.126546], dtype=np.float64),
    "AF3": np.array([-0.389395, 0.887815, 0.245268], dtype=np.float64),
    "AF4": np.array([0.404395, 0.880143, 0.248623], dtype=np.float64),
    "FC1": np.array([-0.375357, 0.286639, 0.881445], dtype=np.float64),
    "FC2": np.array([0.386023, 0.293400, 0.874587], dtype=np.float64),
    "FC5": np.array([-0.929019, 0.224309, 0.294293], dtype=np.float64),
    "FC6": np.array([0.929583, 0.233006, 0.285628], dtype=np.float64),
    "CP1": np.array([-0.326425, -0.434692, 0.839339], dtype=np.float64),
    "CP2": np.array([0.351645, -0.431251, 0.830884], dtype=np.float64),
    "CP5": np.array([-0.818335, -0.478616, 0.318205], dtype=np.float64),
    "CP6": np.array([0.831488, -0.460056, 0.311412], dtype=np.float64),
    "PO3": np.array([-0.321642, -0.888450, 0.327418], dtype=np.float64),
    "PO4": np.array([0.324496, -0.889716, 0.321103], dtype=np.float64),
    "AFZ": np.array([0.002400, 0.932000, 0.362000], dtype=np.float64),
    "FCZ": np.array([0.003800, 0.290000, 0.957000], dtype=np.float64),
    "CPZ": np.array([0.003400, -0.433000, 0.901000], dtype=np.float64),
    "POZ": np.array([0.001900, -0.890000, 0.455000], dtype=np.float64),
    "TP9":  np.array([-0.795524, -0.432188, -0.424683], dtype=np.float64),
    "TP10": np.array([0.795203, -0.434097, -0.423333], dtype=np.float64),
}


def normalize_channel_label(ch: str) -> str:
    """
    Cleans raw channel label: strips prefixes, suffixes, whitespace, converts to uppercase
    and applies standard synonyms (e.g., T7 -> T3).
    """
    cleaned = ch.strip().upper()
    for prefix in ["EEG ", "EEG-", "EEG_"]:
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):]
    cleaned = re.sub(r"[-_](REF|LE|AVG|CMS|DRL)$", "", cleaned)
    return STANDARD_CHANNEL_SYNONYMS.get(cleaned, cleaned)


def compute_legendre_series_g(
    cos_theta: np.ndarray,
    m: int = 4,
    n_terms: int = 50
) -> np.ndarray:
    """
    Computes Perrin et al. 1989 spherical spline interpolation basis function g_m(cos \theta):

        g_m(x) = (1 / (4 * \\pi)) * \\sum_{n=1}^{n_terms} \frac{2n + 1}{(n(n+1))^m} P_n(x)

    Parameters
    ----------
    cos_theta : np.ndarray
        Array of cosine of angles between electrode pairs, clamped to [-1.0, 1.0].
    m : int
        Legendre polynomial power exponent (order m=4 per Perrin 1989).
    n_terms : int
        Number of series summation terms (N=50).

    Returns
    -------
    g : np.ndarray
        Evaluated basis function matrix of the same shape as cos_theta.
    """
    cos_clamped = np.clip(cos_theta, -1.0, 1.0)
    g = np.zeros_like(cos_clamped, dtype=np.float64)
    for n in range(1, n_terms + 1):
        coeff = (2.0 * n + 1.0) / ((n * (n + 1.0)) ** m)
        p_n = sp.eval_legendre(n, cos_clamped)
        g += coeff * p_n
    return g / (4.0 * np.pi)


class MontageNormalizer:
    """
    Montage Normalizer implementing Global Average Reference (GAR) and
    Perrin et al. 1989 Spherical Splines Interpolation on the unit sphere.
    """

    def __init__(
        self,
        m: int = 4,
        lambda_reg: float = 1e-4,
        n_legendre: int = 50,
        custom_coords: Optional[Dict[str, np.ndarray]] = None
    ):
        """
        Parameters
        ----------
        m : int
            Spline order exponent (default: 4).
        lambda_reg : float
            Smoothing/regularization parameter (default: 1e-4).
        n_legendre : int
            Number of series terms for Legendre polynomial summation (default: 50).
        custom_coords : dict, optional
            Dictionary mapping channel names to 3D unit-sphere coordinate vectors.
        """
        self.m = m
        self.lambda_reg = lambda_reg
        self.n_legendre = n_legendre

        # Build coordinate lookup table
        self.coords: Dict[str, np.ndarray] = dict(STANDARD_ELECTRODE_SPHERICAL_COORDS)
        if custom_coords is not None:
            for ch, vec in custom_coords.items():
                norm_ch = normalize_channel_label(ch)
                v = np.asarray(vec, dtype=np.float64).ravel()
                norm = np.linalg.norm(v)
                self.coords[norm_ch] = v / (norm if norm > 0 else 1.0)

        # Standard 19 target coordinate matrix (19, 3)
        self.standard_19_channels = list(STANDARD_19_CHANNELS)
        self.standard_19_coords = np.vstack([
            self.coords[ch] for ch in self.standard_19_channels
        ])

    def normalize_channel_names(self, ch_names: List[str]) -> List[str]:
        """Normalizes a list of channel strings to standard uppercase 10-20 format."""
        return [normalize_channel_label(ch) for ch in ch_names]

    def get_electrode_coordinates(self, ch_names: List[str]) -> np.ndarray:
        """
        Retrieves 3D unit sphere coordinates for the given channel names.
        Raises KeyError if any channel is unrecognized.
        """
        norm_names = self.normalize_channel_names(ch_names)
        coords_list = []
        for orig, norm in zip(ch_names, norm_names):
            if norm in self.coords:
                coords_list.append(self.coords[norm])
            else:
                raise KeyError(
                    f"Electrode '{orig}' (normalized: '{norm}') is not in standard spherical coordinates table."
                )
        return np.vstack(coords_list)

    @staticmethod
    def apply_gar(data: np.ndarray, axis: int = 0) -> np.ndarray:
        """
        Applies Global Average Reference (GAR) across electrodes:
            \tilde{v}_i(t) = v_i(t) - (1/C) \\sum_{j=1}^C v_j(t)

        Parameters
        ----------
        data : np.ndarray
            Multi-channel EEG array.
        axis : int
            Axis corresponding to the electrodes (default: 0, channels in axis 0, time in axis 1).

        Returns
        -------
        gar_data : np.ndarray
            Re-referenced EEG data. At every time point, the sum of all channels is guaranteed
            to be 0.000000 +- 1e-10 uV.
        """
        data_arr = np.asarray(data, dtype=np.float64)
        mean_val = np.mean(data_arr, axis=axis, keepdims=True)
        gar_data = data_arr - mean_val
        return gar_data

    def compute_interpolation_matrix(
        self,
        src_ch_names: List[str],
        dst_ch_names: Optional[List[str]] = None
    ) -> np.ndarray:
        """
        Computes the Perrin et al. 1989 closed-form spherical spline interpolation matrix W:
            V_dst = W * V_src

        Parameters
        ----------
        src_ch_names : list of str
            Available source channel names.
        dst_ch_names : list of str, optional
            Target channel names (default: standard 19 channels locked order).

        Returns
        -------
        W : np.ndarray, shape (len(dst_ch_names), len(src_ch_names))
            Linear mapping interpolation matrix.
        """
        if dst_ch_names is None:
            dst_ch_names = self.standard_19_channels

        src_coords = self.get_electrode_coordinates(src_ch_names) # (N_src, 3)
        dst_coords = self.get_electrode_coordinates(dst_ch_names) # (N_dst, 3)

        N_s = len(src_ch_names)
        N_d = len(dst_ch_names)

        # Pairwise cosine of angles among source electrodes
        cos_src = np.clip(np.dot(src_coords, src_coords.T), -1.0, 1.0)
        G_src = compute_legendre_series_g(cos_src, m=self.m, n_terms=self.n_legendre)

        # Augmented linear system matrix K of shape (N_s + 1, N_s + 1)
        K = np.zeros((N_s + 1, N_s + 1), dtype=np.float64)
        K[:N_s, :N_s] = G_src + self.lambda_reg * np.eye(N_s, dtype=np.float64)
        K[:N_s, N_s] = 1.0
        K[N_s, :N_s] = 1.0
        K[N_s, N_s] = 0.0

        # Pseudo-inverse for optimal numerical stability
        K_inv = np.linalg.pinv(K)

        # Cross basis matrix between destination and source electrodes
        cos_dst_src = np.clip(np.dot(dst_coords, src_coords.T), -1.0, 1.0)
        G_dst_src = compute_legendre_series_g(cos_dst_src, m=self.m, n_terms=self.n_legendre)

        # Target augmented design matrix
        ones_d = np.ones((N_d, 1), dtype=np.float64)
        L = np.hstack([G_dst_src, ones_d]) # (N_d, N_s + 1)

        # Interpolation weights W
        W = L @ K_inv[:, :N_s] # (N_d, N_s)
        return W

    def compute_spherical_spline_interpolation(
        self,
        data_src: np.ndarray,
        src_ch_names: List[str],
        dst_ch_names: Optional[List[str]] = None,
        axis: int = 0
    ) -> np.ndarray:
        """
        Interpolates potential field from source layout to destination layout via Spherical Splines.
        """
        W = self.compute_interpolation_matrix(src_ch_names, dst_ch_names)
        data_arr = np.asarray(data_src, dtype=np.float64)
        if axis == 0:
            return W @ data_arr
        elif axis == 1:
            return (W @ data_arr.T).T
        else:
            raise ValueError(f"Unsupported axis={axis}. Must be 0 or 1.")

    def detect_and_repair_faulty_channels(
        self,
        data: np.ndarray,
        ch_names: List[str],
        flatline_std_threshold: float = 1e-6,
        extreme_voltage_threshold: float = 1000.0,
        axis: int = 0
    ) -> Tuple[np.ndarray, List[int], List[str]]:
        """
        Detects faulty/artifact channels (NaN, Inf, flatline, extreme voltage spikes)
        and repairs them using spherical spline interpolation from valid channels.

        Returns
        -------
        repaired_data : np.ndarray
            Clean data array with faulty channels reconstructed.
        bad_indices : list of int
            Indices of corrupted channels.
        bad_ch_names : list of str
            Names of corrupted channels.
        """
        data_arr = np.asarray(data, dtype=np.float64).copy()
        num_ch = data_arr.shape[axis]
        bad_indices = []

        for i in range(num_ch):
            ch_data = data_arr[i, :] if axis == 0 else data_arr[:, i]
            has_nan_inf = np.any(np.isnan(ch_data)) or np.any(np.isinf(ch_data))
            if has_nan_inf:
                bad_indices.append(i)
                continue

            std_val = float(np.std(ch_data))
            if std_val < flatline_std_threshold:
                bad_indices.append(i)
                continue

            max_abs = float(np.max(np.abs(ch_data)))
            if max_abs > extreme_voltage_threshold:
                bad_indices.append(i)
                continue

        if not bad_indices:
            return data_arr, [], []

        good_indices = [i for i in range(num_ch) if i not in bad_indices]
        if len(good_indices) < 4:
            warnings.warn(
                f"Too many faulty channels ({len(bad_indices)}/{num_ch}). Spline interpolation requires >= 4 good channels."
            )
            return data_arr, bad_indices, [ch_names[i] for i in bad_indices]

        good_ch_names = [ch_names[i] for i in good_indices]
        bad_ch_names = [ch_names[i] for i in bad_indices]

        good_data = data_arr[good_indices, :] if axis == 0 else data_arr[:, good_indices]

        # Interpolate specifically the bad channels from the good channels
        W_repair = self.compute_interpolation_matrix(good_ch_names, bad_ch_names)
        repaired_bad = W_repair @ (good_data if axis == 0 else good_data.T)

        for b_local, b_idx in enumerate(bad_indices):
            if axis == 0:
                data_arr[b_idx, :] = repaired_bad[b_local, :]
            else:
                data_arr[:, b_idx] = repaired_bad[b_local, :]

        return data_arr, bad_indices, bad_ch_names

    def interpolate_missing_channels(
        self,
        data_raw: np.ndarray,
        ch_names: List[str],
        mode: str = "hybrid"
    ) -> Tuple[np.ndarray, List[str]]:
        """
        Maps an arbitrary channel configuration to the standard 19 10-20 channels.

        Parameters
        ----------
        data_raw : np.ndarray, shape (num_ch, T)
            Input raw EEG recording.
        ch_names : list of str
            Channel names corresponding to data_raw.
        mode : str
            - "hybrid": retains exact raw signal for electrodes already matching standard 10-20,
              and computes spherical spline interpolation ONLY for missing channels.
            - "full_spline": performs full spherical spline field reconstruction for all 19 channels.

        Returns
        -------
        output_19ch : np.ndarray, shape (19, T)
            Standard 19-channel array.
        standard_19_channels : list of str
            Locked 19-channel names list.
        """
        norm_ch_names = self.normalize_channel_names(ch_names)
        data_clean, _, _ = self.detect_and_repair_faulty_channels(data_raw, norm_ch_names, axis=0)

        T = data_clean.shape[1]
        out_19 = np.zeros((19, T), dtype=np.float64)

        # Check if already 19 channels in exact locked order
        if norm_ch_names == self.standard_19_channels:
            return data_clean, self.standard_19_channels

        if mode == "hybrid":
            matched_indices = {}
            missing_channels = []
            for t_idx, t_name in enumerate(self.standard_19_channels):
                if t_name in norm_ch_names:
                    s_idx = norm_ch_names.index(t_name)
                    out_19[t_idx, :] = data_clean[s_idx, :]
                    matched_indices[t_name] = s_idx
                else:
                    missing_channels.append((t_idx, t_name))

            if missing_channels:
                missing_dst_names = [name for _, name in missing_channels]
                W = self.compute_interpolation_matrix(norm_ch_names, missing_dst_names)
                interp_vals = W @ data_clean
                for local_idx, (t_idx, _) in enumerate(missing_channels):
                    out_19[t_idx, :] = interp_vals[local_idx, :]
        else:
            # Full spline reconstruction
            W = self.compute_interpolation_matrix(norm_ch_names, self.standard_19_channels)
            out_19 = W @ data_clean

        return out_19, self.standard_19_channels

    def apply_gar_and_spherical_splines(
        self,
        data_raw: np.ndarray,
        ch_names: List[str],
        mode: str = "hybrid"
    ) -> np.ndarray:
        """
        Unified Pillar 1 Pipeline:
        1. Normalizes channel names and repairs local corruptions.
        2. Interpolates any missing/deviated channels onto the locked 19 10-20 locations.
        3. Applies Global Average Reference (GAR) across the 19 channels to guarantee \\sum \tilde{v}_i = 0.

        Parameters
        ----------
        data_raw : np.ndarray
            Input EEG data array of shape (N_channels, T).
        ch_names : list of str
            Corresponding channel labels.
        mode : str
            Interpolation mode ("hybrid" or "full_spline").

        Returns
        -------
        normalized_19ch : np.ndarray, shape (19, T)
            Reference-invariant, 10-20 standardized EEG signal.
        """
        data_19, _ = self.interpolate_missing_channels(data_raw, ch_names, mode=mode)
        gar_19 = self.apply_gar(data_19, axis=0)
        return gar_19

    @staticmethod
    def verify_energy_preservation(
        original_data: np.ndarray,
        normalized_data: np.ndarray,
        rel_tolerance: float = 0.35
    ) -> bool:
        """
        Verifies that signal power and variance remain preserved within physiological limits.
        """
        rms_orig = np.sqrt(np.mean(original_data ** 2))
        rms_norm = np.sqrt(np.mean(normalized_data ** 2))
        if rms_orig < 1e-12:
            return True
        ratio = float(abs(rms_norm - rms_orig) / rms_orig)
        return ratio <= rel_tolerance
