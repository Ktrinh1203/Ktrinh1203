/**
 * =============================================================================
 * STROKE DETECTION AI FOR ESP32 SMART GLASSES (TINYML EMBEDDED C HEADER)
 * =============================================================================
 * Target Platform : ESP32 / ESP32-S3 / ESP32-C3 / ARM Cortex-M
 * Architecture    : Zero-Dependency Pure C / C++ Header (No external libraries)
 * Memory Footprint: 0 KB Dynamic RAM (No heap / malloc), ~22 KB Flash
 * Inference Time  : < 5 microseconds @ 240 MHz
 * Input Dimension : 98 features (8 Glasses Channels: FP1,FP2,F3,F4,F7,F8,T3,T4)
 * Model Engine 1  : Tiny Random Forest (16 Trees, Max Depth 7) [AUROC: 0.9508]
 * Model Engine 2  : Quantized Linear Logistic Model (< 2 KB Flash) [AUROC: 0.9173]
 * =============================================================================
 */

#ifndef STROKE_GLASSES_ESP32_H
#define STROKE_GLASSES_ESP32_H

#include <math.h>
#ifdef ARDUINO
#include <pgmspace.h>
#endif
#ifndef PROGMEM
#define PROGMEM
#endif

#ifdef __cplusplus
extern "C" {
#endif

#define STROKE_GLASSES_NUM_FEATURES 98
#define STROKE_GLASSES_NUM_TREES    16
#define STROKE_DEFAULT_THRESHOLD    0.50f

/* Feature Index Enumeration for Direct Addressing */
typedef enum {
    FEAT_F3_dar = 0,
    FEAT_F3_dtabr = 1,
    FEAT_F3_hjorth_complexity = 2,
    FEAT_F3_hjorth_mobility = 3,
    FEAT_F3_rel_alpha = 4,
    FEAT_F3_rel_beta = 5,
    FEAT_F3_rel_delta = 6,
    FEAT_F3_rel_gamma = 7,
    FEAT_F3_rel_theta = 8,
    FEAT_F3_spectral_entropy = 9,
    FEAT_F3_tar = 10,
    FEAT_F4_dar = 11,
    FEAT_F4_dtabr = 12,
    FEAT_F4_hjorth_complexity = 13,
    FEAT_F4_hjorth_mobility = 14,
    FEAT_F4_rel_alpha = 15,
    FEAT_F4_rel_beta = 16,
    FEAT_F4_rel_delta = 17,
    FEAT_F4_rel_gamma = 18,
    FEAT_F4_rel_theta = 19,
    FEAT_F4_spectral_entropy = 20,
    FEAT_F4_tar = 21,
    FEAT_F7_dar = 22,
    FEAT_F7_dtabr = 23,
    FEAT_F7_hjorth_complexity = 24,
    FEAT_F7_hjorth_mobility = 25,
    FEAT_F7_rel_alpha = 26,
    FEAT_F7_rel_beta = 27,
    FEAT_F7_rel_delta = 28,
    FEAT_F7_rel_gamma = 29,
    FEAT_F7_rel_theta = 30,
    FEAT_F7_spectral_entropy = 31,
    FEAT_F7_tar = 32,
    FEAT_F8_dar = 33,
    FEAT_F8_dtabr = 34,
    FEAT_F8_hjorth_complexity = 35,
    FEAT_F8_hjorth_mobility = 36,
    FEAT_F8_rel_alpha = 37,
    FEAT_F8_rel_beta = 38,
    FEAT_F8_rel_delta = 39,
    FEAT_F8_rel_gamma = 40,
    FEAT_F8_rel_theta = 41,
    FEAT_F8_spectral_entropy = 42,
    FEAT_F8_tar = 43,
    FEAT_FP1_dar = 44,
    FEAT_FP1_dtabr = 45,
    FEAT_FP1_hjorth_complexity = 46,
    FEAT_FP1_hjorth_mobility = 47,
    FEAT_FP1_rel_alpha = 48,
    FEAT_FP1_rel_beta = 49,
    FEAT_FP1_rel_delta = 50,
    FEAT_FP1_rel_gamma = 51,
    FEAT_FP1_rel_theta = 52,
    FEAT_FP1_spectral_entropy = 53,
    FEAT_FP1_tar = 54,
    FEAT_FP2_dar = 55,
    FEAT_FP2_dtabr = 56,
    FEAT_FP2_hjorth_complexity = 57,
    FEAT_FP2_hjorth_mobility = 58,
    FEAT_FP2_rel_alpha = 59,
    FEAT_FP2_rel_beta = 60,
    FEAT_FP2_rel_delta = 61,
    FEAT_FP2_rel_gamma = 62,
    FEAT_FP2_rel_theta = 63,
    FEAT_FP2_spectral_entropy = 64,
    FEAT_FP2_tar = 65,
    FEAT_T3_dar = 66,
    FEAT_T3_dtabr = 67,
    FEAT_T3_hjorth_complexity = 68,
    FEAT_T3_hjorth_mobility = 69,
    FEAT_T3_rel_alpha = 70,
    FEAT_T3_rel_beta = 71,
    FEAT_T3_rel_delta = 72,
    FEAT_T3_rel_gamma = 73,
    FEAT_T3_rel_theta = 74,
    FEAT_T3_spectral_entropy = 75,
    FEAT_T3_tar = 76,
    FEAT_T4_dar = 77,
    FEAT_T4_dtabr = 78,
    FEAT_T4_hjorth_complexity = 79,
    FEAT_T4_hjorth_mobility = 80,
    FEAT_T4_rel_alpha = 81,
    FEAT_T4_rel_beta = 82,
    FEAT_T4_rel_delta = 83,
    FEAT_T4_rel_gamma = 84,
    FEAT_T4_rel_theta = 85,
    FEAT_T4_spectral_entropy = 86,
    FEAT_T4_tar = 87,
    FEAT_asym_dar_FP1_FP2 = 88,
    FEAT_asym_dar_F3_F4 = 89,
    FEAT_asym_dar_F7_F8 = 90,
    FEAT_asym_dar_T3_T4 = 91,
    FEAT_asym_delta_FP1_FP2 = 92,
    FEAT_asym_delta_F3_F4 = 93,
    FEAT_asym_delta_F7_F8 = 94,
    FEAT_asym_delta_T3_T4 = 95,
    FEAT_glasses_mean_asym_dar = 96,
    FEAT_glasses_mean_asym_delta = 97,
    FEAT_TOTAL_COUNT = 98
} GlassesFeatureIndex;

/* Preprocessing Scaling Parameters (Z-Score Normalization for Linear Engine, stored in Flash/PROGMEM) */
static const float STROKE_FEATURE_MEANS[98] PROGMEM = { 41.654552f, 20.897405f, 4.594603f, 0.253716f, 0.057587f, 0.070574f, 0.743222f, 0.034553f, 0.089133f, 3.962168f, 2.357866f, 40.645895f, 20.312859f, 4.501231f, 0.263249f, 0.057616f, 0.072889f, 0.742033f, 0.035542f, 0.087015f, 3.958069f, 2.270501f, 42.304925f, 21.151345f, 4.584083f, 0.254973f, 0.055988f, 0.065994f, 0.754328f, 0.036755f, 0.084071f, 3.933457f, 2.313782f, 43.136559f, 21.831212f, 4.752692f, 0.247732f, 0.055776f, 0.064614f, 0.760739f, 0.034126f, 0.081994f, 3.911668f, 2.272724f, 52.324855f, 23.685933f, 4.875660f, 0.239336f, 0.045678f, 0.066573f, 0.768773f, 0.038574f, 0.076386f, 3.848953f, 2.498587f, 52.270483f, 23.705083f, 4.897899f, 0.239832f, 0.044971f, 0.064776f, 0.773971f, 0.038182f, 0.074704f, 3.814338f, 2.456204f, 34.241873f, 18.221772f, 4.438882f, 0.269236f, 0.074724f, 0.077277f, 0.712887f, 0.039283f, 0.092249f, 4.090957f, 2.097446f, 34.571914f, 18.453368f, 4.412186f, 0.273567f, 0.076911f, 0.076918f, 0.714128f, 0.039027f, 0.089909f, 4.074837f, 2.040086f, -0.012933f, 0.003856f, -0.008134f, -0.000664f, -0.005905f, 0.000831f, -0.006130f, -0.002048f, -0.004469f, -0.003313f };
static const float STROKE_FEATURE_SCALES[98] PROGMEM = { 78.443353f, 34.241599f, 3.095290f, 0.199547f, 0.073250f, 0.084212f, 0.210403f, 0.060819f, 0.075941f, 1.132503f, 1.953582f, 71.376279f, 31.746347f, 3.085898f, 0.208888f, 0.073089f, 0.087005f, 0.210648f, 0.063666f, 0.071319f, 1.165565f, 1.768132f, 76.754040f, 36.551940f, 2.803542f, 0.195715f, 0.067110f, 0.077632f, 0.197228f, 0.063861f, 0.075344f, 1.053584f, 2.022845f, 77.974930f, 38.246775f, 3.084546f, 0.191017f, 0.066207f, 0.076542f, 0.191617f, 0.061005f, 0.067041f, 1.079841f, 1.897424f, 98.727377f, 39.204867f, 2.966914f, 0.189160f, 0.060793f, 0.085036f, 0.196814f, 0.070938f, 0.069731f, 1.060405f, 2.180408f, 103.180670f, 42.780666f, 3.204790f, 0.188577f, 0.060262f, 0.080674f, 0.189545f, 0.071529f, 0.065210f, 1.060580f, 1.982631f, 64.076675f, 31.175494f, 2.943963f, 0.205741f, 0.089573f, 0.090243f, 0.230029f, 0.066468f, 0.083081f, 1.179459f, 1.965819f, 65.012995f, 32.731415f, 2.965155f, 0.208120f, 0.091727f, 0.089475f, 0.227331f, 0.067041f, 0.077357f, 1.210216f, 1.889352f, 0.270563f, 0.285070f, 0.309038f, 0.311788f, 0.105123f, 0.115340f, 0.116390f, 0.134879f, 0.215425f, 0.081992f };

/* Linear Model Weights (stored in Flash/PROGMEM) */
static const float STROKE_LINEAR_WEIGHTS[98] PROGMEM = { 0.348568f, -0.187377f, -0.236505f, -0.125817f, 2.659760f, 3.419271f, 9.163973f, 1.977850f, 3.358931f, 0.624106f, -0.007249f, 0.066554f, -0.069445f, -0.367445f, 0.277481f, 0.670329f, 0.502165f, 0.855285f, 0.597425f, 0.829667f, -0.319937f, 0.061587f, 0.030584f, 0.277240f, -0.189195f, 0.660725f, 1.885831f, 1.582517f, 4.033571f, 1.442749f, 1.124896f, -0.222898f, -0.034708f, 0.173465f, -0.058606f, 0.309615f, -0.881897f, -3.394157f, -3.543527f, -8.471506f, -2.383426f, -3.349237f, 0.609052f, 0.076185f, 0.764393f, -0.453552f, -0.325205f, -0.108526f, -1.465310f, -1.434711f, -2.590024f, -0.452169f, -0.824690f, 0.039354f, 0.168184f, 0.446772f, -0.139746f, -0.151214f, 0.898243f, -0.082379f, 0.437211f, 0.496284f, 0.587276f, 0.143377f, -0.829171f, 0.019968f, -0.039059f, 0.030871f, -0.061739f, 0.313718f, -1.327030f, -0.819124f, -3.661186f, -1.958817f, -0.942875f, -0.714927f, -0.106826f, -0.246323f, 0.138964f, 0.678712f, 0.084735f, -5.092604f, -5.564388f, -14.372811f, -4.132844f, -4.912433f, -0.325261f, -0.230743f, 0.101334f, -0.264460f, 0.165959f, 0.084108f, -0.158870f, -0.219844f, 0.047613f, -0.076184f, 0.034280f, -0.142671f };
static const float STROKE_LINEAR_INTERCEPT = -1.271546f;

/* ===========================================================================
 * ENGINE 1: TINY RANDOM FOREST TREES (OPTIMAL NON-LINEAR DECISION LOGIC)
 * =========================================================================== */
static inline float esp32_tree_0(const float* x) {
    if (x[84] <= 0.012119f) {
        if (x[67] <= 48.461872f) {
            if (x[85] <= 0.023983f) {
                if (x[61] <= 0.897406f) {
                    if (x[18] <= 0.001051f) {
                        return 0.000000f;
                    } else {
                        if (x[62] <= 0.006463f) {
                            if (x[55] <= 26.958881f) {
                                return 0.388170f;
                            } else {
                                return 0.859508f;
                            }
                        } else {
                            if (x[60] <= 0.019464f) {
                                return 0.599273f;
                            } else {
                                return 0.965423f;
                            }
                        }
                    }
                } else {
                    if (x[18] <= 0.003716f) {
                        if (x[35] <= 10.564318f) {
                            if (x[65] <= 2.815524f) {
                                return 0.257059f;
                            } else {
                                return 0.730409f;
                            }
                        } else {
                            if (x[25] <= 0.153557f) {
                                return 0.742541f;
                            } else {
                                return 0.976859f;
                            }
                        }
                    } else {
                        if (x[88] <= -0.297586f) {
                            if (x[3] <= 0.876670f) {
                                return 0.936461f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[86] <= 2.460604f) {
                                return 0.881659f;
                            } else {
                                return 0.566186f;
                            }
                        }
                    }
                }
            } else {
                if (x[18] <= 0.009532f) {
                    if (x[35] <= 10.543896f) {
                        if (x[14] <= 0.285180f) {
                            if (x[47] <= 0.273016f) {
                                return 0.073467f;
                            } else {
                                return 0.655985f;
                            }
                        } else {
                            if (x[34] <= 7.840521f) {
                                return 0.193493f;
                            } else {
                                return 0.943312f;
                            }
                        }
                    } else {
                        if (x[36] <= 0.061718f) {
                            if (x[59] <= 0.016521f) {
                                return 0.902291f;
                            } else {
                                return 0.633606f;
                            }
                        } else {
                            if (x[35] <= 11.670568f) {
                                return 0.373309f;
                            } else {
                                return 0.690993f;
                            }
                        }
                    }
                } else {
                    if (x[39] <= 0.710114f) {
                        if (x[25] <= 0.395728f) {
                            if (x[79] <= 4.713904f) {
                                return 0.144233f;
                            } else {
                                return 0.719389f;
                            }
                        } else {
                            if (x[66] <= 0.679410f) {
                                return 0.000000f;
                            } else {
                                return 0.852690f;
                            }
                        }
                    } else {
                        if (x[80] <= 0.277016f) {
                            if (x[85] <= 0.045147f) {
                                return 0.672632f;
                            } else {
                                return 0.375163f;
                            }
                        } else {
                            if (x[36] <= 0.752346f) {
                                return 0.924138f;
                            } else {
                                return 0.545092f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[58] <= 0.160582f) {
                if (x[33] <= 167.852356f) {
                    if (x[51] <= 0.004780f) {
                        if (x[85] <= 0.014185f) {
                            if (x[85] <= 0.009135f) {
                                return 0.889387f;
                            } else {
                                return 0.566899f;
                            }
                        } else {
                            if (x[79] <= 11.333839f) {
                                return 0.162282f;
                            } else {
                                return 0.754416f;
                            }
                        }
                    } else {
                        if (x[72] <= 0.966723f) {
                            if (x[88] <= -0.253681f) {
                                return 0.878932f;
                            } else {
                                return 0.520984f;
                            }
                        } else {
                            if (x[29] <= 0.000382f) {
                                return 0.000000f;
                            } else {
                                return 0.933982f;
                            }
                        }
                    }
                } else {
                    if (x[35] <= 11.049098f) {
                        if (x[36] <= 0.052024f) {
                            if (x[51] <= 0.011995f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[72] <= 0.972831f) {
                                return 0.665361f;
                            } else {
                                return 0.929994f;
                            }
                        }
                    } else {
                        if (x[47] <= 0.104544f) {
                            if (x[68] <= 14.546323f) {
                                return 0.787490f;
                            } else {
                                return 0.980241f;
                            }
                        } else {
                            if (x[77] <= 35.445536f) {
                                return 0.000000f;
                            } else {
                                return 0.994599f;
                            }
                        }
                    }
                }
            } else {
                if (x[19] <= 0.019774f) {
                    if (x[63] <= 0.158626f) {
                        if (x[41] <= 0.023446f) {
                            if (x[59] <= 0.007658f) {
                                return 0.995546f;
                            } else {
                                return 0.970760f;
                            }
                        } else {
                            if (x[55] <= 51.044037f) {
                                return 0.000000f;
                            } else {
                                return 0.924446f;
                            }
                        }
                    } else {
                        return 0.000000f;
                    }
                } else {
                    if (x[74] <= 0.045589f) {
                        if (x[79] <= 11.064158f) {
                            if (x[37] <= 0.008950f) {
                                return 0.880571f;
                            } else {
                                return 0.657541f;
                            }
                        } else {
                            if (x[65] <= 5.138448f) {
                                return 0.994918f;
                            } else {
                                return 0.774061f;
                            }
                        }
                    } else {
                        if (x[16] <= 0.014732f) {
                            if (x[50] <= 0.972603f) {
                                return 0.989912f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[73] <= 0.001357f) {
                                return 0.196602f;
                            } else {
                                return 0.883533f;
                            }
                        }
                    }
                }
            }
        }
    } else {
        if (x[18] <= 0.025594f) {
            if (x[62] <= 0.036088f) {
                if (x[47] <= 0.291806f) {
                    if (x[59] <= 0.014799f) {
                        if (x[86] <= 2.723317f) {
                            if (x[36] <= 0.197287f) {
                                return 0.712393f;
                            } else {
                                return 0.942515f;
                            }
                        } else {
                            if (x[76] <= 1.654701f) {
                                return 0.658334f;
                            } else {
                                return 0.247616f;
                            }
                        }
                    } else {
                        if (x[78] <= 7.533287f) {
                            if (x[62] <= 0.009000f) {
                                return 0.501780f;
                            } else {
                                return 0.232428f;
                            }
                        } else {
                            if (x[14] <= 0.322344f) {
                                return 0.085453f;
                            } else {
                                return 0.945886f;
                            }
                        }
                    }
                } else {
                    if (x[12] <= 1.896388f) {
                        if (x[92] <= -0.066246f) {
                            if (x[49] <= 0.223327f) {
                                return 0.090812f;
                            } else {
                                return 0.640253f;
                            }
                        } else {
                            if (x[80] <= 0.403028f) {
                                return 0.000000f;
                            } else {
                                return 0.289699f;
                            }
                        }
                    } else {
                        if (x[84] <= 0.145840f) {
                            if (x[42] <= 2.411797f) {
                                return 0.565934f;
                            } else {
                                return 0.913691f;
                            }
                        } else {
                            if (x[5] <= 0.045651f) {
                                return 1.000000f;
                            } else {
                                return 0.018338f;
                            }
                        }
                    }
                }
            } else {
                if (x[21] <= 0.724622f) {
                    if (x[4] <= 0.110912f) {
                        if (x[79] <= 3.497532f) {
                            if (x[60] <= 0.107386f) {
                                return 0.683467f;
                            } else {
                                return 0.116824f;
                            }
                        } else {
                            if (x[34] <= 38.047919f) {
                                return 0.969524f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[10] <= 1.246514f) {
                            if (x[14] <= 0.203480f) {
                                return 0.365400f;
                            } else {
                                return 0.015844f;
                            }
                        } else {
                            if (x[41] <= 0.073509f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                } else {
                    if (x[26] <= 0.026190f) {
                        if (x[73] <= 0.202320f) {
                            if (x[2] <= 1.313229f) {
                                return 0.229839f;
                            } else {
                                return 0.868371f;
                            }
                        } else {
                            if (x[74] <= 0.059554f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    } else {
                        if (x[17] <= 0.566314f) {
                            if (x[78] <= 2.631858f) {
                                return 0.000000f;
                            } else {
                                return 0.494656f;
                            }
                        } else {
                            if (x[53] <= 2.821002f) {
                                return 0.956920f;
                            } else {
                                return 0.673823f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[15] <= 0.157025f) {
                if (x[71] <= 0.176148f) {
                    if (x[58] <= 0.340487f) {
                        if (x[67] <= 2.263386f) {
                            if (x[86] <= 5.535871f) {
                                return 0.943418f;
                            } else {
                                return 0.430021f;
                            }
                        } else {
                            if (x[75] <= 4.250275f) {
                                return 0.779676f;
                            } else {
                                return 0.435022f;
                            }
                        }
                    } else {
                        if (x[80] <= 1.106604f) {
                            if (x[75] <= 5.329262f) {
                                return 0.922125f;
                            } else {
                                return 0.807478f;
                            }
                        } else {
                            if (x[69] <= 0.855541f) {
                                return 0.887021f;
                            } else {
                                return 0.182484f;
                            }
                        }
                    }
                } else {
                    if (x[51] <= 0.240337f) {
                        if (x[17] <= 0.277375f) {
                            if (x[6] <= 0.393244f) {
                                return 0.082304f;
                            } else {
                                return 0.397505f;
                            }
                        } else {
                            if (x[14] <= 0.579170f) {
                                return 0.455801f;
                            } else {
                                return 0.849925f;
                            }
                        }
                    } else {
                        if (x[70] <= 0.071419f) {
                            if (x[27] <= 0.312664f) {
                                return 0.717077f;
                            } else {
                                return 0.139121f;
                            }
                        } else {
                            if (x[75] <= 6.378173f) {
                                return 0.956749f;
                            } else {
                                return 0.601825f;
                            }
                        }
                    }
                }
            } else {
                if (x[48] <= 0.089033f) {
                    if (x[84] <= 0.121064f) {
                        if (x[53] <= 5.475772f) {
                            if (x[4] <= 0.174934f) {
                                return 0.598972f;
                            } else {
                                return 0.194139f;
                            }
                        } else {
                            if (x[32] <= 1.523667f) {
                                return 0.931182f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[61] <= 0.451033f) {
                            if (x[25] <= 0.591269f) {
                                return 0.175457f;
                            } else {
                                return 0.830343f;
                            }
                        } else {
                            if (x[71] <= 0.046770f) {
                                return 1.000000f;
                            } else {
                                return 0.072299f;
                            }
                        }
                    }
                } else {
                    if (x[77] <= 0.931302f) {
                        if (x[62] <= 0.013909f) {
                            if (x[3] <= 0.269157f) {
                                return 0.924446f;
                            } else {
                                return 0.158420f;
                            }
                        } else {
                            if (x[66] <= 2.239138f) {
                                return 0.030369f;
                            } else {
                                return 0.312847f;
                            }
                        }
                    } else {
                        if (x[56] <= 2.448730f) {
                            if (x[13] <= 1.808843f) {
                                return 0.332449f;
                            } else {
                                return 0.062119f;
                            }
                        } else {
                            if (x[57] <= 2.400973f) {
                                return 0.907309f;
                            } else {
                                return 0.300453f;
                            }
                        }
                    }
                }
            }
        }
    }
}

static inline float esp32_tree_1(const float* x) {
    if (x[24] <= 3.531451f) {
        if (x[31] <= 4.136351f) {
            if (x[75] <= 5.909949f) {
                if (x[29] <= 0.001663f) {
                    if (x[66] <= 36.093267f) {
                        if (x[16] <= 0.008462f) {
                            if (x[21] <= 2.986449f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[31] <= 2.502262f) {
                                return 0.000000f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[25] <= 0.218022f) {
                            return 0.000000f;
                        } else {
                            if (x[2] <= 2.063974f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    }
                } else {
                    if (x[58] <= 0.220137f) {
                        if (x[61] <= 0.777197f) {
                            if (x[51] <= 0.022720f) {
                                return 0.139726f;
                            } else {
                                return 0.706843f;
                            }
                        } else {
                            if (x[42] <= 2.953882f) {
                                return 0.892338f;
                            } else {
                                return 0.686022f;
                            }
                        }
                    } else {
                        if (x[69] <= 0.662808f) {
                            if (x[25] <= 0.254654f) {
                                return 0.544253f;
                            } else {
                                return 0.964600f;
                            }
                        } else {
                            if (x[37] <= 0.013492f) {
                                return 0.373290f;
                            } else {
                                return 0.820189f;
                            }
                        }
                    }
                }
            } else {
                if (x[72] <= 0.213497f) {
                    if (x[57] <= 1.313652f) {
                        return 1.000000f;
                    } else {
                        if (x[29] <= 0.203333f) {
                            return 0.000000f;
                        } else {
                            if (x[85] <= 0.045527f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    }
                } else {
                    if (x[29] <= 0.103694f) {
                        if (x[25] <= 0.408154f) {
                            if (x[65] <= 1.720304f) {
                                return 0.021958f;
                            } else {
                                return 0.615391f;
                            }
                        } else {
                            if (x[57] <= 1.422004f) {
                                return 1.000000f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    } else {
                        if (x[36] <= 0.332390f) {
                            if (x[57] <= 11.027425f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[45] <= 21.278399f) {
                                return 0.972773f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[59] <= 0.063907f) {
                if (x[58] <= 0.382810f) {
                    if (x[70] <= 0.117024f) {
                        if (x[86] <= 3.068388f) {
                            if (x[87] <= 3.344676f) {
                                return 0.872005f;
                            } else {
                                return 0.259034f;
                            }
                        } else {
                            if (x[47] <= 0.402864f) {
                                return 0.364925f;
                            } else {
                                return 0.739447f;
                            }
                        }
                    } else {
                        if (x[75] <= 6.125194f) {
                            if (x[14] <= 0.344580f) {
                                return 0.675079f;
                            } else {
                                return 0.903541f;
                            }
                        } else {
                            if (x[36] <= 0.334844f) {
                                return 0.407672f;
                            } else {
                                return 0.088888f;
                            }
                        }
                    }
                } else {
                    if (x[82] <= 0.308769f) {
                        if (x[21] <= 0.547214f) {
                            if (x[29] <= 0.072241f) {
                                return 0.291516f;
                            } else {
                                return 0.878653f;
                            }
                        } else {
                            if (x[73] <= 0.292338f) {
                                return 0.905961f;
                            } else {
                                return 0.550271f;
                            }
                        }
                    } else {
                        if (x[92] <= 0.132229f) {
                            if (x[58] <= 0.704238f) {
                                return 0.029681f;
                            } else {
                                return 0.769425f;
                            }
                        } else {
                            if (x[33] <= 6.904595f) {
                                return 0.489707f;
                            } else {
                                return 0.948975f;
                            }
                        }
                    }
                }
            } else {
                if (x[29] <= 0.011411f) {
                    if (x[69] <= 0.219883f) {
                        if (x[75] <= 3.710120f) {
                            if (x[26] <= 0.094198f) {
                                return 0.000000f;
                            } else {
                                return 0.821057f;
                            }
                        } else {
                            if (x[46] <= 4.728181f) {
                                return 0.016758f;
                            } else {
                                return 0.661900f;
                            }
                        }
                    } else {
                        if (x[27] <= 0.131732f) {
                            if (x[37] <= 0.156350f) {
                                return 0.084247f;
                            } else {
                                return 0.524333f;
                            }
                        } else {
                            if (x[53] <= 3.815836f) {
                                return 0.550271f;
                            } else {
                                return 0.014702f;
                            }
                        }
                    }
                } else {
                    if (x[1] <= 1.663438f) {
                        if (x[17] <= 0.284227f) {
                            if (x[47] <= 0.693073f) {
                                return 0.064730f;
                            } else {
                                return 0.760838f;
                            }
                        } else {
                            if (x[54] <= 0.713265f) {
                                return 0.162849f;
                            } else {
                                return 0.382660f;
                            }
                        }
                    } else {
                        if (x[41] <= 0.147565f) {
                            if (x[47] <= 0.532181f) {
                                return 0.439753f;
                            } else {
                                return 0.867724f;
                            }
                        } else {
                            if (x[62] <= 0.096317f) {
                                return 0.197574f;
                            } else {
                                return 0.690104f;
                            }
                        }
                    }
                }
            }
        }
    } else {
        if (x[87] <= 0.855916f) {
            if (x[54] <= 0.855212f) {
                if (x[48] <= 0.039667f) {
                    if (x[73] <= 0.104386f) {
                        if (x[75] <= 2.515745f) {
                            if (x[84] <= 0.002721f) {
                                return 0.794856f;
                            } else {
                                return 0.956837f;
                            }
                        } else {
                            if (x[25] <= 0.182774f) {
                                return 0.427737f;
                            } else {
                                return 0.845829f;
                            }
                        }
                    } else {
                        if (x[91] <= 0.315756f) {
                            if (x[65] <= 1.439096f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[31] <= 2.223608f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    }
                } else {
                    if (x[46] <= 3.038398f) {
                        if (x[86] <= 3.241722f) {
                            if (x[74] <= 0.080649f) {
                                return 0.964181f;
                            } else {
                                return 0.328600f;
                            }
                        } else {
                            if (x[62] <= 0.020321f) {
                                return 0.630709f;
                            } else {
                                return 0.235263f;
                            }
                        }
                    } else {
                        if (x[86] <= 2.888910f) {
                            if (x[46] <= 4.833494f) {
                                return 0.753628f;
                            } else {
                                return 0.189009f;
                            }
                        } else {
                            if (x[58] <= 0.335686f) {
                                return 0.032159f;
                            } else {
                                return 0.924446f;
                            }
                        }
                    }
                }
            } else {
                if (x[42] <= 3.142016f) {
                    if (x[62] <= 0.012553f) {
                        if (x[44] <= 62.157589f) {
                            if (x[25] <= 0.169606f) {
                                return 0.482098f;
                            } else {
                                return 0.873953f;
                            }
                        } else {
                            if (x[75] <= 5.758210f) {
                                return 0.885243f;
                            } else {
                                return 0.092529f;
                            }
                        }
                    } else {
                        if (x[79] <= 3.965502f) {
                            if (x[80] <= 0.596808f) {
                                return 0.844388f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[91] <= -0.941502f) {
                                return 0.000000f;
                            } else {
                                return 0.980469f;
                            }
                        }
                    }
                } else {
                    if (x[31] <= 3.200015f) {
                        if (x[95] <= 0.480324f) {
                            if (x[73] <= 0.003768f) {
                                return 0.230561f;
                            } else {
                                return 0.869306f;
                            }
                        } else {
                            if (x[48] <= 0.009120f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[87] <= 0.548100f) {
                            if (x[86] <= 5.384595f) {
                                return 0.835883f;
                            } else {
                                return 0.438963f;
                            }
                        } else {
                            if (x[58] <= 0.356815f) {
                                return 0.397106f;
                            } else {
                                return 0.810695f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[22] <= 101.955349f) {
                if (x[58] <= 0.269726f) {
                    if (x[77] <= 105.537472f) {
                        if (x[42] <= 2.277194f) {
                            if (x[49] <= 0.028195f) {
                                return 0.399836f;
                            } else {
                                return 0.756405f;
                            }
                        } else {
                            if (x[80] <= 0.078058f) {
                                return 0.572626f;
                            } else {
                                return 0.114106f;
                            }
                        }
                    } else {
                        if (x[85] <= 0.016786f) {
                            if (x[29] <= 0.002308f) {
                                return 0.390794f;
                            } else {
                                return 0.839323f;
                            }
                        } else {
                            if (x[48] <= 0.022763f) {
                                return 0.281157f;
                            } else {
                                return 0.804216f;
                            }
                        }
                    }
                } else {
                    if (x[58] <= 0.386861f) {
                        if (x[56] <= 14.261727f) {
                            if (x[75] <= 4.830615f) {
                                return 0.554561f;
                            } else {
                                return 0.042109f;
                            }
                        } else {
                            if (x[62] <= 0.021007f) {
                                return 0.943312f;
                            } else {
                                return 0.799059f;
                            }
                        }
                    } else {
                        if (x[64] <= 4.100180f) {
                            if (x[64] <= 3.186387f) {
                                return 0.995610f;
                            } else {
                                return 0.933043f;
                            }
                        } else {
                            if (x[48] <= 0.030313f) {
                                return 0.871873f;
                            } else {
                                return 0.563236f;
                            }
                        }
                    }
                }
            } else {
                if (x[78] <= 74.968472f) {
                    if (x[14] <= 0.195542f) {
                        if (x[68] <= 12.590008f) {
                            if (x[19] <= 0.019032f) {
                                return 0.622403f;
                            } else {
                                return 0.296809f;
                            }
                        } else {
                            if (x[61] <= 0.950668f) {
                                return 0.996982f;
                            } else {
                                return 0.872899f;
                            }
                        }
                    } else {
                        if (x[73] <= 0.035848f) {
                            if (x[85] <= 0.136083f) {
                                return 0.934457f;
                            } else {
                                return 0.140260f;
                            }
                        } else {
                            if (x[85] <= 0.119437f) {
                                return 0.349293f;
                            } else {
                                return 0.976526f;
                            }
                        }
                    }
                } else {
                    if (x[96] <= 0.390228f) {
                        if (x[22] <= 251.771065f) {
                            if (x[92] <= -0.006776f) {
                                return 0.939448f;
                            } else {
                                return 0.693194f;
                            }
                        } else {
                            if (x[68] <= 1.903269f) {
                                return 0.000000f;
                            } else {
                                return 0.950902f;
                            }
                        }
                    } else {
                        if (x[64] <= 3.405027f) {
                            if (x[91] <= 0.333300f) {
                                return 0.550271f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[20] <= 2.847970f) {
                                return 0.907309f;
                            } else {
                                return 0.034737f;
                            }
                        }
                    }
                }
            }
        }
    }
}

static inline float esp32_tree_2(const float* x) {
    if (x[3] <= 0.283066f) {
        if (x[51] <= 0.027413f) {
            if (x[52] <= 0.019398f) {
                if (x[66] <= 140.317612f) {
                    if (x[75] <= 2.490717f) {
                        if (x[71] <= 0.010605f) {
                            if (x[48] <= 0.006430f) {
                                return 0.820347f;
                            } else {
                                return 0.376202f;
                            }
                        } else {
                            if (x[92] <= 0.012006f) {
                                return 0.867900f;
                            } else {
                                return 0.970021f;
                            }
                        }
                    } else {
                        if (x[87] <= 0.721242f) {
                            if (x[62] <= 0.001072f) {
                                return 0.950519f;
                            } else {
                                return 0.626624f;
                            }
                        } else {
                            if (x[35] <= 10.478938f) {
                                return 0.406356f;
                            } else {
                                return 0.749068f;
                            }
                        }
                    }
                } else {
                    if (x[18] <= 0.002923f) {
                        if (x[77] <= 252.327637f) {
                            if (x[15] <= 0.004876f) {
                                return 0.843016f;
                            } else {
                                return 0.446425f;
                            }
                        } else {
                            if (x[18] <= 0.000620f) {
                                return 0.569990f;
                            } else {
                                return 0.968647f;
                            }
                        }
                    } else {
                        if (x[68] <= 10.112213f) {
                            if (x[47] <= 0.069016f) {
                                return 0.462308f;
                            } else {
                                return 0.885169f;
                            }
                        } else {
                            if (x[84] <= 0.098036f) {
                                return 0.985815f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                }
            } else {
                if (x[75] <= 2.506974f) {
                    if (x[51] <= 0.007183f) {
                        if (x[30] <= 0.014203f) {
                            if (x[55] <= 39.171934f) {
                                return 0.511902f;
                            } else {
                                return 0.939627f;
                            }
                        } else {
                            if (x[13] <= 6.079515f) {
                                return 0.676723f;
                            } else {
                                return 0.211277f;
                            }
                        }
                    } else {
                        if (x[86] <= 1.985057f) {
                            if (x[2] <= 34.732561f) {
                                return 0.969698f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[2] <= 5.546460f) {
                                return 0.930513f;
                            } else {
                                return 0.728694f;
                            }
                        }
                    }
                } else {
                    if (x[26] <= 0.007821f) {
                        if (x[57] <= 4.382193f) {
                            if (x[47] <= 0.070410f) {
                                return 0.187561f;
                            } else {
                                return 0.895651f;
                            }
                        } else {
                            if (x[2] <= 11.862345f) {
                                return 0.404482f;
                            } else {
                                return 0.905357f;
                            }
                        }
                    } else {
                        if (x[80] <= 0.247247f) {
                            if (x[87] <= 1.120608f) {
                                return 0.307511f;
                            } else {
                                return 0.108166f;
                            }
                        } else {
                            if (x[48] <= 0.026595f) {
                                return 0.561800f;
                            } else {
                                return 0.269532f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[86] <= 3.472429f) {
                if (x[97] <= 0.020363f) {
                    if (x[92] <= -0.042484f) {
                        if (x[68] <= 7.517960f) {
                            if (x[71] <= 0.195758f) {
                                return 0.921593f;
                            } else {
                                return 0.404676f;
                            }
                        } else {
                            if (x[86] <= 2.682701f) {
                                return 1.000000f;
                            } else {
                                return 0.982291f;
                            }
                        }
                    } else {
                        if (x[75] <= 2.710068f) {
                            if (x[71] <= 0.012231f) {
                                return 0.980912f;
                            } else {
                                return 0.909316f;
                            }
                        } else {
                            if (x[79] <= 2.664973f) {
                                return 0.984408f;
                            } else {
                                return 0.639994f;
                            }
                        }
                    }
                } else {
                    if (x[82] <= 0.313087f) {
                        if (x[63] <= 0.041939f) {
                            if (x[59] <= 0.040982f) {
                                return 0.992178f;
                            } else {
                                return 0.814980f;
                            }
                        } else {
                            if (x[73] <= 0.064622f) {
                                return 0.935693f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        return 0.000000f;
                    }
                }
            } else {
                if (x[11] <= 4.094013f) {
                    if (x[48] <= 0.083596f) {
                        if (x[47] <= 0.274176f) {
                            if (x[25] <= 0.357687f) {
                                return 0.373138f;
                            } else {
                                return 0.895452f;
                            }
                        } else {
                            if (x[6] <= 0.534700f) {
                                return 0.000000f;
                            } else {
                                return 0.805806f;
                            }
                        }
                    } else {
                        if (x[21] <= 0.486502f) {
                            return 0.000000f;
                        } else {
                            if (x[13] <= 1.895263f) {
                                return 0.641652f;
                            } else {
                                return 0.155222f;
                            }
                        }
                    }
                } else {
                    if (x[51] <= 0.048882f) {
                        if (x[92] <= 0.041387f) {
                            if (x[53] <= 3.525434f) {
                                return 0.702791f;
                            } else {
                                return 0.369422f;
                            }
                        } else {
                            if (x[52] <= 0.145013f) {
                                return 0.774325f;
                            } else {
                                return 0.092529f;
                            }
                        }
                    } else {
                        if (x[63] <= 0.044337f) {
                            if (x[51] <= 0.113939f) {
                                return 0.804936f;
                            } else {
                                return 0.936805f;
                            }
                        } else {
                            if (x[72] <= 0.550427f) {
                                return 0.841378f;
                            } else {
                                return 0.621733f;
                            }
                        }
                    }
                }
            }
        }
    } else {
        if (x[75] <= 5.364775f) {
            if (x[31] <= 4.703841f) {
                if (x[17] <= 0.949731f) {
                    if (x[35] <= 1.180915f) {
                        if (x[82] <= 0.092485f) {
                            if (x[69] <= 0.599789f) {
                                return 0.939982f;
                            } else {
                                return 0.193292f;
                            }
                        } else {
                            if (x[38] <= 0.111396f) {
                                return 0.543088f;
                            } else {
                                return 0.960020f;
                            }
                        }
                    } else {
                        if (x[64] <= 4.160102f) {
                            if (x[23] <= 2.793779f) {
                                return 0.968528f;
                            } else {
                                return 0.905606f;
                            }
                        } else {
                            if (x[62] <= 0.126642f) {
                                return 0.735628f;
                            } else {
                                return 0.934063f;
                            }
                        }
                    }
                } else {
                    if (x[73] <= 0.000598f) {
                        if (x[80] <= 0.212604f) {
                            return 1.000000f;
                        } else {
                            return 0.000000f;
                        }
                    } else {
                        if (x[80] <= 0.691703f) {
                            if (x[89] <= -0.958297f) {
                                return 0.000000f;
                            } else {
                                return 0.983724f;
                            }
                        } else {
                            if (x[11] <= 93.387058f) {
                                return 0.709903f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                }
            } else {
                if (x[58] <= 0.328998f) {
                    if (x[25] <= 0.282585f) {
                        if (x[90] <= -0.700348f) {
                            if (x[36] <= 0.103036f) {
                                return 1.000000f;
                            } else {
                                return 0.119681f;
                            }
                        } else {
                            if (x[73] <= 0.158514f) {
                                return 0.119681f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    } else {
                        if (x[43] <= 1.583476f) {
                            if (x[48] <= 0.082542f) {
                                return 0.799337f;
                            } else {
                                return 0.334801f;
                            }
                        } else {
                            if (x[46] <= 3.227425f) {
                                return 0.602033f;
                            } else {
                                return 0.205282f;
                            }
                        }
                    }
                } else {
                    if (x[4] <= 0.190225f) {
                        if (x[77] <= 0.301194f) {
                            return 0.000000f;
                        } else {
                            if (x[29] <= 0.010898f) {
                                return 0.109017f;
                            } else {
                                return 0.912830f;
                            }
                        }
                    } else {
                        if (x[81] <= 0.291504f) {
                            if (x[20] <= 4.840195f) {
                                return 0.960740f;
                            } else {
                                return 0.259034f;
                            }
                        } else {
                            if (x[76] <= 1.082435f) {
                                return 0.026187f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[58] <= 0.542160f) {
                if (x[47] <= 0.584757f) {
                    if (x[67] <= 0.493892f) {
                        if (x[84] <= 0.006687f) {
                            if (x[82] <= 0.169019f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[9] <= 3.794218f) {
                                return 0.449251f;
                            } else {
                                return 0.025488f;
                            }
                        }
                    } else {
                        if (x[76] <= 1.482304f) {
                            if (x[64] <= 5.563809f) {
                                return 0.369955f;
                            } else {
                                return 0.158067f;
                            }
                        } else {
                            if (x[75] <= 5.544337f) {
                                return 0.262436f;
                            } else {
                                return 0.061098f;
                            }
                        }
                    }
                } else {
                    if (x[78] <= 0.953445f) {
                        if (x[81] <= 0.281535f) {
                            if (x[35] <= 1.350299f) {
                                return 0.859508f;
                            } else {
                                return 0.065349f;
                            }
                        } else {
                            if (x[27] <= 0.171069f) {
                                return 0.975096f;
                            } else {
                                return 0.343998f;
                            }
                        }
                    } else {
                        if (x[1] <= 0.933048f) {
                            if (x[86] <= 5.235466f) {
                                return 0.813100f;
                            } else {
                                return 0.202012f;
                            }
                        } else {
                            if (x[53] <= 6.850056f) {
                                return 0.973941f;
                            } else {
                                return 0.494656f;
                            }
                        }
                    }
                }
            } else {
                if (x[39] <= 0.170099f) {
                    if (x[36] <= 0.750210f) {
                        if (x[47] <= 0.731459f) {
                            return 0.000000f;
                        } else {
                            if (x[81] <= 0.038445f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[70] <= 0.044555f) {
                            if (x[27] <= 0.277295f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[12] <= 0.270404f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    }
                } else {
                    if (x[48] <= 0.062538f) {
                        if (x[26] <= 0.063399f) {
                            if (x[53] <= 6.089980f) {
                                return 0.929891f;
                            } else {
                                return 0.522158f;
                            }
                        } else {
                            if (x[46] <= 1.454208f) {
                                return 0.978196f;
                            } else {
                                return 0.810430f;
                            }
                        }
                    } else {
                        if (x[20] <= 5.532878f) {
                            if (x[77] <= 0.967617f) {
                                return 0.379569f;
                            } else {
                                return 0.912709f;
                            }
                        } else {
                            if (x[66] <= 1.186965f) {
                                return 0.457653f;
                            } else {
                                return 0.045362f;
                            }
                        }
                    }
                }
            }
        }
    }
}

static inline float esp32_tree_3(const float* x) {
    if (x[84] <= 0.012886f) {
        if (x[41] <= 0.024399f) {
            if (x[41] <= 0.016506f) {
                if (x[57] <= 6.577056f) {
                    if (x[70] <= 0.009477f) {
                        if (x[85] <= 0.029026f) {
                            if (x[72] <= 0.952683f) {
                                return 0.898060f;
                            } else {
                                return 0.981893f;
                            }
                        } else {
                            if (x[58] <= 0.135462f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    } else {
                        if (x[46] <= 3.610217f) {
                            if (x[80] <= 0.537064f) {
                                return 0.971450f;
                            } else {
                                return 0.511902f;
                            }
                        } else {
                            if (x[18] <= 0.001274f) {
                                return 0.248512f;
                            } else {
                                return 0.889813f;
                            }
                        }
                    }
                } else {
                    if (x[79] <= 10.947066f) {
                        if (x[44] <= 223.524239f) {
                            if (x[88] <= -0.450789f) {
                                return 0.914652f;
                            } else {
                                return 0.495312f;
                            }
                        } else {
                            if (x[12] <= 391.832611f) {
                                return 0.890211f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[69] <= 0.054917f) {
                            if (x[16] <= 0.004970f) {
                                return 0.938264f;
                            } else {
                                return 0.995086f;
                            }
                        } else {
                            if (x[47] <= 0.081424f) {
                                return 0.700115f;
                            } else {
                                return 0.949163f;
                            }
                        }
                    }
                }
            } else {
                if (x[3] <= 0.183887f) {
                    if (x[60] <= 0.027930f) {
                        if (x[36] <= 0.088752f) {
                            if (x[18] <= 0.002048f) {
                                return 0.467554f;
                            } else {
                                return 0.730648f;
                            }
                        } else {
                            if (x[74] <= 0.011985f) {
                                return 0.953255f;
                            } else {
                                return 0.167525f;
                            }
                        }
                    } else {
                        if (x[80] <= 0.113319f) {
                            if (x[91] <= -0.625615f) {
                                return 0.328600f;
                            } else {
                                return 0.948187f;
                            }
                        } else {
                            if (x[62] <= 0.008780f) {
                                return 0.000000f;
                            } else {
                                return 0.722807f;
                            }
                        }
                    }
                } else {
                    if (x[35] <= 1.620481f) {
                        if (x[16] <= 0.065517f) {
                            if (x[87] <= 0.289894f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            return 1.000000f;
                        }
                    } else {
                        if (x[59] <= 0.011020f) {
                            if (x[29] <= 0.001004f) {
                                return 0.411481f;
                            } else {
                                return 0.978763f;
                            }
                        } else {
                            if (x[61] <= 0.908078f) {
                                return 0.943455f;
                            } else {
                                return 0.753628f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[51] <= 0.026638f) {
                if (x[36] <= 0.264544f) {
                    if (x[25] <= 0.318025f) {
                        if (x[88] <= 0.380933f) {
                            if (x[78] <= 65.138287f) {
                                return 0.092740f;
                            } else {
                                return 0.555734f;
                            }
                        } else {
                            if (x[89] <= 0.461737f) {
                                return 0.590842f;
                            } else {
                                return 0.196280f;
                            }
                        }
                    } else {
                        if (x[20] <= 4.505954f) {
                            if (x[28] <= 0.800902f) {
                                return 0.693147f;
                            } else {
                                return 0.986906f;
                            }
                        } else {
                            if (x[29] <= 0.033820f) {
                                return 1.000000f;
                            } else {
                                return 0.044536f;
                            }
                        }
                    }
                } else {
                    if (x[45] <= 2.056399f) {
                        return 0.000000f;
                    } else {
                        if (x[39] <= 0.620358f) {
                            if (x[7] <= 0.030594f) {
                                return 0.346190f;
                            } else {
                                return 0.823689f;
                            }
                        } else {
                            if (x[35] <= 1.387805f) {
                                return 0.000000f;
                            } else {
                                return 0.857832f;
                            }
                        }
                    }
                }
            } else {
                if (x[51] <= 0.047804f) {
                    if (x[58] <= 0.319773f) {
                        if (x[80] <= 0.108676f) {
                            if (x[96] <= -0.308874f) {
                                return 0.723904f;
                            } else {
                                return 0.962407f;
                            }
                        } else {
                            if (x[80] <= 0.325736f) {
                                return 0.308044f;
                            } else {
                                return 0.823241f;
                            }
                        }
                    } else {
                        if (x[4] <= 0.138082f) {
                            if (x[35] <= 1.225956f) {
                                return 0.000000f;
                            } else {
                                return 0.872909f;
                            }
                        } else {
                            if (x[69] <= 0.173736f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                } else {
                    if (x[81] <= 0.050839f) {
                        if (x[79] <= 6.210763f) {
                            if (x[87] <= 3.481865f) {
                                return 0.641581f;
                            } else {
                                return 0.863463f;
                            }
                        } else {
                            if (x[1] <= 1.184230f) {
                                return 0.000000f;
                            } else {
                                return 0.969941f;
                            }
                        }
                    } else {
                        if (x[7] <= 0.015160f) {
                            if (x[25] <= 0.130701f) {
                                return 0.775521f;
                            } else {
                                return 0.166909f;
                            }
                        } else {
                            if (x[40] <= 0.033842f) {
                                return 0.648409f;
                            } else {
                                return 0.970967f;
                            }
                        }
                    }
                }
            }
        }
    } else {
        if (x[4] <= 0.149360f) {
            if (x[51] <= 0.027168f) {
                if (x[76] <= 1.489615f) {
                    if (x[87] <= 1.051470f) {
                        if (x[58] <= 0.324992f) {
                            if (x[54] <= 1.660101f) {
                                return 0.478743f;
                            } else {
                                return 0.730564f;
                            }
                        } else {
                            if (x[35] <= 1.122729f) {
                                return 0.130302f;
                            } else {
                                return 0.937141f;
                            }
                        }
                    } else {
                        if (x[80] <= 0.312732f) {
                            if (x[65] <= 2.778036f) {
                                return 0.329188f;
                            } else {
                                return 0.668983f;
                            }
                        } else {
                            if (x[9] <= 4.246902f) {
                                return 0.736615f;
                            } else {
                                return 0.524185f;
                            }
                        }
                    }
                } else {
                    if (x[96] <= 0.209611f) {
                        if (x[57] <= 2.396446f) {
                            if (x[60] <= 0.152969f) {
                                return 0.942783f;
                            } else {
                                return 0.356527f;
                            }
                        } else {
                            if (x[80] <= 0.428794f) {
                                return 0.171107f;
                            } else {
                                return 0.669846f;
                            }
                        }
                    } else {
                        if (x[3] <= 0.289174f) {
                            if (x[25] <= 0.312970f) {
                                return 0.395161f;
                            } else {
                                return 0.926904f;
                            }
                        } else {
                            if (x[75] <= 4.608511f) {
                                return 0.951938f;
                            } else {
                                return 0.190481f;
                            }
                        }
                    }
                }
            } else {
                if (x[71] <= 0.238070f) {
                    if (x[46] <= 1.607015f) {
                        if (x[9] <= 0.973216f) {
                            if (x[25] <= 1.059605f) {
                                return 0.041869f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[80] <= 1.113458f) {
                                return 0.928767f;
                            } else {
                                return 0.121162f;
                            }
                        }
                    } else {
                        if (x[31] <= 4.042123f) {
                            if (x[24] <= 3.991165f) {
                                return 0.898445f;
                            } else {
                                return 0.743138f;
                            }
                        } else {
                            if (x[20] <= 5.333606f) {
                                return 0.735803f;
                            } else {
                                return 0.467576f;
                            }
                        }
                    }
                } else {
                    if (x[51] <= 0.243628f) {
                        if (x[72] <= 0.192899f) {
                            if (x[31] <= 2.853674f) {
                                return 0.758822f;
                            } else {
                                return 0.045182f;
                            }
                        } else {
                            if (x[68] <= 1.269134f) {
                                return 0.980687f;
                            } else {
                                return 0.313732f;
                            }
                        }
                    } else {
                        if (x[90] <= 0.443152f) {
                            if (x[58] <= 0.691240f) {
                                return 0.673963f;
                            } else {
                                return 0.966746f;
                            }
                        } else {
                            if (x[31] <= 3.516639f) {
                                return 0.745971f;
                            } else {
                                return 0.076599f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[21] <= 0.414294f) {
                if (x[69] <= 0.892332f) {
                    if (x[29] <= 0.006357f) {
                        if (x[43] <= 0.275984f) {
                            if (x[16] <= 0.070552f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[77] <= 0.804139f) {
                                return 0.709903f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[62] <= 0.201906f) {
                            if (x[75] <= 4.303816f) {
                                return 0.277592f;
                            } else {
                                return 0.044134f;
                            }
                        } else {
                            if (x[81] <= 0.149962f) {
                                return 0.000000f;
                            } else {
                                return 0.870627f;
                            }
                        }
                    }
                } else {
                    if (x[42] <= 2.711421f) {
                        return 0.000000f;
                    } else {
                        return 1.000000f;
                    }
                }
            } else {
                if (x[47] <= 0.483307f) {
                    if (x[83] <= 0.279428f) {
                        if (x[52] <= 0.322244f) {
                            if (x[25] <= 0.248992f) {
                                return 0.350150f;
                            } else {
                                return 0.121917f;
                            }
                        } else {
                            if (x[17] <= 0.211075f) {
                                return 0.140260f;
                            } else {
                                return 0.776661f;
                            }
                        }
                    } else {
                        if (x[35] <= 2.056631f) {
                            if (x[42] <= 5.936289f) {
                                return 0.772970f;
                            } else {
                                return 0.213777f;
                            }
                        } else {
                            if (x[25] <= 0.417911f) {
                                return 0.276993f;
                            } else {
                                return 0.733213f;
                            }
                        }
                    }
                } else {
                    if (x[75] <= 6.170048f) {
                        if (x[9] <= 2.610458f) {
                            if (x[57] <= 1.132983f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[24] <= 1.721516f) {
                                return 0.991973f;
                            } else {
                                return 0.709903f;
                            }
                        }
                    } else {
                        if (x[84] <= 0.071595f) {
                            if (x[62] <= 0.059189f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[27] <= 0.428122f) {
                                return 0.000000f;
                            } else {
                                return 0.307926f;
                            }
                        }
                    }
                }
            }
        }
    }
}

static inline float esp32_tree_4(const float* x) {
    if (x[47] <= 0.271086f) {
        if (x[63] <= 0.021518f) {
            if (x[14] <= 0.285961f) {
                if (x[64] <= 1.896349f) {
                    if (x[68] <= 11.703240f) {
                        if (x[62] <= 0.007140f) {
                            if (x[55] <= 289.746704f) {
                                return 0.650512f;
                            } else {
                                return 0.911605f;
                            }
                        } else {
                            if (x[91] <= -0.869993f) {
                                return 0.000000f;
                            } else {
                                return 0.962314f;
                            }
                        }
                    } else {
                        if (x[52] <= 0.014925f) {
                            if (x[52] <= 0.007455f) {
                                return 0.997981f;
                            } else {
                                return 0.961561f;
                            }
                        } else {
                            if (x[55] <= 159.228096f) {
                                return 0.753628f;
                            } else {
                                return 0.991558f;
                            }
                        }
                    }
                } else {
                    if (x[58] <= 0.171873f) {
                        if (x[75] <= 2.347758f) {
                            if (x[63] <= 0.014163f) {
                                return 0.866448f;
                            } else {
                                return 0.601684f;
                            }
                        } else {
                            if (x[5] <= 0.029288f) {
                                return 0.390839f;
                            } else {
                                return 0.581617f;
                            }
                        }
                    } else {
                        if (x[78] <= 8.740503f) {
                            if (x[20] <= 3.821393f) {
                                return 0.830343f;
                            } else {
                                return 0.276601f;
                            }
                        } else {
                            if (x[79] <= 7.754100f) {
                                return 0.873279f;
                            } else {
                                return 0.993083f;
                            }
                        }
                    }
                }
            } else {
                if (x[6] <= 0.531465f) {
                    if (x[86] <= 5.593941f) {
                        if (x[73] <= 0.178164f) {
                            if (x[40] <= 0.025967f) {
                                return 0.000000f;
                            } else {
                                return 0.927428f;
                            }
                        } else {
                            if (x[13] <= 1.583392f) {
                                return 0.924446f;
                            } else {
                                return 0.057651f;
                            }
                        }
                    } else {
                        if (x[21] <= 1.023129f) {
                            return 0.000000f;
                        } else {
                            if (x[54] <= 1.307628f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                } else {
                    if (x[73] <= 0.228552f) {
                        if (x[68] <= 3.264739f) {
                            if (x[42] <= 6.140806f) {
                                return 0.858596f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[58] <= 0.055751f) {
                                return 0.487616f;
                            } else {
                                return 0.978389f;
                            }
                        }
                    } else {
                        if (x[29] <= 0.023827f) {
                            if (x[39] <= 0.891585f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[2] <= 1.429433f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[69] <= 0.243696f) {
                if (x[74] <= 0.021129f) {
                    if (x[62] <= 0.012704f) {
                        if (x[65] <= 1.846460f) {
                            if (x[92] <= -0.009079f) {
                                return 0.756959f;
                            } else {
                                return 0.221412f;
                            }
                        } else {
                            if (x[34] <= 89.558247f) {
                                return 0.618013f;
                            } else {
                                return 0.919001f;
                            }
                        }
                    } else {
                        if (x[60] <= 0.063231f) {
                            if (x[41] <= 0.032449f) {
                                return 0.917514f;
                            } else {
                                return 0.643648f;
                            }
                        } else {
                            if (x[50] <= 0.367865f) {
                                return 0.000000f;
                            } else {
                                return 0.962540f;
                            }
                        }
                    }
                } else {
                    if (x[76] <= 1.156888f) {
                        if (x[7] <= 0.008463f) {
                            if (x[54] <= 3.162896f) {
                                return 0.128571f;
                            } else {
                                return 0.805845f;
                            }
                        } else {
                            if (x[55] <= 7.297774f) {
                                return 0.311798f;
                            } else {
                                return 0.686788f;
                            }
                        }
                    } else {
                        if (x[58] <= 0.292994f) {
                            if (x[35] <= 10.132962f) {
                                return 0.099276f;
                            } else {
                                return 0.590316f;
                            }
                        } else {
                            if (x[53] <= 4.922305f) {
                                return 0.836729f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                }
            } else {
                if (x[68] <= 1.283722f) {
                    if (x[69] <= 0.859966f) {
                        if (x[90] <= 0.616856f) {
                            if (x[19] <= 0.011714f) {
                                return 0.000000f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            return 1.000000f;
                        }
                    } else {
                        if (x[27] <= 0.007983f) {
                            return 0.000000f;
                        } else {
                            if (x[9] <= 1.363449f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    }
                } else {
                    if (x[48] <= 0.064189f) {
                        if (x[13] <= 2.635717f) {
                            if (x[73] <= 0.098700f) {
                                return 0.766457f;
                            } else {
                                return 0.382905f;
                            }
                        } else {
                            if (x[48] <= 0.008072f) {
                                return 0.673394f;
                            } else {
                                return 0.417687f;
                            }
                        }
                    } else {
                        if (x[3] <= 0.334488f) {
                            if (x[55] <= 13.500114f) {
                                return 0.162724f;
                            } else {
                                return 0.480377f;
                            }
                        } else {
                            if (x[58] <= 0.406279f) {
                                return 0.403405f;
                            } else {
                                return 0.942630f;
                            }
                        }
                    }
                }
            }
        }
    } else {
        if (x[75] <= 5.555975f) {
            if (x[37] <= 0.220514f) {
                if (x[48] <= 0.042004f) {
                    if (x[9] <= 0.913661f) {
                        if (x[47] <= 0.934008f) {
                            if (x[14] <= 0.312861f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[11] <= 5.152601f) {
                                return 1.000000f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    } else {
                        if (x[79] <= 1.076832f) {
                            if (x[31] <= 4.004338f) {
                                return 0.310567f;
                            } else {
                                return 0.996459f;
                            }
                        } else {
                            if (x[58] <= 0.376422f) {
                                return 0.854342f;
                            } else {
                                return 0.934242f;
                            }
                        }
                    }
                } else {
                    if (x[24] <= 1.558617f) {
                        if (x[75] <= 2.014786f) {
                            if (x[53] <= 2.175617f) {
                                return 1.000000f;
                            } else {
                                return 0.072086f;
                            }
                        } else {
                            if (x[27] <= 0.427834f) {
                                return 0.958906f;
                            } else {
                                return 0.241959f;
                            }
                        }
                    } else {
                        if (x[69] <= 0.412522f) {
                            if (x[64] <= 4.380242f) {
                                return 0.805256f;
                            } else {
                                return 0.474753f;
                            }
                        } else {
                            if (x[9] <= 1.581080f) {
                                return 0.021476f;
                            } else {
                                return 0.945399f;
                            }
                        }
                    }
                }
            } else {
                if (x[15] <= 0.181821f) {
                    if (x[51] <= 0.126656f) {
                        if (x[50] <= 0.677543f) {
                            if (x[22] <= 3.786426f) {
                                return 0.069036f;
                            } else {
                                return 0.895452f;
                            }
                        } else {
                            if (x[36] <= 1.042176f) {
                                return 0.886187f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[43] <= 0.212229f) {
                            return 1.000000f;
                        } else {
                            return 1.000000f;
                        }
                    }
                } else {
                    if (x[84] <= 0.021108f) {
                        if (x[25] <= 0.221417f) {
                            if (x[52] <= 0.321824f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            return 0.000000f;
                        }
                    } else {
                        if (x[58] <= 0.605069f) {
                            if (x[29] <= 0.011982f) {
                                return 0.765414f;
                            } else {
                                return 0.086403f;
                            }
                        } else {
                            if (x[69] <= 0.694278f) {
                                return 0.951402f;
                            } else {
                                return 0.125835f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[72] <= 0.218466f) {
                if (x[58] <= 0.728976f) {
                    if (x[57] <= 8.969587f) {
                        if (x[14] <= 0.846123f) {
                            if (x[25] <= 0.930966f) {
                                return 0.062438f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[76] <= 0.355157f) {
                                return 1.000000f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    } else {
                        if (x[5] <= 0.247225f) {
                            return 1.000000f;
                        } else {
                            return 1.000000f;
                        }
                    }
                } else {
                    if (x[34] <= 0.462480f) {
                        if (x[81] <= 0.398676f) {
                            return 0.000000f;
                        } else {
                            return 1.000000f;
                        }
                    } else {
                        if (x[2] <= 2.004681f) {
                            if (x[87] <= 1.243401f) {
                                return 0.988459f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            return 0.000000f;
                        }
                    }
                }
            } else {
                if (x[59] <= 0.047260f) {
                    if (x[81] <= 0.083173f) {
                        if (x[25] <= 0.697504f) {
                            if (x[44] <= 4.337241f) {
                                return 0.680300f;
                            } else {
                                return 0.150514f;
                            }
                        } else {
                            if (x[58] <= 0.342924f) {
                                return 0.709903f;
                            } else {
                                return 0.992396f;
                            }
                        }
                    } else {
                        if (x[87] <= 1.436516f) {
                            if (x[82] <= 0.331148f) {
                                return 0.907461f;
                            } else {
                                return 0.065349f;
                            }
                        } else {
                            if (x[75] <= 6.100041f) {
                                return 0.723904f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                } else {
                    if (x[48] <= 0.049478f) {
                        if (x[51] <= 0.142372f) {
                            if (x[75] <= 5.971997f) {
                                return 0.537762f;
                            } else {
                                return 0.137116f;
                            }
                        } else {
                            if (x[82] <= 0.267316f) {
                                return 0.932905f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[46] <= 1.898459f) {
                            if (x[86] <= 6.153230f) {
                                return 0.510625f;
                            } else {
                                return 0.105405f;
                            }
                        } else {
                            if (x[58] <= 0.641909f) {
                                return 0.142784f;
                            } else {
                                return 0.738467f;
                            }
                        }
                    }
                }
            }
        }
    }
}

static inline float esp32_tree_5(const float* x) {
    if (x[51] <= 0.018633f) {
        if (x[86] <= 2.494514f) {
            if (x[59] <= 0.004632f) {
                if (x[96] <= 0.037295f) {
                    if (x[79] <= 13.031423f) {
                        if (x[25] <= 0.054194f) {
                            if (x[38] <= 0.008537f) {
                                return 0.059042f;
                            } else {
                                return 0.830343f;
                            }
                        } else {
                            if (x[88] <= -0.235035f) {
                                return 0.915972f;
                            } else {
                                return 0.697638f;
                            }
                        }
                    } else {
                        if (x[25] <= 0.118654f) {
                            if (x[75] <= 2.154043f) {
                                return 0.990011f;
                            } else {
                                return 0.882274f;
                            }
                        } else {
                            return 1.000000f;
                        }
                    }
                } else {
                    if (x[46] <= 4.129940f) {
                        return 0.000000f;
                    } else {
                        if (x[79] <= 5.863797f) {
                            if (x[44] <= 76.668064f) {
                                return 0.000000f;
                            } else {
                                return 0.873953f;
                            }
                        } else {
                            if (x[87] <= 4.704899f) {
                                return 0.984907f;
                            } else {
                                return 0.181981f;
                            }
                        }
                    }
                }
            } else {
                if (x[74] <= 0.012741f) {
                    if (x[79] <= 9.704662f) {
                        if (x[18] <= 0.005078f) {
                            if (x[47] <= 0.135327f) {
                                return 0.518475f;
                            } else {
                                return 0.960740f;
                            }
                        } else {
                            if (x[7] <= 0.000719f) {
                                return 0.000000f;
                            } else {
                                return 0.967360f;
                            }
                        }
                    } else {
                        if (x[55] <= 196.766884f) {
                            if (x[14] <= 0.022841f) {
                                return 0.000000f;
                            } else {
                                return 0.974343f;
                            }
                        } else {
                            return 0.000000f;
                        }
                    }
                } else {
                    if (x[2] <= 5.853859f) {
                        if (x[73] <= 0.001750f) {
                            if (x[66] <= 151.947357f) {
                                return 0.213777f;
                            } else {
                                return 0.803093f;
                            }
                        } else {
                            if (x[13] <= 1.400189f) {
                                return 0.396334f;
                            } else {
                                return 0.885730f;
                            }
                        }
                    } else {
                        if (x[62] <= 0.011006f) {
                            if (x[36] <= 0.069589f) {
                                return 0.623461f;
                            } else {
                                return 0.169038f;
                            }
                        } else {
                            if (x[53] <= 3.353246f) {
                                return 0.885888f;
                            } else {
                                return 0.173386f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[58] <= 0.311996f) {
                if (x[59] <= 0.008932f) {
                    if (x[13] <= 3.958903f) {
                        if (x[11] <= 89.516479f) {
                            if (x[84] <= 0.003450f) {
                                return 0.230109f;
                            } else {
                                return 0.734444f;
                            }
                        } else {
                            if (x[18] <= 0.059892f) {
                                return 0.961601f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[59] <= 0.004757f) {
                            if (x[35] <= 10.309844f) {
                                return 0.548524f;
                            } else {
                                return 0.818272f;
                            }
                        } else {
                            if (x[47] <= 0.188637f) {
                                return 0.286648f;
                            } else {
                                return 0.887797f;
                            }
                        }
                    }
                } else {
                    if (x[25] <= 0.235220f) {
                        if (x[2] <= 4.610389f) {
                            if (x[29] <= 0.008504f) {
                                return 0.113591f;
                            } else {
                                return 0.385959f;
                            }
                        } else {
                            if (x[36] <= 0.067189f) {
                                return 0.601554f;
                            } else {
                                return 0.047384f;
                            }
                        }
                    } else {
                        if (x[28] <= 0.870081f) {
                            if (x[81] <= 0.048284f) {
                                return 0.192519f;
                            } else {
                                return 0.463183f;
                            }
                        } else {
                            if (x[81] <= 0.041952f) {
                                return 0.712542f;
                            } else {
                                return 0.965122f;
                            }
                        }
                    }
                }
            } else {
                if (x[4] <= 0.144740f) {
                    if (x[0] <= 3.760511f) {
                        if (x[13] <= 1.731514f) {
                            if (x[64] <= 4.273575f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[78] <= 0.729963f) {
                                return 0.000000f;
                            } else {
                                return 0.922397f;
                            }
                        }
                    } else {
                        if (x[38] <= 0.338726f) {
                            if (x[53] <= 4.124754f) {
                                return 0.980645f;
                            } else {
                                return 0.852999f;
                            }
                        } else {
                            if (x[51] <= 0.009354f) {
                                return 0.000000f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                } else {
                    if (x[2] <= 2.918417f) {
                        if (x[11] <= 2.641684f) {
                            if (x[34] <= 0.240325f) {
                                return 0.000000f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[82] <= 0.065113f) {
                                return 0.000000f;
                            } else {
                                return 0.864177f;
                            }
                        }
                    } else {
                        if (x[13] <= 2.560067f) {
                            return 0.000000f;
                        } else {
                            return 1.000000f;
                        }
                    }
                }
            }
        }
    } else {
        if (x[59] <= 0.082867f) {
            if (x[82] <= 0.304711f) {
                if (x[31] <= 3.190493f) {
                    if (x[58] <= 0.292764f) {
                        if (x[59] <= 0.012660f) {
                            if (x[35] <= 12.092399f) {
                                return 0.888929f;
                            } else {
                                return 0.989542f;
                            }
                        } else {
                            if (x[79] <= 8.647706f) {
                                return 0.688254f;
                            } else {
                                return 0.971963f;
                            }
                        }
                    } else {
                        if (x[31] <= 2.617430f) {
                            if (x[10] <= 0.253104f) {
                                return 0.000000f;
                            } else {
                                return 0.977871f;
                            }
                        } else {
                            if (x[14] <= 0.815124f) {
                                return 0.937807f;
                            } else {
                                return 0.755418f;
                            }
                        }
                    }
                } else {
                    if (x[43] <= 1.350629f) {
                        if (x[86] <= 5.438911f) {
                            if (x[36] <= 0.919852f) {
                                return 0.872710f;
                            } else {
                                return 0.603174f;
                            }
                        } else {
                            if (x[47] <= 0.582972f) {
                                return 0.518005f;
                            } else {
                                return 0.925909f;
                            }
                        }
                    } else {
                        if (x[75] <= 5.890148f) {
                            if (x[61] <= 0.588751f) {
                                return 0.859922f;
                            } else {
                                return 0.649417f;
                            }
                        } else {
                            if (x[14] <= 0.690467f) {
                                return 0.159985f;
                            } else {
                                return 0.919484f;
                            }
                        }
                    }
                }
            } else {
                if (x[58] <= 0.671592f) {
                    if (x[69] <= 0.340925f) {
                        if (x[33] <= 1.988598f) {
                            if (x[27] <= 0.318423f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[24] <= 1.872436f) {
                                return 0.979474f;
                            } else {
                                return 0.621898f;
                            }
                        }
                    } else {
                        if (x[88] <= -0.270583f) {
                            if (x[24] <= 1.186983f) {
                                return 1.000000f;
                            } else {
                                return 0.269040f;
                            }
                        } else {
                            if (x[24] <= 1.161876f) {
                                return 1.000000f;
                            } else {
                                return 0.074244f;
                            }
                        }
                    }
                } else {
                    if (x[28] <= 0.142659f) {
                        return 0.000000f;
                    } else {
                        if (x[5] <= 0.342928f) {
                            if (x[10] <= 0.578714f) {
                                return 0.830343f;
                            } else {
                                return 0.985488f;
                            }
                        } else {
                            if (x[79] <= 1.905455f) {
                                return 0.140260f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[85] <= 0.088883f) {
                if (x[58] <= 0.509901f) {
                    if (x[21] <= 0.437680f) {
                        if (x[77] <= 6.622311f) {
                            if (x[47] <= 0.613466f) {
                                return 0.040652f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[11] <= 2.374789f) {
                                return 0.819646f;
                            } else {
                                return 0.044945f;
                            }
                        }
                    } else {
                        if (x[48] <= 0.073197f) {
                            if (x[75] <= 5.869122f) {
                                return 0.826922f;
                            } else {
                                return 0.191474f;
                            }
                        } else {
                            if (x[47] <= 0.530512f) {
                                return 0.256088f;
                            } else {
                                return 0.805050f;
                            }
                        }
                    }
                } else {
                    if (x[67] <= 0.352396f) {
                        if (x[75] <= 6.264235f) {
                            if (x[13] <= 1.950949f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[84] <= 0.157049f) {
                                return 0.000000f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[38] <= 0.358516f) {
                            if (x[77] <= 0.904719f) {
                                return 0.490840f;
                            } else {
                                return 0.938751f;
                            }
                        } else {
                            if (x[20] <= 6.576147f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                }
            } else {
                if (x[17] <= 0.364376f) {
                    if (x[72] <= 0.212427f) {
                        if (x[2] <= 1.551368f) {
                            if (x[85] <= 0.245386f) {
                                return 0.077325f;
                            } else {
                                return 0.681654f;
                            }
                        } else {
                            if (x[17] <= 0.307352f) {
                                return 0.000000f;
                            } else {
                                return 0.039825f;
                            }
                        }
                    } else {
                        if (x[35] <= 2.036455f) {
                            if (x[40] <= 0.025785f) {
                                return 0.623266f;
                            } else {
                                return 0.253361f;
                            }
                        } else {
                            if (x[1] <= 5.676240f) {
                                return 0.033318f;
                            } else {
                                return 0.907309f;
                            }
                        }
                    }
                } else {
                    if (x[46] <= 1.724902f) {
                        if (x[5] <= 0.208697f) {
                            if (x[36] <= 0.273889f) {
                                return 0.311850f;
                            } else {
                                return 0.855035f;
                            }
                        } else {
                            if (x[35] <= 2.101428f) {
                                return 0.083102f;
                            } else {
                                return 0.550271f;
                            }
                        }
                    } else {
                        if (x[59] <= 0.138470f) {
                            if (x[87] <= 1.070249f) {
                                return 0.465978f;
                            } else {
                                return 0.150851f;
                            }
                        } else {
                            if (x[3] <= 0.449748f) {
                                return 0.077232f;
                            } else {
                                return 0.568535f;
                            }
                        }
                    }
                }
            }
        }
    }
}

static inline float esp32_tree_6(const float* x) {
    if (x[25] <= 0.269041f) {
        if (x[62] <= 0.022459f) {
            if (x[55] <= 111.473751f) {
                if (x[5] <= 0.038763f) {
                    if (x[74] <= 0.017872f) {
                        if (x[68] <= 12.214944f) {
                            if (x[15] <= 0.005873f) {
                                return 0.837569f;
                            } else {
                                return 0.498756f;
                            }
                        } else {
                            if (x[7] <= 0.000769f) {
                                return 0.674336f;
                            } else {
                                return 0.974580f;
                            }
                        }
                    } else {
                        if (x[88] <= -0.389808f) {
                            if (x[11] <= 23.576654f) {
                                return 0.252146f;
                            } else {
                                return 0.646761f;
                            }
                        } else {
                            if (x[23] <= 63.453300f) {
                                return 0.088008f;
                            } else {
                                return 0.499155f;
                            }
                        }
                    }
                } else {
                    if (x[45] <= 13.207947f) {
                        if (x[51] <= 0.027795f) {
                            if (x[55] <= 19.934403f) {
                                return 0.130918f;
                            } else {
                                return 0.405059f;
                            }
                        } else {
                            if (x[8] <= 0.200748f) {
                                return 0.696532f;
                            } else {
                                return 0.242599f;
                            }
                        }
                    } else {
                        if (x[47] <= 0.062108f) {
                            if (x[19] <= 0.186426f) {
                                return 0.907309f;
                            } else {
                                return 0.140260f;
                            }
                        } else {
                            if (x[10] <= 3.845732f) {
                                return 0.584609f;
                            } else {
                                return 0.274449f;
                            }
                        }
                    }
                }
            } else {
                if (x[63] <= 0.013225f) {
                    if (x[75] <= 5.945423f) {
                        if (x[29] <= 0.019791f) {
                            if (x[64] <= 2.026052f) {
                                return 0.913511f;
                            } else {
                                return 0.788835f;
                            }
                        } else {
                            if (x[51] <= 0.019390f) {
                                return 0.469356f;
                            } else {
                                return 0.816491f;
                            }
                        }
                    } else {
                        if (x[67] <= 1.742641f) {
                            return 0.000000f;
                        } else {
                            return 1.000000f;
                        }
                    }
                } else {
                    if (x[82] <= 0.097023f) {
                        if (x[33] <= 216.604874f) {
                            if (x[51] <= 0.008638f) {
                                return 0.324667f;
                            } else {
                                return 0.710564f;
                            }
                        } else {
                            if (x[73] <= 0.015300f) {
                                return 0.881815f;
                            } else {
                                return 0.217578f;
                            }
                        }
                    } else {
                        if (x[77] <= 22.109905f) {
                            if (x[65] <= 5.379813f) {
                                return 0.716978f;
                            } else {
                                return 0.901134f;
                            }
                        } else {
                            if (x[0] <= 64.560337f) {
                                return 0.429537f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[59] <= 0.031337f) {
                if (x[75] <= 3.043199f) {
                    if (x[75] <= 2.652380f) {
                        if (x[11] <= 1903.692993f) {
                            if (x[9] <= 2.231154f) {
                                return 0.992115f;
                            } else {
                                return 0.933674f;
                            }
                        } else {
                            if (x[34] <= 98.044628f) {
                                return 0.000000f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[70] <= 0.044970f) {
                            if (x[41] <= 0.019377f) {
                                return 0.936236f;
                            } else {
                                return 0.716311f;
                            }
                        } else {
                            if (x[47] <= 0.369132f) {
                                return 1.000000f;
                            } else {
                                return 0.916750f;
                            }
                        }
                    }
                } else {
                    if (x[46] <= 3.311003f) {
                        if (x[75] <= 5.339934f) {
                            if (x[73] <= 0.079262f) {
                                return 0.811907f;
                            } else {
                                return 0.295073f;
                            }
                        } else {
                            if (x[43] <= 0.683559f) {
                                return 1.000000f;
                            } else {
                                return 0.048509f;
                            }
                        }
                    } else {
                        if (x[14] <= 0.307750f) {
                            if (x[87] <= 1.203338f) {
                                return 0.750861f;
                            } else {
                                return 0.340743f;
                            }
                        } else {
                            if (x[16] <= 0.059010f) {
                                return 0.991131f;
                            } else {
                                return 0.753819f;
                            }
                        }
                    }
                }
            } else {
                if (x[78] <= 19.839478f) {
                    if (x[51] <= 0.206355f) {
                        if (x[44] <= 28.826111f) {
                            if (x[48] <= 0.028278f) {
                                return 0.749780f;
                            } else {
                                return 0.313765f;
                            }
                        } else {
                            if (x[44] <= 45.736748f) {
                                return 0.605672f;
                            } else {
                                return 0.847599f;
                            }
                        }
                    } else {
                        if (x[15] <= 0.155946f) {
                            if (x[16] <= 0.203226f) {
                                return 0.923616f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[12] <= 1.778037f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    }
                } else {
                    if (x[46] <= 3.826105f) {
                        if (x[60] <= 0.037442f) {
                            if (x[25] <= 0.122640f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[83] <= 0.731603f) {
                                return 0.000000f;
                            } else {
                                return 0.956209f;
                            }
                        }
                    } else {
                        if (x[81] <= 0.019144f) {
                            if (x[82] <= 0.010106f) {
                                return 0.951402f;
                            } else {
                                return 0.770046f;
                            }
                        } else {
                            if (x[28] <= 0.917426f) {
                                return 0.158420f;
                            } else {
                                return 0.880116f;
                            }
                        }
                    }
                }
            }
        }
    } else {
        if (x[0] <= 2.608373f) {
            if (x[31] <= 4.102982f) {
                if (x[75] <= 6.114063f) {
                    if (x[87] <= 0.102639f) {
                        if (x[60] <= 0.197634f) {
                            if (x[5] <= 0.059035f) {
                                return 0.000000f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            return 1.000000f;
                        }
                    } else {
                        if (x[28] <= 0.499947f) {
                            if (x[15] <= 0.254237f) {
                                return 0.988405f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[4] <= 0.247007f) {
                                return 0.888308f;
                            } else {
                                return 0.158420f;
                            }
                        }
                    }
                } else {
                    if (x[51] <= 0.022957f) {
                        if (x[73] <= 0.254204f) {
                            return 1.000000f;
                        } else {
                            return 0.000000f;
                        }
                    } else {
                        return 0.000000f;
                    }
                }
            } else {
                if (x[51] <= 0.287245f) {
                    if (x[10] <= 0.566044f) {
                        if (x[72] <= 0.217295f) {
                            if (x[51] <= 0.007503f) {
                                return 0.550271f;
                            } else {
                                return 0.005928f;
                            }
                        } else {
                            if (x[37] <= 0.114079f) {
                                return 0.416483f;
                            } else {
                                return 0.068967f;
                            }
                        }
                    } else {
                        if (x[11] <= 2.183454f) {
                            if (x[75] <= 6.238934f) {
                                return 0.238867f;
                            } else {
                                return 0.054445f;
                            }
                        } else {
                            if (x[75] <= 6.291535f) {
                                return 0.625295f;
                            } else {
                                return 0.128778f;
                            }
                        }
                    }
                } else {
                    if (x[34] <= 0.433821f) {
                        return 0.000000f;
                    } else {
                        if (x[52] <= 0.057481f) {
                            if (x[21] <= 0.234400f) {
                                return 0.000000f;
                            } else {
                                return 0.942916f;
                            }
                        } else {
                            if (x[79] <= 2.029629f) {
                                return 0.000000f;
                            } else {
                                return 0.785899f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[75] <= 5.496367f) {
                if (x[35] <= 1.122228f) {
                    if (x[38] <= 0.084623f) {
                        if (x[20] <= 1.482861f) {
                            return 1.000000f;
                        } else {
                            if (x[3] <= 0.384828f) {
                                return 1.000000f;
                            } else {
                                return 0.039503f;
                            }
                        }
                    } else {
                        if (x[50] <= 0.869347f) {
                            if (x[40] <= 0.028053f) {
                                return 0.000000f;
                            } else {
                                return 0.930229f;
                            }
                        } else {
                            if (x[64] <= 2.717789f) {
                                return 0.000000f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                } else {
                    if (x[3] <= 1.131490f) {
                        if (x[47] <= 0.309579f) {
                            if (x[27] <= 0.039754f) {
                                return 0.941974f;
                            } else {
                                return 0.708462f;
                            }
                        } else {
                            if (x[15] <= 0.217343f) {
                                return 0.921753f;
                            } else {
                                return 0.323176f;
                            }
                        }
                    } else {
                        if (x[25] <= 1.058114f) {
                            if (x[1] <= 1.191208f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            return 1.000000f;
                        }
                    }
                }
            } else {
                if (x[66] <= 3.976459f) {
                    if (x[46] <= 1.482579f) {
                        if (x[70] <= 0.078424f) {
                            if (x[1] <= 1.790666f) {
                                return 0.050511f;
                            } else {
                                return 0.944842f;
                            }
                        } else {
                            if (x[25] <= 0.295946f) {
                                return 0.550271f;
                            } else {
                                return 0.941726f;
                            }
                        }
                    } else {
                        if (x[35] <= 1.214863f) {
                            if (x[74] <= 0.054484f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[42] <= 5.886576f) {
                                return 0.533260f;
                            } else {
                                return 0.213163f;
                            }
                        }
                    }
                } else {
                    if (x[65] <= 1.414699f) {
                        if (x[46] <= 1.921696f) {
                            if (x[9] <= 5.554187f) {
                                return 0.906343f;
                            } else {
                                return 0.478535f;
                            }
                        } else {
                            if (x[62] <= 0.157059f) {
                                return 0.123495f;
                            } else {
                                return 0.810695f;
                            }
                        }
                    } else {
                        if (x[7] <= 0.071249f) {
                            if (x[3] <= 0.492508f) {
                                return 0.266697f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[88] <= -0.349117f) {
                                return 0.434740f;
                            } else {
                                return 0.084054f;
                            }
                        }
                    }
                }
            }
        }
    }
}

static inline float esp32_tree_7(const float* x) {
    if (x[18] <= 0.012929f) {
        if (x[85] <= 0.019819f) {
            if (x[57] <= 5.919264f) {
                if (x[14] <= 0.217019f) {
                    if (x[58] <= 0.082080f) {
                        if (x[65] <= 6.254601f) {
                            if (x[66] <= 381.653458f) {
                                return 0.040152f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[91] <= -0.177933f) {
                                return 1.000000f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    } else {
                        if (x[73] <= 0.128041f) {
                            if (x[17] <= 0.961759f) {
                                return 0.838181f;
                            } else {
                                return 0.974197f;
                            }
                        } else {
                            if (x[50] <= 0.985581f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    }
                } else {
                    if (x[73] <= 0.019358f) {
                        if (x[76] <= 0.241155f) {
                            return 0.000000f;
                        } else {
                            if (x[35] <= 2.350468f) {
                                return 0.289699f;
                            } else {
                                return 0.996578f;
                            }
                        }
                    } else {
                        if (x[33] <= 109.033958f) {
                            return 1.000000f;
                        } else {
                            if (x[7] <= 0.022865f) {
                                return 0.000000f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                }
            } else {
                if (x[80] <= 0.088997f) {
                    if (x[52] <= 0.007976f) {
                        if (x[44] <= 181.626022f) {
                            if (x[48] <= 0.005128f) {
                                return 0.169385f;
                            } else {
                                return 0.873361f;
                            }
                        } else {
                            if (x[83] <= 0.893404f) {
                                return 0.000000f;
                            } else {
                                return 0.980483f;
                            }
                        }
                    } else {
                        if (x[5] <= 0.008620f) {
                            if (x[72] <= 0.970975f) {
                                return 0.451349f;
                            } else {
                                return 0.868050f;
                            }
                        } else {
                            if (x[51] <= 0.005337f) {
                                return 0.812610f;
                            } else {
                                return 0.962783f;
                            }
                        }
                    }
                } else {
                    if (x[39] <= 0.971620f) {
                        if (x[92] <= -0.009626f) {
                            if (x[3] <= 0.167730f) {
                                return 0.461006f;
                            } else {
                                return 0.822995f;
                            }
                        } else {
                            if (x[64] <= 1.800945f) {
                                return 0.729132f;
                            } else {
                                return 0.223197f;
                            }
                        }
                    } else {
                        if (x[59] <= 0.003647f) {
                            if (x[14] <= 0.049399f) {
                                return 0.640253f;
                            } else {
                                return 0.948330f;
                            }
                        } else {
                            if (x[58] <= 0.117295f) {
                                return 0.618552f;
                            } else {
                                return 0.970620f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[33] <= 92.526829f) {
                if (x[68] <= 3.175481f) {
                    if (x[55] <= 19.786245f) {
                        if (x[47] <= 0.375314f) {
                            if (x[73] <= 0.007947f) {
                                return 0.022246f;
                            } else {
                                return 0.255831f;
                            }
                        } else {
                            if (x[12] <= 6.422814f) {
                                return 0.161026f;
                            } else {
                                return 0.943934f;
                            }
                        }
                    } else {
                        if (x[58] <= 0.272501f) {
                            if (x[79] <= 1.865110f) {
                                return 0.835935f;
                            } else {
                                return 0.480398f;
                            }
                        } else {
                            if (x[36] <= 0.777570f) {
                                return 0.986193f;
                            } else {
                                return 0.239982f;
                            }
                        }
                    }
                } else {
                    if (x[58] <= 0.247189f) {
                        if (x[79] <= 10.034712f) {
                            if (x[3] <= 0.271619f) {
                                return 0.081448f;
                            } else {
                                return 0.764087f;
                            }
                        } else {
                            if (x[36] <= 0.069996f) {
                                return 0.886657f;
                            } else {
                                return 0.538783f;
                            }
                        }
                    } else {
                        if (x[1] <= 34.760817f) {
                            if (x[89] <= -0.174667f) {
                                return 0.851186f;
                            } else {
                                return 0.541689f;
                            }
                        } else {
                            if (x[19] <= 0.073619f) {
                                return 0.848182f;
                            } else {
                                return 0.970082f;
                            }
                        }
                    }
                }
            } else {
                if (x[49] <= 0.025144f) {
                    if (x[32] <= 7.201776f) {
                        if (x[47] <= 0.182491f) {
                            if (x[63] <= 0.012927f) {
                                return 0.756959f;
                            } else {
                                return 0.253162f;
                            }
                        } else {
                            if (x[5] <= 0.012148f) {
                                return 0.958668f;
                            } else {
                                return 0.793622f;
                            }
                        }
                    } else {
                        if (x[11] <= 87.315536f) {
                            if (x[64] <= 2.963230f) {
                                return 1.000000f;
                            } else {
                                return 0.305183f;
                            }
                        } else {
                            if (x[3] <= 0.079409f) {
                                return 0.713187f;
                            } else {
                                return 0.924719f;
                            }
                        }
                    }
                } else {
                    if (x[79] <= 8.428751f) {
                        if (x[36] <= 0.071695f) {
                            if (x[55] <= 248.237198f) {
                                return 0.181981f;
                            } else {
                                return 0.765414f;
                            }
                        } else {
                            if (x[13] <= 1.430447f) {
                                return 0.352250f;
                            } else {
                                return 0.812114f;
                            }
                        }
                    } else {
                        if (x[50] <= 0.895016f) {
                            if (x[76] <= 1.657658f) {
                                return 0.904205f;
                            } else {
                                return 0.998120f;
                            }
                        } else {
                            if (x[82] <= 0.007442f) {
                                return 0.958759f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                }
            }
        }
    } else {
        if (x[86] <= 5.091449f) {
            if (x[43] <= 1.522942f) {
                if (x[10] <= 0.374641f) {
                    if (x[8] <= 0.034225f) {
                        if (x[16] <= 0.139379f) {
                            if (x[25] <= 0.567648f) {
                                return 0.325685f;
                            } else {
                                return 0.847599f;
                            }
                        } else {
                            if (x[91] <= -0.500739f) {
                                return 0.307926f;
                            } else {
                                return 0.964181f;
                            }
                        }
                    } else {
                        if (x[75] <= 3.314915f) {
                            if (x[70] <= 0.449775f) {
                                return 0.873361f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[14] <= 0.779880f) {
                                return 0.114100f;
                            } else {
                                return 0.745971f;
                            }
                        }
                    }
                } else {
                    if (x[62] <= 0.055674f) {
                        if (x[59] <= 0.061588f) {
                            if (x[77] <= 7.301267f) {
                                return 0.895651f;
                            } else {
                                return 0.775416f;
                            }
                        } else {
                            if (x[25] <= 0.366771f) {
                                return 0.461743f;
                            } else {
                                return 0.889170f;
                            }
                        }
                    } else {
                        if (x[59] <= 0.077084f) {
                            if (x[73] <= 0.051237f) {
                                return 0.956994f;
                            } else {
                                return 0.912436f;
                            }
                        } else {
                            if (x[73] <= 0.122484f) {
                                return 0.785325f;
                            } else {
                                return 0.096165f;
                            }
                        }
                    }
                }
            } else {
                if (x[47] <= 0.282607f) {
                    if (x[88] <= 0.287824f) {
                        if (x[75] <= 2.931548f) {
                            if (x[87] <= 2.407356f) {
                                return 0.888409f;
                            } else {
                                return 0.681910f;
                            }
                        } else {
                            if (x[68] <= 2.381144f) {
                                return 0.552795f;
                            } else {
                                return 0.341918f;
                            }
                        }
                    } else {
                        if (x[77] <= 32.499109f) {
                            if (x[60] <= 0.076623f) {
                                return 0.583048f;
                            } else {
                                return 0.842658f;
                            }
                        } else {
                            if (x[91] <= -0.848539f) {
                                return 0.000000f;
                            } else {
                                return 0.899522f;
                            }
                        }
                    }
                } else {
                    if (x[57] <= 1.370662f) {
                        if (x[9] <= 0.728134f) {
                            return 0.000000f;
                        } else {
                            if (x[58] <= 0.980587f) {
                                return 0.930697f;
                            } else {
                                return 0.999055f;
                            }
                        }
                    } else {
                        if (x[79] <= 1.229191f) {
                            if (x[39] <= 0.838309f) {
                                return 0.540826f;
                            } else {
                                return 0.134479f;
                            }
                        } else {
                            if (x[46] <= 1.878186f) {
                                return 0.918634f;
                            } else {
                                return 0.763813f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[58] <= 0.497879f) {
                if (x[73] <= 0.149592f) {
                    if (x[17] <= 0.383350f) {
                        if (x[14] <= 0.658284f) {
                            if (x[35] <= 2.025378f) {
                                return 0.272065f;
                            } else {
                                return 0.112293f;
                            }
                        } else {
                            if (x[28] <= 0.561024f) {
                                return 0.411481f;
                            } else {
                                return 0.880116f;
                            }
                        }
                    } else {
                        if (x[10] <= 0.617947f) {
                            if (x[75] <= 3.435134f) {
                                return 0.814094f;
                            } else {
                                return 0.233169f;
                            }
                        } else {
                            if (x[69] <= 0.515879f) {
                                return 0.503819f;
                            } else {
                                return 0.985864f;
                            }
                        }
                    }
                } else {
                    if (x[0] <= 3.080521f) {
                        if (x[51] <= 0.351125f) {
                            if (x[24] <= 1.195450f) {
                                return 1.000000f;
                            } else {
                                return 0.025147f;
                            }
                        } else {
                            if (x[92] <= -0.372532f) {
                                return 1.000000f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    } else {
                        if (x[9] <= 5.251698f) {
                            if (x[73] <= 0.225466f) {
                                return 0.366789f;
                            } else {
                                return 0.132656f;
                            }
                        } else {
                            if (x[81] <= 0.086758f) {
                                return 0.019251f;
                            } else {
                                return 0.187910f;
                            }
                        }
                    }
                }
            } else {
                if (x[42] <= 6.766376f) {
                    if (x[47] <= 0.723451f) {
                        if (x[75] <= 6.252523f) {
                            if (x[59] <= 0.042867f) {
                                return 0.942694f;
                            } else {
                                return 0.794834f;
                            }
                        } else {
                            if (x[25] <= 0.739889f) {
                                return 0.145111f;
                            } else {
                                return 0.912709f;
                            }
                        }
                    } else {
                        if (x[9] <= 6.885142f) {
                            if (x[82] <= 0.408245f) {
                                return 0.988106f;
                            } else {
                                return 0.647309f;
                            }
                        } else {
                            return 0.000000f;
                        }
                    }
                } else {
                    if (x[25] <= 0.854701f) {
                        if (x[30] <= 0.012073f) {
                            return 0.000000f;
                        } else {
                            return 0.000000f;
                        }
                    } else {
                        return 1.000000f;
                    }
                }
            }
        }
    }
}

static inline float esp32_tree_8(const float* x) {
    if (x[69] <= 0.243320f) {
        if (x[63] <= 0.021187f) {
            if (x[25] <= 0.217400f) {
                if (x[0] <= 178.011635f) {
                    if (x[62] <= 0.012565f) {
                        if (x[79] <= 10.957901f) {
                            if (x[87] <= 0.724997f) {
                                return 0.684873f;
                            } else {
                                return 0.317927f;
                            }
                        } else {
                            if (x[2] <= 9.825437f) {
                                return 0.936511f;
                            } else {
                                return 0.690943f;
                            }
                        }
                    } else {
                        if (x[68] <= 4.674475f) {
                            if (x[54] <= 0.871782f) {
                                return 0.225601f;
                            } else {
                                return 0.796558f;
                            }
                        } else {
                            if (x[27] <= 0.013366f) {
                                return 0.964919f;
                            } else {
                                return 0.893473f;
                            }
                        }
                    }
                } else {
                    if (x[68] <= 13.693617f) {
                        if (x[49] <= 0.013506f) {
                            if (x[67] <= 18.952341f) {
                                return 0.951402f;
                            } else {
                                return 0.676615f;
                            }
                        } else {
                            if (x[11] <= 1406.178833f) {
                                return 0.969637f;
                            } else {
                                return 0.328600f;
                            }
                        }
                    } else {
                        if (x[69] <= 0.056281f) {
                            if (x[65] <= 4.564987f) {
                                return 0.997760f;
                            } else {
                                return 0.916750f;
                            }
                        } else {
                            if (x[22] <= 66.460426f) {
                                return 0.000000f;
                            } else {
                                return 0.944842f;
                            }
                        }
                    }
                }
            } else {
                if (x[58] <= 0.141595f) {
                    if (x[64] <= 2.521325f) {
                        if (x[73] <= 0.021056f) {
                            if (x[21] <= 0.462447f) {
                                return 0.000000f;
                            } else {
                                return 0.982543f;
                            }
                        } else {
                            if (x[5] <= 0.020798f) {
                                return 0.365400f;
                            } else {
                                return 0.903444f;
                            }
                        }
                    } else {
                        if (x[13] <= 4.939668f) {
                            if (x[42] <= 3.678504f) {
                                return 0.947859f;
                            } else {
                                return 0.379569f;
                            }
                        } else {
                            if (x[2] <= 6.788800f) {
                                return 0.237076f;
                            } else {
                                return 0.859508f;
                            }
                        }
                    }
                } else {
                    if (x[90] <= -0.894733f) {
                        return 0.000000f;
                    } else {
                        if (x[79] <= 3.527176f) {
                            if (x[59] <= 0.035265f) {
                                return 0.971056f;
                            } else {
                                return 0.530394f;
                            }
                        } else {
                            if (x[58] <= 0.158789f) {
                                return 0.971307f;
                            } else {
                                return 0.998198f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[85] <= 0.021751f) {
                if (x[61] <= 0.909768f) {
                    if (x[3] <= 0.149984f) {
                        if (x[86] <= 2.321128f) {
                            if (x[62] <= 0.002034f) {
                                return 0.328600f;
                            } else {
                                return 0.940111f;
                            }
                        } else {
                            if (x[35] <= 10.580592f) {
                                return 0.670169f;
                            } else {
                                return 0.991099f;
                            }
                        }
                    } else {
                        if (x[81] <= 0.012313f) {
                            if (x[95] <= -0.151552f) {
                                return 0.859508f;
                            } else {
                                return 0.992598f;
                            }
                        } else {
                            if (x[40] <= 0.001331f) {
                                return 0.000000f;
                            } else {
                                return 0.924970f;
                            }
                        }
                    }
                } else {
                    if (x[22] <= 144.770943f) {
                        if (x[85] <= 0.013917f) {
                            if (x[0] <= 190.954758f) {
                                return 0.867415f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[17] <= 0.934415f) {
                                return 0.649800f;
                            } else {
                                return 0.269635f;
                            }
                        }
                    } else {
                        if (x[42] <= 3.385667f) {
                            if (x[39] <= 0.970437f) {
                                return 0.723443f;
                            } else {
                                return 0.929233f;
                            }
                        } else {
                            if (x[51] <= 0.002974f) {
                                return 0.000000f;
                            } else {
                                return 0.916750f;
                            }
                        }
                    }
                }
            } else {
                if (x[51] <= 0.021055f) {
                    if (x[58] <= 0.278379f) {
                        if (x[18] <= 0.012708f) {
                            if (x[25] <= 0.375139f) {
                                return 0.088978f;
                            } else {
                                return 0.951642f;
                            }
                        } else {
                            if (x[47] <= 0.145845f) {
                                return 0.526848f;
                            } else {
                                return 0.200526f;
                            }
                        }
                    } else {
                        if (x[45] <= 3.493796f) {
                            if (x[2] <= 2.938969f) {
                                return 0.020233f;
                            } else {
                                return 0.817731f;
                            }
                        } else {
                            if (x[17] <= 0.531379f) {
                                return 0.559957f;
                            } else {
                                return 0.905680f;
                            }
                        }
                    }
                } else {
                    if (x[86] <= 2.923503f) {
                        if (x[2] <= 3.966363f) {
                            if (x[27] <= 0.012571f) {
                                return 0.328600f;
                            } else {
                                return 0.986183f;
                            }
                        } else {
                            if (x[86] <= 2.578524f) {
                                return 0.942754f;
                            } else {
                                return 0.697906f;
                            }
                        }
                    } else {
                        if (x[88] <= 0.207830f) {
                            if (x[25] <= 0.345420f) {
                                return 0.483865f;
                            } else {
                                return 0.873953f;
                            }
                        } else {
                            if (x[59] <= 0.134960f) {
                                return 0.848806f;
                            } else {
                                return 0.201221f;
                            }
                        }
                    }
                }
            }
        }
    } else {
        if (x[75] <= 5.327321f) {
            if (x[57] <= 3.070936f) {
                if (x[59] <= 0.130743f) {
                    if (x[86] <= 2.214264f) {
                        if (x[60] <= 0.067033f) {
                            if (x[47] <= 0.363063f) {
                                return 0.946204f;
                            } else {
                                return 0.303013f;
                            }
                        } else {
                            if (x[3] <= 0.464639f) {
                                return 0.990131f;
                            } else {
                                return 0.681573f;
                            }
                        }
                    } else {
                        if (x[67] <= 5.304812f) {
                            if (x[9] <= 1.496979f) {
                                return 0.101764f;
                            } else {
                                return 0.882338f;
                            }
                        } else {
                            if (x[3] <= 1.037591f) {
                                return 0.960654f;
                            } else {
                                return 0.536858f;
                            }
                        }
                    }
                } else {
                    if (x[71] <= 0.217768f) {
                        if (x[58] <= 0.497915f) {
                            if (x[69] <= 0.264906f) {
                                return 0.291078f;
                            } else {
                                return 0.055895f;
                            }
                        } else {
                            if (x[68] <= 2.461911f) {
                                return 1.000000f;
                            } else {
                                return 0.753628f;
                            }
                        }
                    } else {
                        if (x[47] <= 0.465826f) {
                            if (x[25] <= 0.649928f) {
                                return 0.050511f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            return 1.000000f;
                        }
                    }
                }
            } else {
                if (x[70] <= 0.069916f) {
                    if (x[46] <= 3.131008f) {
                        if (x[86] <= 5.176744f) {
                            if (x[75] <= 2.217684f) {
                                return 0.121162f;
                            } else {
                                return 0.889015f;
                            }
                        } else {
                            if (x[64] <= 2.725158f) {
                                return 0.944842f;
                            } else {
                                return 0.168488f;
                            }
                        }
                    } else {
                        if (x[48] <= 0.017031f) {
                            if (x[27] <= 0.042498f) {
                                return 0.717166f;
                            } else {
                                return 0.448974f;
                            }
                        } else {
                            if (x[72] <= 0.890384f) {
                                return 0.284225f;
                            } else {
                                return 0.874293f;
                            }
                        }
                    }
                } else {
                    if (x[18] <= 0.036916f) {
                        if (x[33] <= 7.714800f) {
                            if (x[35] <= 2.821081f) {
                                return 0.582640f;
                            } else {
                                return 0.192100f;
                            }
                        } else {
                            if (x[59] <= 0.026375f) {
                                return 0.840755f;
                            } else {
                                return 0.448516f;
                            }
                        }
                    } else {
                        if (x[59] <= 0.075720f) {
                            if (x[43] <= 1.301544f) {
                                return 0.941483f;
                            } else {
                                return 0.772614f;
                            }
                        } else {
                            if (x[1] <= 6.627078f) {
                                return 0.040484f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[67] <= 0.593234f) {
                if (x[47] <= 0.722379f) {
                    if (x[75] <= 6.255573f) {
                        if (x[45] <= 5.206696f) {
                            if (x[15] <= 0.154461f) {
                                return 0.410595f;
                            } else {
                                return 0.034092f;
                            }
                        } else {
                            if (x[83] <= 0.201351f) {
                                return 0.044945f;
                            } else {
                                return 0.671532f;
                            }
                        }
                    } else {
                        if (x[57] <= 1.206621f) {
                            return 1.000000f;
                        } else {
                            if (x[78] <= 0.570342f) {
                                return 0.004693f;
                            } else {
                                return 0.068842f;
                            }
                        }
                    }
                } else {
                    if (x[72] <= 0.094254f) {
                        return 0.000000f;
                    } else {
                        if (x[35] <= 1.293293f) {
                            return 0.000000f;
                        } else {
                            return 1.000000f;
                        }
                    }
                }
            } else {
                if (x[51] <= 0.229515f) {
                    if (x[59] <= 0.069961f) {
                        if (x[31] <= 3.324120f) {
                            if (x[14] <= 0.452408f) {
                                return 0.543388f;
                            } else {
                                return 0.972123f;
                            }
                        } else {
                            if (x[66] <= 5.000971f) {
                                return 0.568868f;
                            } else {
                                return 0.257582f;
                            }
                        }
                    } else {
                        if (x[88] <= 0.484028f) {
                            if (x[75] <= 5.917393f) {
                                return 0.249433f;
                            } else {
                                return 0.110285f;
                            }
                        } else {
                            if (x[1] <= 0.926079f) {
                                return 0.000000f;
                            } else {
                                return 0.687123f;
                            }
                        }
                    }
                } else {
                    if (x[75] <= 6.386611f) {
                        if (x[36] <= 0.373557f) {
                            if (x[35] <= 2.666108f) {
                                return 0.338707f;
                            } else {
                                return 0.863298f;
                            }
                        } else {
                            if (x[26] <= 0.047148f) {
                                return 0.768693f;
                            } else {
                                return 0.950682f;
                            }
                        }
                    } else {
                        if (x[63] <= 0.034399f) {
                            if (x[90] <= 0.483909f) {
                                return 0.897328f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[9] <= 5.257211f) {
                                return 0.830343f;
                            } else {
                                return 0.045786f;
                            }
                        }
                    }
                }
            }
        }
    }
}

static inline float esp32_tree_9(const float* x) {
    if (x[18] <= 0.011147f) {
        if (x[85] <= 0.019739f) {
            if (x[62] <= 0.008010f) {
                if (x[26] <= 0.006252f) {
                    if (x[41] <= 0.015705f) {
                        if (x[67] <= 73.565319f) {
                            if (x[44] <= 427.136765f) {
                                return 0.764990f;
                            } else {
                                return 0.991195f;
                            }
                        } else {
                            if (x[57] <= 7.347146f) {
                                return 0.996948f;
                            } else {
                                return 0.932246f;
                            }
                        }
                    } else {
                        if (x[49] <= 0.002838f) {
                            if (x[3] <= 0.200999f) {
                                return 0.029681f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[79] <= 12.107468f) {
                                return 0.599976f;
                            } else {
                                return 0.967590f;
                            }
                        }
                    }
                } else {
                    if (x[97] <= -0.008106f) {
                        if (x[88] <= -0.536831f) {
                            if (x[46] <= 12.194982f) {
                                return 0.931595f;
                            } else {
                                return 0.494656f;
                            }
                        } else {
                            if (x[83] <= 0.874232f) {
                                return 0.114100f;
                            } else {
                                return 0.707393f;
                            }
                        }
                    } else {
                        if (x[96] <= 0.123153f) {
                            if (x[88] <= 0.114983f) {
                                return 0.201916f;
                            } else {
                                return 0.718713f;
                            }
                        } else {
                            if (x[31] <= 2.847989f) {
                                return 0.878846f;
                            } else {
                                return 0.393119f;
                            }
                        }
                    }
                }
            } else {
                if (x[29] <= 0.104728f) {
                    if (x[68] <= 1.672292f) {
                        if (x[30] <= 0.044617f) {
                            return 0.000000f;
                        } else {
                            return 1.000000f;
                        }
                    } else {
                        if (x[78] <= 6.305919f) {
                            if (x[80] <= 0.337289f) {
                                return 0.830343f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[54] <= 5.383626f) {
                                return 0.956174f;
                            } else {
                                return 0.714046f;
                            }
                        }
                    }
                } else {
                    if (x[80] <= 0.187247f) {
                        return 1.000000f;
                    } else {
                        if (x[52] <= 0.001832f) {
                            return 1.000000f;
                        } else {
                            if (x[13] <= 6.605852f) {
                                return 0.000000f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[80] <= 0.297720f) {
                if (x[55] <= 107.951527f) {
                    if (x[58] <= 0.256755f) {
                        if (x[25] <= 0.305598f) {
                            if (x[69] <= 0.070663f) {
                                return 0.445329f;
                            } else {
                                return 0.091700f;
                            }
                        } else {
                            if (x[27] <= 0.044252f) {
                                return 0.977124f;
                            } else {
                                return 0.372494f;
                            }
                        }
                    } else {
                        if (x[34] <= 36.429794f) {
                            if (x[79] <= 5.254714f) {
                                return 0.423822f;
                            } else {
                                return 0.834591f;
                            }
                        } else {
                            if (x[26] <= 0.012546f) {
                                return 0.971410f;
                            } else {
                                return 0.856113f;
                            }
                        }
                    }
                } else {
                    if (x[47] <= 0.163939f) {
                        if (x[87] <= 1.673213f) {
                            if (x[51] <= 0.001097f) {
                                return 0.836417f;
                            } else {
                                return 0.629493f;
                            }
                        } else {
                            if (x[63] <= 0.013267f) {
                                return 0.665286f;
                            } else {
                                return 0.226345f;
                            }
                        }
                    } else {
                        if (x[24] <= 4.392846f) {
                            if (x[75] <= 5.168091f) {
                                return 0.981489f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[73] <= 0.011879f) {
                                return 0.886585f;
                            } else {
                                return 0.357395f;
                            }
                        }
                    }
                }
            } else {
                if (x[78] <= 10.657666f) {
                    if (x[11] <= 13.625114f) {
                        if (x[89] <= -0.166514f) {
                            if (x[15] <= 0.155111f) {
                                return 0.675605f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[60] <= 0.024987f) {
                                return 0.322415f;
                            } else {
                                return 0.065936f;
                            }
                        }
                    } else {
                        if (x[45] <= 7.126057f) {
                            if (x[5] <= 0.281011f) {
                                return 0.936236f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[58] <= 0.288614f) {
                                return 0.478686f;
                            } else {
                                return 0.971307f;
                            }
                        }
                    }
                } else {
                    if (x[83] <= 0.968357f) {
                        if (x[80] <= 0.304013f) {
                            if (x[0] <= 48.126499f) {
                                return 0.075419f;
                            } else {
                                return 0.793622f;
                            }
                        } else {
                            if (x[84] <= 0.072952f) {
                                return 0.930183f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        return 0.000000f;
                    }
                }
            }
        }
    } else {
        if (x[75] <= 5.122491f) {
            if (x[87] <= 0.989434f) {
                if (x[55] <= 1.775701f) {
                    if (x[85] <= 0.085097f) {
                        if (x[47] <= 0.455496f) {
                            if (x[54] <= 0.729011f) {
                                return 0.064772f;
                            } else {
                                return 0.880116f;
                            }
                        } else {
                            return 1.000000f;
                        }
                    } else {
                        if (x[8] <= 0.374682f) {
                            if (x[49] <= 0.367617f) {
                                return 0.055264f;
                            } else {
                                return 0.550271f;
                            }
                        } else {
                            return 1.000000f;
                        }
                    }
                } else {
                    if (x[2] <= 1.035475f) {
                        if (x[71] <= 0.162036f) {
                            if (x[42] <= 1.590916f) {
                                return 0.753628f;
                            } else {
                                return 0.013020f;
                            }
                        } else {
                            if (x[27] <= 0.139554f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    } else {
                        if (x[55] <= 7.279145f) {
                            if (x[51] <= 0.021046f) {
                                return 0.297298f;
                            } else {
                                return 0.853105f;
                            }
                        } else {
                            if (x[62] <= 0.090234f) {
                                return 0.849313f;
                            } else {
                                return 0.949636f;
                            }
                        }
                    }
                }
            } else {
                if (x[25] <= 0.281640f) {
                    if (x[58] <= 0.340911f) {
                        if (x[69] <= 0.107872f) {
                            if (x[33] <= 13.788909f) {
                                return 0.396334f;
                            } else {
                                return 0.860901f;
                            }
                        } else {
                            if (x[55] <= 47.903751f) {
                                return 0.207695f;
                            } else {
                                return 0.502705f;
                            }
                        }
                    } else {
                        if (x[75] <= 3.450956f) {
                            if (x[69] <= 0.175225f) {
                                return 0.924902f;
                            } else {
                                return 0.990236f;
                            }
                        } else {
                            if (x[49] <= 0.051554f) {
                                return 0.934030f;
                            } else {
                                return 0.645146f;
                            }
                        }
                    }
                } else {
                    if (x[36] <= 1.020644f) {
                        if (x[47] <= 0.302875f) {
                            if (x[75] <= 3.405305f) {
                                return 0.924686f;
                            } else {
                                return 0.629851f;
                            }
                        } else {
                            if (x[40] <= 0.006733f) {
                                return 0.449251f;
                            } else {
                                return 0.925412f;
                            }
                        }
                    } else {
                        if (x[33] <= 19.789549f) {
                            if (x[62] <= 0.038200f) {
                                return 0.144398f;
                            } else {
                                return 0.730843f;
                            }
                        } else {
                            if (x[80] <= 1.024300f) {
                                return 1.000000f;
                            } else {
                                return 0.066938f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[25] <= 0.751547f) {
                if (x[46] <= 1.489050f) {
                    if (x[68] <= 1.485097f) {
                        if (x[58] <= 0.760458f) {
                            if (x[59] <= 0.014247f) {
                                return 1.000000f;
                            } else {
                                return 0.024732f;
                            }
                        } else {
                            if (x[64] <= 4.245208f) {
                                return 1.000000f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    } else {
                        if (x[87] <= 0.688485f) {
                            if (x[36] <= 0.826904f) {
                                return 0.935004f;
                            } else {
                                return 0.140260f;
                            }
                        } else {
                            if (x[46] <= 1.399556f) {
                                return 0.849561f;
                            } else {
                                return 0.464559f;
                            }
                        }
                    }
                } else {
                    if (x[54] <= 0.515047f) {
                        if (x[62] <= 0.221476f) {
                            if (x[72] <= 0.259266f) {
                                return 0.021657f;
                            } else {
                                return 0.118288f;
                            }
                        } else {
                            if (x[38] <= 0.210956f) {
                                return 0.862875f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[86] <= 6.338093f) {
                            if (x[75] <= 6.117745f) {
                                return 0.499940f;
                            } else {
                                return 0.178470f;
                            }
                        } else {
                            if (x[37] <= 0.015053f) {
                                return 0.748207f;
                            } else {
                                return 0.092456f;
                            }
                        }
                    }
                }
            } else {
                if (x[75] <= 6.792500f) {
                    if (x[11] <= 85.957226f) {
                        if (x[9] <= 6.463000f) {
                            if (x[73] <= 0.493350f) {
                                return 0.994612f;
                            } else {
                                return 0.709903f;
                            }
                        } else {
                            if (x[5] <= 0.332500f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[51] <= 0.019876f) {
                            return 0.000000f;
                        } else {
                            return 0.000000f;
                        }
                    }
                } else {
                    if (x[31] <= 6.334236f) {
                        return 1.000000f;
                    } else {
                        return 0.000000f;
                    }
                }
            }
        }
    }
}

static inline float esp32_tree_10(const float* x) {
    if (x[51] <= 0.018739f) {
        if (x[30] <= 0.020688f) {
            if (x[33] <= 174.072014f) {
                if (x[58] <= 0.218897f) {
                    if (x[55] <= 161.115532f) {
                        if (x[86] <= 2.042359f) {
                            if (x[8] <= 0.023563f) {
                                return 0.700559f;
                            } else {
                                return 0.925967f;
                            }
                        } else {
                            if (x[17] <= 0.938781f) {
                                return 0.455092f;
                            } else {
                                return 0.257641f;
                            }
                        }
                    } else {
                        if (x[79] <= 10.883255f) {
                            if (x[44] <= 355.280624f) {
                                return 0.657724f;
                            } else {
                                return 0.895735f;
                            }
                        } else {
                            if (x[18] <= 0.001115f) {
                                return 0.760838f;
                            } else {
                                return 0.990867f;
                            }
                        }
                    }
                } else {
                    if (x[87] <= 5.630291f) {
                        if (x[11] <= 5.921517f) {
                            if (x[29] <= 0.003863f) {
                                return 0.880116f;
                            } else {
                                return 0.158420f;
                            }
                        } else {
                            if (x[54] <= 0.314655f) {
                                return 0.000000f;
                            } else {
                                return 0.970829f;
                            }
                        }
                    } else {
                        if (x[53] <= 3.212867f) {
                            return 0.000000f;
                        } else {
                            return 0.000000f;
                        }
                    }
                }
            } else {
                if (x[70] <= 0.009353f) {
                    if (x[85] <= 0.016029f) {
                        if (x[33] <= 207.521774f) {
                            if (x[93] <= 0.001101f) {
                                return 0.738467f;
                            } else {
                                return 0.972893f;
                            }
                        } else {
                            if (x[12] <= 793.348267f) {
                                return 0.970399f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[28] <= 0.943291f) {
                            return 0.000000f;
                        } else {
                            if (x[9] <= 2.333650f) {
                                return 0.559957f;
                            } else {
                                return 0.853998f;
                            }
                        }
                    }
                } else {
                    if (x[45] <= 113.971706f) {
                        if (x[47] <= 0.200596f) {
                            if (x[56] <= 138.003517f) {
                                return 0.447199f;
                            } else {
                                return 0.924446f;
                            }
                        } else {
                            if (x[55] <= 1097.032913f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[10] <= 0.524704f) {
                            return 0.000000f;
                        } else {
                            if (x[73] <= 0.074580f) {
                                return 0.936852f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[40] <= 0.013095f) {
                if (x[33] <= 95.308643f) {
                    if (x[80] <= 0.278507f) {
                        if (x[36] <= 0.081747f) {
                            if (x[79] <= 6.237462f) {
                                return 0.255815f;
                            } else {
                                return 0.629519f;
                            }
                        } else {
                            if (x[47] <= 0.282904f) {
                                return 0.095550f;
                            } else {
                                return 0.840855f;
                            }
                        }
                    } else {
                        if (x[86] <= 4.523821f) {
                            if (x[84] <= 0.039984f) {
                                return 0.878410f;
                            } else {
                                return 0.323176f;
                            }
                        } else {
                            if (x[25] <= 0.479517f) {
                                return 0.428082f;
                            } else {
                                return 0.986562f;
                            }
                        }
                    }
                } else {
                    if (x[47] <= 0.174183f) {
                        if (x[35] <= 11.576266f) {
                            if (x[3] <= 0.172809f) {
                                return 0.288518f;
                            } else {
                                return 0.710989f;
                            }
                        } else {
                            if (x[63] <= 0.010146f) {
                                return 0.928137f;
                            } else {
                                return 0.712186f;
                            }
                        }
                    } else {
                        if (x[11] <= 91.980820f) {
                            if (x[49] <= 0.014502f) {
                                return 0.971138f;
                            } else {
                                return 0.520091f;
                            }
                        } else {
                            if (x[47] <= 0.186753f) {
                                return 0.833632f;
                            } else {
                                return 0.976526f;
                            }
                        }
                    }
                }
            } else {
                if (x[44] <= 8.769082f) {
                    if (x[80] <= 0.584320f) {
                        if (x[47] <= 0.316674f) {
                            if (x[25] <= 0.356362f) {
                                return 0.122445f;
                            } else {
                                return 0.686911f;
                            }
                        } else {
                            if (x[45] <= 1.437986f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    } else {
                        if (x[0] <= 2.080728f) {
                            if (x[47] <= 0.798055f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[64] <= 4.882183f) {
                                return 0.992489f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                } else {
                    if (x[2] <= 3.947898f) {
                        if (x[83] <= 0.278791f) {
                            if (x[42] <= 5.769130f) {
                                return 0.414206f;
                            } else {
                                return 0.110813f;
                            }
                        } else {
                            if (x[57] <= 2.536398f) {
                                return 0.913206f;
                            } else {
                                return 0.639223f;
                            }
                        }
                    } else {
                        if (x[18] <= 0.021507f) {
                            if (x[25] <= 0.446256f) {
                                return 0.185390f;
                            } else {
                                return 0.808818f;
                            }
                        } else {
                            if (x[44] <= 51.112440f) {
                                return 0.395656f;
                            } else {
                                return 0.752315f;
                            }
                        }
                    }
                }
            }
        }
    } else {
        if (x[64] <= 3.417512f) {
            if (x[62] <= 0.050391f) {
                if (x[73] <= 0.208331f) {
                    if (x[68] <= 8.359326f) {
                        if (x[3] <= 1.132553f) {
                            if (x[86] <= 5.772371f) {
                                return 0.821742f;
                            } else {
                                return 0.439831f;
                            }
                        } else {
                            if (x[40] <= 0.003601f) {
                                return 0.000000f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[36] <= 0.073717f) {
                            if (x[95] <= 0.012920f) {
                                return 1.000000f;
                            } else {
                                return 0.982543f;
                            }
                        } else {
                            if (x[96] <= -0.503830f) {
                                return 0.000000f;
                            } else {
                                return 0.965685f;
                            }
                        }
                    }
                } else {
                    if (x[14] <= 0.797053f) {
                        if (x[41] <= 0.037385f) {
                            if (x[75] <= 2.956982f) {
                                return 1.000000f;
                            } else {
                                return 0.024484f;
                            }
                        } else {
                            if (x[20] <= 5.041716f) {
                                return 0.628828f;
                            } else {
                                return 0.036282f;
                            }
                        }
                    } else {
                        if (x[64] <= 3.098348f) {
                            return 1.000000f;
                        } else {
                            if (x[27] <= 0.186819f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    }
                }
            } else {
                if (x[35] <= 1.110450f) {
                    if (x[38] <= 0.069146f) {
                        if (x[14] <= 0.762493f) {
                            return 0.000000f;
                        } else {
                            return 0.000000f;
                        }
                    } else {
                        if (x[29] <= 0.015327f) {
                            return 0.000000f;
                        } else {
                            if (x[17] <= 0.793644f) {
                                return 0.962193f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                } else {
                    if (x[75] <= 5.925246f) {
                        if (x[42] <= 6.566094f) {
                            if (x[58] <= 0.599599f) {
                                return 0.935638f;
                            } else {
                                return 0.994593f;
                            }
                        } else {
                            return 0.000000f;
                        }
                    } else {
                        if (x[25] <= 0.619477f) {
                            if (x[18] <= 0.540973f) {
                                return 0.035237f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[61] <= 0.707438f) {
                                return 0.958759f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[75] <= 5.546854f) {
                if (x[14] <= 0.369408f) {
                    if (x[59] <= 0.077091f) {
                        if (x[62] <= 0.073606f) {
                            if (x[69] <= 0.504930f) {
                                return 0.487369f;
                            } else {
                                return 0.989683f;
                            }
                        } else {
                            if (x[20] <= 3.782860f) {
                                return 0.927213f;
                            } else {
                                return 0.795657f;
                            }
                        }
                    } else {
                        if (x[48] <= 0.112476f) {
                            if (x[24] <= 2.210225f) {
                                return 0.736049f;
                            } else {
                                return 0.402257f;
                            }
                        } else {
                            if (x[13] <= 1.836192f) {
                                return 0.371564f;
                            } else {
                                return 0.113892f;
                            }
                        }
                    }
                } else {
                    if (x[58] <= 0.314528f) {
                        if (x[86] <= 5.288558f) {
                            if (x[81] <= 0.116577f) {
                                return 0.575274f;
                            } else {
                                return 0.964181f;
                            }
                        } else {
                            if (x[49] <= 0.052226f) {
                                return 0.494656f;
                            } else {
                                return 0.098885f;
                            }
                        }
                    } else {
                        if (x[42] <= 2.556366f) {
                            if (x[69] <= 0.682459f) {
                                return 0.915425f;
                            } else {
                                return 0.345196f;
                            }
                        } else {
                            if (x[48] <= 0.209514f) {
                                return 0.906890f;
                            } else {
                                return 0.341710f;
                            }
                        }
                    }
                }
            } else {
                if (x[58] <= 0.530104f) {
                    if (x[88] <= -0.543629f) {
                        if (x[6] <= 0.464288f) {
                            if (x[58] <= 0.243306f) {
                                return 0.729132f;
                            } else {
                                return 0.169385f;
                            }
                        } else {
                            if (x[78] <= 0.798075f) {
                                return 0.000000f;
                            } else {
                                return 0.971459f;
                            }
                        }
                    } else {
                        if (x[21] <= 0.419190f) {
                            if (x[58] <= 0.175674f) {
                                return 0.379569f;
                            } else {
                                return 0.026677f;
                            }
                        } else {
                            if (x[65] <= 2.064320f) {
                                return 0.283249f;
                            } else {
                                return 0.150186f;
                            }
                        }
                    }
                } else {
                    if (x[48] <= 0.063590f) {
                        if (x[83] <= 0.193108f) {
                            if (x[92] <= -0.187339f) {
                                return 0.790128f;
                            } else {
                                return 0.278701f;
                            }
                        } else {
                            if (x[48] <= 0.039915f) {
                                return 0.904533f;
                            } else {
                                return 0.764195f;
                            }
                        }
                    } else {
                        if (x[86] <= 6.074097f) {
                            if (x[75] <= 6.049304f) {
                                return 0.702990f;
                            } else {
                                return 0.106642f;
                            }
                        } else {
                            if (x[26] <= 0.047590f) {
                                return 0.830343f;
                            } else {
                                return 0.027206f;
                            }
                        }
                    }
                }
            }
        }
    }
}

static inline float esp32_tree_11(const float* x) {
    if (x[62] <= 0.018470f) {
        if (x[39] <= 0.956674f) {
            if (x[73] <= 0.011068f) {
                if (x[80] <= 0.292239f) {
                    if (x[55] <= 119.413731f) {
                        if (x[64] <= 2.291068f) {
                            if (x[7] <= 0.005555f) {
                                return 0.369712f;
                            } else {
                                return 0.790992f;
                            }
                        } else {
                            if (x[35] <= 9.992176f) {
                                return 0.090998f;
                            } else {
                                return 0.582597f;
                            }
                        }
                    } else {
                        if (x[65] <= 2.454730f) {
                            if (x[64] <= 2.293705f) {
                                return 0.913548f;
                            } else {
                                return 0.638963f;
                            }
                        } else {
                            if (x[87] <= 1.277359f) {
                                return 0.866397f;
                            } else {
                                return 0.395946f;
                            }
                        }
                    }
                } else {
                    if (x[38] <= 0.253683f) {
                        if (x[84] <= 0.037622f) {
                            if (x[97] <= -0.097665f) {
                                return 0.181981f;
                            } else {
                                return 0.919380f;
                            }
                        } else {
                            if (x[66] <= 51.974062f) {
                                return 0.382091f;
                            } else {
                                return 0.857466f;
                            }
                        }
                    } else {
                        if (x[7] <= 0.053190f) {
                            return 0.000000f;
                        } else {
                            return 1.000000f;
                        }
                    }
                }
            } else {
                if (x[47] <= 0.287267f) {
                    if (x[70] <= 0.056788f) {
                        if (x[76] <= 1.498191f) {
                            if (x[13] <= 4.823353f) {
                                return 0.638531f;
                            } else {
                                return 0.219347f;
                            }
                        } else {
                            if (x[93] <= -0.030254f) {
                                return 0.367609f;
                            } else {
                                return 0.131112f;
                            }
                        }
                    } else {
                        if (x[69] <= 0.759242f) {
                            if (x[55] <= 17.315822f) {
                                return 0.249732f;
                            } else {
                                return 0.582622f;
                            }
                        } else {
                            if (x[95] <= -0.433345f) {
                                return 0.944842f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    }
                } else {
                    if (x[41] <= 0.144257f) {
                        if (x[9] <= 1.534741f) {
                            if (x[43] <= 1.939289f) {
                                return 0.043353f;
                            } else {
                                return 0.785899f;
                            }
                        } else {
                            if (x[60] <= 0.259728f) {
                                return 0.934133f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[35] <= 1.877420f) {
                            if (x[5] <= 0.241185f) {
                                return 0.942916f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[33] <= 21.588898f) {
                                return 0.220188f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[74] <= 0.014528f) {
                if (x[22] <= 217.447655f) {
                    if (x[18] <= 0.002781f) {
                        if (x[38] <= 0.004093f) {
                            if (x[18] <= 0.000541f) {
                                return 0.328600f;
                            } else {
                                return 0.899138f;
                            }
                        } else {
                            if (x[73] <= 0.007226f) {
                                return 0.642881f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[95] <= -0.027607f) {
                            if (x[26] <= 0.022905f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[69] <= 0.654174f) {
                                return 0.945382f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                } else {
                    if (x[10] <= 0.609916f) {
                        if (x[83] <= 0.993498f) {
                            return 0.000000f;
                        } else {
                            return 1.000000f;
                        }
                    } else {
                        if (x[41] <= 0.024580f) {
                            if (x[85] <= 0.017085f) {
                                return 0.973643f;
                            } else {
                                return 0.756959f;
                            }
                        } else {
                            return 0.000000f;
                        }
                    }
                }
            } else {
                if (x[3] <= 0.159867f) {
                    if (x[58] <= 0.040306f) {
                        if (x[11] <= 32.501415f) {
                            if (x[58] <= 0.030824f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[61] <= 0.986038f) {
                                return 0.752341f;
                            } else {
                                return 0.950871f;
                            }
                        }
                    } else {
                        if (x[51] <= 0.011583f) {
                            if (x[63] <= 0.048344f) {
                                return 0.319199f;
                            } else {
                                return 0.703591f;
                            }
                        } else {
                            if (x[27] <= 0.009972f) {
                                return 0.954327f;
                            } else {
                                return 0.599273f;
                            }
                        }
                    }
                } else {
                    if (x[73] <= 0.030022f) {
                        if (x[0] <= 48.632959f) {
                            if (x[35] <= 2.143224f) {
                                return 0.000000f;
                            } else {
                                return 0.851260f;
                            }
                        } else {
                            if (x[42] <= 3.683374f) {
                                return 0.974175f;
                            } else {
                                return 0.289699f;
                            }
                        }
                    } else {
                        if (x[75] <= 4.969524f) {
                            if (x[87] <= 0.930368f) {
                                return 0.907309f;
                            } else {
                                return 0.411481f;
                            }
                        } else {
                            if (x[49] <= 0.032256f) {
                                return 0.000000f;
                            } else {
                                return 0.550271f;
                            }
                        }
                    }
                }
            }
        }
    } else {
        if (x[11] <= 2.576789f) {
            if (x[58] <= 0.549608f) {
                if (x[59] <= 0.045171f) {
                    if (x[70] <= 0.120335f) {
                        if (x[1] <= 1.497407f) {
                            if (x[80] <= 0.805689f) {
                                return 0.000000f;
                            } else {
                                return 0.550271f;
                            }
                        } else {
                            if (x[93] <= 0.442855f) {
                                return 0.636092f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[17] <= 0.396599f) {
                            if (x[46] <= 3.787174f) {
                                return 0.907309f;
                            } else {
                                return 0.343998f;
                            }
                        } else {
                            if (x[4] <= 0.125791f) {
                                return 0.709903f;
                            } else {
                                return 0.092529f;
                            }
                        }
                    }
                } else {
                    if (x[48] <= 0.090864f) {
                        if (x[17] <= 0.256942f) {
                            if (x[4] <= 0.121400f) {
                                return 0.010011f;
                            } else {
                                return 0.122069f;
                            }
                        } else {
                            if (x[69] <= 0.407586f) {
                                return 0.575802f;
                            } else {
                                return 0.094514f;
                            }
                        }
                    } else {
                        if (x[68] <= 1.214406f) {
                            if (x[6] <= 0.223990f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[72] <= 0.274985f) {
                                return 0.042064f;
                            } else {
                                return 0.190630f;
                            }
                        }
                    }
                }
            } else {
                if (x[86] <= 6.719820f) {
                    if (x[81] <= 0.503629f) {
                        if (x[66] <= 0.582479f) {
                            if (x[18] <= 0.113188f) {
                                return 0.065349f;
                            } else {
                                return 0.728275f;
                            }
                        } else {
                            if (x[16] <= 0.094283f) {
                                return 0.307926f;
                            } else {
                                return 0.896630f;
                            }
                        }
                    } else {
                        if (x[60] <= 0.283893f) {
                            return 0.000000f;
                        } else {
                            if (x[25] <= 0.396278f) {
                                return 1.000000f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    }
                } else {
                    if (x[68] <= 1.163283f) {
                        if (x[3] <= 0.718761f) {
                            return 1.000000f;
                        } else {
                            return 0.000000f;
                        }
                    } else {
                        if (x[61] <= 0.457023f) {
                            if (x[25] <= 0.795778f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            return 1.000000f;
                        }
                    }
                }
            }
        } else {
            if (x[72] <= 0.235339f) {
                if (x[26] <= 0.087965f) {
                    if (x[33] <= 3.456477f) {
                        if (x[79] <= 1.584681f) {
                            if (x[59] <= 0.021766f) {
                                return 0.830343f;
                            } else {
                                return 0.055057f;
                            }
                        } else {
                            if (x[3] <= 0.473397f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    } else {
                        if (x[20] <= 3.172993f) {
                            if (x[77] <= 9.617434f) {
                                return 0.969524f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[75] <= 6.299264f) {
                                return 0.376786f;
                            } else {
                                return 0.053945f;
                            }
                        }
                    }
                } else {
                    if (x[46] <= 1.657469f) {
                        if (x[18] <= 0.034377f) {
                            return 0.000000f;
                        } else {
                            if (x[20] <= 0.522177f) {
                                return 0.000000f;
                            } else {
                                return 0.965198f;
                            }
                        }
                    } else {
                        if (x[13] <= 1.504496f) {
                            if (x[17] <= 0.273683f) {
                                return 0.140260f;
                            } else {
                                return 0.971639f;
                            }
                        } else {
                            if (x[68] <= 2.038787f) {
                                return 0.259500f;
                            } else {
                                return 0.820805f;
                            }
                        }
                    }
                }
            } else {
                if (x[57] <= 2.384597f) {
                    if (x[57] <= 1.436196f) {
                        if (x[35] <= 1.062755f) {
                            if (x[58] <= 1.083012f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[7] <= 0.003270f) {
                                return 0.136352f;
                            } else {
                                return 0.965824f;
                            }
                        }
                    } else {
                        if (x[72] <= 0.692467f) {
                            if (x[42] <= 5.639647f) {
                                return 0.788999f;
                            } else {
                                return 0.583533f;
                            }
                        } else {
                            if (x[42] <= 1.594019f) {
                                return 0.429537f;
                            } else {
                                return 0.901667f;
                            }
                        }
                    }
                } else {
                    if (x[20] <= 3.318106f) {
                        if (x[80] <= 0.103432f) {
                            if (x[42] <= 3.063293f) {
                                return 0.985986f;
                            } else {
                                return 0.856918f;
                            }
                        } else {
                            if (x[14] <= 0.202828f) {
                                return 0.678934f;
                            } else {
                                return 0.880316f;
                            }
                        }
                    } else {
                        if (x[64] <= 3.592456f) {
                            if (x[71] <= 0.147167f) {
                                return 0.837363f;
                            } else {
                                return 0.456039f;
                            }
                        } else {
                            if (x[86] <= 3.234903f) {
                                return 0.843924f;
                            } else {
                                return 0.458323f;
                            }
                        }
                    }
                }
            }
        }
    }
}

static inline float esp32_tree_12(const float* x) {
    if (x[7] <= 0.010982f) {
        if (x[71] <= 0.007130f) {
            if (x[51] <= 0.003784f) {
                if (x[35] <= 12.635859f) {
                    if (x[38] <= 0.002904f) {
                        if (x[0] <= 168.992065f) {
                            if (x[74] <= 0.064607f) {
                                return 0.316115f;
                            } else {
                                return 0.920785f;
                            }
                        } else {
                            if (x[36] <= 0.054510f) {
                                return 0.352250f;
                            } else {
                                return 0.979854f;
                            }
                        }
                    } else {
                        if (x[69] <= 0.143491f) {
                            if (x[69] <= 0.046488f) {
                                return 0.582479f;
                            } else {
                                return 0.165358f;
                            }
                        } else {
                            if (x[22] <= 68.192463f) {
                                return 0.758822f;
                            } else {
                                return 0.989076f;
                            }
                        }
                    }
                } else {
                    if (x[14] <= 0.027311f) {
                        if (x[61] <= 0.984319f) {
                            return 0.000000f;
                        } else {
                            return 1.000000f;
                        }
                    } else {
                        if (x[88] <= 0.011698f) {
                            if (x[65] <= 2.139717f) {
                                return 0.416483f;
                            } else {
                                return 0.853704f;
                            }
                        } else {
                            if (x[67] <= 61.170408f) {
                                return 0.841323f;
                            } else {
                                return 0.992851f;
                            }
                        }
                    }
                }
            } else {
                if (x[3] <= 0.761772f) {
                    if (x[79] <= 11.472172f) {
                        if (x[47] <= 0.140817f) {
                            if (x[68] <= 11.381825f) {
                                return 0.540470f;
                            } else {
                                return 0.945965f;
                            }
                        } else {
                            if (x[13] <= 1.495351f) {
                                return 0.370004f;
                            } else {
                                return 0.947292f;
                            }
                        }
                    } else {
                        if (x[66] <= 1506.703064f) {
                            if (x[35] <= 9.966982f) {
                                return 0.953842f;
                            } else {
                                return 0.994872f;
                            }
                        } else {
                            if (x[40] <= 0.001670f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                } else {
                    if (x[93] <= -0.008388f) {
                        return 1.000000f;
                    } else {
                        return 0.000000f;
                    }
                }
            }
        } else {
            if (x[25] <= 0.280383f) {
                if (x[59] <= 0.008658f) {
                    if (x[44] <= 221.412369f) {
                        if (x[51] <= 0.012532f) {
                            if (x[71] <= 0.040716f) {
                                return 0.294202f;
                            } else {
                                return 0.734263f;
                            }
                        } else {
                            if (x[54] <= 2.651707f) {
                                return 0.951577f;
                            } else {
                                return 0.773077f;
                            }
                        }
                    } else {
                        if (x[79] <= 10.372483f) {
                            if (x[13] <= 4.712119f) {
                                return 0.925533f;
                            } else {
                                return 0.635885f;
                            }
                        } else {
                            if (x[83] <= 0.993977f) {
                                return 0.988588f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                } else {
                    if (x[87] <= 1.121821f) {
                        if (x[37] <= 0.018055f) {
                            if (x[49] <= 0.015044f) {
                                return 0.532489f;
                            } else {
                                return 0.846850f;
                            }
                        } else {
                            if (x[40] <= 0.008388f) {
                                return 0.146402f;
                            } else {
                                return 0.520018f;
                            }
                        }
                    } else {
                        if (x[14] <= 0.294313f) {
                            if (x[79] <= 10.285606f) {
                                return 0.068975f;
                            } else {
                                return 0.714088f;
                            }
                        } else {
                            if (x[22] <= 24.420172f) {
                                return 0.118713f;
                            } else {
                                return 0.938120f;
                            }
                        }
                    }
                }
            } else {
                if (x[23] <= 13.364635f) {
                    if (x[18] <= 0.009254f) {
                        if (x[58] <= 0.320103f) {
                            if (x[84] <= 0.014321f) {
                                return 0.342538f;
                            } else {
                                return 0.023809f;
                            }
                        } else {
                            if (x[2] <= 1.729221f) {
                                return 0.379569f;
                            } else {
                                return 0.988294f;
                            }
                        }
                    } else {
                        if (x[23] <= 1.171466f) {
                            if (x[21] <= 3.075441f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[84] <= 0.107586f) {
                                return 0.867856f;
                            } else {
                                return 0.171362f;
                            }
                        }
                    }
                } else {
                    if (x[3] <= 0.649538f) {
                        if (x[94] <= -0.034395f) {
                            if (x[82] <= 0.030543f) {
                                return 0.929649f;
                            } else {
                                return 0.379569f;
                            }
                        } else {
                            if (x[31] <= 3.768472f) {
                                return 0.999513f;
                            } else {
                                return 0.976934f;
                            }
                        }
                    } else {
                        if (x[24] <= 1.511726f) {
                            if (x[86] <= 2.153303f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[91] <= 0.162010f) {
                                return 0.089158f;
                            } else {
                                return 0.867122f;
                            }
                        }
                    }
                }
            }
        }
    } else {
        if (x[1] <= 1.937952f) {
            if (x[51] <= 0.218991f) {
                if (x[86] <= 4.890028f) {
                    if (x[24] <= 1.634697f) {
                        if (x[75] <= 6.069170f) {
                            if (x[70] <= 0.435079f) {
                                return 0.975311f;
                            } else {
                                return 0.234239f;
                            }
                        } else {
                            if (x[32] <= 1.524429f) {
                                return 0.776124f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[44] <= 11.936603f) {
                            if (x[7] <= 0.018169f) {
                                return 0.126485f;
                            } else {
                                return 0.393333f;
                            }
                        } else {
                            if (x[77] <= 6.514866f) {
                                return 0.869941f;
                            } else {
                                return 0.628048f;
                            }
                        }
                    }
                } else {
                    if (x[75] <= 3.748518f) {
                        if (x[68] <= 1.789247f) {
                            return 1.000000f;
                        } else {
                            if (x[70] <= 0.035021f) {
                                return 0.899727f;
                            } else {
                                return 0.403010f;
                            }
                        }
                    } else {
                        if (x[25] <= 0.803461f) {
                            if (x[22] <= 1.040596f) {
                                return 0.052686f;
                            } else {
                                return 0.254821f;
                            }
                        } else {
                            if (x[59] <= 0.011347f) {
                                return 0.259034f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    }
                }
            } else {
                if (x[72] <= 0.143126f) {
                    if (x[73] <= 0.120630f) {
                        if (x[1] <= 1.603267f) {
                            return 1.000000f;
                        } else {
                            return 0.000000f;
                        }
                    } else {
                        if (x[75] <= 4.372303f) {
                            return 1.000000f;
                        } else {
                            if (x[74] <= 0.091956f) {
                                return 0.000000f;
                            } else {
                                return 0.379569f;
                            }
                        }
                    }
                } else {
                    if (x[36] <= 0.376364f) {
                        if (x[79] <= 2.051280f) {
                            if (x[82] <= 0.144256f) {
                                return 0.930840f;
                            } else {
                                return 0.094677f;
                            }
                        } else {
                            if (x[59] <= 0.111598f) {
                                return 0.784372f;
                            } else {
                                return 0.125835f;
                            }
                        }
                    } else {
                        if (x[52] <= 0.057511f) {
                            if (x[37] <= 0.034435f) {
                                return 0.743748f;
                            } else {
                                return 0.968161f;
                            }
                        } else {
                            if (x[90] <= 0.285873f) {
                                return 0.696651f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[63] <= 0.157363f) {
                if (x[40] <= 0.018201f) {
                    if (x[75] <= 2.910507f) {
                        if (x[77] <= 107.165340f) {
                            if (x[80] <= 1.032540f) {
                                return 0.860761f;
                            } else {
                                return 0.024242f;
                            }
                        } else {
                            if (x[76] <= 2.034455f) {
                                return 0.993915f;
                            } else {
                                return 0.933195f;
                            }
                        }
                    } else {
                        if (x[3] <= 0.297579f) {
                            if (x[76] <= 1.044246f) {
                                return 0.603494f;
                            } else {
                                return 0.314351f;
                            }
                        } else {
                            if (x[3] <= 1.109230f) {
                                return 0.834640f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                } else {
                    if (x[36] <= 0.419360f) {
                        if (x[82] <= 0.103789f) {
                            if (x[46] <= 3.284518f) {
                                return 0.886888f;
                            } else {
                                return 0.648341f;
                            }
                        } else {
                            if (x[57] <= 2.243840f) {
                                return 0.829979f;
                            } else {
                                return 0.523895f;
                            }
                        }
                    } else {
                        if (x[47] <= 0.125738f) {
                            if (x[86] <= 4.585477f) {
                                return 0.817442f;
                            } else {
                                return 0.195620f;
                            }
                        } else {
                            if (x[80] <= 1.113279f) {
                                return 0.870800f;
                            } else {
                                return 0.579106f;
                            }
                        }
                    }
                }
            } else {
                if (x[68] <= 1.888404f) {
                    if (x[69] <= 0.701285f) {
                        if (x[72] <= 0.468373f) {
                            if (x[75] <= 6.197275f) {
                                return 0.767882f;
                            } else {
                                return 0.188282f;
                            }
                        } else {
                            if (x[10] <= 0.843288f) {
                                return 0.000000f;
                            } else {
                                return 0.920233f;
                            }
                        }
                    } else {
                        if (x[20] <= 1.963764f) {
                            if (x[24] <= 2.425122f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[67] <= 1.141539f) {
                                return 0.000000f;
                            } else {
                                return 0.997909f;
                            }
                        }
                    }
                } else {
                    if (x[57] <= 1.866260f) {
                        if (x[69] <= 0.224556f) {
                            return 0.000000f;
                        } else {
                            if (x[23] <= 1.423525f) {
                                return 0.000000f;
                            } else {
                                return 0.920488f;
                            }
                        }
                    } else {
                        if (x[3] <= 0.543694f) {
                            if (x[81] <= 0.262184f) {
                                return 0.123927f;
                            } else {
                                return 0.639257f;
                            }
                        } else {
                            if (x[94] <= 0.358885f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                }
            }
        }
    }
}

static inline float esp32_tree_13(const float* x) {
    if (x[25] <= 0.257756f) {
        if (x[51] <= 0.021351f) {
            if (x[48] <= 0.009194f) {
                if (x[76] <= 1.829159f) {
                    if (x[60] <= 0.026356f) {
                        if (x[52] <= 0.004017f) {
                            if (x[84] <= 0.037599f) {
                                return 0.959698f;
                            } else {
                                return 0.379569f;
                            }
                        } else {
                            if (x[76] <= 1.330062f) {
                                return 0.736499f;
                            } else {
                                return 0.554741f;
                            }
                        }
                    } else {
                        if (x[67] <= 0.698701f) {
                            return 0.000000f;
                        } else {
                            if (x[49] <= 0.037780f) {
                                return 0.929707f;
                            } else {
                                return 0.352250f;
                            }
                        }
                    }
                } else {
                    if (x[11] <= 183.192902f) {
                        if (x[79] <= 11.461641f) {
                            if (x[60] <= 0.017993f) {
                                return 0.247211f;
                            } else {
                                return 0.598855f;
                            }
                        } else {
                            if (x[69] <= 0.051744f) {
                                return 0.987313f;
                            } else {
                                return 0.756959f;
                            }
                        }
                    } else {
                        if (x[79] <= 11.816124f) {
                            if (x[14] <= 0.132562f) {
                                return 0.495259f;
                            } else {
                                return 0.948975f;
                            }
                        } else {
                            if (x[15] <= 0.004083f) {
                                return 0.968249f;
                            } else {
                                return 0.850968f;
                            }
                        }
                    }
                }
            } else {
                if (x[76] <= 1.171434f) {
                    if (x[35] <= 9.258119f) {
                        if (x[48] <= 0.031243f) {
                            if (x[16] <= 0.029456f) {
                                return 0.244777f;
                            } else {
                                return 0.652122f;
                            }
                        } else {
                            if (x[5] <= 0.043804f) {
                                return 0.067274f;
                            } else {
                                return 0.288128f;
                            }
                        }
                    } else {
                        if (x[36] <= 0.064620f) {
                            if (x[80] <= 0.090398f) {
                                return 0.947097f;
                            } else {
                                return 0.734103f;
                            }
                        } else {
                            if (x[47] <= 0.075986f) {
                                return 0.870627f;
                            } else {
                                return 0.259034f;
                            }
                        }
                    }
                } else {
                    if (x[66] <= 123.386875f) {
                        if (x[14] <= 0.323102f) {
                            if (x[79] <= 10.439024f) {
                                return 0.077670f;
                            } else {
                                return 0.671140f;
                            }
                        } else {
                            if (x[23] <= 14.880600f) {
                                return 0.351290f;
                            } else {
                                return 0.897218f;
                            }
                        }
                    } else {
                        if (x[33] <= 171.236557f) {
                            if (x[60] <= 0.016955f) {
                                return 0.418131f;
                            } else {
                                return 0.849827f;
                            }
                        } else {
                            if (x[50] <= 0.956972f) {
                                return 0.953806f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[20] <= 3.564209f) {
                if (x[67] <= 35.226475f) {
                    if (x[20] <= 2.842306f) {
                        if (x[10] <= 0.405284f) {
                            if (x[81] <= 0.020343f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[84] <= 0.064053f) {
                                return 0.893067f;
                            } else {
                                return 0.608957f;
                            }
                        }
                    } else {
                        if (x[40] <= 0.012132f) {
                            if (x[80] <= 0.116169f) {
                                return 0.914372f;
                            } else {
                                return 0.379569f;
                            }
                        } else {
                            if (x[57] <= 3.345568f) {
                                return 0.898856f;
                            } else {
                                return 0.649947f;
                            }
                        }
                    }
                } else {
                    if (x[27] <= 0.009320f) {
                        if (x[19] <= 0.001201f) {
                            return 0.000000f;
                        } else {
                            if (x[73] <= 0.016235f) {
                                return 0.989214f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[86] <= 2.823235f) {
                            if (x[51] <= 0.026481f) {
                                return 0.880116f;
                            } else {
                                return 0.983050f;
                            }
                        } else {
                            if (x[51] <= 0.028178f) {
                                return 0.509365f;
                            } else {
                                return 0.860767f;
                            }
                        }
                    }
                }
            } else {
                if (x[9] <= 5.092044f) {
                    if (x[1] <= 36.315479f) {
                        if (x[62] <= 0.118208f) {
                            if (x[61] <= 0.827191f) {
                                return 0.454680f;
                            } else {
                                return 0.674433f;
                            }
                        } else {
                            if (x[75] <= 5.384099f) {
                                return 0.879236f;
                            } else {
                                return 0.181981f;
                            }
                        }
                    } else {
                        if (x[85] <= 0.009119f) {
                            if (x[64] <= 4.041447f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[65] <= 4.258111f) {
                                return 0.967929f;
                            } else {
                                return 0.628828f;
                            }
                        }
                    }
                } else {
                    if (x[43] <= 1.263810f) {
                        if (x[26] <= 0.095593f) {
                            if (x[72] <= 0.477987f) {
                                return 0.127289f;
                            } else {
                                return 0.404365f;
                            }
                        } else {
                            if (x[62] <= 0.076916f) {
                                return 0.488535f;
                            } else {
                                return 0.822138f;
                            }
                        }
                    } else {
                        if (x[74] <= 0.033873f) {
                            if (x[69] <= 0.267606f) {
                                return 0.960740f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[61] <= 0.805092f) {
                                return 0.076708f;
                            } else {
                                return 0.301601f;
                            }
                        }
                    }
                }
            }
        }
    } else {
        if (x[75] <= 5.538031f) {
            if (x[62] <= 0.134901f) {
                if (x[56] <= 1.772245f) {
                    if (x[31] <= 4.290793f) {
                        if (x[69] <= 0.476488f) {
                            if (x[46] <= 3.491861f) {
                                return 0.478535f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            return 1.000000f;
                        }
                    } else {
                        if (x[12] <= 3.652631f) {
                            if (x[20] <= 3.758680f) {
                                return 0.661900f;
                            } else {
                                return 0.061174f;
                            }
                        } else {
                            if (x[70] <= 0.092540f) {
                                return 0.000000f;
                            } else {
                                return 0.969524f;
                            }
                        }
                    }
                } else {
                    if (x[14] <= 0.320338f) {
                        if (x[75] <= 3.349741f) {
                            if (x[86] <= 2.581139f) {
                                return 0.989989f;
                            } else {
                                return 0.896733f;
                            }
                        } else {
                            if (x[57] <= 3.733968f) {
                                return 0.764040f;
                            } else {
                                return 0.490069f;
                            }
                        }
                    } else {
                        if (x[31] <= 4.779938f) {
                            if (x[4] <= 0.159360f) {
                                return 0.887732f;
                            } else {
                                return 0.529269f;
                            }
                        } else {
                            if (x[73] <= 0.062928f) {
                                return 0.848042f;
                            } else {
                                return 0.564830f;
                            }
                        }
                    }
                }
            } else {
                if (x[35] <= 1.183756f) {
                    if (x[20] <= 1.860188f) {
                        if (x[49] <= 0.084702f) {
                            if (x[15] <= 0.046256f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[86] <= 0.429237f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    } else {
                        if (x[33] <= 7.783529f) {
                            if (x[45] <= 0.992107f) {
                                return 0.000000f;
                            } else {
                                return 0.954639f;
                            }
                        } else {
                            if (x[70] <= 0.145420f) {
                                return 0.044134f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    }
                } else {
                    if (x[48] <= 0.133435f) {
                        if (x[20] <= 0.262109f) {
                            return 0.000000f;
                        } else {
                            if (x[25] <= 0.490139f) {
                                return 0.919135f;
                            } else {
                                return 0.977321f;
                            }
                        }
                    } else {
                        if (x[79] <= 1.806094f) {
                            return 1.000000f;
                        } else {
                            if (x[85] <= 0.084814f) {
                                return 0.907309f;
                            } else {
                                return 0.077817f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[31] <= 3.411048f) {
                if (x[25] <= 0.385443f) {
                    if (x[41] <= 0.096983f) {
                        if (x[60] <= 0.010550f) {
                            if (x[81] <= 0.037663f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            return 0.000000f;
                        }
                    } else {
                        if (x[75] <= 5.928552f) {
                            return 1.000000f;
                        } else {
                            return 0.000000f;
                        }
                    }
                } else {
                    if (x[73] <= 0.421844f) {
                        return 1.000000f;
                    } else {
                        return 0.000000f;
                    }
                }
            } else {
                if (x[47] <= 0.648970f) {
                    if (x[55] <= 2.747257f) {
                        if (x[48] <= 0.077015f) {
                            if (x[12] <= 2.110499f) {
                                return 0.202012f;
                            } else {
                                return 0.880116f;
                            }
                        } else {
                            if (x[11] <= 1.700954f) {
                                return 0.018617f;
                            } else {
                                return 0.132083f;
                            }
                        }
                    } else {
                        if (x[8] <= 0.062395f) {
                            if (x[25] <= 0.859881f) {
                                return 0.122102f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[9] <= 6.196525f) {
                                return 0.452241f;
                            } else {
                                return 0.164313f;
                            }
                        }
                    }
                } else {
                    if (x[82] <= 0.335246f) {
                        if (x[70] <= 0.070693f) {
                            if (x[25] <= 0.587867f) {
                                return 0.000000f;
                            } else {
                                return 0.830343f;
                            }
                        } else {
                            if (x[22] <= 13.346962f) {
                                return 0.944170f;
                            } else {
                                return 0.562930f;
                            }
                        }
                    } else {
                        if (x[47] <= 0.753572f) {
                            return 0.000000f;
                        } else {
                            if (x[76] <= 1.345755f) {
                                return 0.971639f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                }
            }
        }
    }
}

static inline float esp32_tree_14(const float* x) {
    if (x[14] <= 0.286265f) {
        if (x[58] <= 0.289200f) {
            if (x[72] <= 0.962786f) {
                if (x[75] <= 2.452184f) {
                    if (x[27] <= 0.015988f) {
                        if (x[7] <= 0.003645f) {
                            if (x[69] <= 0.074765f) {
                                return 0.648609f;
                            } else {
                                return 0.161344f;
                            }
                        } else {
                            if (x[79] <= 7.579851f) {
                                return 0.622577f;
                            } else {
                                return 0.903414f;
                            }
                        }
                    } else {
                        if (x[18] <= 0.007257f) {
                            if (x[38] <= 0.017036f) {
                                return 0.812862f;
                            } else {
                                return 0.441876f;
                            }
                        } else {
                            if (x[24] <= 4.986994f) {
                                return 0.964830f;
                            } else {
                                return 0.857446f;
                            }
                        }
                    }
                } else {
                    if (x[63] <= 0.021083f) {
                        if (x[33] <= 139.144814f) {
                            if (x[35] <= 11.125918f) {
                                return 0.512148f;
                            } else {
                                return 0.885514f;
                            }
                        } else {
                            if (x[43] <= 5.922660f) {
                                return 0.673083f;
                            } else {
                                return 0.978945f;
                            }
                        }
                    } else {
                        if (x[47] <= 0.283949f) {
                            if (x[84] <= 0.017049f) {
                                return 0.118538f;
                            } else {
                                return 0.385260f;
                            }
                        } else {
                            if (x[86] <= 4.184850f) {
                                return 0.867000f;
                            } else {
                                return 0.549669f;
                            }
                        }
                    }
                }
            } else {
                if (x[35] <= 9.944810f) {
                    if (x[85] <= 0.012961f) {
                        if (x[14] <= 0.055810f) {
                            if (x[25] <= 0.069380f) {
                                return 0.067142f;
                            } else {
                                return 0.907309f;
                            }
                        } else {
                            if (x[72] <= 0.966669f) {
                                return 0.735776f;
                            } else {
                                return 0.944106f;
                            }
                        }
                    } else {
                        if (x[23] <= 38.605808f) {
                            if (x[62] <= 0.001782f) {
                                return 0.296725f;
                            } else {
                                return 0.880116f;
                            }
                        } else {
                            if (x[49] <= 0.014623f) {
                                return 0.277198f;
                            } else {
                                return 0.742200f;
                            }
                        }
                    }
                } else {
                    if (x[61] <= 0.953227f) {
                        if (x[57] <= 8.591709f) {
                            if (x[39] <= 0.996135f) {
                                return 0.995735f;
                            } else {
                                return 0.830343f;
                            }
                        } else {
                            if (x[59] <= 0.019079f) {
                                return 0.962540f;
                            } else {
                                return 0.594859f;
                            }
                        }
                    } else {
                        if (x[0] <= 258.595764f) {
                            if (x[2] <= 8.812053f) {
                                return 0.942694f;
                            } else {
                                return 0.693315f;
                            }
                        } else {
                            if (x[62] <= 0.001213f) {
                                return 0.951402f;
                            } else {
                                return 0.994408f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[15] <= 0.137549f) {
                if (x[42] <= 3.277376f) {
                    if (x[71] <= 0.375311f) {
                        if (x[70] <= 0.018982f) {
                            if (x[75] <= 4.014102f) {
                                return 0.980088f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[87] <= 1.749207f) {
                                return 0.946238f;
                            } else {
                                return 0.695492f;
                            }
                        }
                    } else {
                        return 0.000000f;
                    }
                } else {
                    if (x[75] <= 5.598759f) {
                        if (x[58] <= 0.348893f) {
                            if (x[27] <= 0.009665f) {
                                return 0.980456f;
                            } else {
                                return 0.667694f;
                            }
                        } else {
                            if (x[61] <= 0.145599f) {
                                return 0.000000f;
                            } else {
                                return 0.889940f;
                            }
                        }
                    } else {
                        if (x[55] <= 3.750214f) {
                            if (x[58] <= 0.504258f) {
                                return 0.044134f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[53] <= 4.539348f) {
                                return 0.883900f;
                            } else {
                                return 0.298000f;
                            }
                        }
                    }
                }
            } else {
                if (x[65] <= 0.731908f) {
                    if (x[57] <= 3.262181f) {
                        if (x[48] <= 0.055146f) {
                            return 1.000000f;
                        } else {
                            return 0.000000f;
                        }
                    } else {
                        return 1.000000f;
                    }
                } else {
                    if (x[55] <= 3.811122f) {
                        if (x[13] <= 2.972845f) {
                            if (x[40] <= 0.063737f) {
                                return 0.000000f;
                            } else {
                                return 0.550271f;
                            }
                        } else {
                            return 1.000000f;
                        }
                    } else {
                        if (x[43] <= 1.347905f) {
                            if (x[58] <= 0.290844f) {
                                return 0.000000f;
                            } else {
                                return 0.950218f;
                            }
                        } else {
                            return 0.000000f;
                        }
                    }
                }
            }
        }
    } else {
        if (x[75] <= 5.364775f) {
            if (x[20] <= 5.192665f) {
                if (x[79] <= 1.227657f) {
                    if (x[69] <= 0.664220f) {
                        if (x[4] <= 0.258745f) {
                            if (x[11] <= 82.526180f) {
                                return 0.986144f;
                            } else {
                                return 0.234239f;
                            }
                        } else {
                            return 0.000000f;
                        }
                    } else {
                        if (x[46] <= 1.233745f) {
                            if (x[67] <= 1.305786f) {
                                return 0.000000f;
                            } else {
                                return 0.969429f;
                            }
                        } else {
                            if (x[53] <= 4.991707f) {
                                return 0.290065f;
                            } else {
                                return 0.988124f;
                            }
                        }
                    }
                } else {
                    if (x[3] <= 1.101347f) {
                        if (x[3] <= 0.330989f) {
                            if (x[31] <= 4.193097f) {
                                return 0.915098f;
                            } else {
                                return 0.671255f;
                            }
                        } else {
                            if (x[31] <= 4.700930f) {
                                return 0.951284f;
                            } else {
                                return 0.896047f;
                            }
                        }
                    } else {
                        if (x[68] <= 1.389239f) {
                            if (x[31] <= 3.600618f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[47] <= 0.430857f) {
                                return 0.000000f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                }
            } else {
                if (x[29] <= 0.043024f) {
                    if (x[62] <= 0.130025f) {
                        if (x[55] <= 9.978839f) {
                            if (x[3] <= 0.453664f) {
                                return 0.168607f;
                            } else {
                                return 0.709903f;
                            }
                        } else {
                            if (x[41] <= 0.155417f) {
                                return 0.727341f;
                            } else {
                                return 0.282157f;
                            }
                        }
                    } else {
                        if (x[20] <= 6.448549f) {
                            if (x[84] <= 0.022411f) {
                                return 0.692436f;
                            } else {
                                return 0.944215f;
                            }
                        } else {
                            if (x[36] <= 0.596932f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    }
                } else {
                    if (x[18] <= 0.083278f) {
                        if (x[69] <= 0.415220f) {
                            if (x[47] <= 0.212043f) {
                                return 0.792424f;
                            } else {
                                return 0.339502f;
                            }
                        } else {
                            if (x[84] <= 0.194873f) {
                                return 0.950751f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[24] <= 1.850870f) {
                            if (x[49] <= 0.056599f) {
                                return 0.787585f;
                            } else {
                                return 0.967525f;
                            }
                        } else {
                            if (x[42] <= 5.825577f) {
                                return 0.833932f;
                            } else {
                                return 0.524975f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[82] <= 0.290193f) {
                if (x[47] <= 0.527403f) {
                    if (x[24] <= 1.564839f) {
                        if (x[25] <= 0.697777f) {
                            if (x[77] <= 6.212315f) {
                                return 0.633502f;
                            } else {
                                return 0.148788f;
                            }
                        } else {
                            if (x[70] <= 0.021951f) {
                                return 0.000000f;
                            } else {
                                return 0.946540f;
                            }
                        }
                    } else {
                        if (x[5] <= 0.074661f) {
                            if (x[82] <= 0.171056f) {
                                return 0.755691f;
                            } else {
                                return 0.381847f;
                            }
                        } else {
                            if (x[11] <= 1.617026f) {
                                return 0.109596f;
                            } else {
                                return 0.317078f;
                            }
                        }
                    }
                } else {
                    if (x[46] <= 1.330273f) {
                        if (x[41] <= 0.271417f) {
                            if (x[33] <= 3.650141f) {
                                return 0.995672f;
                            } else {
                                return 0.922492f;
                            }
                        } else {
                            if (x[25] <= 0.273946f) {
                                return 0.000000f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[72] <= 0.185086f) {
                            if (x[12] <= 2.092769f) {
                                return 0.032435f;
                            } else {
                                return 0.785899f;
                            }
                        } else {
                            if (x[36] <= 0.383708f) {
                                return 0.529029f;
                            } else {
                                return 0.843412f;
                            }
                        }
                    }
                }
            } else {
                if (x[6] <= 0.310667f) {
                    if (x[47] <= 0.782130f) {
                        if (x[7] <= 0.069404f) {
                            if (x[61] <= 0.558233f) {
                                return 0.070275f;
                            } else {
                                return 0.625257f;
                            }
                        } else {
                            if (x[63] <= 0.007736f) {
                                return 0.550271f;
                            } else {
                                return 0.011595f;
                            }
                        }
                    } else {
                        if (x[52] <= 0.014848f) {
                            return 1.000000f;
                        } else {
                            return 1.000000f;
                        }
                    }
                } else {
                    if (x[80] <= 0.792415f) {
                        if (x[86] <= 6.448509f) {
                            if (x[16] <= 0.334629f) {
                                return 0.513831f;
                            } else {
                                return 0.114100f;
                            }
                        } else {
                            if (x[24] <= 1.216275f) {
                                return 1.000000f;
                            } else {
                                return 0.012634f;
                            }
                        }
                    } else {
                        if (x[24] <= 1.684737f) {
                            return 1.000000f;
                        } else {
                            if (x[55] <= 33.537745f) {
                                return 0.000000f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    }
                }
            }
        }
    }
}

static inline float esp32_tree_15(const float* x) {
    if (x[58] <= 0.292903f) {
        if (x[51] <= 0.021095f) {
            if (x[63] <= 0.021158f) {
                if (x[22] <= 155.785736f) {
                    if (x[73] <= 0.149991f) {
                        if (x[24] <= 3.341364f) {
                            if (x[79] <= 4.278880f) {
                                return 0.663316f;
                            } else {
                                return 0.935132f;
                            }
                        } else {
                            if (x[80] <= 0.081700f) {
                                return 0.751167f;
                            } else {
                                return 0.486110f;
                            }
                        }
                    } else {
                        if (x[69] <= 0.808335f) {
                            if (x[86] <= 2.966277f) {
                                return 0.463431f;
                            } else {
                                return 0.067713f;
                            }
                        } else {
                            return 1.000000f;
                        }
                    }
                } else {
                    if (x[79] <= 13.034556f) {
                        if (x[51] <= 0.002894f) {
                            if (x[44] <= 349.994370f) {
                                return 0.520984f;
                            } else {
                                return 0.882467f;
                            }
                        } else {
                            if (x[27] <= 0.023162f) {
                                return 0.871325f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[96] <= -0.551761f) {
                            return 0.000000f;
                        } else {
                            if (x[3] <= 0.017547f) {
                                return 0.000000f;
                            } else {
                                return 0.992389f;
                            }
                        }
                    }
                }
            } else {
                if (x[84] <= 0.014892f) {
                    if (x[36] <= 0.078802f) {
                        if (x[87] <= 2.540890f) {
                            if (x[85] <= 0.022658f) {
                                return 0.868435f;
                            } else {
                                return 0.510621f;
                            }
                        } else {
                            if (x[1] <= 229.461578f) {
                                return 0.302732f;
                            } else {
                                return 0.884938f;
                            }
                        }
                    } else {
                        if (x[38] <= 0.005519f) {
                            if (x[25] <= 0.173300f) {
                                return 0.646941f;
                            } else {
                                return 0.964595f;
                            }
                        } else {
                            if (x[69] <= 0.507156f) {
                                return 0.087996f;
                            } else {
                                return 0.899727f;
                            }
                        }
                    }
                } else {
                    if (x[71] <= 0.052412f) {
                        if (x[3] <= 0.310478f) {
                            if (x[86] <= 2.694874f) {
                                return 0.673785f;
                            } else {
                                return 0.160089f;
                            }
                        } else {
                            if (x[17] <= 0.654063f) {
                                return 0.360909f;
                            } else {
                                return 0.898214f;
                            }
                        }
                    } else {
                        if (x[55] <= 13.611808f) {
                            if (x[40] <= 0.031624f) {
                                return 0.204830f;
                            } else {
                                return 0.431442f;
                            }
                        } else {
                            if (x[57] <= 5.042224f) {
                                return 0.679273f;
                            } else {
                                return 0.461677f;
                            }
                        }
                    }
                }
            }
        } else {
            if (x[88] <= -0.238474f) {
                if (x[73] <= 0.093742f) {
                    if (x[20] <= 4.426788f) {
                        if (x[13] <= 1.150736f) {
                            if (x[7] <= 0.064071f) {
                                return 0.100099f;
                            } else {
                                return 0.880116f;
                            }
                        } else {
                            if (x[51] <= 0.049363f) {
                                return 0.828894f;
                            } else {
                                return 0.933477f;
                            }
                        }
                    } else {
                        if (x[59] <= 0.035586f) {
                            if (x[77] <= 6.246751f) {
                                return 0.909141f;
                            } else {
                                return 0.554836f;
                            }
                        } else {
                            if (x[32] <= 1.662175f) {
                                return 0.589452f;
                            } else {
                                return 0.070528f;
                            }
                        }
                    }
                } else {
                    if (x[3] <= 0.718049f) {
                        if (x[69] <= 0.846901f) {
                            if (x[77] <= 5.397613f) {
                                return 0.511298f;
                            } else {
                                return 0.134405f;
                            }
                        } else {
                            if (x[66] <= 0.892843f) {
                                return 1.000000f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    } else {
                        if (x[34] <= 2.167756f) {
                            if (x[39] <= 0.493594f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            return 1.000000f;
                        }
                    }
                }
            } else {
                if (x[42] <= 3.224892f) {
                    if (x[1] <= 62.038883f) {
                        if (x[80] <= 0.108894f) {
                            if (x[66] <= 4.227621f) {
                                return 0.000000f;
                            } else {
                                return 0.968973f;
                            }
                        } else {
                            if (x[82] <= 0.189747f) {
                                return 0.715679f;
                            } else {
                                return 0.169385f;
                            }
                        }
                    } else {
                        if (x[27] <= 0.006997f) {
                            return 1.000000f;
                        } else {
                            if (x[18] <= 0.002482f) {
                                return 0.411481f;
                            } else {
                                return 0.983258f;
                            }
                        }
                    }
                } else {
                    if (x[62] <= 0.067125f) {
                        if (x[69] <= 0.780136f) {
                            if (x[65] <= 0.597943f) {
                                return 0.072974f;
                            } else {
                                return 0.396146f;
                            }
                        } else {
                            if (x[86] <= 2.846525f) {
                                return 0.000000f;
                            } else {
                                return 0.961080f;
                            }
                        }
                    } else {
                        if (x[9] <= 5.681166f) {
                            if (x[31] <= 5.853704f) {
                                return 0.857828f;
                            } else {
                                return 0.140260f;
                            }
                        } else {
                            if (x[11] <= 14.752998f) {
                                return 0.000000f;
                            } else {
                                return 0.379569f;
                            }
                        }
                    }
                }
            }
        }
    } else {
        if (x[0] <= 2.762792f) {
            if (x[58] <= 0.541640f) {
                if (x[11] <= 2.746200f) {
                    if (x[9] <= 5.134312f) {
                        if (x[36] <= 0.426657f) {
                            if (x[48] <= 0.064280f) {
                                return 0.924446f;
                            } else {
                                return 0.076005f;
                            }
                        } else {
                            if (x[28] <= 0.415418f) {
                                return 0.975096f;
                            } else {
                                return 0.379569f;
                            }
                        }
                    } else {
                        if (x[54] <= 0.670314f) {
                            if (x[88] <= -0.535413f) {
                                return 0.604658f;
                            } else {
                                return 0.033183f;
                            }
                        } else {
                            if (x[80] <= 0.377479f) {
                                return 0.265114f;
                            } else {
                                return 0.039583f;
                            }
                        }
                    }
                } else {
                    if (x[71] <= 0.141087f) {
                        if (x[34] <= 6.929716f) {
                            if (x[80] <= 0.887348f) {
                                return 0.840832f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[20] <= 4.228904f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        }
                    } else {
                        if (x[68] <= 1.194372f) {
                            if (x[17] <= 0.734112f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[20] <= 4.406647f) {
                                return 0.504861f;
                            } else {
                                return 0.124595f;
                            }
                        }
                    }
                }
            } else {
                if (x[75] <= 6.669291f) {
                    if (x[42] <= 2.671685f) {
                        if (x[14] <= 1.029306f) {
                            if (x[32] <= 0.826710f) {
                                return 0.000000f;
                            } else {
                                return 0.867122f;
                            }
                        } else {
                            return 1.000000f;
                        }
                    } else {
                        if (x[20] <= 6.514464f) {
                            if (x[15] <= 0.178874f) {
                                return 0.915720f;
                            } else {
                                return 0.603873f;
                            }
                        } else {
                            if (x[56] <= 0.271102f) {
                                return 0.913824f;
                            } else {
                                return 0.328600f;
                            }
                        }
                    }
                } else {
                    if (x[44] <= 10.248065f) {
                        if (x[59] <= 0.017140f) {
                            return 1.000000f;
                        } else {
                            return 0.000000f;
                        }
                    } else {
                        return 1.000000f;
                    }
                }
            }
        } else {
            if (x[53] <= 3.520899f) {
                if (x[80] <= 1.051176f) {
                    if (x[83] <= 0.539006f) {
                        if (x[77] <= 0.577802f) {
                            if (x[13] <= 2.104563f) {
                                return 0.086024f;
                            } else {
                                return 0.859508f;
                            }
                        } else {
                            if (x[95] <= 0.121227f) {
                                return 0.831344f;
                            } else {
                                return 0.965280f;
                            }
                        }
                    } else {
                        if (x[9] <= 0.887722f) {
                            if (x[3] <= 0.657824f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[24] <= 3.409695f) {
                                return 0.978399f;
                            } else {
                                return 0.949773f;
                            }
                        }
                    }
                } else {
                    if (x[33] <= 28.836843f) {
                        if (x[42] <= 1.367279f) {
                            if (x[83] <= 0.464874f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[8] <= 0.169743f) {
                                return 0.926471f;
                            } else {
                                return 0.284881f;
                            }
                        }
                    } else {
                        if (x[75] <= 3.712848f) {
                            if (x[35] <= 1.317485f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[93] <= -0.021245f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        }
                    }
                }
            } else {
                if (x[67] <= 0.757395f) {
                    if (x[76] <= 0.325802f) {
                        if (x[70] <= 0.145096f) {
                            if (x[75] <= 4.678582f) {
                                return 1.000000f;
                            } else {
                                return 0.000000f;
                            }
                        } else {
                            if (x[4] <= 0.130433f) {
                                return 0.923925f;
                            } else {
                                return 0.590078f;
                            }
                        }
                    } else {
                        if (x[61] <= 0.131215f) {
                            if (x[47] <= 0.702199f) {
                                return 0.000000f;
                            } else {
                                return 0.977802f;
                            }
                        } else {
                            if (x[87] <= 0.547838f) {
                                return 0.411481f;
                            } else {
                                return 0.136152f;
                            }
                        }
                    }
                } else {
                    if (x[59] <= 0.053772f) {
                        if (x[9] <= 1.066765f) {
                            if (x[29] <= 0.182241f) {
                                return 0.000000f;
                            } else {
                                return 1.000000f;
                            }
                        } else {
                            if (x[57] <= 2.068869f) {
                                return 0.894620f;
                            } else {
                                return 0.808876f;
                            }
                        }
                    } else {
                        if (x[71] <= 0.166734f) {
                            if (x[51] <= 0.218834f) {
                                return 0.707976f;
                            } else {
                                return 0.961721f;
                            }
                        } else {
                            if (x[73] <= 0.078437f) {
                                return 0.561086f;
                            } else {
                                return 0.211829f;
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Predict stroke probability using 16-Tree Tiny Random Forest.
 * @param features: Pointer to array of 98 float features (QEEG bandpowers & BSI).
 * @return Probability of acute stroke between 0.0f (Normal/Mimic) and 1.0f (Stroke).
 */
static inline float esp32_stroke_predict_rf(const float* features) {
    float sum = 0.0f;
    sum += esp32_tree_0(features);
    sum += esp32_tree_1(features);
    sum += esp32_tree_2(features);
    sum += esp32_tree_3(features);
    sum += esp32_tree_4(features);
    sum += esp32_tree_5(features);
    sum += esp32_tree_6(features);
    sum += esp32_tree_7(features);
    sum += esp32_tree_8(features);
    sum += esp32_tree_9(features);
    sum += esp32_tree_10(features);
    sum += esp32_tree_11(features);
    sum += esp32_tree_12(features);
    sum += esp32_tree_13(features);
    sum += esp32_tree_14(features);
    sum += esp32_tree_15(features);
    return sum * (1.0f / 16.0f);
}

/**
 * Ultra-light Linear Logistic Model (Executes in < 1 microsecond).
 * @param features: Pointer to array of 98 raw float features.
 * @return Probability of acute stroke.
 */
static inline float esp32_stroke_predict_linear(const float* features) {
    float z = STROKE_LINEAR_INTERCEPT;
    for (int i = 0; i < STROKE_GLASSES_NUM_FEATURES; ++i) {
        float scaled = (features[i] - STROKE_FEATURE_MEANS[i]) / (STROKE_FEATURE_SCALES[i] + 1e-7f);
        z += STROKE_LINEAR_WEIGHTS[i] * scaled;
    }
    // Fast Numerically Stable Sigmoid
    if (z >= 16.0f) return 1.0f;
    if (z <= -16.0f) return 0.0f;
    return 1.0f / (1.0f + expf(-z));
}

/**
 * Classify acute stroke status with configurable decision threshold.
 * @param features: Input feature array.
 * @param threshold: Decision boundary (default 0.50f, use 0.40f for higher sensitivity).
 * @return 1 if Stroke Detected (Alert), 0 if Normal / Mimic.
 */
static inline int esp32_stroke_classify(const float* features, float threshold) {
    float prob = esp32_stroke_predict_rf(features);
    return (prob >= threshold) ? 1 : 0;
}

#ifdef __cplusplus
}
#endif
#endif /* STROKE_GLASSES_ESP32_H */
