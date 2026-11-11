import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  AlertTriangle,
  Check,
  X,
  EyeOff,
  Trash2,
  Building2,
  FileText,
  ExternalLink,
  ScanSearch,
  Lock,
  History,
  MessageSquareWarning,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ClipboardCheck,
  Award,
  Gift,
  Coins,
  Star,
  Plus,
} from 'lucide-react';
import { adminApi, adminRewardsApi } from '../api/endpoints';
import { Avatar, Button, Card, EmptyState, Input, Spinner, Textarea } from '../components/ui';
import { ProfessionalBadge } from '../components/user/ProfessionalBadge';
import { errorMessage } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import type {
  ContributionItem,
  CredentialDocumentType,
  RewardCategory,
  VerificationRequestItem,
  VerificationRequestStatus,
} from '../api/types';
import {
  CONTRIBUTION_CATEGORY_LABELS,
  CONTRIBUTION_STATUS_META,
} from './ContributionsPage';

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'PENDING_REVIEW', label: 'Chờ tiếp nhận (PENDING_REVIEW)' },
  { value: 'IN_REVIEW', label: 'Đang thẩm định (IN_REVIEW)' },
  { value: 'ADDITIONAL_INFO_REQUIRED', label: 'Chờ bổ sung (ADDITIONAL_INFO)' },
  { value: 'VERIFIED', label: 'Đã xác minh (VERIFIED)' },
  { value: 'REJECTED', label: 'Đã từ chối (REJECTED)' },
  { value: 'REVOKED', label: 'Đã thu hồi (REVOKED)' },
];

const STATUS_BADGE_STYLE: Record<
  VerificationRequestStatus,
  { label: string; className: string }
> = {
  PENDING_REVIEW: {
    label: 'Chờ tiếp nhận',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  IN_REVIEW: {
    label: 'Đang thẩm định',
    className: 'bg-blue-50 text-blue-800 border-blue-200',
  },
  ADDITIONAL_INFO_REQUIRED: {
    label: 'Yêu cầu bổ sung',
    className: 'bg-orange-50 text-orange-800 border-orange-200',
  },
  VERIFIED: {
    label: 'Đã cấp tích xanh',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  REJECTED: {
    label: 'Đã từ chối',
    className: 'bg-red-50 text-red-800 border-red-200',
  },
  REVOKED: {
    label: 'Đã thu hồi',
    className: 'bg-slate-100 text-slate-700 border-slate-300',
  },
};

const TIER_META: Record<
  'TIER_1' | 'TIER_2' | 'TIER_3' | 'FLAGGED',
  { label: string; className: string }
> = {
  TIER_1: {
    label: 'TIER 1 — Định danh chuẩn (CCHN / ORCID khớp mẫu)',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  TIER_2: {
    label: 'TIER 2 — Văn bằng / Giấy xác nhận cơ sở (Cần đối chiếu)',
    className: 'bg-blue-50 text-blue-800 border-blue-200',
  },
  TIER_3: {
    label: 'TIER 3 — Tài liệu bổ trợ / Cần đọc thủ công',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  FLAGGED: {
    label: 'FLAGGED — Cảnh báo tài liệu bất thường / Sai lệch nội dung / Không đúng chuyên môn',
    className: 'bg-red-50 text-red-800 border-red-300',
  },
};

const DOC_TYPE_SHORT: Record<CredentialDocumentType, string> = {
  MEDICAL_LICENSE: 'Chứng chỉ hành nghề (CCHN)',
  HOSPITAL_STAFF_CARD: 'Thẻ công tác Bệnh viện',
  ACADEMIC_DEGREE: 'Văn bằng Học thuật',
  INSTITUTION_AFFILIATION: 'Xác nhận Đơn vị nghiên cứu',
  ORCID_RECORD: 'Hồ sơ ORCID / DOI',
  OTHER: 'Tài liệu khác',
};

function DossierCard({
  req,
  currentAdminId,
  onDecision,
  isPending,
}: {
  req: VerificationRequestItem;
  currentAdminId: string;
  onDecision: (
    id: string,
    action: 'CLAIM' | 'APPROVE' | 'REJECT' | 'REQUEST_INFO' | 'REVOKE',
    rationale: string,
  ) => void;
  isPending: boolean;
}) {
  const [rationale, setRationale] = useState('');
  const [showAudit, setShowAudit] = useState(false);

  const isSelfRequest = req.userId === currentAdminId;
  const primaryDoc = req.documents[0] ?? null;
  const ocr = primaryDoc?.ocrData ?? null;
  const statusMeta = STATUS_BADGE_STYLE[req.status];

  return (
    <Card className="p-5 space-y-4 border-slate-200/90 shadow-xs">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-3">
          <Avatar name={req.user.displayName} src={req.user.avatarUrl} size="md" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-900">{req.user.displayName}</span>
              <span className="text-xs text-slate-400">@{req.user.username}</span>
              <ProfessionalBadge
                type={req.profile.type}
                status={req.profile.verificationStatus}
              />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Nộp lúc: {new Date(req.updatedAt).toLocaleString('vi-VN')}
              {req.reviewer && ` · Người duyệt: @${req.reviewer.username}`}
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.className}`}
        >
          {statusMeta.label}
        </span>
      </div>

      {/* Side-by-Side Reviewer Dossier Grid */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left Column: Claimed Credentials & Private Document Vault (5 cols) */}
        <div className="lg:col-span-5 space-y-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Building2 className="size-3.5 text-brand-600" /> 1. Thông tin ứng viên tự khai
          </h3>

          <dl className="space-y-2 text-xs">
            <div>
              <dt className="text-slate-400">Họ và tên tài khoản:</dt>
              <dd className="font-semibold text-slate-900">{req.user.displayName}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Chức danh đề xuất:</dt>
              <dd className="font-semibold text-slate-800">{req.claimedTitle}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Chuyên khoa / Lĩnh vực:</dt>
              <dd className="font-semibold text-slate-800">{req.claimedSpecialty}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Đơn vị công tác:</dt>
              <dd className="font-medium text-slate-800">{req.claimedInstitution || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Số CCHN / Mã ORCID đăng ký:</dt>
              <dd className="font-mono font-semibold text-brand-800 bg-white px-2 py-0.5 rounded border border-slate-200 inline-block mt-0.5">
                {req.licenseOrOrcidNumber || 'Chưa cung cấp'}
              </dd>
            </div>
            {req.submissionNotes && (
              <div>
                <dt className="text-slate-400">Ghi chú giải trình của ứng viên:</dt>
                <dd className="italic text-slate-700 bg-white p-2 rounded border border-slate-200 mt-0.5">
                  "{req.submissionNotes}"
                </dd>
              </div>
            )}
          </dl>

          {/* Private Documents List */}
          <div className="border-t border-slate-200 pt-3 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              Tài liệu lưu trữ riêng tư ({req.documents.length})
            </span>
            {req.documents.length === 0 ? (
              <p className="text-xs text-amber-700">Chưa có tài liệu đính kèm.</p>
            ) : (
              <div className="space-y-2">
                {req.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800 truncate">
                        {DOC_TYPE_SHORT[doc.documentType]}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {(doc.sizeBytes / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <a
                      href={`/api/admin/verifications/requests/${req.id}/documents/${doc.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-brand-700 font-semibold hover:underline break-all"
                    >
                      <FileText className="size-3.5 shrink-0" />
                      <span>{doc.fileName}</span>
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                    <div className="text-[10px] text-slate-400 font-mono truncate" title={doc.sha256Hash}>
                      SHA-256: {doc.sha256Hash.slice(0, 24)}...
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: OCR Evidence & Comparison Dossier (7 cols) */}
        <div className="lg:col-span-7 space-y-3 bg-white p-3.5 rounded-xl border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <ScanSearch className="size-4 text-brand-600" /> 2. Hồ sơ Đối chiếu Minh chứng OCR (Evidence Dossier)
            </h3>
            {ocr && (
              <span
                className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                  TIER_META[ocr.sourceReliabilityTier].className
                }`}
              >
                {TIER_META[ocr.sourceReliabilityTier].label}
              </span>
            )}
          </div>

          {!ocr ? (
            <div className="p-4 text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
              Không có dữ liệu OCR cho yêu cầu này. Vui lòng mở tài liệu gốc để kiểm tra thủ công.
            </div>
          ) : (
            <>
              {/* Mandatory Human-in-the-Loop Disclaimer */}
              <div className="rounded-lg bg-amber-50/70 border border-amber-200/80 px-3 py-2 text-[11px] text-amber-900 leading-relaxed space-y-1">
                <div>
                  <strong>Nguyên tắc Thẩm định (Human-in-the-Loop):</strong> {ocr.disclaimer}
                </div>
                {ocr.comparisonFlags.domainRelevanceWarning && (
                  <div className="text-red-700 font-semibold flex items-center gap-1.5 pt-1 border-t border-amber-200">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>
                      CẢNH BÁO TÀI LIỆU KHÔNG PHÙ HỢP: Nội dung tài liệu không chứa các từ khóa Y tế / Học thuật lâm sàng hoặc có dấu hiệu tệp kỹ thuật ngoài ngành (datasheet, phần cứng, tài liệu khác).
                    </span>
                  </div>
                )}
              </div>

              {/* Side-by-Side Comparison Table */}
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-2.5 font-semibold">Trường đối chiếu</th>
                      <th className="py-2 px-2.5 font-semibold">Ứng viên khai báo</th>
                      <th className="py-2 px-2.5 font-semibold">OCR bóc tách từ tài liệu</th>
                      <th className="py-2 px-2.5 font-semibold">Đánh giá tự động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-2 px-2.5 font-medium text-slate-600">Họ và tên</td>
                      <td className="py-2 px-2.5 text-slate-900 font-medium">{req.user.displayName}</td>
                      <td className="py-2 px-2.5 font-mono text-slate-800">
                        {ocr.extractedFields.fullName || '— (Chưa bóc tách)'}
                      </td>
                      <td className="py-2 px-2.5">
                        {ocr.extractedFields.fullName ? (
                          ocr.comparisonFlags.nameMismatchWarning ? (
                            <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
                              <AlertCircle className="size-3.5" /> Sai lệch ({Math.round(ocr.comparisonFlags.nameMatchScore * 100)}%)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                              <CheckCircle2 className="size-3.5" /> Khớp ({Math.round(ocr.comparisonFlags.nameMatchScore * 100)}%)
                            </span>
                          )
                        ) : (
                          <span className="text-amber-700 font-medium flex items-center gap-1">
                            <AlertCircle className="size-3.5" /> Không tìm thấy trên file
                          </span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-2.5 font-medium text-slate-600">Số CCHN / ORCID</td>
                      <td className="py-2 px-2.5 font-mono text-slate-900">
                        {req.licenseOrOrcidNumber || '—'}
                      </td>
                      <td className="py-2 px-2.5 font-mono text-slate-800">
                        {ocr.extractedFields.licenseNumber || '— (Chưa bóc tách)'}
                      </td>
                      <td className="py-2 px-2.5">
                        {ocr.extractedFields.licenseNumber ? (
                          ocr.comparisonFlags.licenseDocumentMatch ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                              <CheckCircle2 className="size-3.5" /> Khớp mã trên tài liệu
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
                              <AlertCircle className="size-3.5" /> Mã không khớp tài liệu
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                            <AlertCircle className="size-3.5" /> Mã chưa tìm thấy trong file
                          </span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-2.5 font-medium text-slate-600">Chuyên khoa / Lĩnh vực</td>
                      <td className="py-2 px-2.5 text-slate-900">{req.claimedSpecialty}</td>
                      <td className="py-2 px-2.5 text-slate-800">
                        {ocr.extractedFields.specialty || '— (Chưa bóc tách)'}
                      </td>
                      <td className="py-2 px-2.5">
                        {ocr.comparisonFlags.specialtyMatchWarning ? (
                          <span className="text-amber-700 font-semibold">Khác biệt từ khóa</span>
                        ) : ocr.extractedFields.specialty ? (
                          <span className="text-emerald-700 font-semibold">Tương thích</span>
                        ) : (
                          <span className="text-amber-700 font-medium flex items-center gap-1">
                            <AlertCircle className="size-3.5" /> Không có trong file
                          </span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-2.5 font-medium text-slate-600">Cơ quan & Ngày cấp</td>
                      <td className="py-2 px-2.5 text-slate-900">{req.claimedInstitution || '—'}</td>
                      <td className="py-2 px-2.5 text-slate-800">
                        {[ocr.extractedFields.issuingAuthority, ocr.extractedFields.issueDate]
                          .filter(Boolean)
                          .join(' · ') || '— (Chưa bóc tách)'}
                      </td>
                      <td className="py-2 px-2.5">
                        {ocr.comparisonFlags.dateInvalidWarning ? (
                          <span className="text-red-700 font-semibold">Ngày cấp bất thường</span>
                        ) : ocr.extractedFields.issueDate || ocr.extractedFields.issuingAuthority ? (
                          <span className="text-emerald-700 font-semibold">Đã trích xuất</span>
                        ) : (
                          <span className="text-slate-400">Chưa đối chiếu</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Raw OCR Text Snippet */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-400 block">
                  Văn bản trích xuất thô (OCR Raw Text Snippet — Untrusted Data):
                </span>
                <pre className="max-h-24 overflow-y-auto rounded-lg bg-slate-900 text-slate-100 p-2.5 text-[11px] font-mono whitespace-pre-wrap">
                  {ocr.ocrRawSnippet}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Reviewer Decision Controls & Anti-Self-Approval Guard */}
      <div className="border-t border-slate-100 pt-3.5 space-y-3">
        {isSelfRequest ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 font-medium">
            <Lock className="size-4 text-amber-700 shrink-0" />
            <span>
              <strong>Chốt chặn Bảo mật (Anti-Self-Approval):</strong> Bạn không được phép tự tiếp nhận hoặc phê duyệt hồ sơ xác minh của chính mình. Một Quản trị viên độc lập khác phải thực hiện thẩm định này.
            </span>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex-1">
              <Input
                placeholder="Nhập ghi chú thẩm định hoặc lý do từ chối / yêu cầu bổ sung / thu hồi (bắt buộc khi Từ chối/Thu hồi)..."
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {req.status === 'PENDING_REVIEW' && (
                <Button
                  variant="outline"
                  size="sm"
                  loading={isPending}
                  onClick={() => onDecision(req.id, 'CLAIM', rationale || 'Tiếp nhận thẩm định hồ sơ')}
                  icon={<ClipboardCheck className="size-3.5 text-blue-600" />}
                >
                  Tiếp nhận (CLAIM)
                </Button>
              )}

              {(req.status === 'PENDING_REVIEW' || req.status === 'IN_REVIEW') && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={isPending}
                    onClick={() => onDecision(req.id, 'REQUEST_INFO', rationale)}
                    icon={<MessageSquareWarning className="size-3.5 text-orange-600" />}
                  >
                    Yêu cầu bổ sung
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    loading={isPending}
                    onClick={() => onDecision(req.id, 'REJECT', rationale)}
                    icon={<X className="size-3.5 text-red-600" />}
                  >
                    Từ chối
                  </Button>

                  <Button
                    size="sm"
                    loading={isPending}
                    onClick={() =>
                      onDecision(
                        req.id,
                        'APPROVE',
                        rationale || 'Đã đối chiếu tài liệu minh chứng hợp lệ',
                      )
                    }
                    icon={<Check className="size-3.5" />}
                  >
                    Phê duyệt cấp tích xanh
                  </Button>
                </>
              )}

              {req.status === 'ADDITIONAL_INFO_REQUIRED' && (
                <Button
                  variant="outline"
                  size="sm"
                  loading={isPending}
                  onClick={() => onDecision(req.id, 'REJECT', rationale)}
                  icon={<X className="size-3.5 text-red-600" />}
                >
                  Từ chối hồ sơ
                </Button>
              )}

              {req.status === 'VERIFIED' && (
                <Button
                  variant="danger"
                  size="sm"
                  loading={isPending}
                  onClick={() => onDecision(req.id, 'REVOKE', rationale)}
                  icon={<RotateCcw className="size-3.5" />}
                >
                  Thu hồi tích xanh (REVOKE)
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Audit Log Toggle */}
        <div className="flex items-center justify-between text-xs pt-1">
          <button
            type="button"
            onClick={() => setShowAudit((v) => !v)}
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-medium"
          >
            <History className="size-3.5" />
            <span>
              {showAudit ? 'Ẩn nhật ký kiểm toán' : `Xem nhật ký kiểm toán bất biến (${req.auditLogs.length} bản ghi)`}
            </span>
          </button>
          {req.reviewNotes && (
            <span className="text-slate-500 italic">
              Ghi chú gần nhất: "{req.reviewNotes}"
            </span>
          )}
        </div>

        {showAudit && req.auditLogs.length > 0 && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1.5 text-xs">
            {req.auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 last:border-none pb-1.5 last:pb-0"
              >
                <div>
                  <span className="font-mono font-semibold text-slate-800">{log.action}</span>{' '}
                  <span className="text-slate-500">
                    ({log.previousState ?? 'NONE'} → <strong>{log.newState}</strong>)
                  </span>{' '}
                  bởi <span className="font-semibold text-slate-700">@{log.actor.username}</span>
                  {log.reason && <span className="text-slate-600"> — "{log.reason}"</span>}
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {new Date(log.timestamp).toLocaleString('vi-VN')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export function AdminPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<
    'verifications' | 'contributions' | 'rewards' | 'wallets' | 'reports'
  >('verifications');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [contribStatusFilter, setContribStatusFilter] = useState<string>('');
  const [walletSearch, setWalletSearch] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [newRewardOpen, setNewRewardOpen] = useState(false);
  const [newReward, setNewReward] = useState({
    name: '',
    description: '',
    category: 'PROFESSIONAL_COURSE' as RewardCategory,
    creditCost: 300,
    stockQuantity: '' as string,
    terms: '',
  });

  const [adjustWalletModal, setAdjustWalletModal] = useState<{
    id: string;
    username: string;
    currentBalance: number;
  } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(100);
  const [adjustReason, setAdjustReason] = useState<string>('');

  const [fulfillModal, setFulfillModal] = useState<{ id: string; name: string } | null>(null);
  const [fulfillInfo, setFulfillInfo] = useState<string>('');

  // 1. Verifications Query
  const { data: dossierData, isLoading: loadingDossiers } = useQuery({
    queryKey: ['admin-verification-requests', statusFilter],
    queryFn: () =>
      adminApi.getVerificationRequests(statusFilter ? { status: statusFilter } : undefined),
    enabled: activeTab === 'verifications',
  });

  // 2. Contributions Query
  const { data: contribData, isLoading: loadingContribs } = useQuery({
    queryKey: ['admin-contributions', contribStatusFilter],
    queryFn: () =>
      adminRewardsApi.getContributions(contribStatusFilter ? { status: contribStatusFilter } : undefined),
    enabled: activeTab === 'contributions',
  });

  // 3. Rewards & Overview Stats Query
  const { data: overviewData } = useQuery({
    queryKey: ['admin-rewards-overview'],
    queryFn: () => adminRewardsApi.getOverview(),
    enabled: activeTab === 'rewards' || activeTab === 'contributions' || activeTab === 'wallets',
  });

  const { data: catalogData, isLoading: loadingCatalog } = useQuery({
    queryKey: ['admin-rewards-catalog'],
    queryFn: () => adminRewardsApi.getCatalog(),
    enabled: activeTab === 'rewards',
  });

  const { data: redemptionsData, isLoading: loadingRedemptions } = useQuery({
    queryKey: ['admin-rewards-redemptions'],
    queryFn: () => adminRewardsApi.getRedemptions(),
    enabled: activeTab === 'rewards',
  });

  // 4. Wallets Query
  const { data: walletsData, isLoading: loadingWallets } = useQuery({
    queryKey: ['admin-wallets', walletSearch],
    queryFn: () => adminRewardsApi.getWallets(walletSearch || undefined),
    enabled: activeTab === 'wallets',
  });

  // 5. Reports Query
  const { data: reportsData, isLoading: loadingReports } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: () => adminApi.getReports('OPEN'),
    enabled: activeTab === 'reports',
  });

  // Mutations
  const decisionMutation = useMutation({
    mutationFn: ({
      id,
      action,
      rationale,
    }: {
      id: string;
      action: 'CLAIM' | 'APPROVE' | 'REJECT' | 'REQUEST_INFO' | 'REVOKE';
      rationale: string;
    }) =>
      adminApi.reviewVerificationRequest(id, {
        action,
        note: rationale || undefined,
        reason: rationale || undefined,
      }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-verification-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-verifications'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const claimContribMutation = useMutation({
    mutationFn: (id: string) => adminRewardsApi.claimContribution(id),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-contributions'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const reviewContribMutation = useMutation({
    mutationFn: (data: {
      id: string;
      decision: 'APPROVE' | 'REJECT' | 'REQUEST_REVISION';
      scoreAccuracy: number;
      scoreRelevance: number;
      scoreUsefulness: number;
      scoreOriginality: number;
      scoreImpact: number;
      awardedCredits: number;
      feedback: string;
    }) => adminRewardsApi.reviewContribution(data.id, data),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-contributions'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-rewards-overview'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const createRewardMutation = useMutation({
    mutationFn: (data: any) => adminRewardsApi.createReward(data),
    onSuccess: () => {
      setError(null);
      setNewRewardOpen(false);
      setNewReward({
        name: '',
        description: '',
        category: 'PROFESSIONAL_COURSE',
        creditCost: 300,
        stockQuantity: '',
        terms: '',
      });
      void queryClient.invalidateQueries({ queryKey: ['admin-rewards-catalog'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const toggleRewardMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminRewardsApi.updateReward(id, { isActive }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-rewards-catalog'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const redemptionDecisionMutation = useMutation({
    mutationFn: (data: {
      id: string;
      action: 'APPROVE' | 'REJECT' | 'FULFILL' | 'CANCEL';
      adminNote?: string;
      fulfillmentInfo?: string;
    }) => adminRewardsApi.reviewRedemption(data.id, data),
    onSuccess: () => {
      setError(null);
      setFulfillModal(null);
      setFulfillInfo('');
      void queryClient.invalidateQueries({ queryKey: ['admin-rewards-redemptions'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-rewards-overview'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const adjustWalletMutation = useMutation({
    mutationFn: (data: { walletId: string; amount: number; reason: string }) =>
      adminRewardsApi.adjustWallet(data.walletId, { amount: data.amount, reason: data.reason }),
    onSuccess: () => {
      setError(null);
      setAdjustWalletModal(null);
      setAdjustAmount(100);
      setAdjustReason('');
      void queryClient.invalidateQueries({ queryKey: ['admin-wallets'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-rewards-overview'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const resolveReportMutation = useMutation({
    mutationFn: ({
      id,
      status,
      action,
      resolutionNote,
    }: {
      id: string;
      status: 'RESOLVED' | 'DISMISSED';
      action?: string;
      resolutionNote?: string;
    }) => adminApi.resolveReport(id, { status, action, resolutionNote }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const requests = dossierData?.requests ?? [];
  const contributions = contribData?.contributions ?? [];
  const catalog = catalogData?.items ?? [];
  const redemptions = redemptionsData?.redemptions ?? [];
  const wallets = walletsData?.wallets ?? [];
  const reports = reportsData?.reports ?? [];
  const stats = overviewData?.stats;

  function handleDecision(
    id: string,
    action: 'CLAIM' | 'APPROVE' | 'REJECT' | 'REQUEST_INFO' | 'REVOKE',
    rationale: string,
  ) {
    setError(null);
    if (
      (action === 'REJECT' || action === 'REQUEST_INFO' || action === 'REVOKE') &&
      rationale.trim().length < 3
    ) {
      setError(
        'Vui lòng nhập lý do cụ thể (tối thiểu 3 ký tự) vào ô ghi chú trước khi Từ chối, Yêu cầu bổ sung hoặc Thu hồi chứng nhận.',
      );
      return;
    }
    decisionMutation.mutate({ id, action, rationale });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Trung tâm Quản trị & Thẩm định NeuroLink
        </h1>
        <p className="text-sm text-slate-500">
          Hệ thống Thẩm định Chuyên môn, Khen thưởng Đóng góp Học thuật và Quản lý Tín chỉ
        </p>
      </div>

      {/* Top Overview Metric Badges */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <Card className="p-3 border-slate-200">
            <span className="text-slate-400 block font-medium">Bài đóng góp chờ duyệt</span>
            <span className="text-xl font-black text-brand-600">{stats.contributions.pending}</span>
            <span className="text-slate-400 text-[11px] block mt-0.5">Tổng số: {stats.contributions.total}</span>
          </Card>
          <Card className="p-3 border-slate-200">
            <span className="text-slate-400 block font-medium">Tổng tín chỉ lưu hành</span>
            <span className="text-xl font-black text-amber-600">{stats.credits.totalInCirculation}</span>
            <span className="text-slate-400 text-[11px] block mt-0.5">Đã giải ngân: {stats.credits.totalEarned}</span>
          </Card>
          <Card className="p-3 border-slate-200">
            <span className="text-slate-400 block font-medium">Yêu cầu đổi quà chờ xử lý</span>
            <span className="text-xl font-black text-purple-600">{stats.rewards.pendingRedemptions}</span>
            <span className="text-slate-400 text-[11px] block mt-0.5">Phần thưởng mở: {stats.rewards.activeCatalogCount}</span>
          </Card>
          <Card className="p-3 border-slate-200">
            <span className="text-slate-400 block font-medium">Báo cáo vi phạm mở</span>
            <span className="text-xl font-black text-red-600">{reports.length}</span>
            <span className="text-slate-400 text-[11px] block mt-0.5">Hồ sơ CCHN: {requests.length}</span>
          </Card>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-xs font-semibold underline ml-3">
            Đóng
          </button>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
        <div className="flex flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('verifications')}
            className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-colors ${
              activeTab === 'verifications'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <ShieldCheck className="size-4" /> Thẩm định Bác sĩ/ORCID ({requests.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('contributions')}
            className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-colors ${
              activeTab === 'contributions'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Award className="size-4 text-brand-600" /> Xét duyệt Đóng góp ({contributions.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rewards')}
            className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-colors ${
              activeTab === 'rewards'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Gift className="size-4 text-purple-600" /> Phần thưởng & Đổi quà ({redemptions.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('wallets')}
            className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-colors ${
              activeTab === 'wallets'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Coins className="size-4 text-amber-600" /> Quản lý Ví Tín chỉ
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-colors ${
              activeTab === 'reports'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <AlertTriangle className="size-4" /> Báo cáo vi phạm ({reports.length})
          </button>
        </div>

        {activeTab === 'verifications' && (
          <div className="pb-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-brand-500 focus:outline-none"
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {activeTab === 'contributions' && (
          <div className="pb-2">
            <select
              value={contribStatusFilter}
              onChange={(e) => setContribStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-brand-500 focus:outline-none"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="SUBMITTED">Chờ duyệt (SUBMITTED)</option>
              <option value="UNDER_REVIEW">Đang thẩm định (UNDER_REVIEW)</option>
              <option value="NEEDS_REVISION">Yêu cầu sửa (NEEDS_REVISION)</option>
              <option value="APPROVED">Đã phê duyệt (APPROVED)</option>
              <option value="REJECTED">Đã từ chối (REJECTED)</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: VERIFICATIONS (EXISTING DOSSIER) */}
      {activeTab === 'verifications' && (
        <div className="space-y-4">
          {loadingDossiers ? (
            <Spinner label="Đang tải hồ sơ thẩm định và dữ liệu OCR..." />
          ) : requests.length === 0 ? (
            <Card>
              <EmptyState
                icon={<ShieldCheck className="size-6" />}
                title="Không có hồ sơ xác minh nào trong bộ lọc này"
                description="Chọn 'Tất cả trạng thái' để xem toàn bộ lịch sử hồ sơ đã duyệt hoặc chờ ứng viên gửi yêu cầu mới."
              />
            </Card>
          ) : (
            requests.map((req) => (
              <DossierCard
                key={req.id}
                req={req}
                currentAdminId={user?.id ?? ''}
                onDecision={handleDecision}
                isPending={decisionMutation.isPending}
              />
            ))
          )}
        </div>
      )}

      {/* TAB 2: CONTRIBUTIONS REVIEW QUEUE */}
      {activeTab === 'contributions' && (
        <div className="space-y-4">
          {loadingContribs ? (
            <Spinner label="Đang tải danh sách bài nộp đóng góp..." />
          ) : contributions.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Award className="size-6 text-brand-600" />}
                title="Không có bài nộp đóng góp nào trong hàng đợi"
                description="Khi các chuyên gia nộp bài viết vào chương trình, các bài nộp sẽ xuất hiện tại đây để Hội đồng chấm điểm 5 tiêu chí."
              />
            </Card>
          ) : (
            contributions.map((contrib) => {
              const isSelf = contrib.userId === user?.id;
              const catConfig = CONTRIBUTION_CATEGORY_LABELS[contrib.category];
              const statusMeta = CONTRIBUTION_STATUS_META[contrib.status];

              return (
                <Card key={contrib.id} className="p-5 space-y-4 border-slate-200 shadow-2xs">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={contrib.user.displayName} src={contrib.user.avatarUrl} size="md" />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900">{contrib.user.displayName}</span>
                          <span className="text-xs text-slate-400">@{contrib.user.username}</span>
                          {contrib.user.professionalProfiles?.map((p, idx) => (
                            <ProfessionalBadge key={idx} type={p.type} status={p.verificationStatus} compact />
                          ))}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Nộp: {new Date(contrib.createdAt).toLocaleString('vi-VN')} · Danh mục:{' '}
                          <span className="font-bold text-teal-800">{catConfig?.label ?? contrib.category}</span>
                        </p>
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>
                      {statusMeta.label}
                    </span>
                  </div>

                  {/* Post Content & Author Summary */}
                  <div className="grid gap-3 sm:grid-cols-2 text-xs">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">Bài viết gốc:</span>
                      <p className="text-slate-800 line-clamp-3 italic">"{contrib.post.content}"</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">Giá trị tác giả khai báo:</span>
                      <p className="text-slate-800 leading-relaxed">{contrib.summary}</p>
                    </div>
                  </div>

                  {/* Review Action Controls & Anti-Self-Review */}
                  {isSelf ? (
                    <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 font-medium">
                      <Lock className="size-4 text-amber-700 shrink-0" />
                      <span>
                        <strong>Anti-Self-Review:</strong> Bạn là tác giả của bài viết này. Quản trị viên không được phép tự tiếp nhận hoặc chấm điểm bài đóng góp của chính mình.
                      </span>
                    </div>
                  ) : (
                    <ContributionEvaluationForm
                      contribution={contrib}
                      onClaim={() => claimContribMutation.mutate(contrib.id)}
                      onReview={(data) => reviewContribMutation.mutate({ id: contrib.id, ...data })}
                      isPending={claimContribMutation.isPending || reviewContribMutation.isPending}
                    />
                  )}

                  {/* Previous Reviews History */}
                  {contrib.reviews.length > 0 && (
                    <div className="border-t border-slate-100 pt-3 space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Lịch sử đánh giá ({contrib.reviews.length} lần duyệt):
                      </span>
                      <div className="space-y-1.5 text-xs">
                        {contrib.reviews.map((rev) => (
                          <div key={rev.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="font-bold text-slate-800">@{rev.reviewer.username}</span>:{' '}
                              <span className="font-semibold text-brand-700">{rev.decision}</span> ({rev.scoreOverall}/5.0 điểm) — "{rev.feedback}"
                            </div>
                            <span className="text-slate-400 text-[11px]">{new Date(rev.createdAt).toLocaleDateString('vi-VN')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* TAB 3: REWARDS & REDEMPTIONS MANAGEMENT */}
      {activeTab === 'rewards' && (
        <div className="space-y-6">
          {/* Section 1: Redemptions Queue */}
          <Card className="p-5 space-y-4 border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Hàng đợi Xử lý Yêu cầu Đổi thưởng ({redemptions.length})</h3>
                <p className="text-xs text-slate-500">Phê duyệt cấp khóa học, vé hội nghị hoặc hoàn trả tín chỉ tự động nếu từ chối.</p>
              </div>
            </div>

            {loadingRedemptions ? (
              <Spinner label="Đang tải yêu cầu đổi quà..." />
            ) : redemptions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">Không có yêu cầu đổi thưởng nào cần xử lý.</div>
            ) : (
              <div className="space-y-3">
                {redemptions.map((redemption) => {
                  return (
                    <div key={redemption.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 text-xs space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-slate-900 text-sm">{redemption.reward.name}</span>
                          <p className="text-slate-500 text-[11px]">
                            Thành viên: <strong>{redemption.user?.displayName}</strong> (@{redemption.user?.username}) · Chi phí: <strong>{redemption.creditCost} tín chỉ</strong>
                          </p>
                        </div>
                        <span className="font-mono px-2 py-0.5 rounded bg-white border border-slate-200 font-bold">
                          {redemption.status}
                        </span>
                      </div>

                      {redemption.userNote && (
                        <p className="text-slate-700 bg-white p-2 rounded border border-slate-200">
                          <strong>Ghi chú của người đổi:</strong> {redemption.userNote}
                        </p>
                      )}

                      {redemption.fulfillmentInfo && (
                        <p className="text-emerald-800 bg-emerald-50 p-2 rounded border border-emerald-200">
                          <strong>Thông tin đã bàn giao:</strong> {redemption.fulfillmentInfo}
                        </p>
                      )}

                      {/* Action buttons */}
                      {redemption.status === 'REQUESTED' && (
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                          <Button
                            variant="outline"
                            size="sm"
                            loading={redemptionDecisionMutation.isPending}
                            onClick={() => {
                              const note = prompt('Nhập lý do từ chối (tín chỉ sẽ được hoàn trả tự động cho thành viên):');
                              if (note) {
                                redemptionDecisionMutation.mutate({
                                  id: redemption.id,
                                  action: 'REJECT',
                                  adminNote: note,
                                });
                              }
                            }}
                          >
                            Từ chối & Hoàn tín chỉ
                          </Button>
                          <Button
                            size="sm"
                            loading={redemptionDecisionMutation.isPending}
                            onClick={() => {
                              setFulfillModal({ id: redemption.id, name: redemption.reward.name });
                            }}
                            icon={<Check className="size-3.5" />}
                          >
                            Bàn giao quyền lợi (FULFILL)
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Section 2: Catalog Management */}
          <Card className="p-5 space-y-4 border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Quản trị Danh mục Phần thưởng ({catalog.length})</h3>
                <p className="text-xs text-slate-500">Thêm mới, bật/tắt hoặc điều chỉnh giá tín chỉ của các gói quyền lợi.</p>
              </div>
              <Button size="sm" onClick={() => setNewRewardOpen(true)} icon={<Plus className="size-4" />}>
                Thêm phần thưởng mới
              </Button>
            </div>

            {loadingCatalog ? (
              <Spinner label="Đang tải danh mục..." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {catalog.map((item) => (
                  <div key={item.id} className="p-3.5 rounded-xl border border-slate-200 bg-white text-xs flex flex-col justify-between space-y-2">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                          {item.creditCost} Tín chỉ
                        </span>
                        <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${item.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                          {item.isActive ? 'ĐANG MỞ' : 'TẠM KHÓA'}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900">{item.name}</h4>
                      <p className="text-slate-500 line-clamp-2">{item.description}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Đã đổi: {item.redeemedCount} lượt</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleRewardMutation.mutate({ id: item.id, isActive: !item.isActive })}
                      >
                        {item.isActive ? 'Tạm khóa' : 'Kích hoạt lại'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 4: WALLETS MANAGEMENT & AUDIT ADJUSTMENTS */}
      {activeTab === 'wallets' && (
        <Card className="p-5 space-y-4 border-slate-200 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Quản trị Ví Tín chỉ & Điều chỉnh Kiểm toán ({wallets.length})</h3>
              <p className="text-xs text-slate-500">Tra cứu số dư, lịch sử giao dịch và thực hiện điều chỉnh tín chỉ có lưu vết kiểm toán bắt buộc.</p>
            </div>
            <div className="w-64">
              <Input
                placeholder="Tìm theo username hoặc tên..."
                value={walletSearch}
                onChange={(e) => setWalletSearch(e.target.value)}
              />
            </div>
          </div>

          {loadingWallets ? (
            <Spinner label="Đang tải danh sách ví..." />
          ) : wallets.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">Không tìm thấy ví thành viên nào.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Thành viên</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Số dư khả dụng</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Tổng tích lũy</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Tổng đã đổi</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {wallets.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={w.user.displayName} src={w.user.avatarUrl} size="sm" />
                          <div>
                            <div className="font-bold text-slate-900">{w.user.displayName}</div>
                            <div className="text-[11px] text-slate-400">@{w.user.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-amber-600 text-sm">
                        {w.balance}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                        {w.totalEarned}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                        {w.totalSpent}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setAdjustWalletModal({
                              id: w.id,
                              username: w.user.username,
                              currentBalance: w.balance,
                            });
                          }}
                        >
                          Điều chỉnh ví
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 5: REPORTS (EXISTING) */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {loadingReports ? (
            <Spinner label="Đang tải báo cáo..." />
          ) : reports.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Check className="size-6 text-emerald-600" />}
                title="Không có báo cáo vi phạm nào chưa xử lý"
                description="Tất cả các báo cáo về spam, quấy rối hoặc sai lệch thông tin đã được giải quyết."
              />
            </Card>
          ) : (
            reports.map((r) => (
              <Card key={r.id} className="p-5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold px-2 py-0.5 rounded bg-red-100 text-red-800">
                    Lý do: {r.reason}
                  </span>
                  <span className="text-slate-400">
                    Báo cáo bởi @{r.reporter.username} lúc {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>

                {r.details && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200">
                    <strong>Chi tiết:</strong> {r.details}
                  </p>
                )}

                {r.post && (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                    <p className="text-slate-400 mb-1">
                      Bài viết của <strong>@{r.post.author.username}</strong> ({r.post.status}):
                    </p>
                    <p className="text-slate-800">{r.post.content}</p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={resolveReportMutation.isPending}
                    onClick={() =>
                      resolveReportMutation.mutate({
                        id: r.id,
                        status: 'DISMISSED',
                        resolutionNote: 'Không vi phạm tiêu chuẩn cộng đồng',
                      })
                    }
                  >
                    Bỏ qua báo cáo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={resolveReportMutation.isPending}
                    onClick={() =>
                      resolveReportMutation.mutate({
                        id: r.id,
                        status: 'RESOLVED',
                        action: 'HIDE_CONTENT',
                        resolutionNote: 'Đã ẩn nội dung vi phạm',
                      })
                    }
                    icon={<EyeOff className="size-3.5 text-amber-600" />}
                  >
                    Ẩn nội dung
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={resolveReportMutation.isPending}
                    onClick={() =>
                      resolveReportMutation.mutate({
                        id: r.id,
                        status: 'RESOLVED',
                        action: 'DELETE_CONTENT',
                        resolutionNote: 'Đã xoá vĩnh viễn nội dung vi phạm nghiêm trọng',
                      })
                    }
                    icon={<Trash2 className="size-3.5" />}
                  >
                    Xoá nội dung
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Modal: New Reward in Catalog */}
      {newRewardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-slate-900">Thêm Phần thưởng Mới vào Danh mục</h3>
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Tên phần thưởng:</label>
                <Input
                  value={newReward.name}
                  onChange={(e) => setNewReward({ ...newReward, name: e.target.value })}
                  placeholder="VD: Khóa học Đọc bản ghi EEG Nâng cao..."
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Mô tả chi tiết:</label>
                <Textarea
                  rows={3}
                  value={newReward.description}
                  onChange={(e) => setNewReward({ ...newReward, description: e.target.value })}
                  placeholder="Nêu rõ quyền lợi, thời lượng, đơn vị cấp chứng chỉ..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Danh mục:</label>
                  <select
                    value={newReward.category}
                    onChange={(e) => setNewReward({ ...newReward, category: e.target.value as any })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
                  >
                    <option value="PROFESSIONAL_COURSE">Khóa học Y khoa & CME</option>
                    <option value="CONFERENCE_ACCESS">Vé Hội nghị Khoa học</option>
                    <option value="ACADEMIC_RESOURCE">Cơ sở dữ liệu Học thuật</option>
                    <option value="MENTORING">Cố vấn Chuyên gia 1:1</option>
                    <option value="PROFESSIONAL_EVENT">Sự kiện Kết nối</option>
                    <option value="OTHER_BENEFIT">Quyền lợi Khác</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Chi phí tín chỉ:</label>
                  <Input
                    type="number"
                    min={1}
                    value={newReward.creditCost}
                    onChange={(e) => setNewReward({ ...newReward, creditCost: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Số lượng suất (Để trống nếu không giới hạn):</label>
                <Input
                  type="number"
                  placeholder="Không giới hạn"
                  value={newReward.stockQuantity}
                  onChange={(e) => setNewReward({ ...newReward, stockQuantity: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Điều kiện & Điều khoản:</label>
                <Input
                  placeholder="Dành cho chuyên gia verified..."
                  value={newReward.terms}
                  onChange={(e) => setNewReward({ ...newReward, terms: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={() => setNewRewardOpen(false)}>
                Hủy
              </Button>
              <Button
                size="sm"
                loading={createRewardMutation.isPending}
                onClick={() => {
                  createRewardMutation.mutate({
                    name: newReward.name,
                    description: newReward.description,
                    category: newReward.category,
                    creditCost: newReward.creditCost,
                    stockQuantity: newReward.stockQuantity ? Number(newReward.stockQuantity) : null,
                    terms: newReward.terms || undefined,
                    isMonetary: false,
                    payoutEnabled: false,
                  });
                }}
              >
                Tạo phần thưởng
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal: Adjust Wallet */}
      {adjustWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-slate-900">
              Điều chỉnh Ví Tín chỉ: @{adjustWalletModal.username}
            </h3>
            <p className="text-xs text-slate-500">
              Số dư hiện tại: <strong>{adjustWalletModal.currentBalance} tín chỉ</strong>. Mọi điều chỉnh được ghi nhận vào Sổ cái bất biến.
            </p>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Số lượng điều chỉnh (+ tăng, - giảm):</label>
                <Input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Lý do điều chỉnh (Bắt buộc tối thiểu 5 ký tự):</label>
                <Textarea
                  rows={3}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="VD: Khen thưởng bài viết phản biện xuất sắc theo quyết định của Hội đồng..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={() => setAdjustWalletModal(null)}>
                Hủy
              </Button>
              <Button
                size="sm"
                loading={adjustWalletMutation.isPending}
                onClick={() => {
                  adjustWalletMutation.mutate({
                    walletId: adjustWalletModal.id,
                    amount: adjustAmount,
                    reason: adjustReason.trim(),
                  });
                }}
              >
                Xác nhận điều chỉnh
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal: Fulfill Redemption */}
      {fulfillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-slate-900">Bàn giao Quyền lợi Phần thưởng</h3>
            <p className="text-xs text-slate-600 font-medium">"{fulfillModal.name}"</p>

            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-700">
                Thông tin truy cập / Mã vé / Tài khoản gửi đến thành viên:
              </label>
              <Textarea
                rows={4}
                value={fulfillInfo}
                onChange={(e) => setFulfillInfo(e.target.value)}
                placeholder="VD: Mã kích hoạt tài khoản CME: MED-2026-XYZ. Đường dẫn tham gia: https://..."
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={() => setFulfillModal(null)}>
                Hủy
              </Button>
              <Button
                size="sm"
                loading={redemptionDecisionMutation.isPending}
                onClick={() => {
                  redemptionDecisionMutation.mutate({
                    id: fulfillModal.id,
                    action: 'FULFILL',
                    fulfillmentInfo: fulfillInfo.trim(),
                  });
                }}
              >
                Xác nhận hoàn tất
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function ContributionEvaluationForm({
  contribution,
  onClaim,
  onReview,
  isPending,
}: {
  contribution: ContributionItem;
  onClaim: () => void;
  onReview: (data: any) => void;
  isPending: boolean;
}) {
  const [accuracy, setAccuracy] = useState(4);
  const [relevance, setRelevance] = useState(5);
  const [usefulness, setUsefulness] = useState(4);
  const [originality, setOriginality] = useState(4);
  const [impact, setImpact] = useState(4);
  const [awardedCredits, setAwardedCredits] = useState(250);
  const [feedback, setFeedback] = useState('');

  const overall = Number(((accuracy + relevance + usefulness + originality + impact) / 5).toFixed(2));

  return (
    <div className="space-y-3.5 border-t border-slate-100 pt-3">
      {contribution.status === 'SUBMITTED' ? (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Bài nộp đang ở trạng thái chờ tiếp nhận.</span>
          <Button size="sm" onClick={onClaim} loading={isPending} icon={<ClipboardCheck className="size-3.5 text-blue-600" />}>
            Tiếp nhận thẩm định (CLAIM)
          </Button>
        </div>
      ) : (
        <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
              <Star className="size-3.5 text-amber-500 fill-amber-500" /> Chấm điểm 5 Tiêu chí Thẩm định (Thang điểm 1 - 5):
            </h4>
            <span className="font-bold text-xs bg-white px-2 py-0.5 rounded border border-slate-200">
              Điểm tổng hợp: {overall} / 5.0
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-500 block">Độ chính xác Y học ({accuracy}/5)</label>
              <input type="range" min={1} max={5} value={accuracy} onChange={(e) => setAccuracy(Number(e.target.value))} className="w-full accent-brand-600" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-500 block">Độ phù hợp ({relevance}/5)</label>
              <input type="range" min={1} max={5} value={relevance} onChange={(e) => setRelevance(Number(e.target.value))} className="w-full accent-brand-600" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-500 block">Tính hữu ích ({usefulness}/5)</label>
              <input type="range" min={1} max={5} value={usefulness} onChange={(e) => setUsefulness(Number(e.target.value))} className="w-full accent-brand-600" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-500 block">Tính nguyên bản ({originality}/5)</label>
              <input type="range" min={1} max={5} value={originality} onChange={(e) => setOriginality(Number(e.target.value))} className="w-full accent-brand-600" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-500 block">Tác động ({impact}/5)</label>
              <input type="range" min={1} max={5} value={impact} onChange={(e) => setImpact(Number(e.target.value))} className="w-full accent-brand-600" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1 space-y-1">
              <label className="font-bold text-xs text-slate-700 block">Tín chỉ khen thưởng:</label>
              <Input type="number" min={10} max={2000} value={awardedCredits} onChange={(e) => setAwardedCredits(Number(e.target.value))} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <label className="font-bold text-xs text-slate-700 block">Nhận xét & Phản hồi thẩm định:</label>
              <Input placeholder="Nhận xét chuyên môn cho tác giả..." value={feedback} onChange={(e) => setFeedback(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => {
                if (!feedback.trim()) return alert('Vui lòng nhập lý do từ chối');
                onReview({
                  decision: 'REJECT',
                  scoreAccuracy: accuracy,
                  scoreRelevance: relevance,
                  scoreUsefulness: usefulness,
                  scoreOriginality: originality,
                  scoreImpact: impact,
                  awardedCredits: 0,
                  feedback: feedback.trim(),
                });
              }}
              icon={<X className="size-3.5 text-red-600" />}
            >
              Từ chối bài nộp
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => {
                if (!feedback.trim()) return alert('Vui lòng nêu rõ các điểm cần bổ sung');
                onReview({
                  decision: 'REQUEST_REVISION',
                  scoreAccuracy: accuracy,
                  scoreRelevance: relevance,
                  scoreUsefulness: usefulness,
                  scoreOriginality: originality,
                  scoreImpact: impact,
                  awardedCredits: 0,
                  feedback: feedback.trim(),
                });
              }}
              icon={<MessageSquareWarning className="size-3.5 text-orange-600" />}
            >
              Yêu cầu chỉnh sửa
            </Button>
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => {
                onReview({
                  decision: 'APPROVE',
                  scoreAccuracy: accuracy,
                  scoreRelevance: relevance,
                  scoreUsefulness: usefulness,
                  scoreOriginality: originality,
                  scoreImpact: impact,
                  awardedCredits,
                  feedback: feedback.trim() || 'Bài viết đạt tiêu chuẩn đóng góp học thuật xuất sắc.',
                });
              }}
              icon={<Check className="size-3.5" />}
            >
              Phê duyệt & Giải ngân Tín chỉ
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
