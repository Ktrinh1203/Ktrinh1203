import { Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageSquare, UserPlus, CheckCheck, Bell, ShieldCheck, Award, Gift } from 'lucide-react';
import { notificationsApi } from '../api/endpoints';
import { Avatar, Button, Card, EmptyState, Spinner } from '../components/ui';
import { useMode } from '../context/ModeContext';
import type { NotificationItem } from '../api/types';

export function NotificationsPage() {
  const { isProfessional } = useMode();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.getAll(50),
    refetchInterval: 10000,
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.setQueryData<{ items: NotificationItem[]; unreadCount: number }>(
        ['notifications'],
        (old) => {
          if (!old) return old;
          return {
            items: old.items.map((n) => ({ ...n, read: true })),
            unreadCount: 0,
          };
        },
      );
    },
  });

  const markSingleMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<{ items: NotificationItem[]; unreadCount: number }>(
        ['notifications'],
        (old) => {
          if (!old) return old;
          return {
            items: old.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
            unreadCount: Math.max(0, old.unreadCount - 1),
          };
        },
      );
    },
  });

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'POST_LIKED':
        return <Heart className="size-4 text-red-500 fill-red-500" />;
      case 'POST_COMMENTED':
        return <MessageSquare className="size-4 text-brand-600" />;
      case 'NEW_FOLLOWER':
        return <UserPlus className="size-4 text-blue-500" />;
      case 'NEW_MESSAGE':
        return <MessageSquare className="size-4 text-emerald-500" />;
      case 'VERIFICATION_UPDATE':
        return <ShieldCheck className="size-4 text-brand-600" />;
      case 'CONTRIBUTION_UPDATE':
        return <Award className="size-4 text-purple-600" />;
      case 'REWARD_UPDATE':
        return <Gift className="size-4 text-amber-500" />;
    }
  };

  const getLink = (n: NotificationItem) => {
    if (n.type === 'CONTRIBUTION_UPDATE') {
      return '/contributions';
    }
    if (n.type === 'REWARD_UPDATE') {
      return '/rewards';
    }
    if (n.type === 'VERIFICATION_UPDATE') {
      return '/settings';
    }
    if (n.type === 'NEW_MESSAGE' && n.conversationId) {
      return `/messages?conv=${n.conversationId}`;
    }
    if (n.postId) {
      return `/feed#post-${n.postId}`;
    }
    return `/u/${n.actor.username}`;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-lg p-5 shadow-2xs ${
          isProfessional
            ? 'bg-[#162B47] text-white border border-slate-700'
            : 'bg-white text-slate-900 border border-teal-200/80'
        }`}
      >
        <div>
          <h1
            className={`text-xl sm:text-2xl font-extrabold tracking-tight ${
              isProfessional ? 'text-white' : 'text-slate-900'
            }`}
          >
            {isProfessional
              ? 'Trung tâm Thông báo Lâm sàng & Hệ thống'
              : 'Thông báo Hoạt động Cộng đồng'}
          </h1>
          <p className={`text-xs sm:text-sm mt-0.5 ${isProfessional ? 'text-slate-300' : 'text-slate-600'}`}>
            {isProfessional
              ? 'Cập nhật phản biện đồng cấp, kết quả xét duyệt CCHN/ORCID, tín chỉ CME và tin nhắn chuyên môn'
              : 'Cập nhật tương tác bài viết, cộng đồng và tin nhắn từ bác sĩ / thành viên'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant={isProfessional ? 'secondary' : 'outline'}
            size="sm"
            loading={markAllMutation.isPending}
            onClick={() => markAllMutation.mutate()}
            icon={<CheckCheck className="size-4" />}
          >
            Đánh dấu đã đọc tất cả
          </Button>
        )}
      </div>

      <Card className="divide-y divide-slate-100 overflow-hidden">
        {isLoading ? (
          <Spinner label="Đang tải thông báo..." />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Bell className="size-6" />}
            title="Chưa có thông báo nào"
            description="Khi có người thích, bình luận bài viết hoặc gửi tin nhắn cho bạn, thông báo sẽ xuất hiện tại đây."
          />
        ) : (
          items.map((n) => (
            <Link
              key={n.id}
              to={getLink(n)}
              onClick={() => {
                if (!n.read) markSingleMutation.mutate(n.id);
              }}
              className={`p-4 flex items-start gap-3 transition-colors block ${
                !n.read ? 'bg-brand-50/40 hover:bg-brand-50/70' : 'hover:bg-slate-50'
              }`}
            >
              <div className="relative shrink-0">
                <Avatar name={n.actor.displayName} src={n.actor.avatarUrl} size="md" />
                <span className="absolute -bottom-1 -right-1 rounded-full bg-white p-0.5 shadow">
                  {getIcon(n.type)}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800 leading-snug">
                  <span className="font-semibold text-slate-900">{n.actor.displayName}</span>{' '}
                  {n.type === 'POST_LIKED' && 'đã thích bài viết của bạn.'}
                  {n.type === 'POST_COMMENTED' && 'đã bình luận vào bài viết của bạn.'}
                  {n.type === 'NEW_FOLLOWER' && 'đã bắt đầu theo dõi bạn.'}
                  {n.type === 'NEW_MESSAGE' && 'đã gửi tin nhắn cho bạn.'}
                  {n.type === 'VERIFICATION_UPDATE' &&
                    'đã cập nhật trạng thái hồ sơ xác minh chuyên môn của bạn. Nhấn để xem chi tiết.'}
                  {n.type === 'CONTRIBUTION_UPDATE' &&
                    'đã cập nhật kết quả thẩm định bài đóng góp chuyên môn của bạn.'}
                  {n.type === 'REWARD_UPDATE' &&
                    'đã cập nhật trạng thái yêu cầu quy đổi quyền lợi CME / Honoraria.'}
                </p>

                {(n.postSnippet || n.commentSnippet) && (
                  <p className="mt-1 text-xs text-slate-500 line-clamp-1 italic">
                    "{n.commentSnippet || n.postSnippet}"
                  </p>
                )}

                <span className="mt-1 block text-[11px] text-slate-400">
                  {new Date(n.updatedAt).toLocaleDateString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: 'numeric',
                    month: 'numeric',
                  })}
                </span>
              </div>

              {!n.read && <span className="size-2 rounded-full bg-brand-600 mt-2 shrink-0" />}
            </Link>
          ))
        )}
      </Card>
    </div>
  );
}
