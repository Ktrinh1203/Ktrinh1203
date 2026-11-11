import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import {
  Award,
  MessageSquare,
  MoreHorizontal,
  Trash2,
  Edit2,
  Check,
  X,
  Share2,
  Copy,
  CheckCheck,
  Maximize2,
  Flag,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postsApi, reportsApi } from '../../api/endpoints';
import { Avatar, Button, Card, Textarea, cn } from '../../components/ui';
import { ProfessionalBadge } from '../../components/user/ProfessionalBadge';
import { useAuth } from '../auth/AuthContext';
import { useMode } from '../../context/ModeContext';
import { CommentSection } from './CommentSection';
import type { PostItem } from '../../api/types';

export function PostCard({
  post,
  onDeleted,
}: {
  post: PostItem;
  onDeleted?: (postId: string) => void;
}) {
  const { user } = useAuth();
  const { isProfessional } = useMode();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [showComments, setShowComments] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [menuOpen, setMenuOpen] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeImageModal, setActiveImageModal] = useState<string | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState('Thông tin y khoa chưa kiểm chứng');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const lastLikeClickRef = useRef<number>(0);
  const isLikeProcessingRef = useRef<boolean>(false);

  // Synchronize state when parent query refetches or post prop changes
  useEffect(() => {
    setLikesCount(post.likesCount);
    setIsLiked(post.isLiked);
    setCommentsCount(post.commentsCount);
  }, [post.likesCount, post.isLiked, post.commentsCount]);

  // Harden: Close post menu on outside click or Escape key
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  // Harden: Close image modal on Escape key
  useEffect(() => {
    if (!activeImageModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveImageModal(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeImageModal]);

  const canEdit = user?.id === post.author.id;
  const canDelete = user?.id === post.author.id || user?.role === 'ADMIN';

  const likeMutation = useMutation({
    mutationFn: (targetLiked: boolean) =>
      targetLiked ? postsApi.like(post.id) : postsApi.unlike(post.id),
    onMutate: async (targetLiked: boolean) => {
      // Optimistic update
      setIsLiked(targetLiked);
      setLikesCount((prev) => (targetLiked ? prev + 1 : Math.max(0, prev - 1)));
    },
    onError: () => {
      // Rollback
      setIsLiked(post.isLiked);
      setLikesCount(post.likesCount);
    },
    onSuccess: (res) => {
      setIsLiked(res.liked);
      setLikesCount(res.likesCount);
      post.isLiked = res.liked;
      post.likesCount = res.likesCount;
      // Synchronize in React Query caches so switching feeds or scrolling doesn't revert
      queryClient.setQueriesData<{ pages: { items: PostItem[] }[] }>(
        { queryKey: ['posts'] },
        (oldData) => {
          if (!oldData?.pages) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === post.id
                  ? { ...item, isLiked: res.liked, likesCount: res.likesCount }
                  : item,
              ),
            })),
          };
        },
      );
    },
    onSettled: () => {
      isLikeProcessingRef.current = false;
    },
  });

  const handleToggleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 1. Double-click prevention: Drop any click happening within 500ms of previous click
    const now = Date.now();
    if (now - lastLikeClickRef.current < 500) {
      return;
    }
    lastLikeClickRef.current = now;

    // 2. Lock guard: Ignore if mutation is still in flight
    if (isLikeProcessingRef.current || likeMutation.isPending) {
      return;
    }

    // 3. Auth guard
    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }

    isLikeProcessingRef.current = true;
    const targetLiked = !isLiked;
    likeMutation.mutate(targetLiked);
  };

  const editMutation = useMutation({
    mutationFn: (newContent: string) => postsApi.update(post.id, { content: newContent }),
    onSuccess: (res) => {
      post.content = res.post.content;
      setIsEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => postsApi.delete(post.id),
    onSuccess: () => {
      onDeleted?.(post.id);
      void queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });

  const reportMutation = useMutation({
    mutationFn: () =>
      reportsApi.create({
        targetType: 'POST',
        targetId: post.id,
        reason: reportReason,
      }),
    onSuccess: () => {
      setShowReportForm(false);
      setReportSubmitted(true);
      setTimeout(() => setReportSubmitted(false), 3500);
    },
  });

  const handleCopyLink = () => {
    const postUrl = `${window.location.origin}/u/${post.author.username}`;
    navigator.clipboard.writeText(postUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setMenuOpen(false);
    });
  };

  // Detect hashtags in content to highlight them
  const renderFormattedContent = (text: string) => {
    const isLong = text.length > 380;
    const displayText = isLong && !isExpanded ? text.slice(0, 380) + '...' : text;

    const parts = displayText.split(/(#[a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]+)/g);

    return (
      <div className="space-y-1">
        <p className="text-[15px] text-slate-800 whitespace-pre-wrap break-words leading-relaxed font-normal">
          {parts.map((part, i) => {
            if (part.startsWith('#')) {
              return (
                <Link
                  key={i}
                  to={`/search?q=${encodeURIComponent(part)}`}
                  className="font-medium text-brand-700 hover:text-brand-800 hover:underline"
                >
                  {part}
                </Link>
              );
            }
            return part;
          })}
        </p>
        {isLong && (
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="text-xs font-semibold text-brand-700 hover:underline pt-0.5"
          >
            {isExpanded ? 'Thu gọn' : 'Xem thêm'}
          </button>
        )}
      </div>
    );
  };

  const formattedDate = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(post.createdAt));

  const hasVerifiedAuthor = (post.author.professionalProfiles ?? []).some(
    (p) => p.verificationStatus === 'VERIFIED',
  );
  const isResearchTopic = /#BCI|#EEG|#Neuroscience|nghiên cứu|tín hiệu/i.test(post.content);

  return (
    <Card className="overflow-hidden border border-slate-200/80 shadow-xs hover:border-brand-300 transition-colors rounded-lg">
      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to={`/u/${post.author.username}`} className="group relative shrink-0">
              <Avatar
                name={post.author.displayName}
                src={post.author.avatarUrl}
                size="md"
                className="ring-2 ring-slate-100 transition-all group-hover:ring-brand-200"
              />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link
                  to={`/u/${post.author.username}`}
                  className="font-bold text-slate-800 hover:text-brand-600 transition-colors truncate text-sm sm:text-base"
                >
                  {post.author.displayName}
                </Link>
                {post.author.professionalProfiles?.map((p, idx) => (
                  <ProfessionalBadge key={idx} type={p.type} status={p.verificationStatus} compact />
                ))}
                {hasVerifiedAuthor && (
                  <span
                    className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider border ${
                      isResearchTopic
                        ? 'bg-brand-50 text-brand-700 border-brand-200'
                        : 'bg-accent-50 text-accent-700 border-accent-100'
                    }`}
                  >
                    {isResearchTopic ? 'BCI & RESEARCH' : 'CA LÂM SÀNG • HCP'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span>@{post.author.username}</span>
                <span>·</span>
                <span>{formattedDate}</span>
              </div>
            </div>
          </div>

          {/* Post Menu Button */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex size-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              aria-label="Tuỳ chọn bài viết"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <MoreHorizontal className="size-4" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg animate-in fade-in duration-100"
              >
                <button
                  role="menuitem"
                  type="button"
                  onClick={handleCopyLink}
                  className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Copy className="size-3.5 text-slate-400" />
                  <span>Sao chép liên kết</span>
                </button>

                {canEdit && (
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setIsEditing(true);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Edit2 className="size-3.5 text-slate-400" />
                    <span>Chỉnh sửa bài viết</span>
                  </button>
                )}

                {isProfessional && canEdit && (
                  <Link
                    role="menuitem"
                    to={`/contributions?postId=${post.id}`}
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50 transition-colors"
                  >
                    <Award className="size-3.5 text-brand-600" />
                    <span>Nộp xét duyệt Research Hub</span>
                  </Link>
                )}

                {user && user.id !== post.author.id && (
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setShowReportForm(true);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-medium text-amber-800 hover:bg-amber-50 transition-colors"
                  >
                    <Flag className="size-3.5 text-amber-600" />
                    <span>Báo cáo nội dung</span>
                  </button>
                )}

                {canDelete && (
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      if (confirm('Bạn có chắc chắn muốn xoá bài viết này không? Thao tác này không thể hoàn tác.')) {
                        deleteMutation.mutate();
                      }
                    }}
                    className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors border-t border-slate-100 mt-1"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Xoá bài viết</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="mt-3.5">
          {isEditing ? (
            <div className="space-y-2.5">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={3}
                maxLength={5000}
                className="text-sm"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} icon={<X className="size-3.5" />}>
                  Huỷ
                </Button>
                <Button
                  size="sm"
                  loading={editMutation.isPending}
                  disabled={!editContent.trim()}
                  onClick={() => editMutation.mutate(editContent.trim())}
                  icon={<Check className="size-3.5" />}
                >
                  Lưu thay đổi
                </Button>
              </div>
            </div>
          ) : (
            renderFormattedContent(post.content)
          )}
        </div>

        {/* Media Gallery (Clinical Viewer Frame) */}
        {post.media.length > 0 && (
          <div
            className={`mt-3.5 grid gap-1.5 rounded-lg overflow-hidden border border-slate-800 bg-slate-900 p-1.5 ${
              post.media.length === 1
                ? 'grid-cols-1'
                : post.media.length === 2
                ? 'grid-cols-2'
                : post.media.length === 3
                ? 'grid-cols-3'
                : 'grid-cols-2'
            }`}
          >
            {post.media.map((m) => (
              <div
                key={m.id}
                onClick={() => setActiveImageModal(m.url)}
                className="group relative cursor-pointer aspect-video overflow-hidden rounded-lg bg-slate-900"
              >
                <img
                  src={m.url}
                  alt="Ảnh bài viết"
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20 flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded-full p-2">
                    <Maximize2 className="size-4" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Bar */}
        <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs sm:text-sm text-slate-500">
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Endorse / Clinical Consensus Button */}
            <button
              type="button"
              onClick={handleToggleLike}
              disabled={likeMutation.isPending}
              aria-pressed={isLiked}
              aria-label={isLiked ? 'Bỏ ghi nhận' : 'Ghi nhận thành tích'}
              title={isLiked ? 'Bỏ ghi nhận thành tích' : 'Ghi nhận thành tích đóng góp này'}
              className={cn(
                'flex items-center gap-1.5 transition-all group select-none active:scale-95 px-2.5 py-1 rounded-md text-xs sm:text-sm',
                likeMutation.isPending && 'opacity-70 cursor-not-allowed',
                isLiked
                  ? 'bg-brand-50 text-brand-800 font-semibold border border-brand-200/80 shadow-2xs'
                  : 'hover:bg-slate-100 hover:text-brand-700 text-slate-600 border border-transparent',
              )}
            >
              <Award
                className={cn(
                  'size-4 transition-transform duration-200 group-hover:scale-110',
                  isLiked ? 'text-brand-600 animate-pop' : 'text-slate-400 group-hover:text-brand-600',
                  likeMutation.isPending && 'animate-pulse',
                )}
              />
              <span className="font-bold">{likesCount}</span>
              <span className="hidden sm:inline text-xs font-normal">ghi nhận</span>
            </button>

            {/* Comment Button */}
            <button
              type="button"
              onClick={() => setShowComments((v) => !v)}
              className={`flex items-center gap-1.5 transition-colors group select-none active:scale-95 px-2 py-1 rounded-md ${
                showComments ? 'text-brand-700 font-semibold bg-brand-50/50' : 'hover:text-brand-700 text-slate-600'
              }`}
            >
              <MessageSquare className="size-4 transition-transform duration-200 group-hover:scale-110 text-slate-400 group-hover:text-brand-600" />
              <span>{commentsCount}</span>
              <span className="hidden sm:inline text-xs font-normal">bình luận</span>
            </button>
          </div>

          {/* Share / Copy link button + Professional Research Hub shortcut */}
          <div className="flex items-center gap-3">
            {isProfessional && canEdit && (
              <Link
                to={`/contributions?postId=${post.id}`}
                className="inline-flex items-center gap-1 rounded bg-brand-50 border border-brand-200 px-2 py-0.5 text-[11px] font-bold text-brand-700 hover:bg-brand-100 transition-colors"
              >
                <Award className="size-3 text-brand-600" />
                <span>+Nộp Research Hub</span>
              </Link>
            )}
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors select-none"
              title="Sao chép liên kết chia sẻ"
            >
              {copied ? (
                <>
                  <CheckCheck className="size-4 text-emerald-600" />
                  <span className="text-emerald-700 font-medium">Đã chép link</span>
                </>
              ) : (
                <>
                  <Share2 className="size-4" />
                  <span className="hidden sm:inline">Chia sẻ</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Inline Report Form (Preserves Moderation Report Workflow) */}
        {showReportForm && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-900 flex items-center gap-1.5">
                <Flag className="size-3.5 text-amber-600" /> Báo cáo bài viết tới Hội đồng Kiểm duyệt
              </span>
              <button
                type="button"
                onClick={() => setShowReportForm(false)}
                className="text-slate-500 hover:text-slate-800"
              >
                Đóng
              </button>
            </div>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full rounded border border-amber-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
            >
              <option value="Thông tin y khoa chưa kiểm chứng">Thông tin y khoa chưa kiểm chứng</option>
              <option value="Tiết lộ dữ liệu định danh bệnh nhân (PHI)">Tiết lộ dữ liệu định danh bệnh nhân (PHI)</option>
              <option value="Quảng cáo thương mại / Spam">Quảng cáo thương mại / Spam</option>
              <option value="Ngôn từ không chuẩn mực">Ngôn từ không chuẩn mực</option>
            </select>
            <div className="flex justify-end gap-2">
              <Button size="xs" variant="ghost" onClick={() => setShowReportForm(false)}>
                Hủy
              </Button>
              <Button
                size="xs"
                loading={reportMutation.isPending}
                onClick={() => reportMutation.mutate()}
              >
                Gửi báo cáo
              </Button>
            </div>
          </div>
        )}

        {reportSubmitted && (
          <div className="mt-2.5 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-800">
            Đã gửi báo cáo tới Hội đồng Kiểm duyệt NeuroLink.
          </div>
        )}
      </div>

      {/* Comment Section Drawer */}
      {showComments && (
        <div className="animate-slide-up border-t border-slate-100">
          <CommentSection
            postId={post.id}
            postAuthorId={post.author.id}
            onCommentCountChange={(delta) => setCommentsCount((prev) => Math.max(0, prev + delta))}
          />
        </div>
      )}

      {/* Lightbox Image Modal */}
      {activeImageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setActiveImageModal(null)}
        >
          <button
            type="button"
            onClick={() => setActiveImageModal(null)}
            className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40 transition-colors"
            aria-label="Đóng ảnh phóng to"
          >
            <X className="size-6" />
          </button>
          <img
            src={activeImageModal}
            alt="Ảnh phóng to"
            className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl transition-transform duration-200 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Card>
  );
}
