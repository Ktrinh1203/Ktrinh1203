import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Activity, ChevronRight, Coins, MessageCircle, Stethoscope } from 'lucide-react';
import { consultationsApi, eegDatasetsApi, rewardsApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { Spinner, VerifiedCheck, isUserVerified, relativeTime } from '../components/ui';

export function ProDashboardPage() {
  const { user } = useAuth();

  const queueQuery = useQuery({
    queryKey: ['consultations', 'pro-dash'],
    queryFn: () => consultationsApi.list({ scope: 'queue' }),
  });

  const mineQuery = useQuery({
    queryKey: ['consultations', 'pro-mine'],
    queryFn: () => consultationsApi.list({ scope: 'mine' }),
  });

  const walletQuery = useQuery({
    queryKey: ['my-wallet'],
    queryFn: () => rewardsApi.getWallet(),
  });

  const eegQuery = useQuery({
    queryKey: ['eeg-datasets', 'workspace'],
    queryFn: () => eegDatasetsApi.getWorkspaceDatasets(),
  });

  const allQueue = queueQuery.data?.tickets ?? [];
  const openTickets = allQueue.filter((t) => t.status === 'OPEN');
  const myTickets = mineQuery.data?.tickets ?? [];
  const handledCount = myTickets.filter(
    (t) =>
      t.requesterId !== user?.id &&
      (t.status === 'CLAIMED' || t.status === 'ANSWERED' || t.status === 'ACCEPTED'),
  ).length;
  const balance = walletQuery.data?.wallet?.balance ?? 0;
  const datasetCount = eegQuery.data?.datasets.length ?? 0;

  return (
    <div className="px-3.5 pt-3.5 space-y-3.5">
      {/* Compact Verified Identity Header */}
      <section className="rounded-[24px] bg-[#14532D] text-white p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[16px] font-bold truncate">
              <span className="truncate">{user?.displayName}</span>
              {isUserVerified(user) && <VerifiedCheck className="text-emerald-300" />}
            </p>
            <p className="text-xs text-emerald-200/80 truncate">
              {user?.professionalProfiles?.find((p) => p.verificationStatus === 'VERIFIED')?.specialty ??
                'Chế độ Chuyên gia'}
            </p>
          </div>
          <Link
            to="/wallet"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white/14 px-3 h-9 font-mono text-xs font-bold text-white tabular-nums"
          >
            <Coins className="size-3.5 text-emerald-300" aria-hidden />
            <span>{balance.toLocaleString('vi-VN')}</span>
          </Link>
        </div>

        {/* 3 Crisp KPI Numbers */}
        <div className="grid grid-cols-3 divide-x divide-white/15 pt-1 text-center">
          <div>
            <span className="block font-mono text-xl font-bold tabular-nums">{openTickets.length}</span>
            <span className="text-[11px] text-emerald-200/80">Ca chờ</span>
          </div>
          <div>
            <span className="block font-mono text-xl font-bold tabular-nums">{datasetCount}</span>
            <span className="text-[11px] text-emerald-200/80">Bản qEEG</span>
          </div>
          <div>
            <span className="block font-mono text-xl font-bold tabular-nums">{handledCount}</span>
            <span className="text-[11px] text-emerald-200/80">Đã xử lý</span>
          </div>
        </div>
      </section>

      {/* Quick Action Row */}
      <div className="grid grid-cols-3 gap-2">
        <Link
          to="/eeg"
          className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-[#DCE6DF] bg-white py-3.5 text-xs font-semibold text-[#111827] active:scale-95 transition-transform"
        >
          <Activity className="size-5 text-[#14532D]" aria-hidden />
          <span>Trạm qEEG</span>
        </Link>
        <Link
          to="/consult"
          className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-[#DCE6DF] bg-white py-3.5 text-xs font-semibold text-[#111827] active:scale-95 transition-transform"
        >
          <Stethoscope className="size-5 text-[#14532D]" aria-hidden />
          <span>Ca chờ đọc</span>
        </Link>
        <Link
          to="/chat"
          className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-[#DCE6DF] bg-white py-3.5 text-xs font-semibold text-[#111827] active:scale-95 transition-transform"
        >
          <MessageCircle className="size-5 text-[#14532D]" aria-hidden />
          <span>Hộp thư</span>
        </Link>
      </div>

      {/* Priority Open Queue */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#111827]">Ca ưu tiên</h2>
          <Link to="/consult" className="text-xs font-semibold text-[#15803D]">
            Tất cả
          </Link>
        </div>

        {queueQuery.isLoading ? (
          <Spinner />
        ) : openTickets.length === 0 ? (
          <div className="rounded-2xl border border-[#DCE6DF] bg-white px-4 py-6 text-center text-xs text-[#5B6860]">
            Đã xử lý hết ca chờ đọc.
          </div>
        ) : (
          <div className="divide-y divide-[#EDF3EF] rounded-2xl border border-[#DCE6DF] bg-white overflow-hidden">
            {openTickets.slice(0, 4).map((t) => (
              <Link
                key={t.id}
                to={`/consult?ticket=${t.id}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#F5FAF7] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {t.urgentRedFlag && (
                      <span className="shrink-0 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700">
                        Khẩn
                      </span>
                    )}
                    <p className="text-sm font-bold text-[#111827] truncate">{t.title}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-[#5B6860] truncate">
                    {t.requester.displayName} · {relativeTime(t.createdAt)}
                    {t.bountyCredits > 0 ? ` · +${t.bountyCredits} Cr` : ''}
                  </p>
                </div>
                <ChevronRight className="size-4 text-[#94A39B] shrink-0" aria-hidden />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
