import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import {
  Stethoscope,
  FlaskConical,
  Trash2,
  FileText,
  Upload,
  ShieldCheck,
  Clock,
  AlertCircle,
  ExternalLink,
  History,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { Alert, Button, Card, Field, Input, Spinner, Textarea } from '../components/ui';
import { authApi, usersApi, verificationsApi } from '../api/endpoints';
import { api, errorMessage, fieldErrors } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { ACCOUNT_ROLE_LABELS, useMode } from '../context/ModeContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PROFESSIONAL_LABEL, ProfessionalBadge } from '../components/user/ProfessionalBadge';
import type { CredentialDocumentType, VerificationRequestItem, VerificationRequestStatus } from '../api/types';

const REQUEST_STATUS_META: Record<
  VerificationRequestStatus,
  { label: string; colorClass: string }
> = {
  PENDING_REVIEW: {
    label: 'Đang chờ thẩm định',
    colorClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  IN_REVIEW: {
    label: 'Đang được Hội đồng xét duyệt',
    colorClass: 'bg-blue-50 text-blue-800 border-blue-200',
  },
  ADDITIONAL_INFO_REQUIRED: {
    label: 'Cần bổ sung minh chứng',
    colorClass: 'bg-orange-50 text-orange-800 border-orange-200',
  },
  VERIFIED: {
    label: 'Đã xác minh tích xanh',
    colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  REJECTED: {
    label: 'Từ chối xác minh',
    colorClass: 'bg-red-50 text-red-800 border-red-200',
  },
  REVOKED: {
    label: 'Đã thu hồi chứng nhận',
    colorClass: 'bg-slate-100 text-slate-700 border-slate-300',
  },
};

const DOCUMENT_TYPE_LABELS: Record<CredentialDocumentType, string> = {
  MEDICAL_LICENSE: 'Chứng chỉ hành nghề khám bệnh, chữa bệnh (CCHN)',
  HOSPITAL_STAFF_CARD: 'Thẻ bác sĩ / Quyết định bổ nhiệm bệnh viện',
  ACADEMIC_DEGREE: 'Bằng Tiến sĩ / Thạc sĩ / Bác sĩ Chuyên khoa',
  INSTITUTION_AFFILIATION: 'Giấy xác nhận công tác Viện nghiên cứu / Trường ĐH',
  ORCID_RECORD: 'Bản trích lục hồ sơ khoa học quốc tế ORCID / DOI',
  OTHER: 'Tài liệu minh chứng chuyên môn khác',
};

const VIETNAM_MEDICAL_AUTHORITIES = [
  { value: 'Bộ Y tế Việt Nam', label: 'Bộ Y tế Việt Nam (Cục Quản lý Khám, chữa bệnh)' },
  { value: 'Sở Y tế Thành phố Hà Nội', label: 'Sở Y tế Thành phố Hà Nội' },
  { value: 'Sở Y tế Thành phố Hồ Chí Minh', label: 'Sở Y tế Thành phố Hồ Chí Minh' },
  { value: 'Sở Y tế Thành phố Đà Nẵng', label: 'Sở Y tế Thành phố Đà Nẵng' },
  { value: 'Sở Y tế Thành phố Hải Phòng', label: 'Sở Y tế Thành phố Hải Phòng' },
  { value: 'Sở Y tế Thành phố Cần Thơ', label: 'Sở Y tế Thành phố Cần Thơ' },
  { value: 'Sở Y tế Tỉnh / Thành phố khác', label: 'Sở Y tế các Tỉnh / Thành phố khác' },
  { value: 'Cục Quân Y - Bộ Quốc Phòng', label: 'Cục Quân Y - Bộ Quốc Phòng' },
];

function ProfileSection() {
  const { user, setUser } = useAuth();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(user?.displayName ?? '');
    setBio(user?.bio ?? '');
  }, [user?.displayName, user?.bio]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (!displayName.trim()) {
      setErrors({ displayName: 'Vui lòng nhập tên hiển thị.' });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const { user: updated } = await usersApi.updateMe({
        displayName: displayName.trim(),
        bio: bio.trim() || null,
      });
      setUser(updated);
      void queryClient.invalidateQueries({ queryKey: ['users', updated.username] });
      setStatus({ tone: 'success', text: 'Đã lưu hồ sơ.' });
    } catch (err) {
      setErrors(fieldErrors(err));
      setStatus({ tone: 'error', text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-slate-900">Hồ sơ cơ bản</h2>
      <p className="text-sm text-slate-500">Thông tin hiển thị công khai với các thành viên.</p>
      <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
        {status && <Alert tone={status.tone}>{status.text}</Alert>}
        <Field label="E-mail (chỉ bạn nhìn thấy)" htmlFor="email">
          <Input id="email" value={user?.email ?? ''} disabled />
        </Field>
        <Field label="Tên hiển thị" htmlFor="displayName" error={errors.displayName}>
          <Input
            id="displayName"
            value={displayName}
            maxLength={80}
            onChange={(e) => setDisplayName(e.target.value)}
            invalid={!!errors.displayName}
          />
        </Field>
        <Field label="Giới thiệu" htmlFor="bio" error={errors.bio} hint={`${bio.length}/1000 ký tự`}>
          <Textarea
            id="bio"
            rows={4}
            maxLength={1000}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            Lưu thay đổi
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ProfessionalSection() {
  const { user, setUser } = useAuth();
  const {
    experience,
    accountRole,
    allRoles,
    verificationStatus,
    enableVerificationCenter,
    enableResubmission,
    isDualRoleProfessional,
  } = useMode();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [type, setType] = useState<'HEALTHCARE_PROFESSIONAL' | 'RESEARCHER'>(
    'HEALTHCARE_PROFESSIONAL',
  );
  const [title, setTitle] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [institution, setInstitution] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('Bộ Y tế Việt Nam');
  const [licenseOrOrcidNumber, setLicenseOrOrcidNumber] = useState('');
  const [documentType, setDocumentType] = useState<CredentialDocumentType>('MEDICAL_LICENSE');
  const [interests, setInterests] = useState('');
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: myVerifData, isLoading: loadingRequests } = useQuery({
    queryKey: ['my-verifications'],
    queryFn: () => verificationsApi.getMyRequests(),
  });

  const existingProfiles = user?.professionalProfiles ?? [];
  const myRequests: VerificationRequestItem[] = myVerifData?.requests ?? [];

  // Auto-prefill when user navigates via ?resubmit=true
  useEffect(() => {
    if (searchParams.get('resubmit') === 'true' && myRequests.length > 0 && !title) {
      const targetReq =
        myRequests.find((r) => r.status === 'REJECTED' || r.status === 'ADDITIONAL_INFO_REQUIRED') ??
        myRequests[0];
      if (targetReq) {
        setType(targetReq.profile.type);
        setTitle(targetReq.claimedTitle);
        setSpecialty(targetReq.claimedSpecialty);
        setInstitution(targetReq.claimedInstitution ?? '');
        setLicenseOrOrcidNumber(targetReq.licenseOrOrcidNumber ?? '');
        setInterests((targetReq.profile.researchInterests ?? []).join(', '));
      }
    }
  }, [searchParams, myRequests, title]);

  // Switch default document type when changing professional role
  function handleTypeSwitch(nextType: 'HEALTHCARE_PROFESSIONAL' | 'RESEARCHER') {
    setType(nextType);
    setDocumentType(
      nextType === 'HEALTHCARE_PROFESSIONAL' ? 'MEDICAL_LICENSE' : 'ORCID_RECORD',
    );
  }

  function prefillFromRequest(req: VerificationRequestItem) {
    setType(req.profile.type);
    setTitle(req.claimedTitle);
    setSpecialty(req.claimedSpecialty);
    setInstitution(req.claimedInstitution ?? '');
    setLicenseOrOrcidNumber(req.licenseOrOrcidNumber ?? '');
    setInterests((req.profile.researchInterests ?? []).join(', '));
    setSubmissionNotes('');
    window.scrollTo({ top: 380, behavior: 'smooth' });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);

    if (!title.trim() || !specialty.trim() || !institution.trim() || !licenseOrOrcidNumber.trim()) {
      setStatus({
        tone: 'error',
        text: 'Vui lòng điền đầy đủ Chức danh, Chuyên khoa, Đơn vị công tác và Mã số CCHN / ORCID.',
      });
      return;
    }

    if (files.length === 0) {
      setStatus({
        tone: 'error',
        text: 'Vui lòng đính kèm ít nhất 1 tài liệu minh chứng (PDF, PNG, JPG hoặc WebP tối đa 10MB).',
      });
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('title', title.trim());
      formData.append('specialty', specialty.trim());
      formData.append('institution', institution.trim());
      if (type === 'HEALTHCARE_PROFESSIONAL') {
        formData.append('issuingAuthority', issuingAuthority);
      }
      formData.append('licenseOrOrcidNumber', licenseOrOrcidNumber.trim());
      formData.append('documentType', documentType);
      if (interests.trim()) {
        formData.append('researchInterests', interests.trim());
      }
      if (submissionNotes.trim()) {
        formData.append('submissionNotes', submissionNotes.trim());
      }
      for (const f of files) {
        formData.append('documents', f);
      }

      await verificationsApi.submitRequest(formData);

      // Refresh current user and verification requests
      const meRes = await authApi.me();
      setUser(meRes.user);
      queryClient.setQueryData(['auth', 'me'], meRes);
      void queryClient.invalidateQueries({ queryKey: ['my-verifications'] });
      void queryClient.invalidateQueries({ queryKey: ['users', user?.username] });

      setTitle('');
      setSpecialty('');
      setInstitution('');
      setLicenseOrOrcidNumber('');
      setInterests('');
      setSubmissionNotes('');
      setFiles([]);
      setStatus({
        tone: 'success',
        text: 'Đã nộp hồ sơ và tài liệu minh chứng thành công! Hệ thống trợ lý OCR đã trích xuất dữ liệu sơ bộ và chuyển tới Hội đồng Quản trị viên để thẩm định.',
      });
    } catch (err) {
      setStatus({ tone: 'error', text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(profileType: 'HEALTHCARE_PROFESSIONAL' | 'RESEARCHER') {
    if (!confirm('Bạn có chắc muốn gỡ bỏ hồ sơ chuyên môn này?')) return;
    try {
      await api(`/users/me/professional/${profileType}`, { method: 'DELETE' });
      const meRes = await authApi.me();
      setUser(meRes.user);
      queryClient.setQueryData(['auth', 'me'], meRes);
      void queryClient.invalidateQueries({ queryKey: ['my-verifications'] });
      void queryClient.invalidateQueries({ queryKey: ['users', user?.username] });
    } catch (err) {
      alert(errorMessage(err));
    }
  }

  return (
    <Card id="verification-center" className="p-5 space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-brand-600" />
          <h2 className="font-semibold text-slate-900">
            Trung tâm Xác minh Chuyên gia & Phân giải Trải nghiệm Tự động
          </h2>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Hệ thống tự động phân giải trải nghiệm (General Mode / Professional Mode) dựa trên vai trò chuyên môn và trạng thái phê duyệt từ Hội đồng Quản trị viên. Tài liệu minh chứng được băm bảo mật SHA-256 và lưu trữ độc lập.
        </p>
      </div>

      {/* Automatic Role & Experience Resolution Summary Card */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Kết quả Phân giải Vai trò Tự động (Automatic Role Resolution)
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold border ${
              experience === 'PROFESSIONAL_MODE'
                ? 'bg-brand-600 text-white border-brand-700'
                : 'bg-teal-50 text-teal-800 border-teal-200'
            }`}
          >
            {experience === 'PROFESSIONAL_MODE' ? '🩺 PROFESSIONAL_MODE' : '👤 GENERAL_MODE'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-md bg-white p-2.5 border border-slate-200/80">
            <span className="text-[11px] text-slate-400 block">Vai trò Tài khoản (account_role)</span>
            <span className="font-bold text-slate-900 mt-0.5 block">
              {accountRole} — {ACCOUNT_ROLE_LABELS[accountRole]}
            </span>
            {isDualRoleProfessional && (
              <span className="mt-1 inline-block rounded bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 text-[10px] font-bold">
                Đa vai trò ({allRoles.join(' + ')})
              </span>
            )}
          </div>

          <div className="rounded-md bg-white p-2.5 border border-slate-200/80">
            <span className="text-[11px] text-slate-400 block">Trạng thái Xác minh (verification_status)</span>
            <span className="font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
              {verificationStatus === 'VERIFIED' && (
                <>
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span className="text-emerald-700">VERIFIED (Đã duyệt tích xanh)</span>
                </>
              )}
              {verificationStatus === 'PENDING' && (
                <>
                  <Clock className="size-3.5 text-amber-600" />
                  <span className="text-amber-800">PENDING (Đang chờ thẩm định)</span>
                </>
              )}
              {verificationStatus === 'REJECTED' && (
                <>
                  <AlertCircle className="size-3.5 text-red-600" />
                  <span className="text-red-700">REJECTED (Cần nộp lại minh chứng)</span>
                </>
              )}
              {verificationStatus === 'UNVERIFIED' && (
                <span className="text-slate-600">UNVERIFIED (Chưa đăng ký chuyên gia)</span>
              )}
            </span>
          </div>

          <div className="rounded-md bg-white p-2.5 border border-slate-200/80">
            <span className="text-[11px] text-slate-400 block">Trạng thái Cổng Xác minh</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {enableVerificationCenter && (
                <span className="rounded bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold">
                  enable_verification_center: true
                </span>
              )}
              {enableResubmission && (
                <span className="rounded bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 text-[10px] font-bold">
                  enable_resubmission: true
                </span>
              )}
              {!enableVerificationCenter && !enableResubmission && (
                <span className="text-slate-600 font-medium">
                  {verificationStatus === 'VERIFIED' ? 'Đã mở khoá toàn bộ công cụ Chuyên gia' : 'Sẵn sàng tiếp nhận hồ sơ'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Verification Center Pipeline for PENDING */}
        {verificationStatus === 'PENDING' && enableVerificationCenter && (
          <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-950 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-amber-900">
              <Clock className="size-4 text-amber-600" />
              <span>Trung tâm Xác minh Đang Hoạt động (Verification Center Enabled)</span>
            </div>
            <p className="text-amber-800 leading-relaxed">
              Tài khoản của bạn hiện hoạt động ở <strong>GENERAL_MODE</strong> trong thời gian chờ Quản trị viên đối chiếu chứng chỉ. Ngay khi được phê duyệt (<strong>VERIFIED</strong>), hệ thống sẽ tự động chuyển bạn sang <strong>PROFESSIONAL_MODE</strong>.
            </p>
          </div>
        )}

        {/* Resubmission Callout for REJECTED */}
        {verificationStatus === 'REJECTED' && enableResubmission && (
          <div className="rounded-md border border-red-200 bg-red-50/70 p-3 text-xs text-red-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-red-800">
                <RefreshCw className="size-4 text-red-600" />
                <span>Chế độ Nộp lại Minh chứng đã mở (Resubmission Enabled)</span>
              </div>
              <p className="text-red-800/90 leading-relaxed">
                Hồ sơ trước đó đã bị từ chối hoặc yêu cầu bổ sung. Vui lòng kiểm tra lý do bên dưới, đính kèm tài liệu rõ nét hơn và gửi lại để xét duyệt lại.
              </p>
            </div>
            {myRequests.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => prefillFromRequest(myRequests[0]!)}
                className="shrink-0 bg-red-600 hover:bg-red-700 text-white"
              >
                Điền lại từ hồ sơ cũ
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Existing Public Profiles */}
      {existingProfiles.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Huy hiệu chuyên môn trên trang cá nhân:
          </h3>
          {existingProfiles.map((p) => (
            <div
              key={p.id}
              className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start justify-between gap-3"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm text-slate-900">
                    {PROFESSIONAL_LABEL[p.type]}
                  </span>
                  <ProfessionalBadge type={p.type} status={p.verificationStatus} />
                </div>
                <p className="text-xs font-medium text-slate-700 mt-1">
                  {p.title} · {p.specialty}
                </p>
                {p.institution && <p className="text-xs text-slate-500">{p.institution}</p>}
                {p.licenseOrOrcidNumber && (
                  <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                    Mã số đăng ký: {p.licenseOrOrcidNumber}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(p.type)}
                icon={<Trash2 className="size-3.5 text-red-600" />}
              >
                Gỡ bỏ
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Verification Dossier History & Status Tracking */}
      {loadingRequests ? (
        <Spinner label="Đang tải tiến trình thẩm định..." />
      ) : (
        myRequests.length > 0 && (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <History className="size-3.5" /> Hồ sơ thẩm định đã nộp ({myRequests.length})
            </h3>
            {myRequests.map((req) => {
              const badgeMeta = REQUEST_STATUS_META[req.status];
              return (
                <div
                  key={req.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold text-slate-900">
                        {req.claimedTitle} — {req.claimedSpecialty}
                      </span>
                      <p className="text-xs text-slate-500">
                        {req.claimedInstitution} · Mã: <code className="font-mono">{req.licenseOrOrcidNumber}</code>
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeMeta.colorClass}`}
                    >
                      <Clock className="size-3" /> {badgeMeta.label}
                    </span>
                  </div>

                  {/* Reviewer Feedback / Rejection Reason */}
                  {(req.reviewNotes || req.rejectionReason) && (
                    <div
                      className={`p-3 rounded-lg border text-xs ${
                        req.status === 'ADDITIONAL_INFO_REQUIRED' || req.status === 'REJECTED'
                          ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <p className="font-semibold flex items-center gap-1.5 mb-0.5">
                        <AlertCircle className="size-3.5" /> Phản hồi từ Hội đồng thẩm định:
                      </p>
                      <p>{req.rejectionReason || req.reviewNotes}</p>
                      {(req.status === 'ADDITIONAL_INFO_REQUIRED' || req.status === 'REJECTED') && (
                        <button
                          type="button"
                          onClick={() => prefillFromRequest(req)}
                          className="mt-2 inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline"
                        >
                          Bổ sung tài liệu & Gửi lại hồ sơ này →
                        </button>
                      )}
                    </div>
                  )}

                  {/* Attached Private Documents */}
                  {req.documents.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-medium text-slate-400 block">
                        Tài liệu minh chứng bảo mật đã đính kèm:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {req.documents.map((doc) => (
                          <a
                            key={doc.id}
                            href={`/api/verifications/${req.id}/documents/${doc.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-800 transition-colors"
                          >
                            <FileText className="size-3.5 text-brand-600" />
                            <span className="truncate max-w-[200px]">{doc.fileName}</span>
                            <ExternalLink className="size-3 text-slate-400" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mini Audit Trail */}
                  {req.auditLogs.length > 0 && (
                    <div className="border-t border-slate-100 pt-2">
                      <p className="text-[11px] font-semibold text-slate-400 mb-1">
                        Nhật ký xử lý (Audit Trail):
                      </p>
                      <div className="space-y-1">
                        {req.auditLogs.slice(0, 3).map((log) => (
                          <div key={log.id} className="text-[11px] text-slate-500 flex items-center justify-between">
                            <span>
                              <strong>{log.action}</strong> → <span className="font-medium text-slate-700">{log.newState}</span>
                              {log.reason ? ` (${log.reason})` : ''}
                            </span>
                            <span className="text-slate-400">
                              {new Date(log.timestamp).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Submit / Resubmit Credential Dossier Form */}
      <form onSubmit={onSubmit} className="border-t border-slate-100 pt-4 space-y-4" noValidate>
        <h3 className="text-sm font-semibold text-slate-900">
          Nộp hoặc bổ sung Hồ sơ Xác minh Chuyên gia
        </h3>

        {status && <Alert tone={status.tone}>{status.text}</Alert>}

        {/* 4 Logical Professional Role Presets mapped cleanly onto HEALTHCARE_PROFESSIONAL & RESEARCHER */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-slate-600 block">
            Chọn nhóm vai trò chuyên môn đăng ký:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                handleTypeSwitch('HEALTHCARE_PROFESSIONAL');
                if (!title) setTitle('Bác sĩ Chuyên khoa Thần kinh');
              }}
              className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2 text-left hover:border-brand-400 hover:bg-brand-50/40 transition-colors"
            >
              <div className="font-bold text-slate-800">DOCTOR</div>
              <div className="text-[10px] text-slate-500">Bác sĩ Lâm sàng</div>
            </button>
            <button
              type="button"
              onClick={() => {
                handleTypeSwitch('HEALTHCARE_PROFESSIONAL');
                setDocumentType('HOSPITAL_STAFF_CARD');
                setTitle('Kỹ thuật viên Điện não đồ lâm sàng');
              }}
              className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2 text-left hover:border-brand-400 hover:bg-brand-50/40 transition-colors"
            >
              <div className="font-bold text-slate-800">HEALTHCARE_WORKER</div>
              <div className="text-[10px] text-slate-500">KTV EEG / Điều dưỡng</div>
            </button>
            <button
              type="button"
              onClick={() => {
                handleTypeSwitch('RESEARCHER');
                if (!title) setTitle('Nghiên cứu viên Thần kinh học & BCI');
              }}
              className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2 text-left hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
            >
              <div className="font-bold text-slate-800">RESEARCHER</div>
              <div className="text-[10px] text-slate-500">Nhà Nghiên cứu / GV</div>
            </button>
            <button
              type="button"
              onClick={() => {
                handleTypeSwitch('RESEARCHER');
                setDocumentType('INSTITUTION_AFFILIATION');
                setTitle('Sinh viên nghiên cứu Kỹ thuật Y sinh');
              }}
              className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2 text-left hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
            >
              <div className="font-bold text-slate-800">RESEARCH_STUDENT</div>
              <div className="text-[10px] text-slate-500">SV Nghiên cứu / NCS</div>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => handleTypeSwitch('HEALTHCARE_PROFESSIONAL')}
            className={`p-3 rounded-xl border text-left text-xs font-medium transition-colors ${
              type === 'HEALTHCARE_PROFESSIONAL'
                ? 'border-brand-600 bg-brand-50/60 text-brand-900 ring-1 ring-brand-600'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
          >
            <Stethoscope className="size-4 text-brand-600 mb-1" />
            <div className="font-semibold">Bác sĩ / Chuyên gia Y tế</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Xác minh Chứng chỉ hành nghề (CCHN) & Bệnh viện
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleTypeSwitch('RESEARCHER')}
            className={`p-3 rounded-xl border text-left text-xs font-medium transition-colors ${
              type === 'RESEARCHER'
                ? 'border-blue-600 bg-blue-50/60 text-blue-900 ring-1 ring-blue-600'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
          >
            <FlaskConical className="size-4 text-blue-600 mb-1" />
            <div className="font-semibold">Nhà nghiên cứu / Học thuật</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Xác minh hồ sơ ORCID, DOI hoặc Viện nghiên cứu
            </div>
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Chức danh chuyên môn"
            htmlFor="profTitle"
            hint="VD: Bác sĩ CKII Thần kinh, PGS.TS, NCS Tiến sĩ"
          >
            <Input
              id="profTitle"
              placeholder="Nhập chức danh..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          <Field
            label={type === 'HEALTHCARE_PROFESSIONAL' ? 'Chuyên khoa lâm sàng' : 'Lĩnh vực nghiên cứu'}
            htmlFor="specialty"
            hint="VD: Thần kinh học lâm sàng, Computational Neuroscience"
          >
            <Input
              id="specialty"
              placeholder="Nhập chuyên khoa / lĩnh vực..."
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Đơn vị công tác / Bệnh viện / Viện nghiên cứu"
            htmlFor="institution"
            hint="VD: Bệnh viện Bạch Mai, Đại học Quốc gia Hà Nội"
          >
            <Input
              id="institution"
              placeholder="Tên bệnh viện hoặc trường đại học..."
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            />
          </Field>

          {type === 'HEALTHCARE_PROFESSIONAL' ? (
            <Field
              label="Cơ quan có thẩm quyền cấp CCHN"
              htmlFor="issuingAuthority"
              hint="Theo Luật KCB: Chỉ Bộ Y tế hoặc Sở Y tế tỉnh/thành phố mới có thẩm quyền cấp CCHN"
            >
              <select
                id="issuingAuthority"
                value={issuingAuthority}
                onChange={(e) => setIssuingAuthority(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                {VIETNAM_MEDICAL_AUTHORITIES.map((auth) => (
                  <option key={auth.value} value={auth.value}>
                    {auth.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field
              label="Cổng định danh / Nguồn kiểm chứng học thuật"
              htmlFor="researchSource"
              hint="Hệ thống tự động liên kết với cơ sở dữ liệu mở ORCID quốc tế"
            >
              <Input
                id="researchSource"
                value="Hệ thống định danh khoa học quốc tế (ORCID Registry)"
                disabled
              />
            </Field>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={
              type === 'HEALTHCARE_PROFESSIONAL'
                ? 'Số Chứng chỉ hành nghề (CCHN)'
                : 'Mã định danh ORCID / DOI / Mã cán bộ'
            }
            htmlFor="licenseOrOrcid"
            hint={
              type === 'HEALTHCARE_PROFESSIONAL'
                ? 'VD: 012845/BYT-CCHN hoặc 004512/HNO-CCHN'
                : 'VD: 0000-0002-1825-0097'
            }
          >
            <Input
              id="licenseOrOrcid"
              placeholder={
                type === 'HEALTHCARE_PROFESSIONAL' ? '012845/BYT-CCHN' : '0000-0002-1825-0097'
              }
              value={licenseOrOrcidNumber}
              onChange={(e) => setLicenseOrOrcidNumber(e.target.value)}
            />
          </Field>

          <Field
            label="Loại tài liệu minh chứng đính kèm"
            htmlFor="documentType"
          >
            <select
              id="documentType"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as CredentialDocumentType)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {Object.entries(DOCUMENT_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label="Tải lên tài liệu minh chứng (Tối đa 3 tệp PDF, PNG, JPG, WebP — dưới 10MB/tệp)"
          htmlFor="verificationFiles"
          hint="Tài liệu được kiểm tra chữ ký nhị phân (Magic Bytes) và lưu trữ riêng tư ngoài thư mục công khai."
        >
          <label
            htmlFor="verificationFiles"
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-4 text-center cursor-pointer hover:border-brand-500 hover:bg-brand-50/30 transition-colors"
          >
            <Upload className="size-5 text-brand-600 mb-1" />
            <span className="text-xs font-medium text-slate-700">
              Nhấn để chọn tệp PDF hoặc ảnh chụp Chứng chỉ / Thẻ công tác
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5">
              Hỗ trợ: .pdf, .png, .jpg, .webp
            </span>
            <input
              id="verificationFiles"
              type="file"
              multiple
              accept=".pdf,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const selected = Array.from(e.target.files ?? []).slice(0, 3);
                setFiles(selected);
              }}
            />
          </label>
          {files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {files.map((f, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 border border-brand-200 px-2.5 py-1 text-xs font-medium text-brand-800"
                >
                  <FileText className="size-3.5" />
                  {f.name} ({(f.size / 1024).toFixed(1)} KB)
                </span>
              ))}
            </div>
          )}
        </Field>

        <Field
          label="Chủ đề nghiên cứu / Chuyên môn sâu (phân cách bằng dấu phẩy)"
          htmlFor="interests"
          hint="VD: Động kinh, Rối loạn giấc ngủ, Brain-Computer Interface (BCI)"
        >
          <Input
            id="interests"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
          />
        </Field>

        <Field
          label="Ghi chú gửi Hội đồng thẩm định (tuỳ chọn)"
          htmlFor="submissionNotes"
        >
          <Textarea
            id="submissionNotes"
            rows={2}
            placeholder="Thông tin giải trình thêm về văn bằng hoặc nơi công tác..."
            value={submissionNotes}
            onChange={(e) => setSubmissionNotes(e.target.value)}
          />
        </Field>

        <div className="flex justify-end">
          <Button type="submit" loading={saving} icon={<ShieldCheck className="size-4" />}>
            Nộp hồ sơ & Tài liệu xác minh
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PasswordSection() {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setStatus({ tone: 'error', text: 'Mật khẩu mới tối thiểu 8 ký tự, gồm cả chữ và số.' });
      return;
    }
    if (newPassword !== confirm) {
      setStatus({ tone: 'error', text: 'Mật khẩu xác nhận không khớp.' });
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setCurrent('');
      setNew('');
      setConfirm('');
      setStatus({
        tone: 'success',
        text: 'Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất.',
      });
    } catch (err) {
      setStatus({ tone: 'error', text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-slate-900">Đổi mật khẩu</h2>
      <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
        {status && <Alert tone={status.tone}>{status.text}</Alert>}
        <Field label="Mật khẩu hiện tại" htmlFor="currentPassword">
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field label="Mật khẩu mới" htmlFor="newPassword">
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
          />
        </Field>
        <Field label="Xác nhận mật khẩu mới" htmlFor="confirmPassword">
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={!currentPassword || !newPassword}>
            Đổi mật khẩu
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Cài đặt tài khoản & Hồ sơ chuyên gia</h1>
      <ProfileSection />
      <ProfessionalSection />
      <PasswordSection />
    </div>
  );
}
