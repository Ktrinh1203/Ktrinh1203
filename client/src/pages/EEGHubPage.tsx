import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import {
  Download,
  Plus,
  ShieldCheck,
  UserX,
} from 'lucide-react';
import { eegDatasetsApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import type { EegDatasetRecord } from '../api/types';
import { Alert, Button, Card, Input, cn } from '../components/ui';
import { useMode } from '../context/ModeContext';
import { useAuth } from '../features/auth/AuthContext';
import { BrainWaveformViewer } from '../features/eeg/BrainWaveformViewer';
import { DataBankMarketplacePanel } from '../features/eeg/DataBankMarketplacePanel';
import { HardwareDevicePanel } from '../features/eeg/HardwareDevicePanel';
import { NeuralDatabasePanel } from '../features/eeg/NeuralDatabasePanel';
import { QeegStudioPanel } from '../features/eeg/QeegStudioPanel';
import { triggerCsvDownload } from '../features/eeg/eegLabels';

type HubTab = 'qeeg' | 'personal' | 'device' | 'databank' | 'neural-db';

const FALLBACK_RECORDINGS: EegDatasetRecord[] = [
  {
    id: 'rec-01',
    ownerId: 'seed-owner-hoa',
    ownerUsername: 'hoa_health',
    patientCode: 'BN-****84 (Ẩn danh)',
    title: 'Thử nghiệm vận động tay phải',
    date: '04/11/2026 09:15',
    duration: '18 phút 42 giây',
    samplingRate: '250 Hz',
    channelsCount: 8,
    montage: 'Hệ thống quốc tế 10-20 (C3, C4, Cz, Fz, Pz, F3, F4, Oz)',
    filter: 'Dải thông 0.5 - 70 Hz · Bộ lọc khuyết 50 Hz Notch',
    status: 'ANALYZED',
    clinicalNote:
      'Giảm đồng bộ (ERD) rõ tại C3 trong dải Mu (8–12 Hz) và Beta (18–24 Hz) khi tưởng tượng nắm tay phải.',
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
    title: 'Theo dõi giấc ngủ ban đêm',
    date: '31/10/2026 22:40',
    duration: '45 phút',
    samplingRate: '500 Hz',
    channelsCount: 16,
    montage: 'Hệ thống quốc tế 10-20 chuẩn lưỡng cực',
    filter: '0.1 - 100 Hz · Notch 50 Hz',
    status: 'REVIEW_PENDING',
    clinicalNote:
      'Rải rác phức hợp nhọn - sóng chậm vùng thái dương trái trong pha ngủ sâu N3.',
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
    name: 'F3',
    region: 'Thùy trán trái',
    freq: '13-18 Hz (Beta thấp)',
    peakUv: '26.4 µV',
    erdPercent: '-11.2% (ERD)',
    impedance: '3.4 kΩ',
    clinicalStatus: 'Ổn định',
  },
  {
    name: 'F4',
    region: 'Thùy trán phải',
    freq: '13-18 Hz (Beta thấp)',
    peakUv: '25.8 µV',
    erdPercent: '-9.4% (ERD)',
    impedance: '3.1 kΩ',
    clinicalStatus: 'Ổn định',
  },
  {
    name: 'C3',
    region: 'Vỏ vận động sơ cấp trái',
    freq: '18-22 Hz (Beta)',
    peakUv: '42.8 µV',
    erdPercent: '-38.4% (ERD)',
    impedance: '3.2 kΩ',
    clinicalStatus: 'Đáp ứng rõ rệt',
  },
  {
    name: 'C4',
    region: 'Vỏ vận động sơ cấp phải',
    freq: '10-12 Hz (Mu)',
    peakUv: '28.5 µV',
    erdPercent: '-6.2% (Baseline)',
    impedance: '2.9 kΩ',
    clinicalStatus: 'Nền ổn định',
  },
  {
    name: 'O1',
    region: 'Thùy chẩm trái',
    freq: '9.8 Hz (Alpha)',
    peakUv: '46.2 µV',
    erdPercent: '+11.8% (ERS)',
    impedance: '3.8 kΩ',
    clinicalStatus: 'Nhịp Alpha sinh lý',
  },
  {
    name: 'O2',
    region: 'Thùy chẩm phải',
    freq: '10.1 Hz (Alpha)',
    peakUv: '44.9 µV',
    erdPercent: '+10.6% (ERS)',
    impedance: '3.6 kΩ',
    clinicalStatus: 'Nhịp Alpha sinh lý',
  },
];

/** Builds deterministic 6-channel multi-lead preview waveforms for a personal EEG record. */
function buildPreviewWaveformForDataset(rec: EegDatasetRecord) {
  const nPts = 300; // 5 seconds at 60 Hz display
  const time = Array.from({ length: nPts }, (_, i) => Number(((i / (nPts - 1)) * 5).toFixed(3)));
  const channels = ['F3', 'F4', 'C3', 'C4', 'O1', 'O2'];
  const isSleepOrPending = rec.status === 'REVIEW_PENDING' || /giấc ngủ|động kinh/i.test(rec.title);
  const seedShift = rec.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 7;

  const filtered: Record<string, number[]> = {};
  const raw: Record<string, number[]> = {};

  channels.forEach((ch, chIdx) => {
    const fArr: number[] = [];
    const rArr: number[] = [];
    for (let i = 0; i < nPts; i++) {
      const t = time[i]!;
      const alphaAmp = ch.startsWith('O') ? 26 : ch.startsWith('C') ? 14 : 9;
      const slowAmp = isSleepOrPending ? (chIdx % 2 === 0 ? 34 : 20) : 7;
      const clean =
        slowAmp * Math.sin(2 * Math.PI * (isSleepOrPending ? 2.1 : 1.4) * t + chIdx * 0.7 + seedShift) +
        alphaAmp * Math.sin(2 * Math.PI * 10.1 * t + chIdx * 0.4) +
        8 * Math.sin(2 * Math.PI * 18.5 * t + chIdx * 1.1);
      const powerline = 6.5 * Math.sin(2 * Math.PI * 50 * t + chIdx);
      fArr.push(Number(clean.toFixed(2)));
      rArr.push(Number((clean + powerline).toFixed(2)));
    }
    filtered[ch] = fArr;
    raw[ch] = rArr;
  });

  return { time, channels, raw, filtered };
}

function resolveInitialTab(searchParams: URLSearchParams): HubTab {
  const tab = searchParams.get('tab');
  if (
    tab === 'qeeg' ||
    tab === 'personal' ||
    tab === 'device' ||
    tab === 'databank' ||
    tab === 'neural-db'
  ) {
    return tab;
  }
  const view = searchParams.get('view');
  const rec = searchParams.get('rec');
  if (rec || view === 'personal') return 'personal';
  return 'qeeg';
}

export function EEGHubPage() {
  const { user } = useAuth();
  const { isProfessional } = useMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const recParam = searchParams.get('rec');

  const [activeTab, setActiveTab] = useState<HubTab>(() => resolveInitialTab(searchParams));
  const [showResearchTabs, setShowResearchTabs] = useState(
    () => activeTab === 'databank' || activeTab === 'neural-db',
  );
  const [datasetScope, setDatasetScope] = useState<'my' | 'workspace'>(() =>
    isProfessional && viewParam === 'workspace' ? 'workspace' : 'my',
  );

  // Personal EEG Datasets & Consent state (Tab 2)
  const [recordings, setRecordings] = useState<EegDatasetRecord[]>(FALLBACK_RECORDINGS);
  const [selectedRecId, setSelectedRecId] = useState<string>(recParam || 'rec-01');
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

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (
      tabParam === 'qeeg' ||
      tabParam === 'personal' ||
      tabParam === 'device' ||
      tabParam === 'databank' ||
      tabParam === 'neural-db'
    ) {
      setActiveTab(tabParam);
      if (tabParam === 'databank' || tabParam === 'neural-db') {
        setShowResearchTabs(true);
      }
    } else if (recParam || viewParam === 'personal') {
      setActiveTab('personal');
      setDatasetScope('my');
    } else if (viewParam === 'workspace' && isProfessional) {
      setDatasetScope('workspace');
    }
    if (recParam) {
      setSelectedRecId(recParam);
    }
  }, [searchParams, recParam, viewParam, isProfessional]);

  const isWorkspaceView = isProfessional && datasetScope === 'workspace';

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
        // Retain fallback records when offline
      });
  }, [user, isWorkspaceView]);

  const switchTab = (nextTab: HubTab) => {
    setActiveTab(nextTab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', nextTab);
    setSearchParams(next, { replace: true });
  };

  const selectedRec =
    recordings.find((r) => r.id === selectedRecId) ?? recordings[0] ?? FALLBACK_RECORDINGS[0]!;
  const isOwnerOfSelected = Boolean(
    user && (selectedRec.ownerId === user.id || selectedRec.ownerUsername === user.username),
  );
  const previewWaveform = useMemo(() => buildPreviewWaveformForDataset(selectedRec), [selectedRec]);

  const handleCreateDataset = async (e: FormEvent) => {
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
        clinicalNote: newClinicalNote.trim() || 'Bản ghi sóng não cá nhân.',
      });
      setRecordings((prev) => [res.dataset, ...prev]);
      setSelectedRecId(res.dataset.id);
      setShowCreateForm(false);
      setNewTitle('');
      setNewClinicalNote('');
      setActiveTab('personal');
      setConsentFeedback({
        tone: 'success',
        text: `Đã tạo bản ghi "${res.dataset.title}" (${res.dataset.patientCode}).`,
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
    triggerCsvDownload(`neurolink-eeg-${selectedRec.id}.csv`, csvRows.map((r) => r.join(',')).join('\n'));
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

  const allTabs: { id: HubTab; label: string }[] = [
    { id: 'qeeg', label: 'Đo & Đọc kết quả' },
    { id: 'personal', label: 'Hồ sơ đã lưu' },
    { id: 'device', label: 'Thiết bị' },
    { id: 'databank', label: 'Kho Dữ liệu' },
    { id: 'neural-db', label: 'Mẫu chuẩn AI' },
  ];
  const visibleTabs =
    isProfessional || showResearchTabs ? allTabs : allTabs.slice(0, 3);

  return (
    <div className={isProfessional ? 'space-y-4' : 'mx-auto max-w-6xl space-y-4'}>
      {/* Header & Navigation */}
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1
            className={cn(
              'font-bold tracking-tight text-[#141413]',
              isProfessional ? 'text-base sm:text-lg' : 'text-lg sm:text-xl',
            )}
          >
            Đo sóng não
          </h1>

          {activeTab === 'personal' && (
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {isProfessional && (
                <div className="inline-flex rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] p-0.5 text-xs font-medium">
                  <button
                    type="button"
                    aria-pressed={datasetScope === 'my'}
                    onClick={() => setDatasetScope('my')}
                    className={cn(
                      'rounded-md px-2.5 py-1 transition-colors',
                      datasetScope === 'my'
                        ? 'bg-[#16A34A] text-white font-semibold'
                        : 'text-[#6E6D68] hover:text-[#15803D]',
                    )}
                  >
                    Của tôi
                  </button>
                  <button
                    type="button"
                    aria-pressed={datasetScope === 'workspace'}
                    onClick={() => setDatasetScope('workspace')}
                    className={cn(
                      'rounded-md px-2.5 py-1 transition-colors',
                      datasetScope === 'workspace'
                        ? 'bg-[#16A34A] text-white font-semibold'
                        : 'text-[#6E6D68] hover:text-[#15803D]',
                    )}
                  >
                    Bệnh nhân
                  </button>
                </div>
              )}
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={handleExportDataset}
                className="border-[#DCE6DF] text-[#262624] hover:bg-[#F5FAF7] text-xs"
                icon={<Download className="size-3.5 text-[#575652]" aria-hidden />}
              >
                Xuất CSV
              </Button>
              <Button
                type="button"
                size="xs"
                variant="primary"
                onClick={() => setShowCreateForm((v) => !v)}
                className="text-xs"
                icon={<Plus className="size-3.5" aria-hidden />}
              >
                Thêm bản ghi
              </Button>
            </div>
          )}
        </div>

        <nav
          aria-label="Điều hướng Đo sóng não"
          className="border-b border-[#DCE6DF] flex items-center gap-4 sm:gap-6 overflow-x-auto"
        >
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => switchTab(tab.id)}
                className={cn(
                  'border-b-2 pb-2.5 text-sm transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16A34A]',
                  isActive
                    ? 'border-[#16A34A] font-bold text-[#15803D]'
                    : 'border-transparent font-normal text-[#6E6D68] hover:text-[#15803D]',
                )}
              >
                {tab.label}
              </button>
            );
          })}

          {!isProfessional && (
            <button
              type="button"
              onClick={() => {
                const next = !showResearchTabs;
                setShowResearchTabs(next);
                if (!next && (activeTab === 'databank' || activeTab === 'neural-db')) {
                  switchTab('qeeg');
                }
              }}
              className="ml-auto pb-2.5 text-xs font-medium text-[#6E6D68] hover:text-[#15803D] whitespace-nowrap shrink-0 transition-colors"
            >
              {showResearchTabs ? 'Ẩn chế độ nghiên cứu' : 'Kho dữ liệu & AI'}
            </button>
          )}
        </nav>
      </header>

      {/* TAB 1: qEEG Studio */}
      {activeTab === 'qeeg' && (
        <QeegStudioPanel
          isProfessional={isProfessional}
          onSavedToPlatform={(dataset) => {
            setRecordings((prev) => [dataset, ...prev]);
            setSelectedRecId(dataset.id);
          }}
          onSwitchTab={(tab) => switchTab(tab)}
        />
      )}

      {/* TAB 2: Personal EEG Datasets & Data-Owner Doctor Consent */}
      {activeTab === 'personal' && (
        <div className="space-y-4">
          {/* Create Dataset Form */}
          {showCreateForm && (
            <Card className="p-4 border-[#DCE6DF] bg-[#F5FAF7] space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#141413]">Thêm bản ghi mới</h2>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="text-xs font-medium text-[#6E6D68] hover:text-[#141413]"
                >
                  Đóng
                </button>
              </div>
              <form onSubmit={handleCreateDataset} className="grid gap-3 sm:grid-cols-3 text-xs">
                <div className="sm:col-span-2 space-y-1">
                  <label htmlFor="personal-eeg-title" className="font-semibold text-[#262624] block">
                    Tiêu đề *
                  </label>
                  <Input
                    id="personal-eeg-title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Nhập tên bản ghi..."
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="personal-eeg-rate" className="font-semibold text-[#262624] block">
                    Tần số
                  </label>
                  <Input
                    id="personal-eeg-rate"
                    value={newSamplingRate}
                    onChange={(e) => setNewSamplingRate(e.target.value)}
                    placeholder="250 Hz"
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="personal-eeg-ch" className="font-semibold text-[#262624] block">
                    Số kênh
                  </label>
                  <Input
                    id="personal-eeg-ch"
                    type="number"
                    value={newChannelsCount}
                    onChange={(e) => setNewChannelsCount(e.target.value)}
                    placeholder="8"
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="personal-eeg-dur" className="font-semibold text-[#262624] block">
                    Thời lượng
                  </label>
                  <Input
                    id="personal-eeg-dur"
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                    placeholder="15 phút 00 giây"
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="personal-eeg-note" className="font-semibold text-[#262624] block">
                    Ghi chú
                  </label>
                  <Input
                    id="personal-eeg-note"
                    value={newClinicalNote}
                    onChange={(e) => setNewClinicalNote(e.target.value)}
                    placeholder="Ghi chú ngắn gọn..."
                    className="bg-white"
                  />
                </div>
                <div className="sm:col-span-3 flex justify-end gap-2 pt-1">
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowCreateForm(false)}>
                    Hủy
                  </Button>
                  <Button type="submit" size="sm" variant="primary" loading={createBusy} icon={<Plus className="size-3.5" aria-hidden />}>
                    Lưu
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {consentFeedback && <Alert tone={consentFeedback.tone}>{consentFeedback.text}</Alert>}

          {/* Recordings List / Table */}
          {isProfessional ? (
            <Card className="p-0 overflow-hidden border-[#DCE6DF]">
              <div className="px-4 py-2.5 bg-[#F5FAF7] border-b border-[#DCE6DF] flex items-center justify-between">
                <h2 className="font-semibold text-[#141413] text-xs sm:text-sm">
                  Bản ghi EEG ({recordings.length})
                </h2>
              </div>

              <div
                tabIndex={0}
                role="region"
                aria-label="Bảng danh mục tập dữ liệu EEG cá nhân và được ủy quyền"
                className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-[#16A34A]"
              >
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#DCE6DF] bg-[#F5FAF7] text-[11px] font-semibold uppercase tracking-wider text-[#6E6D68]">
                      <th className="py-2.5 px-3.5">Mã hồ sơ</th>
                      <th className="py-2.5 px-3.5">Tiêu đề</th>
                      <th className="py-2.5 px-3.5">Đạo trình</th>
                      <th className="py-2.5 px-3.5">Tần số / Thời lượng</th>
                      <th className="py-2.5 px-3.5">Quyền xem</th>
                      <th className="py-2.5 px-3.5 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE6DF]">
                    {recordings.map((rec) => (
                      <tr
                        key={rec.id}
                        className={cn(
                          'hover:bg-[#F5FAF7]/80',
                          selectedRecId === rec.id && 'bg-[#ECFDF3]/70',
                        )}
                      >
                        <td className="py-3 px-3.5 font-mono font-semibold text-[#141413] whitespace-nowrap align-top">
                          {rec.patientCode}
                        </td>
                        <td className="py-3 px-3.5 align-top max-w-md">
                          <div className="font-semibold text-[#141413]">{rec.title}</div>
                          <div className="text-[11px] text-[#6E6D68] mt-0.5">
                            {rec.date} · @{rec.ownerUsername}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-[#575652] align-top">
                          {rec.channelsCount} kênh · {rec.montage}
                        </td>
                        <td className="py-3 px-3.5 font-mono text-[#575652] whitespace-nowrap align-top tabular-nums">
                          {rec.samplingRate} · {rec.duration}
                        </td>
                        <td className="py-3 px-3.5 align-top">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#15803D]">
                            <ShieldCheck className="size-3.5 text-[#16A34A] shrink-0" aria-hidden />
                            {rec.consentedProfessionals.length} bác sĩ
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right whitespace-nowrap align-top">
                          <Button
                            type="button"
                            size="xs"
                            variant={selectedRecId === rec.id ? 'primary' : 'outline'}
                            onClick={() => setSelectedRecId(rec.id)}
                          >
                            {selectedRecId === rec.id ? 'Đang mở' : 'Xem'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {recordings.map((rec) => {
                const isSelected = selectedRecId === rec.id;
                return (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => setSelectedRecId(rec.id)}
                    className={cn(
                      'p-3.5 text-left rounded-xl border transition-colors',
                      isSelected
                        ? 'border-[#86EFAC] bg-[#ECFDF3]'
                        : 'border-[#DCE6DF] bg-white hover:border-[#86EFAC]',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-[#141413] line-clamp-1">{rec.title}</span>
                      <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium text-[#6E6D68]">
                        <span
                          className={cn(
                            'size-1.5 rounded-full',
                            rec.status === 'ANALYZED' ? 'bg-[#16A34A]' : 'bg-amber-500',
                          )}
                          aria-hidden
                        />
                        {rec.status === 'ANALYZED' ? 'Đã đọc' : 'Chờ đọc'}
                      </span>
                    </div>
                    <p className="text-xs text-[#6E6D68] mt-1">
                      {rec.patientCode} · {rec.date} · {rec.channelsCount} kênh
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Selected Record Grid */}
          <div className="grid gap-4 lg:grid-cols-12 items-start">
            <div className="lg:col-span-8 min-w-0 space-y-3">
              <BrainWaveformViewer
                waveforms={previewWaveform}
                samplingRateHz={parseInt(selectedRec.samplingRate, 10) || 250}
                isProfessional={isProfessional}
                title={selectedRec.patientCode}
                subtitle={`${selectedRec.channelsCount} kênh · ${selectedRec.samplingRate}`}
              />

              <div className="rounded-xl border border-[#DCE6DF] bg-[#F5FAF7] px-4 py-3 text-xs sm:text-sm text-[#262624]">
                <span className="font-semibold text-[#141413] mr-1.5">Nhận xét:</span>
                {selectedRec.clinicalNote}
              </div>

              {isProfessional && (
                <details className="rounded-xl border border-[#DCE6DF] bg-white">
                  <summary className="cursor-pointer px-4 py-2.5 text-xs font-semibold text-[#141413]">
                    Thông số 6 đạo trình ▾
                  </summary>
                  <div
                    tabIndex={0}
                    role="region"
                    aria-label="Bảng thông số định lượng các đạo trình điện não 10-20"
                    className="overflow-x-auto border-t border-[#DCE6DF] focus-visible:outline-2 focus-visible:outline-[#16A34A]"
                  >
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#DCE6DF] bg-[#F5FAF7] text-[11px] font-semibold uppercase tracking-wider text-[#6E6D68]">
                          <th className="py-2 px-3">Đạo trình</th>
                          <th className="py-2 px-3">Vùng</th>
                          <th className="py-2 px-3">Dải tần</th>
                          <th className="py-2 px-3 text-right">Biên độ</th>
                          <th className="py-2 px-3 text-right">ERD/ERS</th>
                          <th className="py-2 px-3 text-right">Trở kháng</th>
                          <th className="py-2 px-3">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DCE6DF]">
                        {EEG_CHANNELS.map((ch) => (
                          <tr key={ch.name} className="hover:bg-[#F5FAF7]">
                            <td className="py-2 px-3 font-mono font-semibold text-[#141413]">{ch.name}</td>
                            <td className="py-2 px-3 text-[#575652]">{ch.region}</td>
                            <td className="py-2 px-3 font-mono text-[#575652]">{ch.freq}</td>
                            <td className="py-2 px-3 text-right font-mono font-semibold text-[#141413] tabular-nums">
                              {ch.peakUv}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-medium text-[#15803D] tabular-nums">
                              {ch.erdPercent}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-[#575652] tabular-nums">
                              {ch.impedance}
                            </td>
                            <td className="py-2 px-3 text-[#575652]">
                              {ch.clinicalStatus}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>

            {/* Right Sidebar: Single Consent & Info Card + Collapsed PSD & History */}
            <div className="lg:col-span-4 min-w-0 space-y-3">
              <Card className="p-4 border-[#DCE6DF] space-y-3">
                <div className="text-xs text-[#6E6D68] flex flex-wrap gap-x-2.5 gap-y-1 border-b border-[#DCE6DF] pb-2.5">
                  <span>{selectedRec.duration}</span>
                  <span>·</span>
                  <span className="font-mono">{selectedRec.samplingRate}</span>
                  <span>·</span>
                  <span className="font-mono">@{selectedRec.ownerUsername}</span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-[#141413]">
                    Bác sĩ được xem ({selectedRec.consentedProfessionals.length})
                  </h3>

                  {selectedRec.consentedProfessionals.length === 0 ? (
                    <p className="text-xs text-[#6E6D68]">Chưa chia sẻ (Riêng tư)</p>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedRec.consentedProfessionals.map((prof) => (
                        <div
                          key={prof.username}
                          className="flex items-center justify-between gap-2 rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] px-2.5 py-1.5 text-xs"
                        >
                          <span className="font-medium text-[#141413] truncate">{prof.displayName}</span>
                          {isOwnerOfSelected && (
                            <button
                              type="button"
                              disabled={consentBusy}
                              onClick={() => handleRevokeConsent(prof.username)}
                              className="inline-flex items-center gap-1 shrink-0 rounded border border-[#DCE6DF] bg-white px-2 py-0.5 text-[11px] font-medium text-[#575652] hover:text-red-700 hover:border-red-200 transition-colors"
                            >
                              <UserX className="size-3" aria-hidden />
                              <span>Thu hồi</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {isOwnerOfSelected && (
                  <div className="pt-2 border-t border-[#DCE6DF] space-y-2">
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 min-w-0">
                        <Input
                          id="consent-target-username"
                          value={consentTargetUsername}
                          onChange={(e) => setConsentTargetUsername(e.target.value)}
                          placeholder="Username bác sĩ..."
                          className="bg-white text-xs h-8"
                        />
                      </div>
                      <Button
                        type="button"
                        size="xs"
                        variant="primary"
                        loading={consentBusy}
                        onClick={() => handleGrantConsent(consentTargetUsername)}
                        className="h-8 px-3 whitespace-nowrap shrink-0"
                      >
                        Chia sẻ
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      {(['dr_minh', 'prof_lan', 'bs_noitru_khang'] as const).map((uname) => (
                        <button
                          key={uname}
                          type="button"
                          onClick={() => handleGrantConsent(uname)}
                          disabled={consentBusy}
                          className="rounded-md bg-[#EFF6F1] border border-[#DCE6DF] px-2 py-0.5 font-medium text-[#374151] hover:text-[#15803D] hover:bg-[#E2EFE6] transition-colors"
                        >
                          +{uname}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              <details className="rounded-xl border border-[#DCE6DF] bg-white">
                <summary className="list-none cursor-pointer px-4 py-2.5 text-xs font-medium text-[#575652] hover:text-[#141413] flex items-center justify-between">
                  <span>Phổ tần số &amp; Lịch sử truy cập ({selectedRec.accessHistory.length})</span>
                  <span aria-hidden>▾</span>
                </summary>
                <div className="px-4 pb-4 pt-2 border-t border-[#DCE6DF] space-y-4">
                  <div className="space-y-2 text-xs font-mono tabular-nums">
                    {[
                      { label: 'Delta (0.5–4 Hz)', pct: 14, bar: 'bg-[#8A8882]' },
                      { label: 'Theta (4–8 Hz)', pct: 22, bar: 'bg-[#575652]' },
                      { label: 'Alpha (8–13 Hz)', pct: 42, bar: 'bg-[#16A34A]' },
                      { label: 'Beta (13–30 Hz)', pct: 22, bar: 'bg-[#141413]' },
                    ].map((b) => (
                      <div key={b.label}>
                        <div className="flex justify-between text-[11px] font-medium text-[#575652] pb-1">
                          <span className="font-sans">{b.label}</span>
                          <span>{b.pct}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[#EFF6F1] overflow-hidden">
                          <div className={cn('h-full rounded-full', b.bar)} style={{ width: `${b.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5 border-t border-[#DCE6DF] pt-3">
                    {selectedRec.accessHistory.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] px-2.5 py-1.5 text-[11px] space-y-0.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-semibold text-[#141413]">{entry.action}</span>
                          <span className="font-mono text-[10px] text-[#6E6D68] tabular-nums">
                            {new Date(entry.timestamp).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        <p className="text-[#575652]">{entry.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Live Hardware Devices & Node-RED Center */}
      {activeTab === 'device' && (
        <HardwareDevicePanel isProfessional={isProfessional} />
      )}

      {/* TAB 4: Data Bank Marketplace */}
      {activeTab === 'databank' && (
        <DataBankMarketplacePanel isProfessional={isProfessional} />
      )}

      {/* TAB 5: Neural Network Training DB */}
      {activeTab === 'neural-db' && (
        <NeuralDatabasePanel isProfessional={isProfessional} />
      )}
    </div>
  );
}
