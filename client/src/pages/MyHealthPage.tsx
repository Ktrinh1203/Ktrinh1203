import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Brain,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Circle,
  MessageSquarePlus,
  Plus,
  Trash2,
} from 'lucide-react';
import { eegDatasetsApi, neuralDbApi, selfServiceApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import type { WorkBlockType, WorkingPlanBlockItem } from '../api/types';
import { Alert, Button, Card, Input, Spinner, Textarea, cn } from '../components/ui';
import { useMode } from '../context/ModeContext';
import { useAuth } from '../features/auth/AuthContext';
import { PhysiologicalTrendChart } from '../features/eeg/PhysiologicalTrendChart';
import { WORK_BLOCK_META, WORK_BLOCK_ORDER } from '../features/eeg/eegLabels';

const DAYS_OF_WEEK = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

const MOOD_PRESETS = [
  { label: 'Tỉnh táo', focus: '88', stress: '2', tar: '1.02' },
  { label: 'Bình thường', focus: '75', stress: '4', tar: '1.22' },
  { label: 'Mệt mỏi', focus: '52', stress: '7', tar: '1.68' },
] as const;

const SLEEP_PRESETS = [
  { label: '5.5h', value: '5.5' },
  { label: '6.5h', value: '6.5' },
  { label: '7.5h', value: '7.5' },
  { label: '8h+', value: '8' },
] as const;

export function MyHealthPage() {
  const { user } = useAuth();
  const { isProfessional } = useMode();
  const queryClient = useQueryClient();

  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const [showCheckIn, setShowCheckIn] = useState(true);

  // Check-in Form State
  const [focusScore, setFocusScore] = useState('82');
  const [fatigueIndexTar, setFatigueIndexTar] = useState('1.15');
  const [hemisphericBsi, setHemisphericBsi] = useState('0.07');
  const [alphaPeakHz, setAlphaPeakHz] = useState('10.2');
  const [sleepHours, setSleepHours] = useState('7.5');
  const [stressLevel, setStressLevel] = useState('3');
  const [neuralSampleId, setNeuralSampleId] = useState('');
  const [notes, setNotes] = useState('');

  // Working Plan CRUD State
  const [dayFilter, setDayFilter] = useState<string>('ALL');
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [blockDay, setBlockDay] = useState('Thứ 2');
  const [blockSlot, setBlockSlot] = useState('08:30 - 10:30');
  const [blockTitle, setBlockTitle] = useState('');
  const [blockType, setBlockType] = useState<WorkBlockType>('DEEP_WORK');
  const [blockRationale, setBlockRationale] = useState(WORK_BLOCK_META.DEEP_WORK.defaultRationale);

  const overviewQuery = useQuery({
    queryKey: ['self-service-overview', user?.id],
    queryFn: () => selfServiceApi.getOverview(),
    enabled: Boolean(user),
  });

  const myEegQuery = useQuery({
    queryKey: ['my-eeg-health-summary', user?.id],
    queryFn: () => eegDatasetsApi.getMyDatasets(),
    enabled: Boolean(user),
  });

  const samplesQuery = useQuery({
    queryKey: ['neural-db-samples-for-checkin'],
    queryFn: () => neuralDbApi.listSamples(),
    enabled: Boolean(user),
  });

  const addCheckInMutation = useMutation({
    mutationFn: (payload: {
      neuralSampleId?: string;
      focusScore: number;
      fatigueIndexTar: number;
      hemisphericBsi: number;
      alphaPeakHz: number;
      sleepHours: number;
      stressLevel: number;
      notes: string;
    }) => selfServiceApi.addCheckIn(payload),
    onSuccess: () => {
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['self-service-overview'] });
      setFeedback({
        tone: 'success',
        text: isProfessional
          ? 'Đã lưu nhật ký sinh lý thần kinh hôm nay và cập nhật biểu đồ xu hướng.'
          : 'Đã lưu nhật ký hôm nay.',
      });
    },
    onError: (err) => {
      setFeedback({ tone: 'error', text: errorMessage(err) });
    },
  });

  const addWorkBlockMutation = useMutation({
    mutationFn: () =>
      selfServiceApi.addWorkBlock({
        dayOfWeek: blockDay,
        timeSlot: blockSlot.trim() || '09:00 - 10:30',
        title: blockTitle.trim(),
        blockType,
        eegRationale: isProfessional
          ? blockRationale.trim() || WORK_BLOCK_META[blockType].defaultRationale
          : WORK_BLOCK_META[blockType].defaultRationale,
      }),
    onSuccess: () => {
      setShowAddBlock(false);
      setBlockTitle('');
      queryClient.invalidateQueries({ queryKey: ['self-service-overview'] });
      setFeedback({
        tone: 'success',
        text: isProfessional
          ? 'Đã thêm khối lịch làm việc & phục hồi theo nhịp sóng não.'
          : 'Đã thêm lịch mới vào kế hoạch trong ngày của bạn.',
      });
    },
    onError: (err) => {
      setFeedback({ tone: 'error', text: errorMessage(err) });
    },
  });

  const toggleBlockMutation = useMutation({
    mutationFn: (block: WorkingPlanBlockItem) =>
      selfServiceApi.updateWorkBlock(block.id, { completed: !block.completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['self-service-overview'] });
    },
    onError: (err) => {
      setFeedback({ tone: 'error', text: errorMessage(err) });
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: (id: string) => selfServiceApi.deleteWorkBlock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['self-service-overview'] });
      setFeedback({
        tone: 'success',
        text: 'Đã xóa khối lịch khỏi kế hoạch tuần.',
      });
    },
    onError: (err) => {
      setFeedback({ tone: 'error', text: errorMessage(err) });
    },
  });

  const checkIns = overviewQuery.data?.checkIns ?? [];
  const workPlan = overviewQuery.data?.workPlan ?? [];
  const myDatasets = myEegQuery.data?.datasets ?? [];
  const latestDataset = myDatasets[0];
  const latestCheckIn = checkIns[0];
  const summaryStats = useMemo(() => {
    if (checkIns.length === 0) {
      return {
        focus: 82,
        tar: 1.15,
        bsi: 0.07,
        sleep: 7.5,
      };
    }
    const n = checkIns.length;
    return {
      focus: Math.round(checkIns.reduce((s, c) => s + c.focusScore, 0) / n),
      tar: checkIns.reduce((s, c) => s + c.fatigueIndexTar, 0) / n,
      bsi: checkIns.reduce((s, c) => s + c.hemisphericBsi, 0) / n,
      sleep: checkIns.reduce((s, c) => s + c.sleepHours, 0) / n,
    };
  }, [checkIns]);

  const availableDays = useMemo(() => {
    const set = new Set<string>(DAYS_OF_WEEK);
    workPlan.forEach((b) => {
      if (b.dayOfWeek) set.add(b.dayOfWeek);
    });
    return Array.from(set);
  }, [workPlan]);

  const filteredBlocks = useMemo(() => {
    if (dayFilter === 'ALL') return workPlan;
    return workPlan.filter((b) => b.dayOfWeek === dayFilter);
  }, [workPlan, dayFilter]);

  const completedCount = workPlan.filter((b) => b.completed).length;

  const handleSampleChange = (sampleId: string) => {
    setNeuralSampleId(sampleId);
    const found = samplesQuery.data?.samples.find((s) => s.id === sampleId);
    if (found) {
      setFatigueIndexTar(found.tar.toFixed(2));
      setHemisphericBsi(found.bsi.toFixed(3));
    }
  };

  const handleBlockTypeChange = (nextType: WorkBlockType) => {
    setBlockType(nextType);
    setBlockRationale(WORK_BLOCK_META[nextType].defaultRationale);
  };

  const handleCheckInSubmit = (e: FormEvent) => {
    e.preventDefault();
    addCheckInMutation.mutate({
      neuralSampleId: neuralSampleId || undefined,
      focusScore: Math.max(0, Math.min(100, Math.round(Number(focusScore) || 75))),
      fatigueIndexTar: Math.max(0.1, Number(fatigueIndexTar) || 1.1),
      hemisphericBsi: Math.max(0, Number(hemisphericBsi) || 0.06),
      alphaPeakHz: Math.max(5, Math.min(16, Number(alphaPeakHz) || 10.0)),
      sleepHours: Math.max(0, Math.min(16, Number(sleepHours) || 7.5)),
      stressLevel: Math.max(1, Math.min(10, Math.round(Number(stressLevel) || 3))),
      notes: notes.trim() || 'Theo dõi sinh lý thần kinh hàng ngày.',
    });
  };

  const handleAddBlockSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (blockTitle.trim().length < 3) {
      setFeedback({
        tone: 'error',
        text: 'Vui lòng nhập tiêu đề khối công việc tối thiểu 3 ký tự.',
      });
      return;
    }
    addWorkBlockMutation.mutate();
  };

  return (
    <div className={isProfessional ? 'space-y-5' : 'mx-auto max-w-6xl space-y-6'}>
      {/* Header Banner */}
      {isProfessional ? (
        <section className="rounded-xl border border-[#DCE6DF] bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-[#DCE6DF] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#141413]">
                Nhật ký sức khỏe
              </h1>
              <span className="text-xs font-medium text-[#6E6D68]">
                · {user?.displayName || 'Thành viên'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Link to="/eeg-hub">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  icon={<Brain className="size-3.5 text-[#16A34A]" aria-hidden />}
                >
                  Đo sóng não
                </Button>
              </Link>
              <Link to="/consultations">
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  className="text-xs"
                  icon={<MessageSquarePlus className="size-3.5" aria-hidden />}
                >
                  Hỏi bác sĩ
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#DCE6DF] bg-[#F5FAF7] text-xs font-mono tabular-nums">
            <div className="px-4 py-2.5 flex items-center justify-between">
              <span className="font-sans font-medium text-[#6E6D68]">Focus TB</span>
              <strong className="text-[#141413]">{summaryStats.focus}/100</strong>
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between">
              <span className="font-sans font-medium text-[#6E6D68]">TAR TB</span>
              <strong className={summaryStats.tar > 1.5 ? 'text-amber-700' : 'text-[#141413]'}>
                {summaryStats.tar.toFixed(2)}
              </strong>
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between">
              <span className="font-sans font-medium text-[#6E6D68]">BSI TB</span>
              <strong className={summaryStats.bsi > 0.15 ? 'text-red-700' : 'text-[#141413]'}>
                {summaryStats.bsi.toFixed(3)}
              </strong>
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between">
              <span className="font-sans font-medium text-[#6E6D68]">Giấc ngủ TB</span>
              <strong className="text-[#141413]">{summaryStats.sleep.toFixed(1)} giờ</strong>
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          {/* Top header row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h1 className="text-lg sm:text-xl font-bold text-[#141413] tracking-tight">
              Nhật ký sức khỏe
            </h1>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                type="button"
                size="sm"
                variant={showCheckIn ? 'secondary' : 'primary'}
                onClick={() => setShowCheckIn((v) => !v)}
                icon={<Plus className="size-4" aria-hidden />}
              >
                {showCheckIn ? 'Đóng' : 'Ghi nhận'}
              </Button>
              <Link to="/consultations?ask=1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  icon={<MessageSquarePlus className="size-4 text-[#16A34A]" aria-hidden />}
                >
                  Hỏi Bác sĩ
                </Button>
              </Link>
            </div>
          </div>

          {/* Single 3-Column Typographic KPI Strip */}
          {(() => {
            const focusVal = latestCheckIn ? latestCheckIn.focusScore : summaryStats.focus;
            const sleepVal = latestCheckIn ? latestCheckIn.sleepHours : summaryStats.sleep;
            const needsRest = summaryStats.tar > 1.5 || summaryStats.bsi > 0.15;
            return (
              <div className="rounded-xl border border-[#DCE6DF] bg-white grid grid-cols-3 divide-x divide-[#DCE6DF]">
                <div className="px-4 py-3.5">
                  <span className="block text-xs text-[#6E6D68]">Tỉnh táo</span>
                  <span className="mt-0.5 block font-mono text-xl sm:text-2xl font-semibold text-[#141413] tabular-nums">
                    {focusVal}/100
                  </span>
                </div>

                <div className="px-4 py-3.5">
                  <span className="block text-xs text-[#6E6D68]">Giấc ngủ</span>
                  <span className="mt-0.5 block font-mono text-xl sm:text-2xl font-semibold text-[#141413] tabular-nums">
                    {sleepVal.toFixed(1)}h
                  </span>
                </div>

                <div className="px-4 py-3.5">
                  <span className="block text-xs text-[#6E6D68]">Trạng thái</span>
                  <span
                    className={cn(
                      'mt-0.5 block text-xl sm:text-2xl font-semibold tabular-nums',
                      needsRest ? 'text-amber-700' : 'text-[#141413]',
                    )}
                  >
                    {needsRest ? 'Cần nghỉ ngơi' : 'Ổn định'}
                  </span>
                </div>
              </div>
            );
          })()}
        </section>
      )}

      {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}

      {overviewQuery.isLoading ? (
        <Spinner label="Đang tải dữ liệu theo dõi sinh lý & kế hoạch tuần..." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 8 Columns: Trends, Check-in Form, Working Plan CRUD */}
          <div className="lg:col-span-8 min-w-0 space-y-6">
            {(() => {
              const detailedNumericFields = (
                <>
                  <div className="space-y-1">
                    <label htmlFor="mh-focus" className="font-semibold text-[#262624] block">
                      Tập trung (0–100)
                    </label>
                    <Input
                      id="mh-focus"
                      type="number"
                      min={0}
                      max={100}
                      value={focusScore}
                      onChange={(e) => setFocusScore(e.target.value)}
                      className="bg-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="mh-sleep" className="font-semibold text-[#262624] block">
                      Giấc ngủ (giờ)
                    </label>
                    <Input
                      id="mh-sleep"
                      type="number"
                      step="0.5"
                      min={0}
                      max={16}
                      value={sleepHours}
                      onChange={(e) => setSleepHours(e.target.value)}
                      className="bg-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="mh-stress" className="font-semibold text-[#262624] block">
                      Căng thẳng (1–10)
                    </label>
                    <Input
                      id="mh-stress"
                      type="number"
                      min={1}
                      max={10}
                      value={stressLevel}
                      onChange={(e) => setStressLevel(e.target.value)}
                      className="bg-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="mh-tar" className="font-bold text-slate-700 block">
                      TAR
                    </label>
                    <Input
                      id="mh-tar"
                      type="number"
                      step="0.01"
                      min={0.1}
                      max={8}
                      value={fatigueIndexTar}
                      onChange={(e) => setFatigueIndexTar(e.target.value)}
                      className="bg-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="mh-bsi" className="font-bold text-slate-700 block">
                      BSI
                    </label>
                    <Input
                      id="mh-bsi"
                      type="number"
                      step="0.001"
                      min={0}
                      max={1}
                      value={hemisphericBsi}
                      onChange={(e) => setHemisphericBsi(e.target.value)}
                      className="bg-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="mh-alpha" className="font-bold text-slate-700 block">
                      Alpha (Hz)
                    </label>
                    <Input
                      id="mh-alpha"
                      type="number"
                      step="0.1"
                      min={5}
                      max={15}
                      value={alphaPeakHz}
                      onChange={(e) => setAlphaPeakHz(e.target.value)}
                      className="bg-white font-mono"
                    />
                  </div>

                  {samplesQuery.data?.samples && samplesQuery.data.samples.length > 0 && (
                    <div className="sm:col-span-3 space-y-1">
                      <label htmlFor="mh-sample-link" className="font-bold text-slate-700 block">
                        Mẫu CSDL
                      </label>
                      <select
                        id="mh-sample-link"
                        value={neuralSampleId}
                        onChange={(e) => handleSampleChange(e.target.value)}
                        className="h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900"
                      >
                        <option value="">-- Nhập thủ công --</option>
                        {samplesQuery.data.samples.slice(0, 12).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.subjectCode} · TAR {s.tar.toFixed(2)} · BSI {s.bsi.toFixed(3)} ({s.clinicalCategory})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              );

              const checkInFormSection = isProfessional ? (
                <form onSubmit={handleCheckInSubmit} className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div className="space-y-1">
                    <label htmlFor="mh-focus" className="font-semibold text-[#262624] block">
                      Tập trung (0–100)
                    </label>
                    <Input
                      id="mh-focus"
                      type="number"
                      min={0}
                      max={100}
                      value={focusScore}
                      onChange={(e) => setFocusScore(e.target.value)}
                      className="bg-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="mh-sleep" className="font-semibold text-[#262624] block">
                      Giấc ngủ (giờ)
                    </label>
                    <Input
                      id="mh-sleep"
                      type="number"
                      step="0.5"
                      min={0}
                      max={16}
                      value={sleepHours}
                      onChange={(e) => setSleepHours(e.target.value)}
                      className="bg-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="mh-stress" className="font-semibold text-[#262624] block">
                      Căng thẳng (1–10)
                    </label>
                    <Input
                      id="mh-stress"
                      type="number"
                      min={1}
                      max={10}
                      value={stressLevel}
                      onChange={(e) => setStressLevel(e.target.value)}
                      className="bg-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="mh-notes" className="font-semibold text-[#262624] block">
                      Ghi chú
                    </label>
                    <Input
                      id="mh-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Cảm nhận hôm nay..."
                      className="bg-white"
                    />
                  </div>

                  <details className="sm:col-span-2 rounded-lg border border-[#DCE6DF] bg-[#F5FAF7]">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-[#575652] hover:text-[#141413] rounded-lg">
                      Thông số máy đo ▾
                    </summary>
                    <div className="px-3 pb-3 pt-2 grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <label htmlFor="mh-tar" className="font-semibold text-[#262624] block">
                          TAR
                        </label>
                        <Input
                          id="mh-tar"
                          type="number"
                          step="0.01"
                          min={0.1}
                          max={8}
                          value={fatigueIndexTar}
                          onChange={(e) => setFatigueIndexTar(e.target.value)}
                          className="bg-white font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="mh-bsi" className="font-semibold text-[#262624] block">
                          BSI
                        </label>
                        <Input
                          id="mh-bsi"
                          type="number"
                          step="0.001"
                          min={0}
                          max={1}
                          value={hemisphericBsi}
                          onChange={(e) => setHemisphericBsi(e.target.value)}
                          className="bg-white font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="mh-alpha" className="font-semibold text-[#262624] block">
                          Alpha (Hz)
                        </label>
                        <Input
                          id="mh-alpha"
                          type="number"
                          step="0.1"
                          min={5}
                          max={15}
                          value={alphaPeakHz}
                          onChange={(e) => setAlphaPeakHz(e.target.value)}
                          className="bg-white font-mono"
                        />
                      </div>

                      {samplesQuery.data?.samples && samplesQuery.data.samples.length > 0 && (
                        <div className="sm:col-span-3 space-y-1">
                          <label htmlFor="mh-sample-link" className="font-semibold text-[#262624] block">
                            Chọn mẫu EEG
                          </label>
                          <select
                            id="mh-sample-link"
                            value={neuralSampleId}
                            onChange={(e) => handleSampleChange(e.target.value)}
                            className="h-9.5 w-full rounded-lg border border-[#DCE6DF] bg-white px-3 text-xs text-[#141413]"
                          >
                            <option value="">-- Nhập thủ công --</option>
                            {samplesQuery.data.samples.slice(0, 12).map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.subjectCode} · TAR {s.tar.toFixed(2)} · BSI {s.bsi.toFixed(3)} ({s.clinicalCategory})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </details>

                  <div className="sm:col-span-2 flex justify-end pt-1">
                    <Button
                      type="submit"
                      size="sm"
                      variant="primary"
                      loading={addCheckInMutation.isPending}
                      icon={<Plus className="size-3.5" aria-hidden />}
                    >
                      Lưu ghi nhận
                    </Button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleCheckInSubmit} className="space-y-3 text-xs">
                  {/* Row 1: Đầu óc */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[#262624] w-16 shrink-0">Đầu óc</span>
                    <div className="flex flex-wrap gap-1.5">
                      {MOOD_PRESETS.map((preset) => {
                        const isActive =
                          focusScore === preset.focus &&
                          stressLevel === preset.stress &&
                          fatigueIndexTar === preset.tar;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            aria-pressed={isActive}
                            onClick={() => {
                              setFocusScore(preset.focus);
                              setStressLevel(preset.stress);
                              setFatigueIndexTar(preset.tar);
                            }}
                            className={cn(
                              'rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors',
                              isActive
                                ? 'bg-[#16A34A] text-white font-semibold'
                                : 'bg-[#EFF6F1] text-[#374151] hover:bg-[#E2EFE6]',
                            )}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Row 2: Giấc ngủ */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[#262624] w-16 shrink-0">Giấc ngủ</span>
                    <div className="flex flex-wrap gap-1.5">
                      {SLEEP_PRESETS.map((preset) => {
                        const isActive = sleepHours === preset.value;
                        return (
                          <button
                            key={preset.value}
                            type="button"
                            aria-pressed={isActive}
                            onClick={() => setSleepHours(preset.value)}
                            className={cn(
                              'rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors',
                              isActive
                                ? 'bg-[#16A34A] text-white font-semibold'
                                : 'bg-[#EFF6F1] text-[#374151] hover:bg-[#E2EFE6]',
                            )}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Row 3: Ghi chú + Lưu */}
                  <div className="flex gap-2">
                    <Input
                      id="mh-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ghi chú ngắn (tùy chọn)..."
                      className="bg-white flex-1"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="primary"
                      loading={addCheckInMutation.isPending}
                    >
                      Lưu
                    </Button>
                  </div>

                  {/* Collapsed detailed numeric inputs */}
                  <details className="rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] text-xs">
                    <summary className="cursor-pointer px-3 py-1.5 font-medium text-[#575652]">
                      Chỉnh thông số chi tiết ▾
                    </summary>
                    <div className="px-3 pb-3 pt-2 grid gap-3 sm:grid-cols-3">
                      {detailedNumericFields}
                    </div>
                  </details>
                </form>
              );

              const checkInTableContent = checkIns.length > 0 && (
                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Lịch sử check-in sức khỏe"
                  className="overflow-x-auto rounded-xl border border-[#DCE6DF] focus-visible:outline-2 focus-visible:outline-[#16A34A]"
                >
                  {isProfessional ? (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          <th className="py-2 px-3 whitespace-nowrap">Ngày</th>
                          <th className="py-2 px-3">Ghi chú</th>
                          <th className="py-2 px-3 text-right whitespace-nowrap">Focus</th>
                          <th className="py-2 px-3 text-right whitespace-nowrap">TAR</th>
                          <th className="py-2 px-3 text-right whitespace-nowrap">BSI</th>
                          <th className="py-2 px-3 text-right whitespace-nowrap">Ngủ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/80 bg-white">
                        {checkIns.slice(0, 5).map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/80">
                            <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap tabular-nums">
                              {new Date(item.recordedDate).toLocaleDateString('vi-VN')}
                            </td>
                            <td className="py-2 px-3 text-slate-600 max-w-xs truncate" title={item.notes}>
                              {item.notes}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-700 whitespace-nowrap tabular-nums">
                              {item.focusScore}
                            </td>
                            <td
                              className={cn(
                                'py-2 px-3 text-right font-mono whitespace-nowrap tabular-nums',
                                item.fatigueIndexTar > 1.5
                                  ? 'font-bold text-amber-700'
                                  : 'text-slate-600',
                              )}
                            >
                              {item.fatigueIndexTar.toFixed(2)}
                            </td>
                            <td
                              className={cn(
                                'py-2 px-3 text-right font-mono whitespace-nowrap tabular-nums',
                                item.hemisphericBsi > 0.15
                                  ? 'font-bold text-rose-700'
                                  : 'text-slate-600',
                              )}
                            >
                              {item.hemisphericBsi.toFixed(3)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600 whitespace-nowrap tabular-nums">
                              {item.sleepHours.toFixed(1)}h
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          <th className="py-2 px-3 whitespace-nowrap">Ngày</th>
                          <th className="py-2 px-3">Cảm nhận</th>
                          <th className="py-2 px-3 text-right whitespace-nowrap">Độ tỉnh táo</th>
                          <th className="py-2 px-3 text-right whitespace-nowrap">Giấc ngủ</th>
                          <th className="py-2 px-3 text-right whitespace-nowrap">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/80 bg-white">
                        {checkIns.slice(0, 5).map((item) => {
                          const needsRest =
                            item.fatigueIndexTar > 1.5 ||
                            item.hemisphericBsi > 0.15 ||
                            item.sleepHours < 6.5;
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/80">
                              <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap tabular-nums">
                                {new Date(item.recordedDate).toLocaleDateString('vi-VN')}
                              </td>
                              <td className="py-2 px-3 text-slate-600 max-w-xs truncate" title={item.notes}>
                                {item.notes}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-700 whitespace-nowrap tabular-nums">
                                {item.focusScore}/100
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-600 whitespace-nowrap tabular-nums">
                                {item.sleepHours.toFixed(1)}h
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap">
                                <span
                                  className={cn(
                                    'inline-block rounded border px-2 py-0.5 text-[11px] font-semibold',
                                    needsRest
                                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-800',
                                  )}
                                >
                                  {needsRest ? 'Cần nghỉ ngơi' : 'Ổn định'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );

              const checkInTableSection = checkIns.length > 0 && (
                isProfessional ? (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Lịch sử Check-in Gần đây ({checkIns.length})
                    </h3>
                    {checkInTableContent}
                  </div>
                ) : (
                  <details className="pt-2 border-t border-slate-100">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-900">
                      Xem bảng lịch sử ({checkIns.length}) ▾
                    </summary>
                    <div className="pt-2.5">{checkInTableContent}</div>
                  </details>
                )
              );

              const workingPlanCard = (
                <Card className="p-5 sm:p-6 border-[#DCE6DF] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h2 className="text-base sm:text-lg font-semibold text-[#141413] flex items-center gap-2">
                      <CalendarClock className="size-5 text-[#16A34A]" aria-hidden />
                      <span>
                        {isProfessional
                          ? `Kế hoạch làm việc (${completedCount}/${workPlan.length})`
                          : `Lịch hôm nay (${completedCount}/${workPlan.length})`}
                      </span>
                    </h2>
                    <Button
                      type="button"
                      size="sm"
                      variant={showAddBlock ? 'outline' : 'primary'}
                      className="whitespace-nowrap shrink-0"
                      onClick={() => setShowAddBlock((v) => !v)}
                      icon={isProfessional ? <Plus className="size-3.5" aria-hidden /> : undefined}
                    >
                      {showAddBlock ? 'Đóng' : 'Thêm lịch'}
                    </Button>
                  </div>

                  {/* Add Working Plan Block Form */}
                  {showAddBlock && (
                    <form
                      onSubmit={handleAddBlockSubmit}
                      className="rounded-xl border border-[#DCE6DF] bg-[#F5FAF7] p-4 grid gap-3 sm:grid-cols-3 text-xs"
                    >
                      <div className="space-y-1">
                        <label htmlFor="wp-day" className="font-semibold text-[#262624] block">
                          Ngày
                        </label>
                        <select
                          id="wp-day"
                          value={blockDay}
                          onChange={(e) => setBlockDay(e.target.value)}
                          className="h-9.5 w-full rounded-lg border border-[#DCE6DF] bg-white px-2.5 text-xs text-[#141413]"
                        >
                          {DAYS_OF_WEEK.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="wp-slot" className="font-semibold text-[#262624] block">
                          Khung giờ
                        </label>
                        <Input
                          id="wp-slot"
                          value={blockSlot}
                          onChange={(e) => setBlockSlot(e.target.value)}
                          placeholder="08:30 - 10:30"
                          className="bg-white font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="wp-type" className="font-semibold text-[#262624] block">
                          Loại hoạt động
                        </label>
                        <select
                          id="wp-type"
                          value={blockType}
                          onChange={(e) => handleBlockTypeChange(e.target.value as WorkBlockType)}
                          className="h-9.5 w-full rounded-lg border border-[#DCE6DF] bg-white px-2.5 text-xs text-[#141413]"
                        >
                          {WORK_BLOCK_ORDER.map((wt) => (
                            <option key={wt} value={wt}>
                              {WORK_BLOCK_META[wt].label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3 space-y-1">
                        <label htmlFor="wp-title" className="font-semibold text-[#262624] block">
                          Tiêu đề *
                        </label>
                        <Input
                          id="wp-title"
                          value={blockTitle}
                          onChange={(e) => setBlockTitle(e.target.value)}
                          placeholder="Nhập tên hoạt động..."
                          className="bg-white"
                        />
                      </div>

                      {isProfessional && (
                        <div className="sm:col-span-3 space-y-1">
                          <label htmlFor="wp-rationale" className="font-semibold text-[#262624] block">
                            Cơ sở EEG
                          </label>
                          <Textarea
                            id="wp-rationale"
                            rows={2}
                            value={blockRationale}
                            onChange={(e) => setBlockRationale(e.target.value)}
                            className="bg-white"
                          />
                        </div>
                      )}

                      <div className="sm:col-span-3 flex justify-end gap-2">
                        <Button type="button" size="xs" variant="outline" onClick={() => setShowAddBlock(false)}>
                          Hủy
                        </Button>
                        <Button type="submit" size="xs" variant="primary" loading={addWorkBlockMutation.isPending}>
                          Lưu lịch
                        </Button>
                      </div>
                    </form>
                  )}

                  {/* Day Filter Pills */}
                  <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Lọc lịch làm việc theo ngày">
                    <button
                      type="button"
                      aria-pressed={dayFilter === 'ALL'}
                      onClick={() => setDayFilter('ALL')}
                      className={cn(
                        'rounded-lg px-3 py-1 text-xs font-medium transition-colors',
                        dayFilter === 'ALL'
                          ? 'bg-[#16A34A] text-white font-semibold'
                          : 'bg-[#EFF6F1] text-[#374151] hover:bg-[#E2EFE6]',
                      )}
                    >
                      Tất cả ({workPlan.length})
                    </button>
                    {availableDays.map((day) => {
                      const count = workPlan.filter((b) => b.dayOfWeek === day).length;
                      if (count === 0) return null;
                      return (
                        <button
                          key={day}
                          type="button"
                          aria-pressed={dayFilter === day}
                          onClick={() => setDayFilter(day)}
                          className={cn(
                            'rounded-lg px-3 py-1 text-xs font-medium transition-colors',
                            dayFilter === day
                              ? 'bg-[#16A34A] text-white font-semibold'
                              : 'bg-[#EFF6F1] text-[#374151] hover:bg-[#E2EFE6]',
                          )}
                        >
                          {day} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Blocks List */}
                  {filteredBlocks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#DCE6DF] p-6 text-center text-xs text-[#6E6D68]">
                      Chưa có lịch nào.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredBlocks.map((block) => {
                        const meta = WORK_BLOCK_META[block.blockType];
                        return (
                          <div
                            key={block.id}
                            className={cn(
                              'rounded-xl border p-3.5 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-3',
                              block.completed
                                ? 'border-[#DCE6DF] bg-[#F5FAF7]'
                                : 'border-[#DCE6DF] bg-white',
                            )}
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <button
                                type="button"
                                onClick={() => toggleBlockMutation.mutate(block)}
                                aria-label={
                                  block.completed
                                    ? `Đánh dấu chưa hoàn thành ${block.title}`
                                    : `Đánh dấu hoàn thành ${block.title}`
                                }
                                className="mt-0.5 text-[#16A34A] hover:text-[#15803D] shrink-0"
                              >
                                {block.completed ? (
                                  <CheckCircle2 className="size-5 text-[#16A34A]" aria-hidden />
                                ) : (
                                  <Circle className="size-5 text-[#C5C3BC]" aria-hidden />
                                )}
                              </button>

                              <div className="space-y-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-[11px] font-medium text-[#575652]">
                                    {block.dayOfWeek} · {block.timeSlot}
                                  </span>
                                  <span className="text-[11px] text-[#6E6D68]">
                                    · {meta.label}
                                  </span>
                                </div>
                                <div
                                  className={cn(
                                    'text-sm font-semibold text-[#141413]',
                                    block.completed && 'line-through text-[#6E6D68]',
                                  )}
                                >
                                  {block.title}
                                </div>
                                {isProfessional && (
                                  <p className="text-xs text-[#575652] leading-relaxed">
                                    <strong className="text-[#262624]">Cơ sở EEG: </strong>
                                    {block.eegRationale}
                                  </p>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => deleteBlockMutation.mutate(block.id)}
                              aria-label={`Xóa khối lịch ${block.title}`}
                              className="self-end sm:self-start inline-flex items-center gap-1 rounded-md border border-[#DCE6DF] px-2 py-1 text-[11px] font-medium text-[#6E6D68] hover:border-red-200 hover:bg-red-50 hover:text-red-700 shrink-0"
                            >
                              <Trash2 className="size-3.5" aria-hidden />
                              <span>Xóa</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );

              if (isProfessional) {
                return (
                  <>
                    {/* Multi-day Physiological Trend Chart */}
                    <Card className="p-5 sm:p-6 border-[#DCE6DF] space-y-4">
                      <PhysiologicalTrendChart checkIns={checkIns} isProfessional={isProfessional} />
                    </Card>

                    {/* Daily Check-in */}
                    <Card className="p-5 sm:p-6 border-[#DCE6DF] bg-white space-y-4">
                      <h2 className="text-base font-semibold text-[#141413]">Ghi nhận hôm nay</h2>
                      {checkInFormSection}
                      {checkInTableSection}
                    </Card>

                    {/* Interactive Working Plan & Recovery Schedule CRUD */}
                    {workingPlanCard}
                  </>
                );
              }

              return (
                <>
                  {/* Card 1: Ghi nhận hôm nay */}
                  <Card id="mh-checkin-card" className="p-5 sm:p-6 border-[#DCE6DF] bg-white space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-base font-semibold text-[#141413]">
                        Ghi nhận hôm nay
                      </h2>
                      <button
                        type="button"
                        onClick={() => setShowCheckIn((v) => !v)}
                        className="rounded-md border border-[#DCE6DF] bg-white px-2.5 py-1 text-xs font-medium text-[#575652] hover:bg-[#F5FAF7] shrink-0"
                      >
                        {showCheckIn ? 'Thu gọn' : 'Mở'}
                      </button>
                    </div>
                    {showCheckIn && checkInFormSection}
                  </Card>

                  {/* Card 2: Lịch hôm nay */}
                  {workingPlanCard}

                  {/* Card 3: Xu hướng 7 ngày */}
                  <Card className="p-5 sm:p-6 border-[#DCE6DF] space-y-4">
                    <PhysiologicalTrendChart checkIns={checkIns} isProfessional={isProfessional} />
                    {checkInTableSection}
                  </Card>
                </>
              );
            })()}
          </div>

          {/* Right 4 Columns: Latest EEG Record, Direct Links & Brain Guides */}
          <div className="lg:col-span-4 space-y-6">
            {isProfessional ? (
              <>
                {/* Latest Personal EEG Summary */}
                <Card className="p-5 border-[#DCE6DF] bg-white space-y-3">
                  <div className="flex items-center gap-2.5">
                    <Activity className="size-4 text-[#16A34A] shrink-0" aria-hidden />
                    <div>
                      <h2 className="text-sm font-semibold text-[#141413]">Bản ghi EEG gần nhất</h2>
                      <p className="text-[11px] text-[#6E6D68]">
                        {latestDataset
                          ? `${latestDataset.patientCode} · ${latestDataset.date}`
                          : 'Chưa có bản ghi'}
                      </p>
                    </div>
                  </div>
                  {latestDataset && (
                    <p className="text-xs text-[#575652] line-clamp-2">{latestDataset.clinicalNote}</p>
                  )}
                  <Link to="/eeg-hub?view=personal" className="block">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full"
                      icon={<ChevronRight className="size-3.5" aria-hidden />}
                    >
                      Mở hồ sơ sóng não
                    </Button>
                  </Link>
                </Card>

                {/* Direct Link to Remote Consultations */}
                <Card className="p-5 border-[#DCE6DF] bg-[#F5FAF7] space-y-3">
                  <div className="flex items-center gap-2 text-[#141413] font-semibold text-sm">
                    <MessageSquarePlus className="size-4 text-[#16A34A]" aria-hidden />
                    <span>Hỏi bác sĩ từ xa</span>
                  </div>
                  <p className="text-xs text-[#575652]">
                    Gửi bản ghi sóng não để bác sĩ chuyên khoa xem xét.
                  </p>
                  <div className="space-y-2">
                    <Link to="/consultations" className="block">
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        className="w-full text-xs"
                      >
                        Đặt câu hỏi
                      </Button>
                    </Link>
                    <Link to="/eeg-hub" className="block">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full text-xs"
                      >
                        Đo sóng não
                      </Button>
                    </Link>
                  </div>
                </Card>
              </>
            ) : (
              <Card className="p-4 border-[#DCE6DF] space-y-2.5">
                <h2 className="text-sm font-semibold text-[#141413]">Sóng não &amp; Tư vấn</h2>
                <p className="text-xs text-[#6E6D68]">
                  {latestDataset ? `Bản ghi gần nhất: ${latestDataset.patientCode}` : 'Chưa có bản ghi cá nhân'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Link to="/eeg-hub?tab=personal" className="block">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                    >
                      Hồ sơ sóng não
                    </Button>
                  </Link>
                  <Link to="/consultations?ask=1" className="block">
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      className="w-full text-xs"
                    >
                      Hỏi Bác sĩ
                    </Button>
                  </Link>
                </div>
              </Card>
            )}

            {/* Brain Health Guides — compact accordion */}
            <Card className="p-0 overflow-hidden border-[#DCE6DF]">
              <details>
                <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-[#141413] hover:bg-[#F5FAF7] flex items-center justify-between">
                  <span>Ý nghĩa chỉ số ▾</span>
                </summary>
                <div className="px-4 pb-4 pt-1 space-y-3 divide-y divide-[#DCE6DF] text-xs">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-[#141413]">TAR (Theta/Alpha)</span>
                    <p className="text-[#575652]">
                      TAR &gt; 1.50 cho thấy não đang mệt, nên nghỉ mắt 15 phút.
                    </p>
                  </div>

                  <div className="pt-2.5 space-y-0.5">
                    <span className="font-semibold text-[#141413]">Giấc ngủ sâu (Delta N3)</span>
                    <p className="text-[#575652]">
                      Ngủ đúng giờ và tránh ánh sáng xanh 45 phút giúp phục hồi tốt hơn.
                    </p>
                  </div>

                  <div className="pt-2.5 space-y-0.5">
                    <span className="font-semibold text-[#141413]">BSI (Đối xứng bán cầu)</span>
                    <p className="text-[#575652]">
                      BSI dưới 0.15 là bình thường; lệch cao kéo dài cần đi khám.
                    </p>
                  </div>
                </div>
              </details>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
