import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Coins,
  Plus,
  Send,
  Star,
  Stethoscope,
} from 'lucide-react';
import { consultationsApi, eegDatasetsApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import type {
  ClinicalCategory,
  ConsultationStatus,
  ConsultationTicketItem,
} from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useMode } from '../context/ModeContext';
import {
  Avatar,
  BottomSheet,
  EmptyView,
  PillTabs,
  Spinner,
  VerifiedCheck,
  cn,
  isUserVerified,
  relativeTime,
} from '../components/ui';

const CATEGORIES: { id: ClinicalCategory; label: string }[] = [
  { id: 'SLEEP_COGNITIVE', label: 'Giấc ngủ' },
  { id: 'EPILEPSY_ICU', label: 'Động kinh' },
  { id: 'VASCULAR_STROKE', label: 'Đột quỵ' },
  { id: 'HARDWARE_BCI', label: 'EEG & BCI' },
];

const BOUNTIES = [0, 30, 50, 80];

const STATUS_BADGE: Record<ConsultationStatus, { label: string; cls: string }> = {
  OPEN: { label: 'Chờ BS', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  CLAIMED: { label: 'Đang đọc', cls: 'bg-sky-50 text-sky-800 border-sky-200' },
  ANSWERED: { label: 'Đã trả lời', cls: 'bg-[#ECFDF3] text-[#15803D] border-[#BBF7D0]' },
  ACCEPTED: { label: 'Hoàn tất', cls: 'bg-[#F5FAF7] text-[#5B6860] border-[#DCE6DF]' },
  CANCELLED: { label: 'Đã hủy', cls: 'bg-slate-50 text-slate-500 border-slate-200' },
};

export function ConsultPage() {
  const { user } = useAuth();
  const { isProfessional, canAccessProfessionalMode } = useMode();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [scope, setScope] = useState<'queue' | 'mine' | 'all'>(() =>
    isProfessional ? 'queue' : 'mine',
  );
  const [askOpen, setAskOpen] = useState(() => searchParams.get('ask') === '1');
  const [activeTicket, setActiveTicket] = useState<ConsultationTicketItem | null>(null);
  const requestedTicketId = searchParams.get('ticket');

  // Keep scope valid when toggling General <-> Professional mode
  useEffect(() => {
    if (!isProfessional && scope === 'queue') {
      setScope('mine');
    }
  }, [isProfessional, scope]);

  // Ask form
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ClinicalCategory>('SLEEP_COGNITIVE');
  const [symptom, setSymptom] = useState('');
  const [datasetId, setDatasetId] = useState('');
  const [bounty, setBounty] = useState(30);
  const [formErr, setFormErr] = useState<string | null>(null);

  // Doctor reply form
  const [waveText, setWaveText] = useState('');
  const [guideText, setGuideText] = useState('');
  const [followText, setFollowText] = useState('');
  const [actionErr, setActionErr] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('ask') === '1') {
      setAskOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('ask');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const ticketsQuery = useQuery({
    queryKey: ['consultations', scope],
    queryFn: () => consultationsApi.list({ scope }),
  });

  const deepLinkQuery = useQuery({
    queryKey: ['consultations', 'all-deeplink'],
    queryFn: () => consultationsApi.list({ scope: 'all' }),
    enabled: Boolean(requestedTicketId),
  });

  useEffect(() => {
    if (!requestedTicketId) return;
    const pool = [
      ...(ticketsQuery.data?.tickets ?? []),
      ...(deepLinkQuery.data?.tickets ?? []),
    ];
    const match = pool.find((t) => t.id === requestedTicketId);
    if (match) {
      setActionErr(null);
      setActiveTicket(match);
      const next = new URLSearchParams(searchParams);
      next.delete('ticket');
      setSearchParams(next, { replace: true });
    }
  }, [requestedTicketId, ticketsQuery.data, deepLinkQuery.data, searchParams, setSearchParams]);

  const datasetsQuery = useQuery({
    queryKey: ['eeg-datasets', 'for-consult'],
    queryFn: () => eegDatasetsApi.getMyDatasets(),
    enabled: askOpen,
  });

  const createMut = useMutation({
    mutationFn: () =>
      consultationsApi.create({
        title: title.trim(),
        symptomSummary: symptom.trim(),
        clinicalCategory: category,
        bountyCredits: bounty,
        datasetId: datasetId || undefined,
      }),
    onSuccess: () => {
      setTitle('');
      setSymptom('');
      setDatasetId('');
      setFormErr(null);
      setAskOpen(false);
      setScope('mine');
      void queryClient.invalidateQueries({ queryKey: ['consultations'] });
      void queryClient.invalidateQueries({ queryKey: ['my-wallet'] });
    },
    onError: (e) => setFormErr(errorMessage(e)),
  });

  const claimMut = useMutation({
    mutationFn: (id: string) => consultationsApi.claim(id),
    onSuccess: (res) => {
      setActiveTicket(res.ticket);
      setActionErr(null);
      void queryClient.invalidateQueries({ queryKey: ['consultations'] });
    },
    onError: (e) => setActionErr(errorMessage(e)),
  });

  const replyMut = useMutation({
    mutationFn: (id: string) =>
      consultationsApi.reply(id, {
        waveAnalysisText: waveText.trim(),
        clinicalGuidanceText: guideText.trim(),
        recommendedFollowUp: followText.trim() || 'Tái khám nếu triệu chứng kéo dài.',
      }),
    onSuccess: (res) => {
      setActiveTicket(res.ticket);
      setWaveText('');
      setGuideText('');
      setFollowText('');
      setActionErr(null);
      void queryClient.invalidateQueries({ queryKey: ['consultations'] });
    },
    onError: (e) => setActionErr(errorMessage(e)),
  });

  const acceptMut = useMutation({
    mutationFn: ({ ticketId, replyId }: { ticketId: string; replyId: string }) =>
      consultationsApi.acceptReply(ticketId, replyId, 5),
    onSuccess: (res) => {
      setActiveTicket(res.ticket);
      setActionErr(null);
      void queryClient.invalidateQueries({ queryKey: ['consultations'] });
      void queryClient.invalidateQueries({ queryKey: ['my-wallet'] });
    },
    onError: (e) => setActionErr(errorMessage(e)),
  });

  const tickets = ticketsQuery.data?.tickets ?? [];

  const scopeItems: { id: 'queue' | 'mine' | 'all'; label: string }[] = isProfessional
    ? [
        { id: 'queue', label: 'Ca chờ đọc' },
        { id: 'all', label: 'Tất cả' },
        { id: 'mine', label: 'Của tôi' },
      ]
    : [
        { id: 'mine', label: 'Của tôi' },
        { id: 'all', label: 'Cộng đồng' },
      ];

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 5 || symptom.trim().length < 10) {
      setFormErr('Nhập tiêu đề (≥5 ký tự) và mô tả ngắn (≥10 ký tự).');
      return;
    }
    createMut.mutate();
  };

  return (
    <div className="px-3.5 pt-3.5 space-y-3.5">
      {/* Top Scope Bar + Quick Ask Button */}
      <div className="flex items-center justify-between gap-2">
        <PillTabs
          items={scopeItems}
          value={scope}
          onChange={setScope}
          dark={isProfessional}
        />
        {!isProfessional && (
          <button
            type="button"
            onClick={() => setAskOpen(true)}
            className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#16A34A] px-3.5 h-9 text-xs font-semibold text-white active:scale-95 transition-transform cursor-pointer"
          >
            <Plus className="size-3.5" aria-hidden />
            <span>Hỏi BS</span>
          </button>
        )}
      </div>

      {/* Ticket List */}
      {ticketsQuery.isLoading ? (
        <Spinner />
      ) : tickets.length === 0 ? (
        <EmptyView
          icon={<Stethoscope className="size-8" />}
          title={scope === 'queue' ? 'Không có ca chờ đọc' : 'Chưa có câu hỏi nào'}
          action={
            !isProfessional ? (
              <button
                type="button"
                onClick={() => setAskOpen(true)}
                className="rounded-full bg-[#16A34A] px-4 h-10 text-xs font-semibold text-white cursor-pointer"
              >
                Gửi câu hỏi đầu tiên
              </button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-2.5">
          {tickets.map((t) => {
            const st = STATUS_BADGE[t.status];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActionErr(null);
                  setActiveTicket(t);
                }}
                className="w-full text-left rounded-2xl border border-[#DCE6DF] bg-white p-4 hover:border-[#86EFAC] active:scale-[0.99] transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', st.cls)}>
                      {st.label}
                    </span>
                    {t.urgentRedFlag && (
                      <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10.5px] font-bold text-red-700">
                        Khẩn
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[#7A8880]">
                    {t.bountyCredits > 0 && (
                      <span className="inline-flex items-center gap-0.5 font-mono font-semibold text-[#15803D] tabular-nums">
                        <Coins className="size-3" aria-hidden />
                        {t.bountyCredits}
                      </span>
                    )}
                    <span>{relativeTime(t.createdAt)}</span>
                  </div>
                </div>

                <h3 className="mt-2 text-[15px] font-bold text-[#111827] line-clamp-2">
                  {t.title}
                </h3>
                <p className="mt-1 text-xs text-[#5B6860] line-clamp-2 leading-relaxed">
                  {t.symptomSummary}
                </p>

                <div className="mt-3 flex items-center justify-between text-[11px] text-[#7A8880]">
                  <span className="flex items-center gap-1.5 truncate">
                    <Avatar name={t.requester.displayName} src={t.requester.avatarUrl} size="xs" />
                    <span className="truncate font-medium text-[#374151]">{t.requester.displayName}</span>
                  </span>
                  <span className="shrink-0 font-medium">
                    {t.replies.length > 0 ? `${t.replies.length} phản hồi` : 'Chạm để mở'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Ask Doctor Bottom Sheet */}
      <BottomSheet
        open={askOpen}
        onClose={() => setAskOpen(false)}
        title="Hỏi bác sĩ chuyên khoa"
      >
        <form onSubmit={handleCreate} className="space-y-3.5">
          {formErr && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
              {formErr}
            </p>
          )}

          <input
            type="text"
            placeholder="Tiêu đề ngắn (vd: Mất ngủ kèm đau đầu sáng)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-11 rounded-2xl border border-[#DCE6DF] bg-[#F5FAF7] px-4 text-sm focus:bg-white focus:border-[#16A34A] focus:outline-none"
          />

          <PillTabs items={CATEGORIES} value={category} onChange={setCategory} />

          <textarea
            rows={3}
            placeholder="Mô tả triệu chứng, thời điểm xảy ra..."
            value={symptom}
            onChange={(e) => setSymptom(e.target.value)}
            className="w-full rounded-2xl border border-[#DCE6DF] bg-[#F5FAF7] p-3.5 text-sm focus:bg-white focus:border-[#16A34A] focus:outline-none resize-none"
          />

          {(datasetsQuery.data?.datasets.length ?? 0) > 0 && (
            <select
              aria-label="Đính kèm bản ghi EEG"
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value)}
              className="w-full h-11 rounded-2xl border border-[#DCE6DF] bg-white px-3.5 text-xs text-[#111827]"
            >
              <option value="">Đính kèm bản ghi EEG (tùy chọn)</option>
              {datasetsQuery.data!.datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.patientCode})
                </option>
              ))}
            </select>
          )}

          {/* Bounty Credit Pills */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#5B6860]">Thù lao Credit</span>
            <div className="flex gap-1.5">
              {BOUNTIES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setBounty(v)}
                  className={cn(
                    'rounded-full min-w-[44px] px-3 h-9 font-mono text-xs font-semibold tabular-nums cursor-pointer transition-colors',
                    bounty === v
                      ? 'bg-[#16A34A] text-white'
                      : 'bg-[#EFF6F1] text-[#374151]',
                  )}
                >
                  {v === 0 ? '0' : `${v}`}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={createMut.isPending}
            className="w-full h-12 rounded-full bg-[#16A34A] text-sm font-semibold text-white hover:bg-[#15803D] disabled:opacity-50 cursor-pointer"
          >
            {createMut.isPending ? 'Đang gửi...' : 'Gửi câu hỏi'}
          </button>
        </form>
      </BottomSheet>

      {/* Ticket Detail & Doctor Reply Bottom Sheet */}
      <BottomSheet
        open={Boolean(activeTicket)}
        onClose={() => setActiveTicket(null)}
        title="Chi tiết ca hỏi đáp"
      >
        {activeTicket && (
          <div className="space-y-4">
            {actionErr && (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                {actionErr}
              </p>
            )}

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', STATUS_BADGE[activeTicket.status].cls)}>
                    {STATUS_BADGE[activeTicket.status].label}
                  </span>
                  {activeTicket.urgentRedFlag && (
                    <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10.5px] font-bold text-red-700">
                      Khẩn
                    </span>
                  )}
                </div>
                {activeTicket.bountyCredits > 0 && (
                  <span className="font-mono text-xs font-bold text-[#15803D] tabular-nums">
                    +{activeTicket.bountyCredits} Credit
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-[#111827]">{activeTicket.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#374151]">
                {activeTicket.symptomSummary}
              </p>
            </div>

            {activeTicket.neuralSample && (
              <div className="grid grid-cols-3 divide-x divide-[#DCE6DF] rounded-2xl border border-[#DCE6DF] bg-[#F5FAF7] py-2.5 text-center font-mono text-xs tabular-nums">
                <div>
                  <span className="block text-[10px] font-sans text-[#5B6860]">
                    {isProfessional ? 'DAR' : 'Sóng chậm'}
                  </span>
                  <strong>{activeTicket.neuralSample.dar.toFixed(2)}</strong>
                </div>
                <div>
                  <span className="block text-[10px] font-sans text-[#5B6860]">
                    {isProfessional ? 'BSI' : 'Lệch 2 bên'}
                  </span>
                  <strong>{activeTicket.neuralSample.bsi.toFixed(2)}</strong>
                </div>
                <div>
                  <span className="block text-[10px] font-sans text-[#5B6860]">
                    {isProfessional ? 'TAR' : 'Mệt mỏi'}
                  </span>
                  <strong>{activeTicket.neuralSample.tar.toFixed(2)}</strong>
                </div>
              </div>
            )}

            {/* Replies */}
            {activeTicket.replies.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-[#EDF3EF]">
                {activeTicket.replies.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-[#DCE6DF] bg-[#F5FAF7] p-3.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <Avatar name={r.responder.displayName} src={r.responder.avatarUrl} size="xs" />
                      <span className="text-xs font-bold text-[#111827] truncate">
                        {r.responder.displayName}
                      </span>
                      {isUserVerified(r.responder) && <VerifiedCheck />}
                      {r.isAccepted && (
                        <CheckCircle2 className="size-4 text-[#16A34A] ml-auto shrink-0" aria-label="Đã nghiệm thu" />
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-[#1F2937]">{r.waveAnalysisText}</p>
                    <p className="text-xs leading-relaxed text-[#374151]">{r.clinicalGuidanceText}</p>
                    {r.recommendedFollowUp && (
                      <p className="text-[11px] font-medium text-[#15803D]">{r.recommendedFollowUp}</p>
                    )}

                    {user?.id === activeTicket.requesterId &&
                      activeTicket.status === 'ANSWERED' &&
                      !r.isAccepted && (
                        <button
                          type="button"
                          disabled={acceptMut.isPending}
                          onClick={() => acceptMut.mutate({ ticketId: activeTicket.id, replyId: r.id })}
                          className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[#16A34A] px-4 h-9 text-xs font-semibold text-white cursor-pointer"
                        >
                          <Star className="size-3.5" aria-hidden />
                          <span>Nghiệm thu (5★)</span>
                        </button>
                      )}
                  </div>
                ))}
              </div>
            )}

            {/* Professional Actions */}
            {isProfessional && canAccessProfessionalMode && activeTicket.requesterId !== user?.id && (
              <div className="pt-2 border-t border-[#EDF3EF] space-y-2.5">
                {activeTicket.status === 'OPEN' ? (
                  <button
                    type="button"
                    disabled={claimMut.isPending}
                    onClick={() => claimMut.mutate(activeTicket.id)}
                    className="w-full h-11 rounded-full bg-[#14532D] text-sm font-semibold text-white cursor-pointer disabled:opacity-50"
                  >
                    {claimMut.isPending ? 'Đang nhận...' : 'Nhận đọc ca này'}
                  </button>
                ) : activeTicket.status === 'CLAIMED' && activeTicket.claimedById === user?.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (waveText.trim().length < 5 || guideText.trim().length < 5) {
                        setActionErr('Nhập nhận định sóng và hướng dẫn ngắn.');
                        return;
                      }
                      replyMut.mutate(activeTicket.id);
                    }}
                    className="space-y-2.5"
                  >
                    <textarea
                      rows={2}
                      placeholder="Phân tích sóng não / lâm sàng..."
                      value={waveText}
                      onChange={(e) => setWaveText(e.target.value)}
                      className="w-full rounded-2xl border border-[#DCE6DF] bg-[#F5FAF7] p-3 text-xs focus:bg-white focus:border-[#14532D] focus:outline-none resize-none"
                    />
                    <textarea
                      rows={2}
                      placeholder="Hướng dẫn xử trí..."
                      value={guideText}
                      onChange={(e) => setGuideText(e.target.value)}
                      className="w-full rounded-2xl border border-[#DCE6DF] bg-[#F5FAF7] p-3 text-xs focus:bg-white focus:border-[#14532D] focus:outline-none resize-none"
                    />
                    <input
                      type="text"
                      placeholder="Khuyến nghị theo dõi (tùy chọn)"
                      value={followText}
                      onChange={(e) => setFollowText(e.target.value)}
                      className="w-full h-10 rounded-2xl border border-[#DCE6DF] bg-[#F5FAF7] px-3.5 text-xs focus:bg-white focus:border-[#14532D] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={replyMut.isPending}
                      className="flex w-full items-center justify-center gap-1.5 h-11 rounded-full bg-[#14532D] text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                    >
                      <Send className="size-3.5" aria-hidden />
                      <span>{replyMut.isPending ? 'Đang gửi...' : 'Gửi phân tích'}</span>
                    </button>
                  </form>
                ) : null}
              </div>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
