import { useState, useRef, type FormEvent } from 'react';
import { Image, X, Shield } from 'lucide-react';
import { Alert, Avatar, Button, cn } from '../../components/ui';
import { useAuth } from '../auth/AuthContext';
import { postsApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';

const TOPIC_PRESETS = [
  '#LâmSàngThầnKinh',
  '#BCI_Neurotech',
  '#HìnhẢnhHọcNão',
  '#NghiênCứuKhoaHọc',
  '#TraoĐổiChuyênMôn',
];

export function CreatePostCard({ onPostCreated }: { onPostCreated: () => void }) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTopics, setShowTopics] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!user) return null;

  const openComposer = (focusTextarea = true) => {
    setExpanded(true);
    if (focusTextarea) {
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const MAX_SIZE = 10 * 1024 * 1024;
    const rawFiles = Array.from(e.target.files);
    const oversized = rawFiles.find((f) => f.size > MAX_SIZE);
    if (oversized) {
      setError(`Tệp "${oversized.name}" vượt quá giới hạn 10MB.`);
      return;
    }
    setError(null);
    const files = rawFiles.slice(0, 4 - selectedFiles.length);
    const newFiles = [...selectedFiles, ...files].slice(0, 4);
    setSelectedFiles(newFiles);

    previews.forEach((url) => URL.revokeObjectURL(url));
    const newPreviews = newFiles.map((file) => URL.createObjectURL(file));
    setPreviews(newPreviews);
  };

  const removeFile = (index: number) => {
    if (previews[index]) {
      URL.revokeObjectURL(previews[index]);
    }
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const addTopic = (tag: string) => {
    if (content.includes(tag)) return;
    setContent((prev) => (prev ? `${prev.trim()}\n${tag} ` : `${tag} `));
  };

  const resetComposer = () => {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setContent('');
    setSelectedFiles([]);
    setPreviews([]);
    setShowTopics(false);
    setError(null);
    setExpanded(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim() && selectedFiles.length === 0) {
      setError('Vui lòng nhập nội dung hoặc đính kèm ảnh để chia sẻ.');
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('content', content.trim());
      selectedFiles.forEach((file) => {
        formData.append('media', file);
      });

      await postsApi.create(formData);
      resetComposer();
      onPostCreated();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const isDoctor = user.professionalProfiles?.some((p) => p.type === 'HEALTHCARE_PROFESSIONAL');
  const isResearcher = user.professionalProfiles?.some((p) => p.type === 'RESEARCHER');

  const placeholderText = isDoctor
    ? 'Chia sẻ ca lâm sàng, hướng dẫn chẩn đoán hoặc góc nhìn y khoa...'
    : isResearcher
      ? 'Chia sẻ phát hiện nghiên cứu, công nghệ BCI hoặc tài liệu học thuật...'
      : 'Chia sẻ ghi chú, ca bệnh hoặc đặt câu hỏi...';

  if (!expanded && !content && selectedFiles.length === 0) {
    return (
      <div className="px-4 sm:px-5 py-3.5">
        <div className="flex items-center gap-3">
          <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
          <button
            type="button"
            onClick={() => openComposer(true)}
            className="flex-1 min-w-0 text-left text-sm text-[#8A8882] hover:text-[#575652] py-1.5 truncate focus:outline-none"
          >
            Chia sẻ ghi chú, ca bệnh hoặc đặt câu hỏi...
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[#6E6D68] hover:bg-[#EFF6F1] hover:text-[#15803D] transition-colors shrink-0"
            aria-label="Đính kèm ảnh"
          >
            <Image className="size-4" aria-hidden />
            <span>Ảnh</span>
          </button>
          <Button
            type="button"
            size="xs"
            onClick={() => openComposer(true)}
            className="shrink-0"
          >
            Đăng
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFileChange(e);
              setExpanded(true);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-5 py-3.5">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <Alert>{error}</Alert>}

        <div className="flex items-start gap-3">
          <Avatar name={user.displayName} src={user.avatarUrl} size="sm" className="mt-0.5" />
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              placeholder={placeholderText}
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  if (content.trim() || selectedFiles.length > 0) {
                    void handleSubmit(e);
                  }
                } else if (e.key === 'Escape' && !content.trim() && selectedFiles.length === 0) {
                  setExpanded(false);
                }
              }}
              maxLength={5000}
              className="w-full resize-none border-0 bg-transparent p-0 text-[15px] leading-relaxed text-[#141413] placeholder:text-[#8A8882] focus:outline-none focus:ring-0"
            />
          </div>
        </div>

        {showTopics && (
          <div className="flex flex-wrap items-center gap-1.5 pl-12">
            {TOPIC_PRESETS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => addTopic(tag)}
                className={cn(
                  'rounded-md px-2 py-0.5 text-xs transition-colors',
                  content.includes(tag)
                    ? 'bg-[#16A34A] text-white font-medium'
                    : 'border border-[#DCE6DF] bg-[#EFF6F1] text-[#374151] hover:bg-[#E2EFE6]',
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {previews.length > 0 && (
          <div className="space-y-2 pl-12">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {previews.map((src, idx) => (
                <div
                  key={idx}
                  className="group relative aspect-square rounded-lg overflow-hidden border border-[#DCE6DF] bg-[#F5FAF7]"
                >
                  <img src={src} alt="Đính kèm" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/75 text-white hover:bg-black transition-colors"
                    aria-label="Xoá ảnh"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] px-3 py-2 text-xs text-[#575652]">
              <Shield className="size-3.5 text-[#16A34A] shrink-0" aria-hidden />
              <span className="leading-tight">
                Hãy che họ tên, mã bệnh nhân và thông tin định danh trước khi tải ảnh y khoa.
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-[#DCE6DF] pt-2.5 pl-12">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={selectedFiles.length >= 4}
            />
            <button
              type="button"
              disabled={selectedFiles.length >= 4}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[#6E6D68] hover:bg-[#EFF6F1] hover:text-[#15803D] disabled:opacity-40 transition-colors"
            >
              <Image className="size-4" aria-hidden />
              <span>Ảnh</span>
              {selectedFiles.length > 0 && (
                <span className="text-[11px] text-[#8A8882]">{selectedFiles.length}/4</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowTopics((v) => !v)}
              aria-expanded={showTopics}
              className={cn(
                'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                showTopics
                  ? 'bg-[#ECFDF3] text-[#15803D]'
                  : 'text-[#6E6D68] hover:bg-[#EFF6F1] hover:text-[#15803D]',
              )}
            >
              #Chủ đề
            </button>
          </div>

          <div className="flex items-center gap-2">
            {content.length > 0 && (
              <span className="hidden sm:inline text-[11px] text-[#8A8882] tabular-nums">
                {content.length}/5000
              </span>
            )}
            <button
              type="button"
              onClick={resetComposer}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-[#6E6D68] hover:text-[#141413] transition-colors"
            >
              Hủy
            </button>
            <Button
              type="submit"
              size="xs"
              loading={submitting}
              disabled={!content.trim() && selectedFiles.length === 0}
            >
              Đăng
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
