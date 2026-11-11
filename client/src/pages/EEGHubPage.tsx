import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  Activity,
  Brain,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  History,
  Lock,
  Plus,
  ShieldCheck,
  Sliders,
  Sparkles,
  UserCheck,
  UserPlus,
  UserX,
} from 'lucide-react';
import { eegDatasetsApi } from '../api/endpoints';
import type { EegDatasetRecord } from '../api/types';
import { Alert, Button, Card, Input } from '../components/ui';
import { useMode } from '../context/ModeContext';
import { useAuth } from '../features/auth/AuthContext';
import { ApiError } from '../api/client';

const FALLBACK_RECORDINGS: EegDatasetRecord[] = [
  {
    id: 'rec-01',
    ownerId: 'seed-owner-hoa',
    ownerUsername: 'hoa_health',
    patientCode: 'BN-****84 (Ẩn danh)',
    title: 'Ghi điện não đồ bề mặt: Thử nghiệm kích thích vận động tinh tay phải (Motor Imagery)',
    date: '04/11/2026 09:15',
    duration: '18 phút 42 giây',
    samplingRate: '250 Hz',
    channelsCount: 8,
    montage: 'Hệ thống quốc tế 10-20 (C3, C4, Cz, Fz, Pz, F3, F4, Oz)',
    filter: 'Dải thông 0.5 - 70 Hz · Bộ lọc khuyết 50 Hz Notch',
    status: 'ANALYZED',
    clinicalNote:
      'Phát hiện sự giảm đồng bộ liên quan đến sự kiện (ERD) rõ rệt tại đạo trình C3 trong dải sóng Mu (8-12 Hz) và Beta (18-24 Hz) khi bệnh nhân tưởng tượng nắm bàn tay phải.',
    consentedProfessionals: [
      {
        userId: 'seed-dr-minh',
        username: 'dr_minh',
        displayName: 'BS. CKII Nguyễn Văn Minh',
        title: 'Bác sĩ Chuyên khoa II Thần kinh',
        specialty: 'Thần kinh học lâm sàng',
        grantedAt: '2026-11-04T09:20:00.000Z',
      },
      {
        userId: 'seed-prof-lan',
        username: 'prof_lan',
        displayName: 'PGS. TS. Trần Mai Lan',
        title: 'Phó Giáo sư, Trưởng phòng thí nghiệm BCI',
        specialty: 'Khoa học thần kinh tính toán',
        grantedAt: '2026-11-04T09:25:00.000Z',
      },
    ],
    accessHistory: [
      {
        id: 'hist-01',
        action: 'DATASET_REGISTERED',
        actorUsername: 'hoa_health',
        actorDisplayName: 'Nguyễn Thanh Hoa',
        timestamp: '2026-11-04T09:15:00.000Z',
        note: 'Tải lên bản ghi điện não đồ cá nhân (8 kênh, 250 Hz)',
      },
      {
        id: 'hist-02',
        action: 'CONSENT_GRANTED',
        actorUsername: 'hoa_health',
        actorDisplayName: 'Nguyễn Thanh Hoa',
        targetProfessional: 'BS. CKII Nguyễn Văn Minh (@dr_minh)',
        timestamp: '2026-11-04T09:20:00.000Z',
        note: 'Chủ sở hữu dữ liệu cấp quyền đọc bản ghi lâm sàng',
      },
    ],
  },
  {
    id: 'rec-02',
    ownerId: 'seed-owner-hoa',
    ownerUsername: 'hoa_health',
    patientCode: 'BN-****29 (Ẩn danh)',
    title: 'Đánh giá hoạt động điện não giấc ngủ ban đêm & Động kinh thùy thái dương',
    date: '31/10/2026 22:40',
    duration: '45 phút',
    samplingRate: '500 Hz',
    channelsCount: 16,
    montage: 'Hệ thống quốc tế 10-20 chuẩn lưỡng cực',
    filter: '0.1 - 100 Hz · Notch 50 Hz',
    status: 'REVIEW_PENDING',
    clinicalNote:
      'Xuất hiện rải rác phức hợp nhọn - sóng chậm đồng thì vùng thái dương - đỉnh bán cầu trái trong pha ngủ sâu N3.',
    consentedProfessionals: [
      {
        userId: 'seed-dr-minh',
        username: 'dr_minh',
        displayName: 'BS. CKII Nguyễn Văn Minh',
        title: 'Bác sĩ Chuyên khoa II Thần kinh',
        specialty: 'Thần kinh học lâm sàng',
        grantedAt: '2026-10-31T22:45:00.000Z',
      },
    ],
    accessHistory: [
      {
        id: 'hist-03',
        action: 'CONSENT_GRANTED',
        actorUsername: 'hoa_health',
        actorDisplayName: 'Nguyễn Thanh Hoa',
        targetProfessional: 'BS. CKII Nguyễn Văn Minh (@dr_minh)',
        timestamp: '2026-10-31T22:45:00.000Z',
        note: 'Cấp quyền riêng cho BS. Nguyễn Văn Minh hội chẩn giấc ngủ N3',
      },
    ],
  },
];

const EEG_CHANNELS = [
  {
    name: 'C3 (Motor Left)',
    region: 'Vỏ vận động sơ cấp trái',
    freq: '18-22 Hz (Beta)',
    peakUv: '42.8 µV',
    erdPercent: '-38.4% (ERD)',
    impedance: '3.2 kΩ',
    clinicalStatus: 'Đáp ứng rõ rệt',
    d: 'M0 24 Q15 6 30 24 T60 24 T90 24 T120 24 T150 10 T180 38 T210 24 T240 24 T270 24 T300 24 T330 14 T360 34 T390 24 T420 24',
  },
  {
    name: 'C4 (Motor Right)',
    region: 'Vỏ vận động sơ cấp phải',
    freq: '10-12 Hz (Mu)',
    peakUv: '28.5 µV',
    erdPercent: '-6.2% (Baseline)',
    impedance: '2.9 kΩ',
    clinicalStatus: 'Nền ổn định',
    d: 'M0 24 Q20 12 40 24 T80 24 T120 24 T160 24 T200 24 T240 24 T280 24 T320 24 T360 24 T400 24 T420 24',
  },
  {
    name: 'Cz (Vertex)',
    region: 'Đỉnh trung tâm',
    freq: '8-13 Hz (Alpha/Mu)',
    peakUv: '34.1 µV',
    erdPercent: '-14.0% (ERD)',
    impedance: '3.5 kΩ',
    clinicalStatus: 'Đồng bộ tốt',
    d: 'M0 24 Q25 8 50 24 T100 24 T150 24 T200 16 T250 32 T300 24 T350 24 T400 24 T420 24',
  },
  {
    name: 'Fz (Frontal)',
    region: 'Thùy trán trung tâm',
    freq: '4-7 Hz (Theta)',
    peakUv: '25.0 µV',
    erdPercent: '+4.1% (ERS)',
    impedance: '4.1 kΩ',
    clinicalStatus: 'Không nhiễu EOG',
    d: 'M0 24 Q30 10 60 24 T120 24 T180 24 T240 24 T300 24 T360 24 T420 24',
  },
  {
    name: 'Pz (Parietal)',
    region: 'Thùy đỉnh trung tâm',
    freq: '14-16 Hz (SMR)',
    peakUv: '39.4 µV',
    erdPercent: '-19.5% (ERD)',
    impedance: '3.0 kΩ',
    clinicalStatus: 'Đáp ứng SMR',
    d: 'M0 24 Q18 10 36 24 T72 24 T108 24 T144 24 T180 8 T216 40 T252 24 T288 24 T324 24 T360 24 T396 24 T420 24',
  },
  {
    name: 'O1 (Occipital Left)',
    region: 'Thùy chẩm trái',
    freq: '9.5 Hz (Alpha)',
    peakUv: '46.2 µV',
    erdPercent: '+11.8% (ERS)',
    impedance: '3.8 kΩ',
    clinicalStatus: 'Nhịp Alpha sinh lý',
    d: 'M0 24 Q22 4 44 24 T88 24 T132 24 T176 24 T220 24 T264 24 T308 24 T352 24 T396 24 T420 24',
  },
];

export function EEGHubPage() {
  const { user } = useAuth();
  const { isProfessional } = useMode();
  const [searchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const recParam = searchParams.get('rec');
  const isWorkspaceView = isProfessional && viewParam !== 'personal';

  const [recordings, setRecordings] = useState<EegDatasetRecord[]>(FALLBACK_RECORDINGS);
  const [selectedRecId, setSelectedRecId] = useState<string>(recParam || 'rec-01');
  const [timeScale, setTimeScale] = useState<'1s' | '5s' | '10s'>('5s');
  const [sensitivity, setSensitivity] = useState<'20' | '50' | '100'>('50');
  const [consentTargetUsername, setConsentTargetUsername] = useState('');
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentFeedback, setConsentFeedback] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSamplingRate, setNewSamplingRate] = useState('250 Hz');
  const [newChannelsCount, setNewChannelsCount] = useState('8');
  const [newDuration, setNewDuration] = useState('15 phút 00 giây');
  const [newClinicalNote, setNewClinicalNote] = useState('');
  const [createBusy, setCreateBusy] = useState(false);

  const [activeTab, setActiveTab] = useState<'visualizer' | 'datasets' | 'access'>(() => {
    if (viewParam === 'workspace' && isProfessional) return 'visualizer';
    if (viewParam === 'personal') return 'datasets';
    return isProfessional ? 'visualizer' : 'datasets';
  });

  useEffect(() => {
    if (recParam) {
      setSelectedRecId(recParam);
      setActiveTab('visualizer');
    }
  }, [recParam]);

  useEffect(() => {
    if (!user) return;
    const loader = isWorkspaceView
      ? eegDatasetsApi.getWorkspaceDatasets()
      : eegDatasetsApi.getMyDatasets();

    loader
      .then((res) => {
        setRecordings(res.datasets);
        if (res.datasets.length > 0) {
          setSelectedRecId((prev) =>
            res.datasets.some((d) => d.id === prev) ? prev : res.datasets[0]!.id,
          );
        }
      })
      .catch(() => {
        // Fallback if unauthenticated or offline
      });
  }, [user, isWorkspaceView]);

  const selectedRec =
    recordings.find((r) => r.id === selectedRecId) ?? recordings[0] ?? FALLBACK_RECORDINGS[0]!;
  const isOwnerOfSelected = Boolean(
    user && (selectedRec.ownerId === user.id || selectedRec.ownerUsername === user.username),
  );

  const handleCreateDataset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || newTitle.trim().length < 3) {
      setConsentFeedback({
        tone: 'error',
        text: 'Vui lòng nhập tiêu đề bản ghi EEG tối thiểu 3 ký tự.',
      });
      return;
    }
    setCreateBusy(true);
    setConsentFeedback(null);
    try {
      const res = await eegDatasetsApi.create({
        title: newTitle.trim(),
        samplingRate: newSamplingRate.trim() || '250 Hz',
        channelsCount: Number(newChannelsCount) || 8,
        duration: newDuration.trim() || '15 phút 00 giây',
        clinicalNote:
          newClinicalNote.trim() ||
          'Bản ghi điện não đồ cá nhân mới tải lên. Mặc định khoá riêng tư 100% cho đến khi chủ sở hữu cấp quyền bác sĩ.',
      });
      setRecordings((prev) => [res.dataset, ...prev]);
      setSelectedRecId(res.dataset.id);
      setShowCreateForm(false);
      setNewTitle('');
      setNewClinicalNote('');
      setActiveTab('access');
      setConsentFeedback({
        tone: 'success',
        text: `Đã tạo bản ghi EEG mới "${res.dataset.title}" (${res.dataset.patientCode}). Bạn có thể cấp quyền bác sĩ ngay bên dưới.`,
      });
    } catch (err) {
      setConsentFeedback({
        tone: 'error',
        text: err instanceof ApiError ? err.message : 'Không thể tạo bản ghi EEG mới',
      });
    } finally {
      setCreateBusy(false);
    }
  };

  const handleExportDataset = () => {
    const csvRows = [
      ['Dataset ID', 'Patient Code', 'Title', 'Sampling Rate', 'Channels', 'Owner', 'Status'],
      [
        selectedRec.id,
        selectedRec.patientCode,
        `"${selectedRec.title.replace(/"/g, '""')}"`,
        selectedRec.samplingRate,
        String(selectedRec.channelsCount),
        selectedRec.ownerUsername,
        selectedRec.status,
      ],
      [],
      ['Channel', 'Region', 'Frequency Band', 'Peak Amplitude', 'ERD/ERS', 'Impedance'],
      ...EEG_CHANNELS.map((ch) => [
        ch.name,
        ch.region,
        ch.freq,
        ch.peakUv,
        ch.erdPercent,
        ch.impedance,
      ]),
    ];
    const csvContent = csvRows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neurolink-eeg-${selectedRec.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setConsentFeedback({
      tone: 'success',
      text: `Đã xuất tệp dữ liệu ${selectedRec.id} (CSV chuẩn 10-20) thành công.`,
    });
  };

  const handleGrantConsent = async (usernameToGrant: string) => {
    const clean = usernameToGrant.trim().replace(/^@/, '');
    if (!clean) return;
    setConsentBusy(true);
    setConsentFeedback(null);
    try {
      const res = await eegDatasetsApi.grantConsent(selectedRec.id, clean);
      setRecordings((prev) => prev.map((r) => (r.id === res.dataset.id ? res.dataset : r)));
      setConsentTargetUsername('');
      setConsentFeedback({
        tone: 'success',
        text: `Đã cấp quyền truy cập EEG cho chuyên gia @${clean}`,
      });
    } catch (e) {
      setConsentFeedback({
        tone: 'error',
        text: e instanceof ApiError ? e.message : 'Không thể cấp quyền truy cập',
      });
    } finally {
      setConsentBusy(false);
    }
  };

  const handleRevokeConsent = async (usernameToRevoke: string) => {
    setConsentBusy(true);
    setConsentFeedback(null);
    try {
      const res = await eegDatasetsApi.revokeConsent(selectedRec.id, usernameToRevoke);
      setRecordings((prev) => prev.map((r) => (r.id === res.dataset.id ? res.dataset : r)));
      setConsentFeedback({
        tone: 'success',
        text: `Đã thu hồi quyền truy cập của @${usernameToRevoke}`,
      });
    } catch (e) {
      setConsentFeedback({
        tone: 'error',
        text: e instanceof ApiError ? e.message : 'Không thể thu hồi quyền truy cập',
      });
    } finally {
      setConsentBusy(false);
    }
  };

  return (
    <div className={isWorkspaceView ? 'space-y-5' : 'mx-auto max-w-5xl space-y-6'}>
      {/* Mode-Differentiated Header */}
      {isWorkspaceView ? (
        <section className="rounded-lg border border-slate-300 bg-white shadow-2xs overflow-hidden">
          <div className="bg-[#162B47] px-5 py-4 text-white flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
                  EEG Workspace · Phân tích Đạo trình 10-20 & Hội chẩn BCI
                </h1>
                <span className="inline-flex items-center gap-1 rounded bg-[#2C6865] px-2 py-0.5 text-[11px] font-semibold text-teal-50 border border-teal-400/30">
                  <ShieldCheck className="size-3 text-teal-200" />
                  Explicit Data-Owner Consent
                </span>
              </div>
              <p className="text-xs text-slate-300 max-w-3xl">
                Trạm làm việc dành cho Bác sĩ và Nhà nghiên cứu đã xác minh: chỉ hiển thị các tập dữ liệu điện não đồ đã được chủ sở hữu cấp quyền tường minh.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportDataset}
                className="border-white/25 bg-white/10 text-white hover:bg-white/20 text-xs"
                icon={<Download className="size-3.5 text-teal-200" />}
              >
                Xuất EDF+ / CSV
              </Button>
              <Button
                size="sm"
                onClick={() => setShowCreateForm((v) => !v)}
                className="bg-[#2C6865] hover:bg-teal-700 text-white text-xs"
                icon={<Plus className="size-3.5 text-white" />}
              >
                Nhập bản ghi lâm sàng
              </Button>
            </div>
          </div>

          {/* 4-Column Clinical Telemetry Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/80 text-xs">
            <div className="px-4 py-2.5 flex items-center justify-between">
              <span className="font-semibold text-slate-600">Bản ghi Được Ủy quyền</span>
              <span className="font-extrabold text-slate-900 tabular-nums">{recordings.length}</span>
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between">
              <span className="font-semibold text-slate-600">Đạo trình Đang mở</span>
              <span className="font-mono font-bold text-[#1E3A5F]">{selectedRec.channelsCount} kênh (10-20)</span>
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between">
              <span className="font-semibold text-slate-600">Tần số Lấy mẫu</span>
              <span className="font-mono font-bold text-[#2C6865]">{selectedRec.samplingRate}</span>
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between">
              <span className="font-semibold text-slate-600">Trạng thái Bảo mật</span>
              <span className="font-mono font-semibold text-emerald-700">PHI Anonymized</span>
            </div>
          </div>

          {/* Structured Sub-Tabs */}
          <div className="px-5 py-2.5 bg-white border-t border-slate-200 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('visualizer')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded transition-colors ${
                activeTab === 'visualizer'
                  ? 'bg-[#162B47] text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Eye className="size-3.5" />
              <span>Trực quan hóa Đạo trình & Thông số Kênh</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('datasets')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded transition-colors ${
                activeTab === 'datasets'
                  ? 'bg-[#162B47] text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet className="size-3.5" />
              <span>Bảng Danh mục Tập dữ liệu ({recordings.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('access')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded transition-colors ${
                activeTab === 'access'
                  ? 'bg-[#162B47] text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Lock className="size-3.5" />
              <span>Ủy quyền Chủ sở hữu & Nhật ký Kiểm toán</span>
            </button>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-teal-200/80 bg-white p-6 sm:p-7 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Hồ sơ Sóng não Cá nhân & Quyền Bác sĩ (My EEG)
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 border border-teal-200/80">
                  <Activity className="size-3.5 text-teal-600" />
                  Bảo mật Chủ sở hữu 100%
                </span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Lưu trữ an toàn các bản đo điện não đồ của bạn, xem tóm tắt kết quả dễ hiểu và chủ động quyết định bác sĩ nào được phép xem dữ liệu.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportDataset}
                className="border-teal-200 text-teal-800 hover:bg-teal-50"
                icon={<Download className="size-3.5 text-teal-600" />}
              >
                Tải về bản ghi
              </Button>
              <Button
                size="sm"
                onClick={() => setShowCreateForm((v) => !v)}
                className="bg-teal-600 hover:bg-teal-700 text-white"
                icon={<Plus className="size-3.5 text-white" />}
              >
                Tải lên bản ghi mới
              </Button>
            </div>
          </div>

          {/* Friendly Pill Switcher */}
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setActiveTab('datasets')}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-full transition-colors ${
                activeTab === 'datasets'
                  ? 'bg-teal-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-teal-700'
              }`}
            >
              <FileSpreadsheet className="size-4" />
              <span>Bản ghi EEG của tôi ({recordings.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('access')}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-full transition-colors ${
                activeTab === 'access'
                  ? 'bg-teal-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-teal-700'
              }`}
            >
              <Lock className="size-4" />
              <span>Quản lý Quyền Bác sĩ ({selectedRec.consentedProfessionals.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('visualizer')}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-full transition-colors ${
                activeTab === 'visualizer'
                  ? 'bg-teal-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-teal-700'
              }`}
            >
              <Eye className="size-4" />
              <span>Xem Biểu đồ Sóng não</span>
            </button>
          </div>
        </section>
      )}

      {/* Working Upload / Create EEG Dataset Form */}
      {showCreateForm && (
        <Card className="p-5 border-teal-300 bg-[#F0FDFA]/80 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Đăng ký & Tải lên Bản ghi Điện não đồ (EEG Dataset) Mới
            </h2>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Đóng
            </button>
          </div>
          <form onSubmit={handleCreateDataset} className="grid gap-3 sm:grid-cols-3 text-xs">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-bold text-slate-700 block">Tiêu đề Bản ghi EEG *</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ví dụ: Đo điện não đồ giấc ngủ trưa 8 kênh (Alpha/Theta)"
                className="bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">Tần số Lấy mẫu</label>
              <Input
                value={newSamplingRate}
                onChange={(e) => setNewSamplingRate(e.target.value)}
                placeholder="250 Hz"
                className="bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">Số kênh Đạo trình</label>
              <Input
                type="number"
                value={newChannelsCount}
                onChange={(e) => setNewChannelsCount(e.target.value)}
                placeholder="8"
                className="bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">Thời lượng Đo</label>
              <Input
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                placeholder="15 phút 00 giây"
                className="bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">Ghi chú Lâm sàng / Cảm nhận</label>
              <Input
                value={newClinicalNote}
                onChange={(e) => setNewClinicalNote(e.target.value)}
                placeholder="Ghi chú ngắn gọn về trạng thái khi đo..."
                className="bg-white"
              />
            </div>
            <div className="sm:col-span-3 flex justify-end gap-2 pt-1">
              <Button type="button" size="sm" variant="outline" onClick={() => setShowCreateForm(false)}>
                Hủy
              </Button>
              <Button type="submit" size="sm" loading={createBusy} icon={<Plus className="size-3.5" />}>
                Lưu Bản ghi EEG
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Main Tab 1: Multi-Channel EEG Visualizer */}
      {activeTab === 'visualizer' && (
        <div className="grid gap-5 lg:grid-cols-12 items-start">
          {/* Left / Main: Oscilloscope & Quantitative Table (in Pro mode) */}
          <div className="lg:col-span-8 space-y-5">
            <Card className="p-4 sm:p-5 border-slate-200/90 shadow-2xs space-y-4">
              {/* Visualizer Controls Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Sliders className="size-3.5 text-brand-600" />
                    <span>Khung thời gian & Độ nhạy:</span>
                  </span>
                  <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
                    {(['1s', '5s', '10s'] as const).map((scale) => (
                      <button
                        key={scale}
                        type="button"
                        onClick={() => setTimeScale(scale)}
                        className={`rounded px-2.5 py-1 transition-colors ${
                          timeScale === scale
                            ? 'bg-white text-brand-700 shadow-2xs font-bold'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {scale}
                      </button>
                    ))}
                  </div>

                  <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
                    {(['20', '50', '100'] as const).map((sens) => (
                      <button
                        key={sens}
                        type="button"
                        onClick={() => setSensitivity(sens)}
                        className={`rounded px-2 py-1 transition-colors ${
                          sensitivity === sens
                            ? 'bg-white text-brand-700 shadow-2xs font-bold'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {sens} µV
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                  <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                    <CheckCircle2 className="size-3" /> Trở kháng &lt; 5 kΩ
                  </span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {selectedRec.samplingRate}
                  </span>
                </div>
              </div>

              {/* Waveform Canvas Frame */}
              <div className="rounded-lg border border-slate-200 bg-[#FAFCFF] p-3 sm:p-4 space-y-3">
                {EEG_CHANNELS.map((ch) => (
                  <div key={ch.name} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                      <span className="font-bold text-slate-700">{ch.name}</span>
                      <span className="text-slate-500">{ch.freq}</span>
                    </div>
                    <div className="relative h-10 w-full overflow-hidden rounded border border-slate-200/80 bg-white">
                      <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:32px_16px]" />
                      <svg
                        viewBox="0 0 420 48"
                        preserveAspectRatio="none"
                        className="absolute inset-0 h-full w-full"
                      >
                        <path
                          d={ch.d}
                          fill="none"
                          stroke={isProfessional ? '#1E3A5F' : '#0D9488'}
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                ))}

                <div className="flex justify-between text-[10px] font-mono text-slate-400 border-t border-slate-200 pt-1.5">
                  <span>0.0s</span>
                  <span>1.0s</span>
                  <span>2.0s</span>
                  <span>3.0s</span>
                  <span>4.0s</span>
                  <span>5.0s</span>
                </div>
              </div>

              {/* Clinical Annotation Box */}
              <div
                className={`rounded-lg border p-3.5 space-y-2 ${
                  isProfessional
                    ? 'bg-slate-50 border-slate-200/90'
                    : 'bg-[#F0FDFA] border-teal-200/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Brain className="size-4 text-teal-700" />
                    <span>
                      {isProfessional
                        ? 'Nhận định lâm sàng & Đánh giá sóng não:'
                        : 'Tóm tắt kết quả đọc sóng não từ Bác sĩ:'}
                    </span>
                  </span>
                  <span className="rounded bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    {selectedRec.status === 'ANALYZED' ? 'Đã có kết luận' : 'Đang chờ bác sĩ đọc'}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{selectedRec.clinicalNote}</p>
              </div>
            </Card>

            {/* Professional Mode Only: Quantitative 10-20 Electrode Parameters Data Table */}
            {isProfessional && (
              <Card className="p-0 overflow-hidden border-slate-300 shadow-2xs">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900">
                    Bảng Thông số Định lượng Đạo trình Quốc tế 10-20 (Electrode Telemetry)
                  </h2>
                  <span className="text-[11px] font-mono text-slate-500">
                    Notch 50Hz · Bandpass 0.5–70Hz
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100/80 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        <th className="py-2.5 px-3.5">Đạo trình</th>
                        <th className="py-2.5 px-3.5">Vùng Giải phẫu</th>
                        <th className="py-2.5 px-3.5">Dải tần Ưu thế</th>
                        <th className="py-2.5 px-3.5 text-right">Biên độ Đỉnh</th>
                        <th className="py-2.5 px-3.5 text-right">Chỉ số ERD/ERS</th>
                        <th className="py-2.5 px-3.5 text-right">Trở kháng</th>
                        <th className="py-2.5 px-3.5">Nhận định Kênh</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80">
                      {EEG_CHANNELS.map((ch) => (
                        <tr key={ch.name} className="hover:bg-slate-50/90">
                          <td className="py-2.5 px-3.5 font-mono font-bold text-[#1E3A5F]">
                            {ch.name}
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-700">{ch.region}</td>
                          <td className="py-2.5 px-3.5 font-mono text-slate-700">{ch.freq}</td>
                          <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                            {ch.peakUv}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-[#2C6865] tabular-nums">
                            {ch.erdPercent}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono text-emerald-700 tabular-nums">
                            {ch.impedance}
                          </td>
                          <td className="py-2.5 px-3.5">
                            <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-200">
                              {ch.clinicalStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>

          {/* Right Column: Metadata, Band Spectrum & Access Guard */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="p-4 sm:p-5 border-slate-200/90 shadow-2xs space-y-3.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Thông tin Bản ghi Đang mở
              </h3>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Mã hồ sơ:</span>
                  <span className="font-bold text-slate-800">{selectedRec.patientCode}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Thời gian đo:</span>
                  <span className="font-semibold text-slate-700">
                    {selectedRec.date} ({selectedRec.duration})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Cấu hình đo:</span>
                  <span className="font-medium text-slate-700">{selectedRec.filter}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">
                    Bác sĩ & Chuyên gia được chủ sở hữu cấp quyền:
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedRec.consentedProfessionals.map((doc) => (
                      <span
                        key={doc.username}
                        className="rounded bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800 border border-teal-200"
                      >
                        {doc.displayName}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500">
                <ShieldCheck className="size-4 text-teal-600 shrink-0 mt-0.5" />
                <span className="leading-snug">
                  Dữ liệu được khử định danh (PHI Anonymized) và bảo vệ bởi cơ chế uỷ quyền tường minh từ chủ sở hữu (Explicit Data-Owner Consent).
                </span>
              </div>
            </Card>

            {/* Power Spectral Density (PSD) Bands Distribution */}
            <Card className="p-4 sm:p-5 border-slate-200/90 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Tỷ trọng Tần số Sóng não (PSD)
              </h3>

              <div className="space-y-2.5 text-xs">
                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-700 pb-1">
                    <span>Delta (0.5 – 4 Hz · Ngủ sâu)</span>
                    <span className="text-slate-500 font-mono">14%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-slate-400 rounded-full" style={{ width: '14%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-700 pb-1">
                    <span>Theta (4 – 8 Hz · Thư giãn sâu)</span>
                    <span className="text-slate-500 font-mono">22%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-sky-500 rounded-full" style={{ width: '22%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-700 pb-1">
                    <span>Alpha / Mu (8 – 13 Hz · Thư thái)</span>
                    <span className="text-teal-700 font-bold font-mono">42% (Ưu thế)</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-teal-600 rounded-full" style={{ width: '42%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-700 pb-1">
                    <span>Beta (13 – 30 Hz · Tập trung)</span>
                    <span className="text-slate-500 font-mono">22%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-[#2B4C7E] rounded-full" style={{ width: '22%' }} />
                  </div>
                </div>
              </div>
            </Card>

            {/* Future Analysis Roadmap Notice */}
            <div className="rounded-lg border border-sky-200/80 bg-[#F0F9FF] p-4 space-y-1.5 text-xs text-slate-800">
              <div className="flex items-center gap-1.5 font-bold text-sky-900">
                <Sparkles className="size-4 text-sky-600" />
                <span>Lộ trình Tích hợp Giai đoạn Tiếp theo</span>
              </div>
              <p className="leading-relaxed text-slate-600">
                Mô-đun tiền xử lý tín hiệu số (DSP) và tự động lọc nhiễu chớp mắt (ICA) sẽ được tích hợp trong giai đoạn phát triển tiếp theo.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Tab 2: Datasets Management List (Structured Table in Pro Mode, Friendly Cards in General Mode) */}
      {activeTab === 'datasets' && (
        <>
          {isProfessional ? (
            <Card className="p-0 overflow-hidden border-slate-300 shadow-2xs">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h2 className="font-bold text-slate-900 text-xs sm:text-sm">
                  Danh mục Tập dữ liệu EEG Đã Cấp Quyền Truy Cập ({recordings.length})
                </h2>
                <span className="text-[11px] font-mono text-slate-500">
                  Định dạng hỗ trợ: EDF+, BDF, CSV, MAT
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/80 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      <th className="py-2.5 px-3.5">Mã Hồ sơ</th>
                      <th className="py-2.5 px-3.5">Tên Bản ghi Lâm sàng</th>
                      <th className="py-2.5 px-3.5">Cấu hình Đạo trình</th>
                      <th className="py-2.5 px-3.5">Tần số / Thời lượng</th>
                      <th className="py-2.5 px-3.5">Ủy quyền Chủ sở hữu</th>
                      <th className="py-2.5 px-3.5 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80">
                    {recordings.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/90">
                        <td className="py-3 px-3.5 font-mono font-bold text-[#1E3A5F] whitespace-nowrap align-top">
                          {rec.patientCode}
                        </td>
                        <td className="py-3 px-3.5 align-top max-w-md">
                          <div className="font-bold text-slate-900">{rec.title}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Ngày ghi: {rec.date} · Chủ sở hữu: @{rec.ownerUsername}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-slate-700 align-top">
                          {rec.channelsCount} kênh · {rec.montage}
                        </td>
                        <td className="py-3 px-3.5 font-mono text-slate-700 whitespace-nowrap align-top">
                          {rec.samplingRate} · {rec.duration}
                        </td>
                        <td className="py-3 px-3.5 align-top">
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold">
                            <ShieldCheck className="size-3 text-emerald-600" />{' '}
                            {rec.consentedProfessionals.length} chuyên gia
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right whitespace-nowrap align-top">
                          <Button
                            size="sm"
                            variant={selectedRecId === rec.id ? 'primary' : 'outline'}
                            onClick={() => {
                              setSelectedRecId(rec.id);
                              setActiveTab('visualizer');
                            }}
                          >
                            Mở Trạm Đọc
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <Card className="p-5 sm:p-6 border-slate-200/80 rounded-xl shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="font-bold text-slate-900 text-base">
                    Các bản ghi sóng não cá nhân của bạn ({recordings.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Nhấn vào bản ghi để xem biểu đồ sóng não hoặc quản lý bác sĩ được phép xem kết quả.
                  </p>
                </div>
                <span className="text-xs text-teal-700 font-semibold bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                  Hỗ trợ EDF+, CSV
                </span>
              </div>

              <div className="space-y-3.5">
                {recordings.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => {
                      setSelectedRecId(rec.id);
                      setActiveTab('visualizer');
                    }}
                    className={`p-4 sm:p-5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                      selectedRecId === rec.id
                        ? 'border-teal-500 bg-[#F0FDFA] shadow-2xs'
                        : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm sm:text-base">
                          {rec.title}
                        </span>
                        <span className="rounded-full bg-sky-50 text-sky-800 border border-sky-200 px-2.5 py-0.5 text-[11px] font-semibold">
                          {rec.status === 'ANALYZED' ? 'Đã có nhận xét Bác sĩ' : 'Đang chờ đọc'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{rec.clinicalNote}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5 text-teal-600" /> {rec.date}
                        </span>
                        <span>Thời lượng: {rec.duration}</span>
                        <span className="text-teal-700 font-semibold">
                          Đang chia sẻ với {rec.consentedProfessionals.length} bác sĩ chuyên khoa
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-teal-200 text-teal-700 hover:bg-teal-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRecId(rec.id);
                          setActiveTab('access');
                        }}
                      >
                        Quyền Bác sĩ
                      </Button>
                      <Button
                        size="sm"
                        className="bg-teal-600 hover:bg-teal-700 text-white"
                      >
                        Xem sóng não
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Main Tab 3: Authorized Expert Access & Data-Owner Consent Management */}
      {activeTab === 'access' && (
        <div className="space-y-5">
          <Card className="p-5 sm:p-6 border-slate-200/90 shadow-2xs space-y-4">
            <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                  Kiểm soát Truy cập & Sự đồng thuận của Chủ sở hữu Dữ liệu (Data-Owner Consent)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Trạng thái Chuyên gia không tự động cấp quyền xem mọi dữ liệu EEG của bệnh nhân. Chỉ các Bác sĩ / Nhà nghiên cứu có tích xanh được chủ sở hữu uỷ quyền mới có thể truy cập bản ghi:{' '}
                  <strong className="text-slate-700">{selectedRec.title}</strong>
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-800 shrink-0">
                <ShieldCheck className="size-3.5 text-emerald-600" />
                <span>Chủ sở hữu: @{selectedRec.ownerUsername}</span>
              </span>
            </div>

            {consentFeedback && <Alert tone={consentFeedback.tone}>{consentFeedback.text}</Alert>}

            {/* Data-Owner Consent Grant Form */}
            {isOwnerOfSelected && (
              <div className="rounded-lg border border-teal-200 bg-[#F0FDFA] p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <UserPlus className="size-4 text-teal-600" />
                    <span>Cấp quyền đọc bản ghi EEG cho Bác sĩ / Chuyên gia đã xác minh:</span>
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-slate-500">Chọn nhanh:</span>
                    <button
                      type="button"
                      onClick={() => handleGrantConsent('dr_minh')}
                      disabled={consentBusy}
                      className="rounded bg-white border border-teal-200 px-2 py-0.5 font-semibold text-teal-700 hover:bg-teal-50"
                    >
                      + @dr_minh
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGrantConsent('prof_lan')}
                      disabled={consentBusy}
                      className="rounded bg-white border border-teal-200 px-2 py-0.5 font-semibold text-teal-700 hover:bg-teal-50"
                    >
                      + @prof_lan
                    </button>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <Input
                      value={consentTargetUsername}
                      onChange={(e) => setConsentTargetUsername(e.target.value)}
                      placeholder="Nhập username chuyên gia đã xác minh (ví dụ: dr_minh hoặc prof_lan)"
                    />
                  </div>
                  <Button
                    size="sm"
                    loading={consentBusy}
                    onClick={() => handleGrantConsent(consentTargetUsername)}
                  >
                    Cấp quyền truy cập
                  </Button>
                </div>
              </div>
            )}

            {/* List of Consented Professionals */}
            <div className="grid gap-3 sm:grid-cols-2">
              {selectedRec.consentedProfessionals.map((prof) => (
                <div
                  key={prof.username}
                  className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2 flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                        <UserCheck className="size-4 text-teal-600" />
                        <span>{prof.displayName}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">@{prof.username}</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      {prof.title} · {prof.specialty}
                    </p>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-2">
                    <span className="inline-block rounded bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 text-[10px] font-bold">
                      Đã được chủ sở hữu uỷ quyền đọc EEG
                    </span>
                    {isOwnerOfSelected && (
                      <button
                        type="button"
                        disabled={consentBusy}
                        onClick={() => handleRevokeConsent(prof.username)}
                        className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        <UserX className="size-3" />
                        <span>Thu hồi</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {selectedRec.consentedProfessionals.length === 0 && (
                <div className="sm:col-span-2 rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                  Hiện chưa có chuyên gia nào được cấp quyền truy cập bản ghi này. Bản ghi đang ở chế độ riêng tư 100% chỉ mình chủ sở hữu xem được.
                </div>
              )}
            </div>
          </Card>

          {/* Immutable Access & Consent Audit History */}
          <Card className="p-5 border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <History className="size-4 text-brand-600" />
              <h3 className="text-xs sm:text-sm font-bold text-slate-800">
                Nhật ký Cấp quyền & Lịch sử Truy cập Bản ghi (Dataset Access History)
              </h3>
            </div>
            <div className="space-y-2">
              {selectedRec.accessHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 rounded-md border border-slate-200/80 bg-slate-50/70 px-3.5 py-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 font-semibold text-slate-800">
                      <span className="rounded bg-white border border-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-brand-700">
                        {entry.action}
                      </span>
                      <span>{entry.note}</span>
                    </div>
                    {entry.targetProfessional && (
                      <p className="text-[11px] text-slate-500">
                        Đối tượng: {entry.targetProfessional} · Thực hiện bởi: @{entry.actorUsername}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">
                    {new Date(entry.timestamp).toLocaleString('vi-VN')}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
