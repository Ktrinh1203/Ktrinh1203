import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { notificationsApi } from '../api/endpoints';
import type { NotificationItem } from '../api/types';
import { Avatar, EmptyView, Spinner, cn, relativeTime } from '../components/ui';

function notifText(n: NotificationItem): string {
  switch (n.type) {
    case 'POST_LIKED':
      return 'đã thích bài viết của bạn';
    case 'POST_COMMENTED':
      return 'đã bình luận bài viết';
    case 'NEW_FOLLOWER':
      return 'bắt đầu theo dõi bạn';
    case 'NEW_MESSAGE':
      return 'đã gửi tin nhắn mới';
    case 'VERIFICATION_UPDATE':
      return 'cập nhật xác minh chuyên gia';
    case 'CONTRIBUTION_UPDATE':
      return 'cập nhật đóng góp học thuật';
    case 'REWARD_UPDATE':
      return 'cập nhật ví Credit';
    case 'CONSULTATION_UPDATE':
      return 'cập nhật ca hỏi đáp bác sĩ';
    default:
      return 'có hoạt động mới';
  }
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.getAll(30),
  });

  const markAllMut = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markOneMut = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const items = query.data?.items ?? [];
  const unread = query.data?.unreadCount ?? 0;

  if (query.isLoading) return <Spinner />;

  return (
    <div className="space-y-2">
      {unread > 0 && (
        <div className="flex justify-end px-3.5 pt-3">
          <button
            type="button"
            disabled={markAllMut.isPending}
            onClick={() => markAllMut.mutate()}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF3] px-3.5 h-8 text-xs font-semibold text-[#15803D] cursor-pointer"
          >
            <CheckCheck className="size-3.5" aria-hidden />
            <span>Đọc tất cả</span>
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyView icon={<Bell className="size-8" />} title="Chưa có thông báo" />
      ) : (
        <div className="divide-y divide-[#EDF3EF] bg-white border-y border-[#E6EFE9]">
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                if (!n.read) markOneMut.mutate(n.id);
                if (n.conversationId) navigate(`/chat?conv=${n.conversationId}`);
                else if (n.type === 'CONSULTATION_UPDATE') navigate('/consult');
                else if (n.type === 'REWARD_UPDATE') navigate('/wallet');
                else navigate(`/u/${n.actor.username}`);
              }}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors cursor-pointer',
                !n.read ? 'bg-[#ECFDF3]/55' : 'bg-white hover:bg-[#F5FAF7]',
              )}
            >
              <Avatar name={n.actor.displayName} src={n.actor.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-snug text-[#1F2937]">
                  <strong className="font-bold text-[#111827]">{n.actor.displayName}</strong>{' '}
                  {notifText(n)}
                </p>
                <p className="mt-0.5 text-[11px] text-[#7A8880]">{relativeTime(n.createdAt)}</p>
              </div>
              {!n.read && <span className="size-2 rounded-full bg-[#16A34A] shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
