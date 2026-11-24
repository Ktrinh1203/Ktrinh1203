import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Coins,
  Database,
  Download,
  FileSpreadsheet,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  Unlock,
  X,
} from 'lucide-react';
import { dataBankApi, eegDatasetsApi, rewardsApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { ClinicalCategory, DataBankListingItem } from '../../api/types';
import { Alert, Button, Card, EmptyState, Input, Spinner, Textarea, cn } from '../../components/ui';
import { ProfessionalBadge } from '../../components/user/ProfessionalBadge';
import { useMode } from '../../context/ModeContext';
import { useAuth } from '../auth/AuthContext';
import {
  CLINICAL_CATEGORY_META,
  CLINICAL_CATEGORY_ORDER,
  triggerCsvDownload,
} from './eegLabels';

export interface DataBankMarketplacePanelProps {
  isProfessional?: boolean;
}

const SAMPLE_CSV_TEMPLATE = [
  'subject_code,channel_spec,sampling_hz,mean_dar,mean_bsi,mean_tar,mean_wpli,label',
  'NL_ANON_001,10-20_6CH,500,1.12,0.06,0.95,0.42,CONTROL',
  'NL_ANON_002,10-20_6CH,500,4.28,0.28,1.94,0.21,ISCHEMIC_STROKE',
].join('\n');

export function DataBankMarketplacePanel({ isProfessional = false }: DataBankMarketplacePanelProps) {
  const { user } = useAuth();
  const { isVerifiedHCP } = useMode();
  const queryClient = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState<ClinicalCategory | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmPurchaseId, setConfirmPurchaseId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Publish form state (Verified Professionals)
  const [showPublishForm, setShowPublishForm] = useState(false);
  const [title, setTitle] = useState('');
  const [clinicalCategory, setClinicalCategory] = useState<ClinicalCategory>('VASCULAR_STROKE');
  const [datasetId, setDatasetId] = useState('');
  const [summary, setSummary] = useState('');
  const [methodologyNote, setMethodologyNote] = useState('');
  const [sampleCount, setSampleCount] = useState('12');
  const [channelsSpec, setChannelsSpec] = useState('6 kênh 10-20 (F3,F4,C3,C4,O1,O2)');
  const [samplingRateHz, setSamplingRateHz] = useState('500');
  const [priceCredits, setPriceCredits] = useState('40');
  const [meanDar, setMeanDar] = useState('2.45');
  const [meanBsi, setMeanBsi] = useState('0.18');
  const [meanTar, setMeanTar] = useState('1.42');
  const [meanWpli, setMeanWpli] = useState('0.34');
  const [dominantBand, setDominantBand] = useState('Delta (0.5–4 Hz)');
  const [payloadCsv, setPayloadCsv] = useState(SAMPLE_CSV_TEMPLATE);

  const listingsQuery = useQuery({
    queryKey: ['databank-listings', categoryFilter, searchTerm.trim()],
    queryFn: () =>
      dataBankApi.list({
        clinicalCategory: categoryFilter === 'ALL' ? undefined : categoryFilter,
        q: searchTerm.trim() || undefined,
      }),
    enabled: Boolean(user),
  });

  const walletQuery = useQuery({
    queryKey: ['rewards-wallet', user?.id],
    queryFn: () => rewardsApi.getWallet(),
    enabled: Boolean(user),
  });

  const myDatasetsQuery = useQuery({
    queryKey: ['my-eeg-datasets-for-databank', user?.id],
    queryFn: () => eegDatasetsApi.getMyDatasets(),
    enabled: Boolean(user && isVerifiedHCP && showPublishForm),
  });

  const claimGrantMutation = useMutation({
    mutationFn: () => rewardsApi.claimOnboardingGrant(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['rewards-wallet'] });
      setFeedback({
        tone: res.granted ? 'success' : 'info',
        text: res.granted
          ? `Đã cộng +${res.amount} Credit Khởi đầu vào ví nghiên cứu của bạn (Số dư: ${res.wallet.balance} Credit).`
          : 'Tài khoản của bạn đã nhận gói credit khởi đầu trước đó.',
      });
    },
    onError: (err) => {
      setFeedback({ tone: 'error', text: errorMessage(err) });
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: (listingId: string) => dataBankApi.purchase(listingId),
    onSuccess: (res) => {
      setConfirmPurchaseId(null);
      queryClient.invalidateQueries({ queryKey: ['databank-listings'] });
      queryClient.invalidateQueries({ queryKey: ['rewards-wallet'] });
      setFeedback({
        tone: 'success',
        text: `Đã mở khóa "${res.listing.title}". Số dư còn lại: ${res.remainingBalance} Credit. Bạn có thể tải CSV ngay.`,
      });
    },
    onError: (err) => {
      setConfirmPurchaseId(null);
      setFeedback({ tone: 'error', text: errorMessage(err) });
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      dataBankApi.create({
        datasetId: datasetId || undefined,
        title: title.trim(),
        summary: summary.trim(),
        clinicalCategory,
        methodologyNote: methodologyNote.trim(),
        sampleCount: Math.max(1, Number(sampleCount) || 1),
        channelsSpec: channelsSpec.trim() || '6 kênh 10-20',
        samplingRateHz: Math.max(100, Number(samplingRateHz) || 500),
        priceCredits: Math.max(0, Number(priceCredits) || 0),
        previewMetrics: {
          meanDar: Number(meanDar) || 1.2,
          meanBsi: Number(meanBsi) || 0.08,
          meanTar: Number(meanTar) || 1.1,
          meanWpli: Number(meanWpli) || 0.35,
          dominantBand: dominantBand.trim() || 'Alpha (8–12 Hz)',
        },
        payloadCsv: payloadCsv.trim(),
      }),
    onSuccess: (res) => {
      setShowPublishForm(false);
      setTitle('');
      setSummary('');
      setMethodologyNote('');
      queryClient.invalidateQueries({ queryKey: ['databank-listings'] });
      setFeedback({
        tone: 'success',
        text: `Đã công bố bộ dữ liệu "${res.listing.title}" lên Kho dữ liệu.`,
      });
    },
    onError: (err) => {
      setFeedback({ tone: 'error', text: errorMessage(err) });
    },
  });

  const handleDownloadCsv = async (listing: DataBankListingItem) => {
    setDownloadingId(listing.id);
    setFeedback(null);
    try {
      let csv = listing.payloadCsv;
      if (!csv) {
        const detail = await dataBankApi.getById(listing.id);
        csv = detail.listing.payloadCsv ?? null;
      }
      if (!csv) {
        setFeedback({
          tone: 'error',
          text: 'Dữ liệu CSV đang được khóa hoặc chưa có nội dung tải về.',
        });
        return;
      }
      triggerCsvDownload(`neurolink-databank-${listing.id.slice(0, 8)}.csv`, csv);
      setFeedback({
        tone: 'success',
        text: `Đã tải xuống tệp dữ liệu CSV của "${listing.title}".`,
      });
    } catch (err) {
      setFeedback({ tone: 'error', text: errorMessage(err) });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCsvFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setPayloadCsv(text.slice(0, 120_000));
  };

  const handlePublishSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 5 || summary.trim().length < 10 || !payloadCsv.trim()) {
      setFeedback({
        tone: 'error',
        text: 'Vui lòng nhập đầy đủ tiêu đề (>=5 ký tự), tóm tắt (>=10 ký tự) và nội dung CSV.',
      });
      return;
    }
    createMutation.mutate();
  };

  const wallet = walletQuery.data?.wallet;
  const listings = listingsQuery.data?.listings ?? [];

  return (
    <div className="space-y-5">
      {/* Header & Wallet Strip */}
      <Card
        className={cn(
          'p-4 space-y-3',
          isProfessional ? 'border-slate-300' : 'border-teal-200/80',
        )}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database
              className={cn('size-5', isProfessional ? 'text-[#1E3A5F]' : 'text-teal-700')}
              aria-hidden
            />
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Kho dữ liệu
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 flex items-center gap-2">
              <Coins className="size-4 text-amber-600" aria-hidden />
              <div className="leading-tight">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Số dư
                </span>
                <span className="font-mono text-sm font-extrabold text-slate-900 tabular-nums">
                  {wallet ? `${wallet.balance} Credit` : '—'}
                </span>
              </div>
            </div>

            {wallet && wallet.balance === 0 && (
              <Button
                type="button"
                size="sm"
                variant="accent"
                loading={claimGrantMutation.isPending}
                onClick={() => claimGrantMutation.mutate()}
                icon={<Coins className="size-3.5" aria-hidden />}
              >
                Nhận 250 credit
              </Button>
            )}

            {isVerifiedHCP && (
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => setShowPublishForm(true)}
                icon={<Plus className="size-3.5" aria-hidden />}
              >
                Đóng góp dữ liệu
              </Button>
            )}
          </div>
        </div>

        {/* Category Filters & Search */}
        <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Lọc theo nhóm bệnh lý">
            <button
              type="button"
              aria-pressed={categoryFilter === 'ALL'}
              onClick={() => setCategoryFilter('ALL')}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors border',
                categoryFilter === 'ALL'
                  ? isProfessional
                    ? 'bg-[#162B47] text-white border-[#162B47]'
                    : 'bg-teal-700 text-white border-teal-700'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
              )}
            >
              Tất cả
            </button>
            {CLINICAL_CATEGORY_ORDER.map((cat) => (
              <button
                key={cat}
                type="button"
                aria-pressed={categoryFilter === cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors border',
                  categoryFilter === cat
                    ? isProfessional
                      ? 'bg-[#162B47] text-white border-[#162B47]'
                      : 'bg-teal-700 text-white border-teal-700'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
                )}
              >
                {CLINICAL_CATEGORY_META[cat].shortLabel}
              </button>
            ))}
          </div>

          <div className="w-full md:w-72">
            <label htmlFor="databank-search" className="sr-only">
              Tìm bộ dữ liệu EEG
            </label>
            <div className="relative">
              <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden />
              <Input
                id="databank-search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm bộ dữ liệu, tác giả..."
                className="pl-9 bg-white"
              />
            </div>
          </div>
        </div>
      </Card>

      {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}

      {/* Publish New Dataset Modal (Verified Professionals Only) */}
      {showPublishForm && isVerifiedHCP && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="databank-publish-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPublishForm(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-300 bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-teal-700 shrink-0" aria-hidden />
                <h3 id="databank-publish-modal-title" className="text-sm font-bold text-slate-900">
                  Đóng góp bộ dữ liệu EEG mới
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPublishForm(false)}
                aria-label="Đóng hộp thoại đóng góp dữ liệu"
                className="rounded-md p-1 text-slate-500 hover:bg-slate-200/70 hover:text-slate-900"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <form onSubmit={handlePublishSubmit} className="p-5 grid gap-3 sm:grid-cols-6 text-xs">
              <div className="sm:col-span-4 space-y-1">
                <label htmlFor="db-pub-title" className="font-bold text-slate-700 block">
                  Tiêu đề Bộ dữ liệu *
                </label>
                <Input
                  id="db-pub-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: 24 ca Thiếu máu não LVO (ADS1299 500Hz)"
                  className="bg-white"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label htmlFor="db-pub-cat" className="font-bold text-slate-700 block">
                  Nhóm Chuyên khoa *
                </label>
                <select
                  id="db-pub-cat"
                  value={clinicalCategory}
                  onChange={(e) => setClinicalCategory(e.target.value as ClinicalCategory)}
                  className="h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                >
                  {CLINICAL_CATEGORY_ORDER.map((cat) => (
                    <option key={cat} value={cat}>
                      {CLINICAL_CATEGORY_META[cat].label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3 space-y-1">
                <label htmlFor="db-pub-summary" className="font-bold text-slate-700 block">
                  Tóm tắt Lâm sàng *
                </label>
                <Textarea
                  id="db-pub-summary"
                  rows={2}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Tiêu chuẩn chọn mẫu, đã ẩn danh cá nhân..."
                  className="bg-white"
                />
              </div>

              <div className="sm:col-span-3 space-y-1">
                <label htmlFor="db-pub-method" className="font-bold text-slate-700 block">
                  Phương pháp xử lý tín hiệu *
                </label>
                <Textarea
                  id="db-pub-method"
                  rows={2}
                  value={methodologyNote}
                  onChange={(e) => setMethodologyNote(e.target.value)}
                  placeholder="Bandpass 0.5-45 Hz, Notch 50 Hz..."
                  className="bg-white"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label htmlFor="db-pub-channels" className="font-bold text-slate-700 block">
                  Cấu hình Đạo trình
                </label>
                <Input
                  id="db-pub-channels"
                  value={channelsSpec}
                  onChange={(e) => setChannelsSpec(e.target.value)}
                  className="bg-white"
                />
              </div>

              <div className="sm:col-span-1 space-y-1">
                <label htmlFor="db-pub-samples" className="font-bold text-slate-700 block">
                  Số mẫu
                </label>
                <Input
                  id="db-pub-samples"
                  type="number"
                  min={1}
                  value={sampleCount}
                  onChange={(e) => setSampleCount(e.target.value)}
                  className="bg-white font-mono"
                />
              </div>

              <div className="sm:col-span-1 space-y-1">
                <label htmlFor="db-pub-hz" className="font-bold text-slate-700 block">
                  Tần số (Hz)
                </label>
                <Input
                  id="db-pub-hz"
                  type="number"
                  min={100}
                  value={samplingRateHz}
                  onChange={(e) => setSamplingRateHz(e.target.value)}
                  className="bg-white font-mono"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label htmlFor="db-pub-price" className="font-bold text-slate-700 block">
                  Phí mở khóa (Credit · 0 = Free)
                </label>
                <Input
                  id="db-pub-price"
                  type="number"
                  min={0}
                  value={priceCredits}
                  onChange={(e) => setPriceCredits(e.target.value)}
                  className="bg-white font-mono"
                />
              </div>

              {/* Preview metrics row */}
              <div className="sm:col-span-1 space-y-1">
                <label htmlFor="db-pub-dar" className="font-bold text-slate-700 block">
                  Mean DAR
                </label>
                <Input
                  id="db-pub-dar"
                  type="number"
                  step="0.01"
                  value={meanDar}
                  onChange={(e) => setMeanDar(e.target.value)}
                  className="bg-white font-mono"
                />
              </div>

              <div className="sm:col-span-1 space-y-1">
                <label htmlFor="db-pub-bsi" className="font-bold text-slate-700 block">
                  Mean BSI
                </label>
                <Input
                  id="db-pub-bsi"
                  type="number"
                  step="0.001"
                  value={meanBsi}
                  onChange={(e) => setMeanBsi(e.target.value)}
                  className="bg-white font-mono"
                />
              </div>

              <div className="sm:col-span-1 space-y-1">
                <label htmlFor="db-pub-tar" className="font-bold text-slate-700 block">
                  Mean TAR
                </label>
                <Input
                  id="db-pub-tar"
                  type="number"
                  step="0.01"
                  value={meanTar}
                  onChange={(e) => setMeanTar(e.target.value)}
                  className="bg-white font-mono"
                />
              </div>

              <div className="sm:col-span-1 space-y-1">
                <label htmlFor="db-pub-wpli" className="font-bold text-slate-700 block">
                  Mean wPLI
                </label>
                <Input
                  id="db-pub-wpli"
                  type="number"
                  step="0.01"
                  value={meanWpli}
                  onChange={(e) => setMeanWpli(e.target.value)}
                  className="bg-white font-mono"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label htmlFor="db-pub-band" className="font-bold text-slate-700 block">
                  Dải tần Ưu thế
                </label>
                <Input
                  id="db-pub-band"
                  value={dominantBand}
                  onChange={(e) => setDominantBand(e.target.value)}
                  className="bg-white"
                />
              </div>

              {myDatasetsQuery.data?.datasets && myDatasetsQuery.data.datasets.length > 0 && (
                <div className="sm:col-span-6 space-y-1">
                  <label htmlFor="db-pub-dataset" className="font-bold text-slate-700 block">
                    Liên kết Bản ghi EEG Cá nhân (tùy chọn)
                  </label>
                  <select
                    id="db-pub-dataset"
                    value={datasetId}
                    onChange={(e) => setDatasetId(e.target.value)}
                    className="h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  >
                    <option value="">-- Không liên kết --</option>
                    {myDatasetsQuery.data.datasets.map((ds) => (
                      <option key={ds.id} value={ds.id}>
                        {ds.patientCode} · {ds.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="sm:col-span-6 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="db-pub-csv" className="font-bold text-slate-700">
                    Nội dung CSV (Đã ẩn danh cá nhân) *
                  </label>
                  <label
                    htmlFor="db-pub-csv-file"
                    className="cursor-pointer inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <FileSpreadsheet className="size-3.5" aria-hidden />
                    <span>Nạp tệp .CSV</span>
                    <input
                      id="db-pub-csv-file"
                      type="file"
                      accept=".csv,.txt"
                      className="sr-only"
                      onChange={handleCsvFileUpload}
                    />
                  </label>
                </div>
                <Textarea
                  id="db-pub-csv"
                  rows={4}
                  value={payloadCsv}
                  onChange={(e) => setPayloadCsv(e.target.value)}
                  className="bg-white font-mono text-xs"
                />
              </div>

              <div className="sm:col-span-6 flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" size="sm" variant="outline" onClick={() => setShowPublishForm(false)}>
                  Hủy
                </Button>
                <Button type="submit" size="sm" loading={createMutation.isPending}>
                  Đăng dữ liệu
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Listings Grid */}
      {listingsQuery.isLoading ? (
        <Spinner label="Đang tải danh mục Kho Dữ liệu Nghiên cứu..." />
      ) : listingsQuery.isError ? (
        <Alert tone="error">{errorMessage(listingsQuery.error)}</Alert>
      ) : listings.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Database className="size-6" />}
            title="Chưa có bộ dữ liệu phù hợp"
            description="Thử chuyển bộ lọc chuyên khoa khác hoặc tìm kiếm bằng từ khóa rộng hơn."
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {listings.map((item) => {
            const catMeta = CLINICAL_CATEGORY_META[item.clinicalCategory];
            const isFree = item.priceCredits === 0;
            const unlocked = item.hasAccess || item.isAuthor || isFree;
            const isConfirming = confirmPurchaseId === item.id;
            const insufficientCredits =
              !unlocked && wallet !== undefined && wallet.balance < item.priceCredits;

            return (
              <Card
                key={item.id}
                className={cn(
                  'p-5 flex flex-col justify-between gap-4',
                  isProfessional ? 'border-slate-300' : 'border-slate-200/90',
                )}
              >
                <div className="space-y-3">
                  {/* Top Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-bold',
                        catMeta.badgeCls,
                      )}
                    >
                      {catMeta.label}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-xs font-mono font-bold tabular-nums',
                        isFree
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : unlocked
                            ? 'bg-teal-50 text-teal-800 border-teal-200'
                            : 'bg-amber-50 text-amber-900 border-amber-200',
                      )}
                    >
                      {isFree ? (
                        'Miễn phí mở'
                      ) : unlocked ? (
                        <>
                          <Unlock className="size-3" aria-hidden /> Đã mở khóa ({item.priceCredits} Credit)
                        </>
                      ) : (
                        <>
                          <Lock className="size-3" aria-hidden /> {item.priceCredits} Credit
                        </>
                      )}
                    </span>
                  </div>

                  {/* Title & Author */}
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                      {item.title}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">{item.author.displayName}</span>
                      <span className="font-mono text-[11px] text-slate-400">@{item.author.username}</span>
                      {item.author.professionalProfiles[0] && (
                        <ProfessionalBadge
                          type={item.author.professionalProfiles[0].type}
                          status={item.author.professionalProfiles[0].verificationStatus}
                          compact
                        />
                      )}
                    </div>
                  </div>

                  {/* Summary & Methodology */}
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{item.summary}</p>
                  <div className="rounded-md bg-slate-50 border border-slate-200/80 px-3 py-2 text-[11px] text-slate-600 line-clamp-2">
                    <strong className="text-slate-800">Xử lý tín hiệu: </strong>
                    {item.methodologyNote}
                  </div>

                  {/* Specs + Open Preview Biomarkers */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono tabular-nums">
                    <div className="rounded border border-slate-200 bg-white px-2.5 py-1.5">
                      <span className="block text-[10px] text-slate-400 font-sans">Mean DAR</span>
                      <strong className="text-slate-900">{item.previewMetrics.meanDar.toFixed(2)}</strong>
                    </div>
                    <div className="rounded border border-slate-200 bg-white px-2.5 py-1.5">
                      <span className="block text-[10px] text-slate-400 font-sans">Mean BSI</span>
                      <strong className="text-slate-900">{item.previewMetrics.meanBsi.toFixed(3)}</strong>
                    </div>
                    <div className="rounded border border-slate-200 bg-white px-2.5 py-1.5">
                      <span className="block text-[10px] text-slate-400 font-sans">Mean TAR</span>
                      <strong className="text-slate-900">{item.previewMetrics.meanTar.toFixed(2)}</strong>
                    </div>
                    <div className="rounded border border-slate-200 bg-white px-2.5 py-1.5">
                      <span className="block text-[10px] text-slate-400 font-sans">wPLI</span>
                      <strong className="text-slate-900">{item.previewMetrics.meanWpli.toFixed(2)}</strong>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 font-mono tabular-nums">
                    <span>{item.sampleCount} mẫu</span>
                    <span>{item.channelsSpec}</span>
                    <span>{item.samplingRateHz} Hz</span>
                    <span>Ưu thế: {item.previewMetrics.dominantBand}</span>
                    <span>{item.downloadsCount} lượt tải</span>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  {unlocked ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                        <CheckCircle2 className="size-3.5" aria-hidden />
                        {item.isAuthor ? 'Của bạn' : isFree ? 'Miễn phí' : 'Đã mở khóa'}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="accent"
                        loading={downloadingId === item.id}
                        onClick={() => handleDownloadCsv(item)}
                        icon={<Download className="size-3.5" aria-hidden />}
                      >
                        Tải CSV
                      </Button>
                    </div>
                  ) : isConfirming ? (
                    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2 text-xs">
                      <p className="font-semibold text-amber-950">
                        Mở khóa với <span className="font-mono font-bold">{item.priceCredits} Credit</span>? (Số dư:{' '}
                        <span className="font-mono font-bold">{wallet?.balance ?? 0}</span> Credit)
                      </p>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => setConfirmPurchaseId(null)}
                        >
                          Hủy
                        </Button>
                        {insufficientCredits && wallet?.balance === 0 ? (
                          <Button
                            type="button"
                            size="xs"
                            variant="accent"
                            loading={claimGrantMutation.isPending}
                            onClick={() => claimGrantMutation.mutate()}
                          >
                            Nhận 250 credit
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="xs"
                            variant="primary"
                            disabled={insufficientCredits}
                            loading={purchaseMutation.isPending}
                            onClick={() => purchaseMutation.mutate(item.id)}
                          >
                            Xác nhận mở khóa
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-500">Mở khóa để tải CSV</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={() => setConfirmPurchaseId(item.id)}
                        icon={<Unlock className="size-3.5" aria-hidden />}
                      >
                        Mở khóa ({item.priceCredits} Credit)
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
