import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageCircle, Send } from 'lucide-react';
import { communityInsightsApi, messagesApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import type { MessageItem, UserSummary } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useMode } from '../context/ModeContext';
import {
  Avatar,
  EmptyView,
  Spinner,
  VerifiedCheck,
  cn,
  isUserVerified,
  relativeTime,
} from '../components/ui';

export function ChatPage() {
  const { user } = useAuth();
  const { isProfessional } = useMode();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeId = searchParams.get('conv');

  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [optimisticOther, setOptimisticOther] = useState<UserSummary | null>(
    () => (location.state as { otherUser?: UserSummary } | null)?.otherUser ?? null,
  );
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fromState = (location.state as { otherUser?: UserSummary } | null)?.otherUser ?? null;
    if (fromState) setOptimisticOther(fromState);
    if (!activeId) setOptimisticOther(null);
  }, [activeId, location.state]);

  const convsQuery = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagesApi.getConversations(),
    refetchInterval: 5000,
  });

  const spotlightQuery = useQuery({
    queryKey: ['community-spotlight'],
    queryFn: () => communityInsightsApi.getSpotlight(),
    staleTime: 60_000,
  });

  const convs = convsQuery.data?.conversations ?? [];
  const activeConvFromList = convs.find((c) => c.id === activeId);

  const convDetailQuery = useQuery({
    queryKey: ['conversation-detail', activeId],
    queryFn: () => messagesApi.getDetails(activeId!),
    enabled: Boolean(activeId && !activeConvFromList),
  });

  const msgsQuery = useQuery({
    queryKey: ['messages', activeId],
    queryFn: () => messagesApi.getMessages(activeId!),
    enabled: Boolean(activeId),
    refetchInterval: 3000,
  });

  const sendMut = useMutation({
    mutationFn: (content: string) => messagesApi.sendMessage(activeId!, content),
    onSuccess: (res) => {
      setText('');
      setErr(null);
      queryClient.setQueryData<{ items: MessageItem[]; nextCursor: string | null; hasMore: boolean }>(
        ['messages', activeId],
        (old) =>
          old
            ? { ...old, items: [...old.items, res.message] }
            : { items: [res.message], nextCursor: null, hasMore: false },
      );
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (e) => setErr(errorMessage(e)),
  });

  const startChat = async (targetUser: UserSummary) => {
    try {
      const res = await messagesApi.startConversation(targetUser.id);
      setOptimisticOther(res.conversation.otherUser ?? targetUser);
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setSearchParams({ conv: res.conversation.id });
    } catch (e) {
      setErr(errorMessage(e));
    }
  };

  const activeConv = activeConvFromList ?? convDetailQuery.data?.conversation;
  const messages = msgsQuery.data?.items ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeId]);

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeId) return;
    sendMut.mutate(text.trim());
  };

  // Full-Screen Native Mobile Chat Thread
  if (activeId) {
    const other = activeConv?.otherUser ?? optimisticOther;
    return (
      <div className="flex flex-col h-dvh bg-[#F5FAF7]">
        <header
          className={cn(
            'border-b shrink-0',
            isProfessional
              ? 'bg-[#14532D] text-white border-[#052E16]'
              : 'bg-white text-[#111827] border-[#DCE6DF]',
          )}
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="h-14 px-3 flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setSearchParams({})}
              aria-label="Quay lại"
              className="flex size-10 items-center justify-center rounded-full hover:bg-black/5 cursor-pointer -ml-1"
            >
              <ArrowLeft className="size-5" aria-hidden />
            </button>

            {other ? (
              <Link to={`/u/${other.username}`} className="flex items-center gap-2.5 min-w-0 flex-1">
                <Avatar name={other.displayName} src={other.avatarUrl} size="sm" />
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-sm font-bold truncate">
                    <span className="truncate">{other.displayName}</span>
                    {isUserVerified(other) && (
                      <VerifiedCheck className={isProfessional ? 'text-emerald-300' : undefined} />
                    )}
                  </p>
                  <p className={cn('text-[11px] truncate', isProfessional ? 'text-emerald-200/80' : 'text-[#5B6860]')}>
                    @{other.username}
                  </p>
                </div>
              </Link>
            ) : (
              <div className="h-4 w-32 rounded-full bg-current/15 animate-pulse" aria-label="Đang tải hội thoại" />
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-2.5">
          {msgsQuery.isLoading ? (
            <Spinner />
          ) : messages.length === 0 ? (
            <EmptyView title="Bắt đầu cuộc trò chuyện" />
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={cn('flex', m.isSender ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[80%] px-3.5 py-2.5 text-[14.5px] leading-relaxed break-words',
                    m.isSender
                      ? 'rounded-2xl rounded-tr-xs bg-[#16A34A] text-white'
                      : 'rounded-2xl rounded-tl-xs bg-white text-[#111827] border border-[#DCE6DF]',
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  <span
                    className={cn(
                      'mt-1 block text-right text-[10px] tabular-nums',
                      m.isSender ? 'text-white/75' : 'text-[#8A9790]',
                    )}
                  >
                    {new Date(m.createdAt).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {err && <p className="px-4 py-1 text-xs text-red-600 bg-red-50">{err}</p>}

        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 border-t border-[#DCE6DF] bg-white px-3 py-2.5 shrink-0"
          style={{ paddingBottom: 'max(0.65rem, env(safe-area-inset-bottom))' }}
        >
          <input
            type="text"
            placeholder="Nhắn tin..."
            aria-label="Nội dung tin nhắn"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 h-11 rounded-full border border-[#DCE6DF] bg-[#F5FAF7] px-4 text-sm text-[#111827] placeholder:text-[#8A9790] focus:bg-white focus:border-[#16A34A] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!text.trim() || sendMut.isPending}
            aria-label="Gửi tin nhắn"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#16A34A] text-white disabled:opacity-40 active:scale-95 transition-transform cursor-pointer"
          >
            <Send className="size-4.5" aria-hidden />
          </button>
        </form>
      </div>
    );
  }

  // Inbox View
  const suggested = (spotlightQuery.data?.professionals ?? []).filter((p) => p.user.id !== user?.id);

  return (
    <div className="space-y-3">
      {/* Quick-Start Contact Strip */}
      {suggested.length > 0 && (
        <div className="bg-white border-b border-[#E6EFE9]">
          <div
            data-story-strip="true"
            className="flex items-center gap-3.5 overflow-x-auto no-scrollbar px-4 pt-3.5 pb-3"
          >
            {suggested.map((p) => {
              const shortName = p.user.displayName.split(' ').slice(-2).join(' ');
              return (
                <button
                  key={p.user.id}
                  type="button"
                  onClick={() => void startChat(p.user)}
                  className="flex flex-col items-center gap-1.5 shrink-0 w-16 cursor-pointer active:scale-95 transition-transform"
                >
                  <Avatar
                    name={p.user.displayName}
                    src={p.user.avatarUrl}
                    size="md"
                    online
                    storyRing
                  />
                  <span className="w-full truncate text-center text-[11px] font-medium text-[#374151]">
                    {shortName}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {convsQuery.isLoading ? (
        <Spinner />
      ) : convs.length === 0 ? (
        <EmptyView
          icon={<MessageCircle className="size-8" />}
          title="Chạm bác sĩ phía trên để nhắn tin"
        />
      ) : (
        <div className="divide-y divide-[#EDF3EF] bg-white border-y border-[#E6EFE9]">
          {convs.map((c) => {
            const other = c.otherUser;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSearchParams({ conv: c.id })}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#F5FAF7] active:bg-[#ECFDF3] transition-colors cursor-pointer"
              >
                <div className="relative shrink-0">
                  <Avatar name={other?.displayName ?? 'NL'} src={other?.avatarUrl} size="md" />
                  {c.isUnread && (
                    <span className="absolute top-0 right-0 size-2.5 rounded-full bg-[#16A34A] ring-2 ring-white" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-[14.5px] font-bold text-[#111827] truncate">
                      <span className="truncate">{other?.displayName ?? 'Thành viên'}</span>
                      {isUserVerified(other) && <VerifiedCheck />}
                    </span>
                    <span className="text-[11px] text-[#7A8880] shrink-0">
                      {relativeTime(c.lastMessageAt)}
                    </span>
                  </div>
                  <p
                    className={cn(
                      'mt-0.5 text-xs truncate',
                      c.isUnread ? 'font-semibold text-[#111827]' : 'text-[#5B6860]',
                    )}
                  >
                    {c.lastMessage?.content ?? 'Bắt đầu trò chuyện'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
