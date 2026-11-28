import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Coins, Maximize2, MessageCircle, Minus, Search, Send, X } from 'lucide-react';
import { communityInsightsApi, messagesApi, searchApi } from '../../api/endpoints';
import type { MessageItem } from '../../api/types';
import { Avatar } from '../../components/ui';
import { useAuth } from '../auth/AuthContext';
import { useChatPopup } from './ChatPopupContext';

export function ChatPopupDock() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    isOpen,
    isMinimized,
    activeConvId,
    isStartingChat,
    openInbox,
    togglePopup,
    openConversation,
    startChatWithUser,
    minimizePopup,
    closePopup,
  } = useChatPopup();

  const [searchTerm, setSearchTerm] = useState('');
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isMessagesRoute = location.pathname.startsWith('/messages');

  const { data: convData, isLoading: loadingConvs } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagesApi.getConversations(),
    enabled: Boolean(user),
    refetchInterval: isOpen ? 5000 : 15000,
  });

  const conversations = convData?.conversations ?? [];
  const unreadCount = conversations.filter((c) => c.isUnread).length;

  const activeConvFromList = activeConvId
    ? conversations.find((c) => c.id === activeConvId) ?? null
    : null;

  const { data: activeConvDetailData } = useQuery({
    queryKey: ['conversation-details', activeConvId],
    queryFn: () => messagesApi.getDetails(activeConvId!),
    enabled: Boolean(user && isOpen && activeConvId && !activeConvFromList && !isMessagesRoute),
  });

  const activeConv = activeConvFromList ?? activeConvDetailData?.conversation ?? null;

  const trimmedSearch = searchTerm.trim();
  const { data: searchData, isFetching: searchingUsers } = useQuery({
    queryKey: ['chat-popup-search', trimmedSearch],
    queryFn: () => searchApi.search({ q: trimmedSearch }),
    enabled: Boolean(
      user && isOpen && !isMinimized && !activeConvId && !isMessagesRoute && trimmedSearch.length >= 2,
    ),
  });

  const { data: spotlightData } = useQuery({
    queryKey: ['community-spotlight'],
    queryFn: () => communityInsightsApi.getSpotlight(),
    enabled: Boolean(user && isOpen && !isMinimized && !activeConvId && !isMessagesRoute),
    staleTime: 60_000,
  });

  const { data: msgData, isLoading: loadingMsgs } = useQuery({
    queryKey: ['messages', activeConvId],
    queryFn: () => messagesApi.getMessages(activeConvId!),
    enabled: Boolean(user && isOpen && !isMinimized && activeConvId && !isMessagesRoute),
    refetchInterval: 3000,
  });

  const messages = msgData?.items ?? [];

  useEffect(() => {
    if (!isOpen || isMinimized || isMessagesRoute) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePopup();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isMinimized, isMessagesRoute, closePopup]);

  useEffect(() => {
    if (isOpen && !isMinimized && activeConvId && !isMessagesRoute) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isOpen, isMinimized, activeConvId, isMessagesRoute]);

  const sendMutation = useMutation({
    mutationFn: (text: string) => messagesApi.sendMessage(activeConvId!, text),
    onSuccess: (res) => {
      setDraft('');
      queryClient.setQueryData<{ items: MessageItem[]; nextCursor: string | null; hasMore: boolean }>(
        ['messages', activeConvId],
        (old) => {
          if (!old) return { items: [res.message], nextCursor: null, hasMore: false };
          return { ...old, items: [...old.items, res.message] };
        },
      );
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !activeConvId || sendMutation.isPending) return;
    sendMutation.mutate(draft.trim());
  };

  if (!user || isMessagesRoute || !isOpen) {
    return null;
  }

  // State B: Minimized
  if (isMinimized) {
    return (
      <div className="fixed bottom-0 right-5 z-50 flex w-68 items-center justify-between gap-2 rounded-t-xl border border-b-0 border-[#15803D] bg-[#16A34A] px-3.5 py-2.5 text-xs font-semibold text-white shadow-lg">
        <button
          type="button"
          onClick={togglePopup}
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
        >
          <MessageCircle className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{activeConv?.otherUser?.displayName ?? 'Tin nhắn'}</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-[#DC2626] px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums shrink-0">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={closePopup}
          aria-label="Đóng khung chat"
          className="rounded p-0.5 text-white/85 hover:bg-white/15 hover:text-white transition-colors shrink-0"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    );
  }

  // State C: Expanded Popup
  const matchedUsers = (searchData?.users ?? []).filter((u) => u.id !== user.id);
  const existingConvUserIds = new Set(
    conversations.map((c) => c.otherUser?.id).filter((id): id is string => Boolean(id)),
  );
  const quickSuggestions = (spotlightData?.professionals ?? []).filter(
    (item) => item.user.id !== user.id && !existingConvUserIds.has(item.user.id),
  );
  const other = activeConv?.otherUser ?? null;

  return (
    <div
      role="dialog"
      aria-label="Cửa sổ tin nhắn"
      className="fixed inset-x-2 bottom-16 sm:inset-x-auto sm:bottom-0 sm:right-5 z-50 sm:w-[360px] h-[460px] max-h-[calc(100vh-5rem)] rounded-xl sm:rounded-b-none sm:rounded-t-xl border border-[#DCE6DF] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.15)] flex flex-col overflow-hidden"
    >
      {!activeConvId ? (
        <>
          {/* Sub-view 1 Header */}
          <div className="h-12 px-3.5 border-b border-[#DCE6DF] bg-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <MessageCircle className="size-4 text-[#16A34A] shrink-0" aria-hidden />
              <span className="text-sm font-bold text-[#111827] truncate">Tin nhắn</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#DC2626] px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                aria-label="Mở toàn màn hình"
                onClick={() => {
                  navigate('/messages');
                  closePopup();
                }}
                className="flex size-7 items-center justify-center rounded-lg text-[#4B5563] hover:bg-[#ECFDF3] hover:text-[#15803D] transition-colors"
              >
                <Maximize2 className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Thu gọn"
                onClick={minimizePopup}
                className="flex size-7 items-center justify-center rounded-lg text-[#4B5563] hover:bg-[#ECFDF3] hover:text-[#15803D] transition-colors"
              >
                <Minus className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Đóng"
                onClick={closePopup}
                className="flex size-7 items-center justify-center rounded-lg text-[#4B5563] hover:bg-[#FEF2F2] hover:text-[#DC2626] transition-colors"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          </div>

          {/* Search input */}
          <div className="px-3 py-2 border-b border-[#EEF3F0] shrink-0">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#6B7280]"
                aria-hidden
              />
              <input
                type="text"
                aria-label="Tìm người nhắn tin"
                placeholder="Tìm bác sĩ hoặc thành viên..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-8.5 rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] pl-8.5 pr-3 text-xs text-[#111827] placeholder:text-[#6B7280] focus:bg-white focus:border-[#16A34A] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Conversation list & Quick Start */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#EEF3F0]">
            {trimmedSearch.length >= 2 && (
              <div className="bg-[#F5FAF7]">
                <div className="px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
                  Kết quả tìm kiếm
                </div>
                {searchingUsers ? (
                  <p className="px-3.5 py-2.5 text-xs text-[#6B7280]">Đang tìm...</p>
                ) : matchedUsers.length === 0 ? (
                  <p className="px-3.5 py-2.5 text-xs text-[#6B7280]">Không tìm thấy thành viên phù hợp.</p>
                ) : (
                  matchedUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      disabled={isStartingChat}
                      onClick={() => {
                        void startChatWithUser(u.id);
                        setSearchTerm('');
                      }}
                      className="w-full px-3.5 py-2 flex items-center gap-2.5 text-left hover:bg-[#ECFDF3] transition-colors disabled:opacity-60"
                    >
                      <Avatar name={u.displayName} src={u.avatarUrl} size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-[#111827]">{u.displayName}</p>
                        <p className="truncate text-[11px] text-[#6B7280]">@{u.username}</p>
                      </div>
                      <span className="text-[11px] font-semibold text-[#16A34A] shrink-0">Nhắn</span>
                    </button>
                  ))
                )}
              </div>
            )}

            {loadingConvs ? (
              <div className="p-6 text-center text-xs text-[#6B7280]">Đang tải hội thoại...</div>
            ) : conversations.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-[#6B7280]">
                Chưa có cuộc trò chuyện nào.
              </div>
            ) : (
              conversations.map((c) => {
                const convUser = c.otherUser;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openConversation(c.id)}
                    className="w-full px-3.5 py-2.5 flex items-center gap-2.5 text-left hover:bg-[#F5FAF7] transition-colors"
                  >
                    <div className="relative shrink-0">
                      <Avatar
                        name={convUser?.displayName || 'Người dùng'}
                        src={convUser?.avatarUrl}
                        size="sm"
                      />
                      {c.isUnread && (
                        <span
                          className="absolute top-0 right-0 size-2.5 rounded-full bg-[#16A34A] ring-2 ring-white"
                          aria-hidden
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-[#111827]">
                          {convUser?.displayName || 'Người dùng'}
                        </span>
                        <span className="text-[10px] text-[#6B7280] shrink-0 tabular-nums">
                          {new Date(c.lastMessageAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <p
                        className={`truncate text-xs mt-0.5 ${
                          c.isUnread ? 'font-semibold text-[#111827]' : 'text-[#6B7280]'
                        }`}
                      >
                        {c.lastMessage ? c.lastMessage.content : 'Chưa có tin nhắn'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}

            {quickSuggestions.length > 0 && (
              <div className="bg-white">
                <div className="px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] bg-[#F5FAF7] border-b border-[#EEF3F0]">
                  Gợi ý nhắn nhanh
                </div>
                <div className="divide-y divide-[#EEF3F0]">
                  {quickSuggestions.slice(0, 4).map((item) => {
                    const subtitle =
                      item.user.specialty || item.user.institution || 'Chuyên gia NeuroLink';
                    return (
                      <button
                        key={item.user.id}
                        type="button"
                        disabled={isStartingChat}
                        onClick={() => void startChatWithUser(item.user.id)}
                        className="w-full px-3.5 py-2 flex items-center gap-2.5 text-left hover:bg-[#ECFDF3] transition-colors disabled:opacity-60"
                      >
                        <div className="relative shrink-0">
                          <Avatar
                            name={item.user.displayName}
                            src={item.user.avatarUrl}
                            size="xs"
                          />
                          <span
                            className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-[#16A34A] ring-2 ring-white"
                            aria-hidden
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-[#111827]">
                            {item.user.displayName}
                          </p>
                          <p className="truncate text-[11px] text-[#6B7280]">{subtitle}</p>
                        </div>
                        <span className="text-[11px] font-semibold text-[#16A34A] shrink-0">
                          Chat
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Sub-view 2 Header */}
          <div className="h-12 px-3 border-b border-[#DCE6DF] bg-white flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                aria-label="Quay lại danh sách"
                onClick={openInbox}
                className="flex size-7 items-center justify-center rounded-lg text-[#4B5563] hover:bg-[#ECFDF3] hover:text-[#15803D] transition-colors shrink-0"
              >
                <ArrowLeft className="size-4" aria-hidden />
              </button>
              <div className="relative shrink-0">
                <Avatar
                  name={other?.displayName || 'Trò chuyện'}
                  src={other?.avatarUrl}
                  size="xs"
                />
                <span
                  className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-[#16A34A] ring-2 ring-white"
                  aria-hidden
                />
              </div>
              {other?.username ? (
                <Link
                  to={`/u/${other.username}`}
                  className="text-xs sm:text-sm font-bold text-[#111827] hover:text-[#16A34A] truncate"
                >
                  {other.displayName || 'Trò chuyện'}
                </Link>
              ) : (
                <span className="text-xs sm:text-sm font-bold text-[#111827] truncate">
                  {other?.displayName || 'Trò chuyện'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {other?.username && (
                <Link
                  to={`/rewards?tab=transfer&to=${encodeURIComponent(other.username)}`}
                  onClick={minimizePopup}
                  title={`Chuyển Credit tới @${other.username}`}
                  aria-label="Chuyển Credit"
                  className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#BBF7D0] bg-[#ECFDF3] px-2 text-[11px] font-semibold text-[#15803D] hover:bg-[#DCFCE7] transition-colors shrink-0"
                >
                  <Coins className="size-3 shrink-0" aria-hidden />
                  <span>Chuyển Credit</span>
                </Link>
              )}
              <button
                type="button"
                aria-label="Mở toàn màn hình"
                onClick={() => {
                  navigate(`/messages?conv=${activeConvId}`);
                  closePopup();
                }}
                className="flex size-7 items-center justify-center rounded-lg text-[#4B5563] hover:bg-[#ECFDF3] hover:text-[#15803D] transition-colors"
              >
                <Maximize2 className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Thu gọn"
                onClick={minimizePopup}
                className="flex size-7 items-center justify-center rounded-lg text-[#4B5563] hover:bg-[#ECFDF3] hover:text-[#15803D] transition-colors"
              >
                <Minus className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Đóng"
                onClick={closePopup}
                className="flex size-7 items-center justify-center rounded-lg text-[#4B5563] hover:bg-[#FEF2F2] hover:text-[#DC2626] transition-colors"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2 bg-[#F7FAF8]">
            {loadingMsgs ? (
              <div className="py-8 text-center text-xs text-[#6B7280]">Đang tải tin nhắn...</div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center px-4 text-xs text-[#6B7280]">
                <MessageCircle className="size-7 text-[#16A34A]/50 mb-2" aria-hidden />
                <p>Chưa có tin nhắn. Hãy gửi lời chào đầu tiên.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.isSender ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={
                      msg.isSender
                        ? 'bg-[#16A34A] text-white rounded-2xl rounded-br-xs px-3.5 py-2 text-[13px] leading-snug max-w-[82%] break-words whitespace-pre-wrap'
                        : 'bg-white text-[#111827] border border-[#DCE6DF] rounded-2xl rounded-bl-xs px-3.5 py-2 text-[13px] leading-snug max-w-[82%] break-words whitespace-pre-wrap'
                    }
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <form
            onSubmit={handleSend}
            className="p-2.5 bg-white border-t border-[#DCE6DF] flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              aria-label="Nhập tin nhắn"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={4000}
              placeholder="Nhập tin nhắn..."
              className="flex-1 min-w-0 h-9 rounded-full border border-[#DCE6DF] bg-[#F5FAF7] px-3.5 text-xs sm:text-sm text-[#111827] placeholder:text-[#6B7280] focus:bg-white focus:border-[#16A34A] focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Gửi tin nhắn"
              disabled={!draft.trim() || sendMutation.isPending}
              className="size-8.5 rounded-full bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition-colors"
            >
              <Send className="size-3.5" aria-hidden />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
