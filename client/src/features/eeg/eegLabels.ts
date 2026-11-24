import type {
  ClinicalCategory,
  DatasetSplit,
  NeuralLabel,
  WorkBlockType,
} from '../../api/types';

export const CLINICAL_CATEGORY_ORDER: ClinicalCategory[] = [
  'VASCULAR_STROKE',
  'EPILEPSY_ICU',
  'SLEEP_COGNITIVE',
  'HARDWARE_BCI',
];

export const CLINICAL_CATEGORY_META: Record<
  ClinicalCategory,
  {
    label: string;
    shortLabel: string;
    description: string;
    badgeCls: string;
  }
> = {
  VASCULAR_STROKE: {
    label: 'Đột quỵ & Mạch máu não',
    shortLabel: 'Mạch máu não',
    description: 'Thiếu máu não cục bộ, xuất huyết não và sàng lọc khóa an toàn tPA.',
    badgeCls: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  EPILEPSY_ICU: {
    label: 'Động kinh & Hồi sức (ICU)',
    shortLabel: 'Động kinh & ICU',
    description: 'Phức hợp nhọn - sóng chậm kịch phát, theo dõi động kinh thùy thái dương.',
    badgeCls: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  SLEEP_COGNITIVE: {
    label: 'Giấc ngủ & Nhận thức',
    shortLabel: 'Giấc ngủ & Nhận thức',
    description: 'Pha ngủ sâu N3, mệt mỏi nhận thức (TAR) và nhịp Alpha thư giãn.',
    badgeCls: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  HARDWARE_BCI: {
    label: 'Phần cứng ADS1299 & BCI',
    shortLabel: 'Phần cứng & BCI',
    description: 'Bản ghi chuẩn 24-bit TI ADS1299 500 Hz và tín hiệu vận động Motor Imagery.',
    badgeCls: 'bg-teal-50 text-teal-800 border-teal-200',
  },
};

export const NEURAL_LABEL_ORDER: NeuralLabel[] = [
  'CONTROL',
  'ISCHEMIC_STROKE',
  'HEMORRHAGIC_STROKE',
  'EPILEPTIFORM_SLOWING',
  'COGNITIVE_FATIGUE',
];

export const NEURAL_LABEL_META: Record<
  NeuralLabel,
  {
    numericId: number;
    label: string;
    shortLabel: string;
    badgeCls: string;
    barCls: string;
  }
> = {
  CONTROL: {
    numericId: 0,
    label: 'Sinh lý bình thường (Control)',
    shortLabel: 'Bình thường',
    badgeCls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    barCls: 'bg-emerald-600',
  },
  ISCHEMIC_STROKE: {
    numericId: 1,
    label: 'Thiếu máu não cục bộ (Ischemic)',
    shortLabel: 'Thiếu máu não',
    badgeCls: 'bg-rose-50 text-rose-800 border-rose-200',
    barCls: 'bg-rose-600',
  },
  HEMORRHAGIC_STROKE: {
    numericId: 2,
    label: 'Xuất huyết não (ICH)',
    shortLabel: 'Xuất huyết não',
    badgeCls: 'bg-red-900 text-white border-red-950',
    barCls: 'bg-red-800',
  },
  EPILEPTIFORM_SLOWING: {
    numericId: 3,
    label: 'Sóng động kinh / Chậm cục bộ',
    shortLabel: 'Động kinh / Chậm',
    badgeCls: 'bg-amber-50 text-amber-800 border-amber-200',
    barCls: 'bg-amber-600',
  },
  COGNITIVE_FATIGUE: {
    numericId: 4,
    label: 'Mệt mỏi nhận thức / Giấc ngủ N3',
    shortLabel: 'Mệt mỏi / N3',
    badgeCls: 'bg-sky-50 text-sky-800 border-sky-200',
    barCls: 'bg-sky-600',
  },
};

export const DATASET_SPLIT_ORDER: DatasetSplit[] = [
  'TRAIN',
  'VALIDATION',
  'TEST',
  'EXTERNAL_HOLDOUT',
];

export const DATASET_SPLIT_META: Record<
  DatasetSplit,
  {
    label: string;
    shortLabel: string;
    badgeCls: string;
  }
> = {
  TRAIN: {
    label: 'Huấn luyện (TRAIN)',
    shortLabel: 'TRAIN',
    badgeCls: 'bg-slate-100 text-slate-800 border-slate-300',
  },
  VALIDATION: {
    label: 'Kiểm định (VALIDATION)',
    shortLabel: 'VAL',
    badgeCls: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  TEST: {
    label: 'Kiểm thử (TEST)',
    shortLabel: 'TEST',
    badgeCls: 'bg-teal-50 text-teal-800 border-teal-200',
  },
  EXTERNAL_HOLDOUT: {
    label: 'Ngoại kiểm độc lập (HOLDOUT)',
    shortLabel: 'HOLDOUT',
    badgeCls: 'bg-amber-50 text-amber-800 border-amber-200',
  },
};

export const WORK_BLOCK_ORDER: WorkBlockType[] = [
  'DEEP_WORK',
  'LIGHT_ADMIN',
  'NEURO_RECOVERY',
  'SLEEP_TARGET',
  'CLINICAL_CHECK',
];

export const WORK_BLOCK_META: Record<
  WorkBlockType,
  {
    label: string;
    badgeCls: string;
    defaultRationale: string;
  }
> = {
  DEEP_WORK: {
    label: 'Làm việc Chuyên sâu',
    badgeCls: 'bg-[#1E3A5F]/10 text-[#1E3A5F] border-[#1E3A5F]/25',
    defaultRationale:
      'Tận dụng cửa sổ sóng Beta thấp (13–18 Hz) ổn định, chỉ số TAR thấp sau giấc ngủ hồi phục.',
  },
  LIGHT_ADMIN: {
    label: 'Tác vụ Nhẹ & Hành chính',
    badgeCls: 'bg-slate-100 text-slate-700 border-slate-300',
    defaultRationale:
      'Phù hợp khung giờ chuyển tiếp khi TAR tăng nhẹ, tránh quá tải thùy trán (F3/F4).',
  },
  NEURO_RECOVERY: {
    label: 'Thư giãn & Điều hòa Sóng não',
    badgeCls: 'bg-teal-50 text-teal-800 border-teal-200',
    defaultRationale:
      'Nghỉ ngơi nhắm mắt và thở chậm 15 phút để phục hồi nhịp Alpha chẩm (8–12 Hz) ở O1/O2.',
  },
  SLEEP_TARGET: {
    label: 'Mục tiêu Giấc ngủ Sâu',
    badgeCls: 'bg-sky-50 text-sky-800 border-sky-200',
    defaultRationale:
      'Ngắt ánh sáng xanh 45 phút trước khi ngủ để củng cố pha Delta N3 đồng bộ hai bán cầu.',
  },
  CLINICAL_CHECK: {
    label: 'Kiểm tra Điện não & Y tế',
    badgeCls: 'bg-amber-50 text-amber-800 border-amber-200',
    defaultRationale:
      'Ghi mẫu EEG chuẩn 10-20 định kỳ để theo dõi DAR, BSI và cập nhật hồ sơ tham vấn bác sĩ.',
  },
};

export const CHANNEL_ANATOMY_MAP: Record<string, string> = {
  FP1: 'Cực trán trái',
  FP2: 'Cực trán phải',
  F7: 'Trán dưới trái',
  F3: 'Trán trái',
  FZ: 'Trán giữa',
  F4: 'Trán phải',
  F8: 'Trán dưới phải',
  T3: 'Thái dương giữa trái',
  C3: 'Vận động trái',
  CZ: 'Đỉnh trung tâm',
  C4: 'Vận động phải',
  T4: 'Thái dương giữa phải',
  T5: 'Thái dương sau trái',
  P3: 'Đỉnh trái',
  PZ: 'Đỉnh giữa',
  P4: 'Đỉnh phải',
  T6: 'Thái dương sau phải',
  O1: 'Chẩm trái',
  O2: 'Chẩm phải',
};

export const EEG_ACCESS_ACTION_LABELS: Record<string, string> = {
  DATASET_REGISTERED: 'Đã tạo bản ghi',
  CONSENT_GRANTED: 'Đã cấp quyền xem',
  CONSENT_REVOKED: 'Đã thu hồi quyền',
  DATASET_ACCESSED: 'Đã xem',
  DATASET_VIEWED: 'Đã xem',
};

export function formatEegAccessAction(action: string): string {
  return EEG_ACCESS_ACTION_LABELS[action] ?? action;
}

export function triggerCsvDownload(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
