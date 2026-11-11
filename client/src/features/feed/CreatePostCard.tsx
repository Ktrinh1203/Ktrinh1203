import { useState, useRef, type FormEvent } from 'react';
import { Image, X, Sparkles, Send, Tag, Shield } from 'lucide-react';
import { Alert, Avatar, Button, Card, Textarea } from '../../components/ui';
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
  const [content, setContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTopics, setShowTopics] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB per image
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

    // Generate previews
    const newPreviews = newFiles.map((file) => URL.createObjectURL(file));
    setPreviews(newPreviews);
  };

  const removeFile = (index: number) => {
    if (previews[index]) {
      URL.revokeObjectURL(previews[index]);
    }
    const updatedFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updatedFiles);
    const updatedPreviews = previews.filter((_, i) => i !== index);
    setPreviews(updatedPreviews);
  };

  const addTopic = (tag: string) => {
    if (content.includes(tag)) return;
    setContent((prev) => (prev ? `${prev.trim()}\n${tag} ` : `${tag} `));
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
      previews.forEach((url) => URL.revokeObjectURL(url));
      setContent('');
      setSelectedFiles([]);
      setPreviews([]);
      setShowTopics(false);
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
    ? 'Chia sẻ ca lâm sàng, hướng dẫn chẩn đoán hoặc góc nhìn y khoa chuyên sâu...'
    : isResearcher
    ? 'Chia sẻ phát hiện nghiên cứu, công nghệ giao diện não - máy tính (BCI), hoặc tài liệu học thuật...'
    : 'Đặt câu hỏi y khoa, chia sẻ hiểu biết hoặc thảo luận về sức khỏe não bộ...';

  return (
    <Card className="p-4 sm:p-5 border-slate-200/80 shadow-xs rounded-lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <Alert>{error}</Alert>}

        {/* Inline Clinical Composer Layout: Avatar + Textarea */}
        <div className="flex items-start gap-3">
          <Avatar
            name={user.displayName}
            src={user.avatarUrl}
            size="md"
            className="shrink-0 mt-0.5 ring-2 ring-slate-100"
          />
          <div className="flex-1 min-w-0">
            <Textarea
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
                }
              }}
              maxLength={5000}
              className="text-[14.5px] leading-relaxed resize-none border-slate-200/90 bg-slate-50/50 focus:bg-white focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 rounded-lg"
            />
          </div>
        </div>

        {/* Topic Suggestion Chips */}
        {showTopics && (
          <div className="flex flex-wrap items-center gap-1.5 pl-11 pt-0.5 animate-slide-up">
            <span className="text-xs text-slate-500 font-medium mr-1 flex items-center gap-1">
              <Sparkles className="size-3 text-brand-600" /> Chủ đề:
            </span>
            {TOPIC_PRESETS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => addTopic(tag)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  content.includes(tag)
                    ? 'bg-brand-600 text-white shadow-2xs font-semibold'
                    : 'bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Media Preview Gallery */}
        {previews.length > 0 && (
          <div className="space-y-2 pl-11 pt-1">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {previews.map((src, idx) => (
                <div
                  key={idx}
                  className="group relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shadow-xs"
                >
                  <img src={src} alt="Đính kèm" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-slate-900/80 text-white shadow-sm hover:bg-red-600 transition-colors"
                    aria-label="Xoá ảnh"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* PHI Patient Privacy Guardrail */}
            <div className="flex items-center gap-2 rounded-lg bg-amber-50/90 border border-amber-200/80 px-3 py-2 text-xs text-amber-900 animate-slide-up">
              <Shield className="size-4 text-amber-600 shrink-0" />
              <span className="leading-tight">
                <strong>Bảo mật Bệnh án (PHI):</strong> Hãy đảm bảo họ tên, mã bệnh nhân và khuôn mặt đã được che hoặc ẩn danh trước khi tải ảnh X-quang/MRI/EEG.
              </span>
            </div>
          </div>
        )}

        {/* Footer Toolbar */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 sm:pl-11">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={selectedFiles.length >= 4}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedFiles.length >= 4}
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-slate-600 hover:text-slate-900 border-slate-200/90 rounded-md h-8 whitespace-nowrap px-2.5"
              icon={<Image className="size-3.5 text-brand-600 shrink-0" />}
            >
              <span>Ảnh tư liệu</span>
              {selectedFiles.length > 0 && (
                <span className="ml-1 rounded bg-brand-50 px-1.5 text-[10px] font-bold text-brand-700 border border-brand-200">
                  {selectedFiles.length}/4
                </span>
              )}
            </Button>

            <button
              type="button"
              onClick={() => setShowTopics((v) => !v)}
              aria-expanded={showTopics}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors h-8 whitespace-nowrap ${
                showTopics
                  ? 'border-brand-300 bg-brand-50 text-brand-700'
                  : 'border-slate-200/90 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title="Thêm hashtag chủ đề lâm sàng / nghiên cứu"
            >
              <Tag className="size-3 text-brand-600 shrink-0" />
              <span>Chủ đề</span>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden sm:inline text-[11px] text-slate-400 font-mono">
              {content.length > 0 && `${content.length}/5000`}
            </span>
            <Button
              type="submit"
              size="sm"
              loading={submitting}
              disabled={!content.trim() && selectedFiles.length === 0}
              className="px-3.5 sm:px-4 shadow-xs h-8 rounded-md bg-brand-600 hover:bg-brand-700 text-white font-semibold whitespace-nowrap"
              icon={<Send className="size-3.5 shrink-0" />}
            >
              Chia sẻ
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
