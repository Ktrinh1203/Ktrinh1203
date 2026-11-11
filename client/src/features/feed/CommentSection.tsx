import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Trash2, Edit2, Check, X } from 'lucide-react';
import { postsApi } from '../../api/endpoints';
import { Alert, Avatar, Button, Spinner } from '../../components/ui';
import { ProfessionalBadge } from '../../components/user/ProfessionalBadge';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../../api/client';
import type { CommentItem } from '../../api/types';

export function CommentSection({
  postId,
  postAuthorId,
  onCommentCountChange,
}: {
  postId: string;
  postAuthorId: string;
  onCommentCountChange?: (delta: number) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['comments', postId],
    queryFn: () => postsApi.getComments(postId),
  });

  const createMutation = useMutation({
    mutationFn: (content: string) => postsApi.createComment(postId, content),
    onSuccess: (res) => {
      setNewContent('');
      queryClient.setQueryData<{ comments: CommentItem[] }>(['comments', postId], (old) => {
        return old ? { comments: [...old.comments, res.comment] } : { comments: [res.comment] };
      });
      onCommentCountChange?.(1);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      postsApi.updateComment(commentId, content),
    onSuccess: (res) => {
      setEditingId(null);
      queryClient.setQueryData<{ comments: CommentItem[] }>(['comments', postId], (old) => {
        if (!old) return old;
        return {
          comments: old.comments.map((c) => (c.id === res.comment.id ? res.comment : c)),
        };
      });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => postsApi.deleteComment(commentId),
    onSuccess: (_, commentId) => {
      queryClient.setQueryData<{ comments: CommentItem[] }>(['comments', postId], (old) => {
        if (!old) return old;
        return {
          comments: old.comments.filter((c) => c.id !== commentId),
        };
      });
      onCommentCountChange?.(-1);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    setError(null);
    createMutation.mutate(newContent.trim());
  };

  const handleStartEdit = (comment: CommentItem) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const handleSaveEdit = (commentId: string) => {
    if (!editContent.trim()) return;
    setError(null);
    updateMutation.mutate({ commentId, content: editContent.trim() });
  };

  const comments = data?.comments ?? [];

  return (
    <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:p-5 space-y-4">
      {error && <Alert>{error}</Alert>}

      {/* Comment Input */}
      {user && (
        <form onSubmit={handleCreate} className="flex items-center gap-3">
          <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              placeholder="Thảo luận, chia sẻ góc nhìn chuyên môn..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              maxLength={1000}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs sm:text-sm placeholder:text-slate-400 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 transition-colors shadow-2xs"
            />
            <Button
              type="submit"
              size="sm"
              loading={createMutation.isPending}
              disabled={!newContent.trim()}
              className="rounded-lg px-3.5 h-8 font-semibold"
              icon={<Send className="size-3.5" />}
            >
              <span className="hidden sm:inline">Gửi</span>
            </Button>
          </div>
        </form>
      )}

      {/* Comments List */}
      {isLoading ? (
        <Spinner label="Đang tải thảo luận..." />
      ) : comments.length === 0 ? (
        <p className="text-center py-3 text-xs text-slate-400">
          Chưa có ý kiến trao đổi. Hãy là người đầu tiên tham gia thảo luận!
        </p>
      ) : (
        <div className="space-y-3 pt-1">
          {comments.map((comment) => {
            const isAuthor = user?.id === comment.author.id;
            const canDelete = isAuthor || user?.id === postAuthorId || user?.role === 'ADMIN';

            return (
              <div key={comment.id} className="flex gap-2.5 text-sm group animate-slide-up">
                <Avatar name={comment.author.displayName} src={comment.author.avatarUrl} size="sm" />
                <div className="flex-1 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-slate-900 text-xs sm:text-sm">
                        {comment.author.displayName}
                      </span>
                      <span className="text-[11px] text-slate-400">@{comment.author.username}</span>
                      {comment.author.professionalProfiles?.map((p, idx) => (
                        <ProfessionalBadge key={idx} type={p.type} status={p.verificationStatus} compact />
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(comment.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>

                  {editingId === comment.id ? (
                    <div className="mt-2 space-y-2">
                      <input
                        type="text"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        maxLength={1000}
                        className="w-full rounded-xl border border-brand-500 px-3 py-1.5 text-sm focus:outline-none"
                        autoFocus
                      />
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          icon={<X className="size-3" />}
                        >
                          Huỷ
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(comment.id)}
                          loading={updateMutation.isPending}
                          icon={<Check className="size-3" />}
                        >
                          Lưu
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1.5 text-slate-800 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                      {comment.content}
                    </p>
                  )}

                  {/* Actions */}
                  {editingId !== comment.id && (isAuthor || canDelete) && (
                    <div className="mt-2 flex gap-3 text-[11px] text-slate-400 opacity-80 group-hover:opacity-100 transition-opacity border-t border-slate-50 pt-1.5">
                      {isAuthor && (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(comment)}
                          className="hover:text-slate-700 flex items-center gap-1 transition-colors"
                        >
                          <Edit2 className="size-3" /> Sửa
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(comment.id)}
                          className="hover:text-red-600 flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="size-3" /> Xoá
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
