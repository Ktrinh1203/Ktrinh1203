import { Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageSquare, UserPlus, CheckCheck, Bell, ShieldCheck, Award, Gift } from 'lucide-react';
import { notificationsApi } from '../api/endpoints';
import { Avatar, Button, Card, EmptyState, Spinner } from '../components/ui';
import type { NotificationItem } from '../api/types';

export function NotificationsPage() {
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
        return <Heart className="size-3.5 text-red-500 fill-red-500" />;
      case 'POST_COMMENTED':
        return <MessageSquare className="size-3.5 text-[#16A34A]" />;
      case 'NEW_FOLLOWER':
        return <UserPlus className="size-3.5 text-[#16A34A]" />;
      case 'NEW_MESSAGE':
        return <MessageSquare className="size-3.5 text-[#15803D]" />;
      case 'VERIFICATION_UPDATE':
        return <ShieldCheck className="size-3.5 text-[#16A34A]" />;
      case 'CONTRIBUTION_UPDATE':
        return <Award className="size-3.5 text-[#15803D]" />;
      case 'REWARD_UPDATE':
        return <Gift className="size-3.5 text-amber-500" />;
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
      <Card className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#141413]">
          Thông báo
        </h1>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            loading={markAllMutation.isPending}
            onClick={() => markAllMutation.mutate()}
            icon={<CheckCheck className="size-4 text-[#16A34A]" aria-hidden />}
          >
            Đánh dấu đã đọc
          </Button>
        )}
      </Card>

      <Card className="divide-y divide-[#DCE6DF] overflow-hidden">
        {isLoading ? (
          <Spinner label="Đang tải thông báo..." />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Bell className="size-6 text-[#16A34A]" />}
            title="Chưa có thông báo nào"
            description="Thông báo tương tác và tin nhắn sẽ hiển thị tại đây."
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
                !n.read ? 'bg-[#EFF6F1]/70 hover:bg-[#EFF6F1]' : 'hover:bg-[#F5FAF7]'
              }`}
            >
              <div className="relative shrink-0">
                <Avatar name={n.actor.displayName} src={n.actor.avatarUrl} size="md" />
                <span className="absolute -bottom-1 -right-1 rounded-full bg-white p-0.5 border border-[#DCE6DF]">
                  {getIcon(n.type)}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#262624] leading-snug">
                  <span className="font-semibold text-[#141413]">{n.actor.displayName}</span>{' '}
                  {n.type === 'POST_LIKED' && 'đã thích bài viết của bạn.'}
                  {n.type === 'POST_COMMENTED' && 'đã bình luận bài viết của bạn.'}
                  {n.type === 'NEW_FOLLOWER' && 'đã theo dõi bạn.'}
                  {n.type === 'NEW_MESSAGE' && 'đã gửi tin nhắn cho bạn.'}
                  {n.type === 'VERIFICATION_UPDATE' && 'đã cập nhật hồ sơ xác minh của bạn.'}
                  {n.type === 'CONTRIBUTION_UPDATE' && 'đã cập nhật kết quả bài đóng góp.'}
                  {n.type === 'REWARD_UPDATE' && 'đã cập nhật yêu cầu đổi ưu đãi Credit.'}
                </p>

                {(n.postSnippet || n.commentSnippet) && (
                  <p className="mt-1 text-xs text-[#6E6D68] line-clamp-1 italic">
                    &ldquo;{n.commentSnippet || n.postSnippet}&rdquo;
                  </p>
                )}

                <span className="mt-1 block text-[11px] text-[#6E6D68] tabular-nums">
                  {new Date(n.updatedAt).toLocaleDateString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: 'numeric',
                    month: 'numeric',
                  })}
                </span>
              </div>

              {!n.read && <span className="size-2 rounded-full bg-[#16A34A] mt-2 shrink-0" />}
            </Link>
          ))
        )}
      </Card>
    </div>
  );
}
