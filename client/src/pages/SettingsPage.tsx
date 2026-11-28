import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Camera,
  Clock,
  FileText,
  ImagePlus,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Alert, Avatar, Button, Input, Spinner, Textarea, cn } from '../components/ui';
import { authApi, usersApi, verificationsApi } from '../api/endpoints';
import { api, errorMessage, fieldErrors } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import type {
  CredentialDocumentType,
  SelfUser,
  VerificationRequestItem,
  VerificationRequestStatus,
} from '../api/types';

type SettingsTab = 'profile' | 'security' | 'verify';

const REQUEST_STATUS_META: Record<VerificationRequestStatus, { label: string; cls: string }> = {
  PENDING_REVIEW: { label: 'Chờ duyệt', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  IN_REVIEW: { label: 'Đang xét duyệt', cls: 'bg-blue-50 text-blue-800 border-blue-200' },
  ADDITIONAL_INFO_REQUIRED: { label: 'Cần bổ sung', cls: 'bg-orange-50 text-orange-800 border-orange-200' },
  VERIFIED: { label: 'Đã xác minh', cls: 'bg-[#ECFDF3] text-[#15803D] border-[#BBF7D0]' },
  REJECTED: { label: 'Từ chối', cls: 'bg-red-50 text-red-700 border-red-200' },
  REVOKED: { label: 'Đã thu hồi', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
};

const DOCUMENT_TYPE_OPTIONS: { value: CredentialDocumentType; label: string }[] = [
  { value: 'MEDICAL_LICENSE', label: 'Chứng chỉ hành nghề (CCHN)' },
  { value: 'HOSPITAL_STAFF_CARD', label: 'Thẻ bác sĩ / Quyết định bổ nhiệm' },
  { value: 'ACADEMIC_DEGREE', label: 'Bằng ThS / TS / BSCK' },
  { value: 'INSTITUTION_AFFILIATION', label: 'Xác nhận công tác Viện / Trường' },
  { value: 'ORCID_RECORD', label: 'Hồ sơ ORCID / DOI' },
  { value: 'OTHER', label: 'Tài liệu khác' },
];

const ISSUING_AUTHORITIES = [
  'Bộ Y tế Việt Nam',
  'Sở Y tế Thành phố Hà Nội',
  'Sở Y tế Thành phố Hồ Chí Minh',
  'Sở Y tế Thành phố Đà Nẵng',
  'Sở Y tế Thành phố Hải Phòng',
  'Sở Y tế Thành phố Cần Thơ',
  'Sở Y tế Tỉnh / Thành phố khác',
  'Cục Quân Y - Bộ Quốc Phòng',
];

function resolveInitialTab(searchParams: URLSearchParams, hash: string): SettingsTab {
  const tab = searchParams.get('tab');
  const section = searchParams.get('section');
  if (tab === 'profile') return 'profile';
  if (tab === 'security') return 'security';
  if (
    tab === 'verify' ||
    section === 'verification' ||
    searchParams.get('resubmit') === 'true' ||
    hash === '#verification-center'
  ) {
    return 'verify';
  }
  return 'profile';
}

function ProfileTab() {
  const { user, setUser } = useAuth();
  const queryClient = useQueryClient();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setDisplayName(user?.displayName ?? '');
    setBio(user?.bio ?? '');
  }, [user?.displayName, user?.bio]);

  function syncUserCache(updated: SelfUser) {
    setUser(updated);
    void queryClient.invalidateQueries({ queryKey: ['posts'] });
    void queryClient.invalidateQueries({ queryKey: ['user'] });
    void queryClient.invalidateQueries({ queryKey: ['users'] });
  }

  async function handleCoverChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStatus(null);
    setUploadingCover(true);
    try {
      const res = await usersApi.uploadCover(file);
      syncUserCache(res.user);
      setStatus({ tone: 'success', text: 'Đã cập nhật ảnh bìa.' });
    } catch (err) {
      setStatus({ tone: 'error', text: errorMessage(err) });
    } finally {
      setUploadingCover(false);
    }
  }

  async function handleRemoveCover() {
    setStatus(null);
    setUploadingCover(true);
    try {
      const res = await usersApi.removeCover();
      syncUserCache(res.user);
      setStatus({ tone: 'success', text: 'Đã gỡ ảnh bìa.' });
    } catch (err) {
      setStatus({ tone: 'error', text: errorMessage(err) });
    } finally {
      setUploadingCover(false);
    }
  }

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStatus(null);
    setUploadingAvatar(true);
    try {
      const res = await usersApi.uploadAvatar(file);
      syncUserCache(res.user);
      setStatus({ tone: 'success', text: 'Đã cập nhật ảnh đại diện.' });
    } catch (err) {
      setStatus({ tone: 'error', text: errorMessage(err) });
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleRemoveAvatar() {
    setStatus(null);
    setUploadingAvatar(true);
    try {
      const res = await usersApi.removeAvatar();
      syncUserCache(res.user);
      setStatus({ tone: 'success', text: 'Đã gỡ ảnh đại diện.' });
    } catch (err) {
      setStatus({ tone: 'error', text: errorMessage(err) });
    } finally {
      setUploadingAvatar(false);
    }
  }

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
      const res = await usersApi.updateMe({
        displayName: displayName.trim(),
        bio: bio.trim() || null,
      });
      syncUserCache(res.user);
      setStatus({ tone: 'success', text: 'Đã lưu thay đổi.' });
    } catch (err) {
      setErrors(fieldErrors(err));
      setStatus({ tone: 'error', text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#DCE6DF] bg-white overflow-hidden">
      {/* Cover Photo Banner */}
      <div className="relative h-36 sm:h-44 bg-[#E8F3EC]">
        {user?.coverUrl && (
          <img src={user.coverUrl} alt="Ảnh bìa" className="h-full w-full object-cover" />
        )}
        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleCoverChange}
        />
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <Button
            type="button"
            size="xs"
            variant="outline"
            loading={uploadingCover}
            onClick={() => coverInputRef.current?.click()}
            icon={<ImagePlus className="size-3.5 text-[#15803D]" />}
            className="bg-white/95 backdrop-blur-xs border-[#DCE6DF] text-[#111827] hover:bg-white"
          >
            Đổi ảnh bìa
          </Button>
          {user?.coverUrl && (
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={uploadingCover}
              onClick={handleRemoveCover}
              className="bg-white/95 backdrop-blur-xs border-[#DCE6DF] text-[#DC2626] hover:bg-[#FEF2F2]"
            >
              Gỡ
            </Button>
          )}
        </div>
      </div>

      <div className="px-5 pb-5">
        {/* Avatar Row */}
        <div className="-mt-10 mb-4 flex flex-wrap items-end justify-between gap-3">
          <Avatar
            name={user?.displayName ?? 'U'}
            src={user?.avatarUrl}
            size="xl"
            className="size-20 ring-4 ring-white"
          />

          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />

          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              size="xs"
              variant="outline"
              loading={uploadingAvatar}
              icon={<Camera className="size-3.5 text-[#15803D]" />}
              onClick={() => avatarInputRef.current?.click()}
              className="border-[#DCE6DF] text-[#15803D] hover:bg-[#F5FAF7]"
            >
              Đổi ảnh đại diện
            </Button>
            {user?.avatarUrl && (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={uploadingAvatar}
                onClick={handleRemoveAvatar}
                className="text-[#DC2626] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
              >
                Gỡ ảnh
              </Button>
            )}
          </div>
        </div>

        {/* Profile Form */}
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {status && <Alert tone={status.tone}>{status.text}</Alert>}

          <div className="space-y-1.5">
            <label htmlFor="displayName" className="block text-xs font-medium text-[#374151]">
              Tên hiển thị
            </label>
            <Input
              id="displayName"
              value={displayName}
              maxLength={80}
              onChange={(e) => setDisplayName(e.target.value)}
              invalid={!!errors.displayName}
              className="border-[#DCE6DF] focus:border-[#16A34A]"
            />
            {errors.displayName && (
              <p className="text-xs text-red-600" role="alert">
                {errors.displayName}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="bio" className="block text-xs font-medium text-[#374151]">
              Giới thiệu
            </label>
            <Textarea
              id="bio"
              rows={3}
              maxLength={1000}
              placeholder="Giới thiệu ngắn về bạn..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              invalid={!!errors.bio}
              className="border-[#DCE6DF] focus:border-[#16A34A]"
            />
            {errors.bio && (
              <p className="text-xs text-red-600" role="alert">
                {errors.bio}
              </p>
            )}
          </div>

          <p className="text-xs text-[#6B7280]">
            @{user?.username} · {user?.email}
          </p>

          <div className="flex justify-end">
            <Button
              type="submit"
              loading={saving}
              className="bg-[#16A34A] hover:bg-[#15803D] text-white"
            >
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PasswordTab() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setStatus({ tone: 'error', text: 'Mật khẩu mới tối thiểu 8 ký tự, gồm cả chữ và số.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus({ tone: 'error', text: 'Mật khẩu xác nhận không khớp.' });
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setStatus({ tone: 'success', text: 'Đã cập nhật mật khẩu.' });
    } catch (err) {
      setStatus({ tone: 'error', text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#DCE6DF] bg-white p-5">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {status && <Alert tone={status.tone}>{status.text}</Alert>}

        <div className="space-y-1.5">
          <label htmlFor="currentPassword" className="block text-xs font-medium text-[#374151]">
            Mật khẩu hiện tại
          </label>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="border-[#DCE6DF] focus:border-[#16A34A]"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="newPassword" className="block text-xs font-medium text-[#374151]">
            Mật khẩu mới
          </label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="border-[#DCE6DF] focus:border-[#16A34A]"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="block text-xs font-medium text-[#374151]">
            Xác nhận mật khẩu mới
          </label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="border-[#DCE6DF] focus:border-[#16A34A]"
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            loading={saving}
            disabled={!currentPassword || !newPassword}
            className="bg-[#16A34A] hover:bg-[#15803D] text-white"
          >
            Cập nhật mật khẩu
          </Button>
        </div>
      </form>
    </div>
  );
}

function VerificationTab() {
  const { user, setUser } = useAuth();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [type, setType] = useState<'HEALTHCARE_PROFESSIONAL' | 'RESEARCHER'>(
    'HEALTHCARE_PROFESSIONAL',
  );
  const [title, setTitle] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [institution, setInstitution] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState(ISSUING_AUTHORITIES[0]);
  const [licenseOrOrcidNumber, setLicenseOrOrcidNumber] = useState('');
  const [documentType, setDocumentType] = useState<CredentialDocumentType>('MEDICAL_LICENSE');
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyStep, setVerifyStep] = useState<1 | 2>(1);

  const { data: myVerifData, isLoading: loadingRequests } = useQuery({
    queryKey: ['my-verifications'],
    queryFn: () => verificationsApi.getMyRequests(),
  });

  const myRequests: VerificationRequestItem[] = myVerifData?.requests ?? [];
  const existingProfiles = user?.professionalProfiles ?? [];
  const hasVerifiedProfile = existingProfiles.some((p) => p.verificationStatus === 'VERIFIED');
  const latestRequest = myRequests[0] ?? null;

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
        setVerifyStep(1);
        setVerifyModalOpen(true);
      }
    }
  }, [searchParams, myRequests, title]);

  useEffect(() => {
    if (!verifyModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setStatus(null);
        setVerifyModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [verifyModalOpen]);

  function openVerifyModal() {
    setStatus(null);
    setVerifyStep(1);
    setVerifyModalOpen(true);
  }

  function handleNextStep() {
    setStatus(null);
    if (!title.trim() || !specialty.trim() || !institution.trim()) {
      setStatus({ tone: 'error', text: 'Vui lòng điền đủ chức danh, chuyên khoa và đơn vị công tác.' });
      return;
    }
    setVerifyStep(2);
  }

  function handleRoleChange(nextType: 'HEALTHCARE_PROFESSIONAL' | 'RESEARCHER') {
    setType(nextType);
    setDocumentType(nextType === 'HEALTHCARE_PROFESSIONAL' ? 'MEDICAL_LICENSE' : 'ORCID_RECORD');
  }

  async function handleDeleteProfile(profileType: 'HEALTHCARE_PROFESSIONAL' | 'RESEARCHER') {
    if (!confirm('Gỡ hồ sơ chuyên môn này?')) return;
    try {
      await api(`/users/me/professional/${profileType}`, { method: 'DELETE' });
      const meRes = await authApi.me();
      setUser(meRes.user);
      queryClient.setQueryData(['auth', 'me'], meRes);
      void queryClient.invalidateQueries({ queryKey: ['my-verifications'] });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err) {
      setStatus({ tone: 'error', text: errorMessage(err) });
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (!title.trim() || !specialty.trim() || !institution.trim() || !licenseOrOrcidNumber.trim()) {
      setStatus({ tone: 'error', text: 'Vui lòng điền đủ thông tin chuyên môn.' });
      return;
    }
    if (files.length === 0) {
      setStatus({ tone: 'error', text: 'Vui lòng tải lên ít nhất 1 ảnh hoặc PDF minh chứng.' });
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
      for (const f of files) {
        formData.append('documents', f);
      }

      await verificationsApi.submitRequest(formData);
      const meRes = await authApi.me();
      setUser(meRes.user);
      queryClient.setQueryData(['auth', 'me'], meRes);
      void queryClient.invalidateQueries({ queryKey: ['my-verifications'] });
      void queryClient.invalidateQueries({ queryKey: ['users'] });

      setTitle('');
      setSpecialty('');
      setInstitution('');
      setLicenseOrOrcidNumber('');
      setFiles([]);
      setVerifyModalOpen(false);
      setVerifyStep(1);
      setStatus({ tone: 'success', text: 'Đã gửi hồ sơ xác minh.' });
    } catch (err) {
      setStatus({ tone: 'error', text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div id="verification-center" className="rounded-xl border border-[#DCE6DF] bg-white p-5 space-y-4">
      {/* Compact Verification Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DCE6DF] bg-[#F5FAF7] p-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-[#16A34A] shrink-0" />
            <h2 className="text-sm font-bold text-[#111827]">
              {hasVerifiedProfile
                ? 'Đã xác minh chuyên gia'
                : latestRequest
                  ? `Hồ sơ gần nhất: ${REQUEST_STATUS_META[latestRequest.status].label}`
                  : 'Chưa xác minh chuyên gia'}
            </h2>
          </div>
          <p className="text-xs text-[#4B5563] leading-relaxed">
            Gửi chứng chỉ hành nghề hoặc ORCID để gắn tích xanh, đọc ca tư vấn và đóng góp nghiên cứu.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={openVerifyModal}
          icon={<ShieldCheck className="size-4" />}
          className="bg-[#16A34A] hover:bg-[#15803D] text-white shrink-0"
        >
          {existingProfiles.length > 0 || myRequests.length > 0
            ? 'Cập nhật hồ sơ'
            : 'Gửi hồ sơ xác minh'}
        </Button>
      </div>

      {!verifyModalOpen && status && <Alert tone={status.tone}>{status.text}</Alert>}

      {existingProfiles.length > 0 && (
        <div className="space-y-2">
          {existingProfiles.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] px-3.5 py-2.5 text-xs"
            >
              <div className="min-w-0">
                <p className="font-semibold text-[#111827] truncate">
                  {p.title} · {p.specialty}
                </p>
                {p.institution && <p className="text-[#6B7280] truncate">{p.institution}</p>}
              </div>
              <button
                type="button"
                onClick={() => handleDeleteProfile(p.type)}
                className="inline-flex items-center gap-1 text-[#DC2626] hover:underline shrink-0"
              >
                <Trash2 className="size-3.5" /> Gỡ
              </button>
            </div>
          ))}
        </div>
      )}

      {loadingRequests ? (
        <Spinner label="Đang tải..." />
      ) : (
        myRequests.length > 0 && (
          <div className="space-y-2">
            {myRequests.map((req) => {
              const meta = REQUEST_STATUS_META[req.status];
              const note = req.rejectionReason || req.reviewNotes;
              return (
                <div
                  key={req.id}
                  className="rounded-lg border border-[#DCE6DF] bg-[#F5FAF7]/60 p-3 text-xs space-y-1"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[#111827]">
                      {req.claimedTitle} · {req.claimedSpecialty}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                        meta.cls,
                      )}
                    >
                      <Clock className="size-3" /> {meta.label}
                    </span>
                  </div>
                  <p className="text-[#6B7280]">
                    {new Date(req.createdAt).toLocaleDateString('vi-VN')}
                  </p>
                  {note && <p className="text-[#374151]">{note}</p>}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Sequential 2-Step Verification Pop-up Modal */}
      {verifyModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Hồ sơ xác minh chuyên gia"
          onClick={() => {
            setStatus(null);
            setVerifyModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[#DCE6DF] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#DCE6DF] px-5 py-3.5">
              <h3 className="text-sm font-bold text-[#111827]">
                {verifyStep === 1
                  ? 'Bước 1/2 · Thông tin chuyên môn'
                  : 'Bước 2/2 · Giấy tờ & Minh chứng'}
              </h3>
              <button
                type="button"
                aria-label="Đóng cửa sổ xác minh"
                onClick={() => {
                  setStatus(null);
                  setVerifyModalOpen(false);
                }}
                className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="p-5 space-y-4" noValidate>
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    'flex-1 rounded-lg border px-2.5 py-1.5 text-center font-semibold',
                    verifyStep === 1
                      ? 'border-[#16A34A] bg-[#ECFDF3] text-[#15803D]'
                      : 'border-[#DCE6DF] bg-[#F5FAF7] text-[#6B7280]',
                  )}
                >
                  1. Chuyên môn
                </span>
                <span
                  className={cn(
                    'flex-1 rounded-lg border px-2.5 py-1.5 text-center font-semibold',
                    verifyStep === 2
                      ? 'border-[#16A34A] bg-[#ECFDF3] text-[#15803D]'
                      : 'border-[#DCE6DF] bg-[#F5FAF7] text-[#6B7280]',
                  )}
                >
                  2. Minh chứng
                </span>
              </div>

              {status && <Alert tone={status.tone}>{status.text}</Alert>}

              {verifyStep === 1 ? (
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label htmlFor="requestedRole" className="block text-xs font-medium text-[#374151]">
                      Vai trò
                    </label>
                    <select
                      id="requestedRole"
                      value={type}
                      onChange={(e) =>
                        handleRoleChange(e.target.value as 'HEALTHCARE_PROFESSIONAL' | 'RESEARCHER')
                      }
                      className="h-9.5 w-full rounded-lg border border-[#DCE6DF] bg-white px-3 text-sm text-[#111827] focus:border-[#16A34A] focus:outline-none"
                    >
                      <option value="HEALTHCARE_PROFESSIONAL">Bác sĩ / Nhân viên y tế</option>
                      <option value="RESEARCHER">Nhà nghiên cứu</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="profTitle" className="block text-xs font-medium text-[#374151]">
                      Chức danh
                    </label>
                    <Input
                      id="profTitle"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="VD: BS. CKII / TS. Nghiên cứu"
                      className="border-[#DCE6DF] focus:border-[#16A34A]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="specialty" className="block text-xs font-medium text-[#374151]">
                      Chuyên khoa
                    </label>
                    <Input
                      id="specialty"
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      placeholder="VD: Thần kinh lâm sàng / BCI"
                      className="border-[#DCE6DF] focus:border-[#16A34A]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="institution" className="block text-xs font-medium text-[#374151]">
                      Đơn vị công tác
                    </label>
                    <Input
                      id="institution"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      placeholder="VD: Bệnh viện Bạch Mai"
                      className="border-[#DCE6DF] focus:border-[#16A34A]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DCE6DF]">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setStatus(null);
                        setVerifyModalOpen(false);
                      }}
                    >
                      Hủy
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleNextStep}
                      className="bg-[#16A34A] hover:bg-[#15803D] text-white"
                    >
                      Tiếp tục
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label htmlFor="licenseOrOrcid" className="block text-xs font-medium text-[#374151]">
                      Số CCHN / ORCID
                    </label>
                    <Input
                      id="licenseOrOrcid"
                      value={licenseOrOrcidNumber}
                      onChange={(e) => setLicenseOrOrcidNumber(e.target.value)}
                      placeholder="VD: 001234/BYT-CCHN hoặc 0000-0002-..."
                      className="border-[#DCE6DF] focus:border-[#16A34A]"
                    />
                  </div>

                  {type === 'HEALTHCARE_PROFESSIONAL' && (
                    <div className="space-y-1.5">
                      <label htmlFor="issuingAuthority" className="block text-xs font-medium text-[#374151]">
                        Cơ quan cấp
                      </label>
                      <select
                        id="issuingAuthority"
                        value={issuingAuthority}
                        onChange={(e) => setIssuingAuthority(e.target.value)}
                        className="h-9.5 w-full rounded-lg border border-[#DCE6DF] bg-white px-3 text-sm text-[#111827] focus:border-[#16A34A] focus:outline-none"
                      >
                        {ISSUING_AUTHORITIES.map((auth) => (
                          <option key={auth} value={auth}>
                            {auth}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label htmlFor="documentType" className="block text-xs font-medium text-[#374151]">
                      Loại giấy tờ
                    </label>
                    <select
                      id="documentType"
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value as CredentialDocumentType)}
                      className="h-9.5 w-full rounded-lg border border-[#DCE6DF] bg-white px-3 text-sm text-[#111827] focus:border-[#16A34A] focus:outline-none"
                    >
                      {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="verificationFiles" className="block text-xs font-medium text-[#374151]">
                      Tải ảnh hoặc PDF minh chứng
                    </label>
                    <label
                      htmlFor="verificationFiles"
                      className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[#DCE6DF] bg-[#F5FAF7] px-4 py-3 text-xs font-medium text-[#15803D] hover:border-[#16A34A] transition-colors"
                    >
                      <Upload className="size-4" />
                      <span>Chọn tối đa 3 tệp (.pdf, .jpg, .png, .webp)</span>
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
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {files.map((f, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 rounded-md border border-[#DCE6DF] bg-[#F5FAF7] px-2 py-1 text-xs text-[#15803D]"
                          >
                            <FileText className="size-3.5" />
                            <span className="truncate max-w-[180px]">{f.name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#DCE6DF]">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setStatus(null);
                        setVerifyStep(1);
                      }}
                    >
                      Quay lại
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      loading={saving}
                      icon={<ShieldCheck className="size-4" />}
                      className="bg-[#16A34A] hover:bg-[#15803D] text-white"
                    >
                      Gửi xác minh
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<SettingsTab>(() =>
    resolveInitialTab(searchParams, location.hash),
  );

  useEffect(() => {
    setActiveTab(resolveInitialTab(searchParams, location.hash));
  }, [searchParams, location.hash]);

  function selectTab(tab: SettingsTab) {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    next.delete('section');
    setSearchParams(next, { replace: true });
  }

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'profile', label: 'Hồ sơ' },
    { id: 'security', label: 'Mật khẩu' },
    { id: 'verify', label: 'Xác minh chuyên gia' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-[#111827]">Cài đặt</h1>

      <div className="flex items-center gap-1 rounded-xl border border-[#DCE6DF] bg-white p-1">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              className={cn(
                'flex-1 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition-colors',
                active
                  ? 'bg-[#16A34A] text-white'
                  : 'text-[#4B5563] hover:bg-[#F5FAF7] hover:text-[#15803D]',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'profile' && <ProfileTab />}
      {activeTab === 'security' && <PasswordTab />}
      {activeTab === 'verify' && <VerificationTab />}
    </div>
  );
}
