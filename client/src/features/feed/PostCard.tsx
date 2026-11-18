import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import {
  Award,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Trash2,
  Edit2,
  Check,
  X,
  Share2,
  Copy,
  Maximize2,
  Flag,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postsApi, reportsApi } from '../../api/endpoints';
import { Avatar, Button, Textarea, cn } from '../../components/ui';
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

  useEffect(() => {
    setLikesCount(post.likesCount);
    setIsLiked(post.isLiked);
    setCommentsCount(post.commentsCount);
  }, [post.likesCount, post.isLiked, post.commentsCount]);

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
      setIsLiked(targetLiked);
      setLikesCount((prev) => (targetLiked ? prev + 1 : Math.max(0, prev - 1)));
    },
    onError: () => {
      setIsLiked(post.isLiked);
      setLikesCount(post.likesCount);
    },
    onSuccess: (res) => {
      setIsLiked(res.liked);
      setLikesCount(res.likesCount);
      post.isLiked = res.liked;
      post.likesCount = res.likesCount;
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

    const now = Date.now();
    if (now - lastLikeClickRef.current < 500) {
      return;
    }
    lastLikeClickRef.current = now;

    if (isLikeProcessingRef.current || likeMutation.isPending) {
      return;
    }

    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }

    isLikeProcessingRef.current = true;
    likeMutation.mutate(!isLiked);
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

  const renderFormattedContent = (text: string) => {
    const isLong = text.length > 380;
    const displayText = isLong && !isExpanded ? text.slice(0, 380) + '...' : text;
    const parts = displayText.split(/(#[a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]+)/g);

    return (
      <div className="space-y-1">
        <p className="text-[15px] text-[#222220] whitespace-pre-wrap break-words leading-[1.6]">
          {parts.map((part, i) => {
            if (part.startsWith('#')) {
              return (
                <Link
                  key={i}
                  to={`/search?q=${encodeURIComponent(part)}`}
                  className="font-medium text-[#16A34A] hover:text-[#15803D] hover:underline"
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
            className="text-xs font-medium text-[#16A34A] hover:text-[#15803D] hover:underline pt-0.5"
          >
            {isExpanded ? 'Thu gọn' : 'Xem thêm'}
          </button>
        )}
      </div>
    );
  };

  const createdAtDate = new Date(post.createdAt);
  const fullFormattedDate = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(createdAtDate);

  const formatNaturalDate = (date: Date) => {
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 60_000) return 'Vừa xong';
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 60) return `${diffMins} phút trước`;
    const diffHours = Math.floor(diffMs / 3_600_000);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 1) return 'Hôm qua';
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
    }).format(date);
  };
  const formattedDate = formatNaturalDate(createdAtDate);

  const verifiedProfiles =
    post.author.professionalProfiles?.filter((p) => p.verificationStatus === 'VERIFIED') ?? [];

  return (
    <article className="px-4 sm:px-5 py-4 transition-colors hover:bg-[#F5FAF7]/50">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to={`/u/${post.author.username}`} className="shrink-0">
            <Avatar name={post.author.displayName} src={post.author.avatarUrl} size="sm" />
          </Link>
          <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
            <Link
              to={`/u/${post.author.username}`}
              className="text-[14.5px] font-semibold text-[#141413] hover:underline truncate"
            >
              {post.author.displayName}
            </Link>
            {verifiedProfiles.map((p, idx) => (
              <ProfessionalBadge key={idx} type={p.type} status={p.verificationStatus} compact />
            ))}
            <span className="text-xs text-[#8A8882]">·</span>
            <time
              dateTime={post.createdAt}
              title={fullFormattedDate}
              className="text-xs text-[#8A8882]"
            >
              {formattedDate}
            </time>
          </div>
        </div>

        {/* Post Menu Button */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex size-7 items-center justify-center rounded-md text-[#8A8882] hover:bg-[#EFF6F1] hover:text-[#15803D] transition-colors"
            aria-label="Tuỳ chọn bài viết"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-[#DCE6DF] bg-white py-1 shadow-md"
            >
              <button
                role="menuitem"
                type="button"
                onClick={handleCopyLink}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#262624] hover:bg-[#EFF6F1] transition-colors"
              >
                <Copy className="size-3.5 text-[#6E6D68]" aria-hidden />
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
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#262624] hover:bg-[#EFF6F1] transition-colors"
                >
                  <Edit2 className="size-3.5 text-[#6E6D68]" aria-hidden />
                  <span>Chỉnh sửa bài viết</span>
                </button>
              )}

              {isProfessional && canEdit && (
                <Link
                  role="menuitem"
                  to={`/contributions?postId=${post.id}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#15803D] hover:bg-[#EFF6F1] transition-colors"
                >
                  <Award className="size-3.5 text-[#16A34A]" aria-hidden />
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
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#262624] hover:bg-[#EFF6F1] transition-colors"
                >
                  <Flag className="size-3.5 text-[#6E6D68]" aria-hidden />
                  <span>Báo cáo nội dung</span>
                </button>
              )}

              {canDelete && (
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    if (
                      confirm(
                        'Bạn có chắc chắn muốn xoá bài viết này không? Thao tác này không thể hoàn tác.',
                      )
                    ) {
                      deleteMutation.mutate();
                    }
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors border-t border-[#DCE6DF] mt-1 pt-1.5"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  <span>Xoá bài viết</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="mt-2">
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
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setIsEditing(false)}
                icon={<X className="size-3.5" />}
              >
                Huỷ
              </Button>
              <Button
                size="xs"
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

      {/* Media Gallery */}
      {post.media.length > 0 && (
        <div
          className={cn(
            'mt-3 grid gap-1.5 rounded-lg overflow-hidden border border-[#DCE6DF]',
            post.media.length === 1
              ? 'grid-cols-1'
              : post.media.length === 2
                ? 'grid-cols-2'
                : post.media.length === 3
                  ? 'grid-cols-3'
                  : 'grid-cols-2',
          )}
        >
          {post.media.map((m) => (
            <div
              key={m.id}
              onClick={() => setActiveImageModal(m.url)}
              className="group relative cursor-pointer aspect-video overflow-hidden bg-[#F5FAF7]"
            >
              <img
                src={m.url}
                alt="Ảnh bài viết"
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/15 flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded-full p-2">
                  <Maximize2 className="size-4" aria-hidden />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Minimal Left-Aligned Action Row */}
      <div className="mt-3 flex items-center gap-5 text-xs text-[#6E6D68]">
        <button
          type="button"
          onClick={handleToggleLike}
          disabled={likeMutation.isPending}
          aria-pressed={isLiked}
          aria-label={isLiked ? 'Bỏ thích' : 'Thích bài viết'}
          className={cn(
            'inline-flex items-center gap-1.5 transition-colors hover:text-[#141413] select-none',
            likeMutation.isPending && 'opacity-70 cursor-not-allowed',
            isLiked && 'text-[#B91C1C]',
          )}
        >
          <Heart
            className={cn(
              'size-4',
              isLiked ? 'fill-[#B91C1C] text-[#B91C1C]' : 'text-[#6E6D68]',
            )}
            aria-hidden
          />
          <span>{likesCount > 0 ? likesCount : 'Thích'}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 transition-colors hover:text-[#141413] select-none',
            showComments && 'text-[#141413] font-medium',
          )}
        >
          <MessageCircle className="size-4" aria-hidden />
          <span>{commentsCount > 0 ? commentsCount : 'Bình luận'}</span>
        </button>

        <button
          type="button"
          onClick={handleCopyLink}
          className={cn(
            'inline-flex items-center gap-1.5 transition-colors hover:text-[#141413] select-none',
            copied && 'text-[#16A34A] font-medium',
          )}
          title="Sao chép liên kết chia sẻ"
        >
          <Share2 className="size-3.5" aria-hidden />
          <span>{copied ? 'Đã chép' : 'Chia sẻ'}</span>
        </button>
      </div>

      {/* Inline Report Form */}
      {showReportForm && (
        <div className="mt-3 rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] p-3 text-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#141413] flex items-center gap-1.5">
              <Flag className="size-3.5 text-[#6E6D68]" aria-hidden /> Báo cáo bài viết tới Hội đồng Kiểm duyệt
            </span>
            <button
              type="button"
              onClick={() => setShowReportForm(false)}
              className="text-[#6E6D68] hover:text-[#141413]"
            >
              Đóng
            </button>
          </div>
          <select
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            className="w-full rounded-md border border-[#DCE6DF] bg-white px-2.5 py-1.5 text-xs text-[#141413] focus:border-[#16A34A] focus:outline-none"
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
        <div className="mt-2.5 rounded-md border border-[#86EFAC] bg-[#ECFDF3] px-3 py-1.5 text-xs font-medium text-[#15803D]">
          Đã gửi báo cáo tới Hội đồng Kiểm duyệt NeuroLink.
        </div>
      )}

      {/* Comment Section Drawer */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-[#DCE6DF]">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setActiveImageModal(null)}
        >
          <button
            type="button"
            onClick={() => setActiveImageModal(null)}
            className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 transition-colors"
            aria-label="Đóng ảnh phóng to"
          >
            <X className="size-5" aria-hidden />
          </button>
          <img
            src={activeImageModal}
            alt="Ảnh phóng to"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </article>
  );
}
