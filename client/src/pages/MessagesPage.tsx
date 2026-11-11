import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useSearchParams, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, MessageSquare, ArrowLeft, Shield } from 'lucide-react';
import { messagesApi } from '../api/endpoints';
import { Avatar, Button, Card, Spinner } from '../components/ui';
import { ProfessionalBadge } from '../components/user/ProfessionalBadge';
import { useMode } from '../context/ModeContext';
import { errorMessage } from '../api/client';
import type { MessageItem } from '../api/types';

export function MessagesPage() {
  const { isProfessional } = useMode();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeConvId = searchParams.get('conv');

  const [messageText, setMessageText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Fetch conversations list
  const { data: convData, isLoading: loadingConvs } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagesApi.getConversations(),
    refetchInterval: 5000, // Poll every 5s for new messages
  });

  const conversations = convData?.conversations ?? [];

  // If no conversation is selected but conversations exist, select the first one on desktop
  useEffect(() => {
    if (!activeConvId && conversations.length > 0 && window.innerWidth >= 768) {
      setSearchParams({ conv: conversations[0]!.id });
    }
  }, [activeConvId, conversations, setSearchParams]);

  // 2. Fetch active conversation messages
  const { data: msgData, isLoading: loadingMsgs } = useQuery({
    queryKey: ['messages', activeConvId],
    queryFn: () => messagesApi.getMessages(activeConvId!),
    enabled: Boolean(activeConvId),
    refetchInterval: 3000, // Poll active chat every 3s
  });

  const messages = msgData?.items ?? [];

  // Scroll to bottom when messages load or change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: (text: string) => messagesApi.sendMessage(activeConvId!, text),
    onSuccess: (res) => {
      setMessageText('');
      queryClient.setQueryData<{ items: MessageItem[]; nextCursor: string | null; hasMore: boolean }>(
        ['messages', activeConvId],
        (old) => {
          if (!old) return { items: [res.message], nextCursor: null, hasMore: false };
          return { ...old, items: [...old.items, res.message] };
        },
      );
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !activeConvId) return;
    setError(null);
    sendMutation.mutate(messageText.trim());
  };

  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="mx-auto max-w-5xl h-[calc(100vh-8.5rem)] min-h-[520px]">
      <Card className="h-full grid grid-cols-1 md:grid-cols-[320px_1fr] overflow-hidden border-slate-200/70 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.04)] rounded-2xl">
        {/* Left: Conversation List (MindBridge Clean List) */}
        <div
          className={`flex flex-col border-r border-slate-200/80 bg-white h-full ${
            activeConvId ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div
            className={`p-4.5 border-b ${
              isProfessional
                ? 'bg-[#162B47] text-white border-slate-700'
                : 'bg-[#F0FDFA] text-slate-900 border-teal-200/70'
            }`}
          >
            <h1
              className={`font-bold text-base ${
                isProfessional ? 'text-white' : 'text-slate-900'
              }`}
            >
              {isProfessional ? 'Kênh Trao đổi & Hội chẩn Chuyên gia' : 'Hộp thư Trao đổi Trực tiếp'}
            </h1>
            <p className={`text-xs ${isProfessional ? 'text-slate-300' : 'text-slate-600'}`}>
              {isProfessional
                ? 'Liên lạc đồng nghiệp CCHN/ORCID và tư vấn người bệnh'
                : 'Tin nhắn trực tiếp bảo mật cùng bác sĩ và thành viên'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loadingConvs ? (
              <Spinner label="Đang tải danh sách..." />
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                <MessageSquare className="size-8 mx-auto text-slate-300" />
                <p>Chưa có cuộc trò chuyện nào.</p>
                <p className="text-[11px] text-slate-400">
                  Hãy ghé thăm mục Khám phá để kết nối với bác sĩ hoặc nhà nghiên cứu.
                </p>
              </div>
            ) : (
              conversations.map((c) => {
                const isActive = c.id === activeConvId;
                const other = c.otherUser;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSearchParams({ conv: c.id })}
                    className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors ${
                      isActive ? 'bg-sky-50/80 ring-1 ring-sky-200/80 shadow-2xs' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <Avatar name={other?.displayName || 'User'} src={other?.avatarUrl} size="md" className="ring-2 ring-slate-100" />
                      {c.isUnread && (
                        <span className="absolute top-0 right-0 size-2.5 rounded-full bg-accent-600 ring-2 ring-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                          {other?.displayName || 'Người dùng'}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(c.lastMessageAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <p
                        className={`text-xs truncate mt-0.5 ${
                          c.isUnread ? 'font-semibold text-slate-900' : 'text-slate-500'
                        }`}
                      >
                        {c.lastMessage ? c.lastMessage.content : 'Chưa có tin nhắn'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Active Chat Window (MindBridge Chat Surface) */}
        <div
          className={`flex flex-col h-full bg-[#F8FAFC] ${
            !activeConvId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {activeConvId && activeConv ? (
            <>
              {/* Chat Header */}
              <div className="h-16 px-4.5 border-b border-slate-200/80 bg-white flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setSearchParams({})}
                    className="md:hidden p-1.5 -ml-1.5 text-slate-500 hover:text-slate-800"
                    aria-label="Quay lại danh sách"
                  >
                    <ArrowLeft className="size-5" />
                  </button>
                  <Avatar
                    name={activeConv.otherUser?.displayName || 'User'}
                    src={activeConv.otherUser?.avatarUrl}
                    size="sm"
                    className="ring-2 ring-slate-100"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Link
                        to={`/u/${activeConv.otherUser?.username}`}
                        className="font-bold text-xs sm:text-sm text-slate-900 hover:text-brand-600 transition-colors truncate"
                      >
                        {activeConv.otherUser?.displayName}
                      </Link>
                      {activeConv.otherUser?.professionalProfiles?.map((p, idx) => (
                        <ProfessionalBadge key={idx} type={p.type} status={p.verificationStatus} compact />
                      ))}
                    </div>
                    <span className="text-[11px] text-slate-400">@{activeConv.otherUser?.username}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <Shield className="size-3.5 text-teal-600" />
                  <span className="hidden sm:inline">Mã hoá bảo mật</span>
                </div>
              </div>

              {/* Messages History (MindBridge Calming Bubbles) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
                {loadingMsgs ? (
                  <Spinner label="Đang tải lịch sử trao đổi..." />
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6 text-xs text-slate-400">
                    <MessageSquare className="size-8 text-slate-300 mb-2" />
                    Chưa có tin nhắn nào trong cuộc trao đổi này. Hãy gửi tin nhắn đầu tiên!
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSelf = msg.isSender;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col animate-slide-up ${isSelf ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm shadow-2xs leading-relaxed ${
                            isSelf
                              ? 'bg-[#E8F4FC] text-[#0F2942] border border-[#CCE5F7] rounded-tr-xs'
                              : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 px-1">
                          {new Date(msg.createdAt).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Box (MindBridge Pill Bar) */}
              <div className="p-3.5 bg-white border-t border-slate-200/70 shrink-0">
                {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
                <form onSubmit={handleSend} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nhập nội dung trao đổi... (Nhấn Enter để gửi)"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    maxLength={4000}
                    className="flex-1 rounded-full border border-slate-200/90 bg-slate-50/70 px-4.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100/60 transition-all"
                  />
                  <Button
                    type="submit"
                    loading={sendMutation.isPending}
                    disabled={!messageText.trim()}
                    className="rounded-full px-5"
                    icon={<Send className="size-3.5" />}
                  >
                    <span className="hidden sm:inline">Gửi</span>
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="size-14 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 mb-3 ring-4 ring-brand-50/50">
                <MessageSquare className="size-7" />
              </div>
              <h2 className="font-bold text-slate-800 text-base">Hộp thư NeuroLink</h2>
              <p className="text-xs text-slate-500 max-w-xs mt-1.5 leading-relaxed">
                Chọn một cuộc trò chuyện từ danh sách bên trái hoặc tìm kiếm chuyên gia để bắt đầu trao đổi học thuật.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
