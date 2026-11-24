import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Users } from 'lucide-react';
import { communitiesApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import { useMode } from '../context/ModeContext';
import { EmptyView, Spinner, cn } from '../components/ui';

export function CommunitiesPage() {
  const { canAccessProfessionalMode } = useMode();
  const queryClient = useQueryClient();
  const [err, setErr] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['communities'],
    queryFn: () => communitiesApi.list(),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, joined }: { id: string; joined: boolean }) =>
      joined ? communitiesApi.leave(id) : communitiesApi.join(id),
    onSuccess: () => {
      setErr(null);
      void queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
    onError: (e) => setErr(errorMessage(e)),
  });

  if (query.isLoading) return <Spinner />;
  const list = query.data?.communities ?? [];

  if (list.length === 0) return <EmptyView icon={<Users className="size-8" />} title="Chưa có nhóm cộng đồng" />;

  return (
    <div className="px-3.5 pt-3.5 space-y-2.5">
      {err && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
          {err}
        </div>
      )}
      {list.map((c) => {
        const locked = c.isVerifiedOnly && !canAccessProfessionalMode && !c.isMember;
        return (
          <div
            key={c.id}
            className="rounded-2xl border border-[#DCE6DF] bg-white p-4 flex items-center justify-between gap-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-[#111827] truncate">{c.name}</h2>
                {c.isVerifiedOnly && (
                  <Lock className="size-3.5 shrink-0 text-[#15803D]" aria-label="Dành cho chuyên gia xác minh" />
                )}
              </div>
              <p className="mt-0.5 text-xs text-[#5B6860] tabular-nums truncate">
                {c.membersCount.toLocaleString('vi-VN')} thành viên · {c.specialtyLabel}
              </p>
            </div>
            {locked ? (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-[#DCE6DF] bg-[#F5FAF7] px-3 h-9 text-[11px] font-semibold text-[#5B6860]">
                <Lock className="size-3" aria-hidden />
                <span>Chuyên gia</span>
              </span>
            ) : (
              <button
                type="button"
                disabled={toggleMut.isPending}
                onClick={() => toggleMut.mutate({ id: c.id, joined: c.isMember })}
                className={cn(
                  'shrink-0 rounded-full px-4 h-9 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50',
                  c.isMember
                    ? 'border border-[#DCE6DF] bg-[#F5FAF7] text-[#374151]'
                    : 'bg-[#16A34A] text-white',
                )}
              >
                {c.isMember ? 'Đã vào' : 'Tham gia'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
