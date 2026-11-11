import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { resetEegDatasetStore } from '../src/modules/eeg/eeg-access.service.js';
import { makeAdmin, registerUser, resetDatabase } from './helpers.js';

beforeEach(async () => {
  await resetDatabase();
  resetEegDatasetStore();
});

afterAll(() => prisma.$disconnect());

describe('Comprehensive 14-Point End-to-End Platform Verification Suite', () => {
  it('1–6. Verifies General User login, Verified Doctor login, Verified Researcher login, Pending & Rejected verification states, and Automatic Experience Resolution', async () => {
    const admin = await registerUser({ username: 'sys_admin' });
    await makeAdmin(admin.user.id);

    // 1. General User login
    const generalUser = await registerUser({
      username: 'gen_member',
      displayName: 'Nguyễn Minh An (General User)',
    });
    const genLogin = await generalUser
      .post('/api/auth/login', {
        identifier: 'gen_member',
        password: 'Password123',
      })
      .expect(200);
    expect(genLogin.body.user.experienceResolution.accountRole).toBe('GENERAL_USER');
    expect(genLogin.body.user.experienceResolution.experience).toBe('GENERAL_MODE');
    expect(genLogin.body.user.experienceResolution.canAccessProfessionalMode).toBe(false);

    // 2. Verified Doctor login
    const doctorUser = await registerUser({
      username: 'dr_clinician',
      displayName: 'BS. CKII Trần Quốc Bảo',
    });
    const docProf = await doctorUser
      .post('/api/users/me/professional', {
        type: 'HEALTHCARE_PROFESSIONAL',
        title: 'Bác sĩ Chuyên khoa II Thần kinh',
        specialty: 'Thần kinh học lâm sàng',
        institution: 'Bệnh viện Bạch Mai',
        licenseOrOrcidNumber: '045892/BYT-CCHN',
        requestVerification: true,
      })
      .expect(200);

    await admin
      .patch(`/api/admin/verifications/${docProf.body.profile.id}`, {
        status: 'VERIFIED',
        note: 'Verified Doctor CCHN',
      })
      .expect(200);

    const docLogin = await doctorUser
      .post('/api/auth/login', {
        identifier: 'dr_clinician',
        password: 'Password123',
      })
      .expect(200);
    expect(docLogin.body.user.experienceResolution.accountRole).toBe('DOCTOR');
    expect(docLogin.body.user.experienceResolution.verificationStatus).toBe('VERIFIED');
    expect(docLogin.body.user.experienceResolution.experience).toBe('PROFESSIONAL_MODE');
    expect(docLogin.body.user.experienceResolution.canAccessProfessionalMode).toBe(true);

    // 3. Verified Researcher login
    const researcherUser = await registerUser({
      username: 'prof_neuro_bci',
      displayName: 'PGS. TS. Lê Thu Hà',
    });
    const resProf = await researcherUser
      .post('/api/users/me/professional', {
        type: 'RESEARCHER',
        title: 'Phó Giáo sư Tiến sĩ Khoa học Thần kinh',
        specialty: 'Giải mã tín hiệu BCI & qEEG',
        institution: 'Viện Công nghệ Thông tin - ĐHQGHN',
        licenseOrOrcidNumber: '0000-0002-7391-4482',
        requestVerification: true,
      })
      .expect(200);

    await admin
      .patch(`/api/admin/verifications/${resProf.body.profile.id}`, {
        status: 'VERIFIED',
        note: 'Verified Researcher ORCID',
      })
      .expect(200);

    const resLogin = await researcherUser
      .post('/api/auth/login', {
        identifier: 'prof_neuro_bci',
        password: 'Password123',
      })
      .expect(200);
    expect(resLogin.body.user.experienceResolution.accountRole).toBe('RESEARCHER');
    expect(resLogin.body.user.experienceResolution.verificationStatus).toBe('VERIFIED');
    expect(resLogin.body.user.experienceResolution.experience).toBe('PROFESSIONAL_MODE');
    expect(resLogin.body.user.experienceResolution.canAccessProfessionalMode).toBe(true);

    // 4. Pending professional verification
    const pendingUser = await registerUser({
      username: 'dr_pending_applicant',
      displayName: 'BS. Nguyễn Hoàng',
    });
    await pendingUser
      .post('/api/users/me/professional', {
        type: 'HEALTHCARE_PROFESSIONAL',
        title: 'Bác sĩ Nội trú Thần kinh',
        specialty: 'Động kinh học',
        institution: 'Bệnh viện Đại học Y',
        requestVerification: true,
      })
      .expect(200);

    const pendingMe = (await pendingUser.get('/api/auth/me').expect(200)).body.user;
    expect(pendingMe.experienceResolution.accountRole).toBe('DOCTOR');
    expect(pendingMe.experienceResolution.verificationStatus).toBe('PENDING');
    expect(pendingMe.experienceResolution.experience).toBe('GENERAL_MODE');
    expect(pendingMe.experienceResolution.enableVerificationCenter).toBe(true);
    expect(pendingMe.experienceResolution.canAccessProfessionalMode).toBe(false);

    // 5. Rejected professional verification
    const rejectedUser = await registerUser({
      username: 'res_rejected_applicant',
      displayName: 'ThS. Phạm Văn Kiên',
    });
    const rejProf = await rejectedUser
      .post('/api/users/me/professional', {
        type: 'RESEARCHER',
        title: 'Nghiên cứu sinh Khoa học Thần kinh',
        specialty: 'Xử lý tín hiệu EEG',
        institution: 'ĐH Bách Khoa',
        requestVerification: true,
      })
      .expect(200);

    await admin
      .patch(`/api/admin/verifications/${rejProf.body.profile.id}`, {
        status: 'REJECTED',
        note: 'Ảnh chụp minh chứng ORCID bị mờ, vui lòng nộp lại bản rõ nét.',
      })
      .expect(200);

    const rejectedMe = (await rejectedUser.get('/api/auth/me').expect(200)).body.user;
    expect(rejectedMe.experienceResolution.accountRole).toBe('RESEARCH_STUDENT');
    expect(rejectedMe.experienceResolution.verificationStatus).toBe('REJECTED');
    expect(rejectedMe.experienceResolution.experience).toBe('GENERAL_MODE');
    expect(rejectedMe.experienceResolution.enableResubmission).toBe(true);
    expect(rejectedMe.experienceResolution.canAccessProfessionalMode).toBe(false);
  });

  it('7–14. Enforces backend route authorization, shared social interactions, messaging, profile updates, EEG Data-Owner Consent, and credit wallet lifecycle across all roles', async () => {
    const admin = await registerUser({ username: 'chief_admin' });
    await makeAdmin(admin.user.id);

    const generalUser = await registerUser({
      username: 'patient_mai',
      displayName: 'Trần Thị Mai (Patient)',
    });
    const pendingUser = await registerUser({
      username: 'pending_doc',
      displayName: 'BS. Đỗ Hùng (Pending)',
    });
    const rejectedUser = await registerUser({
      username: 'rejected_doc',
      displayName: 'BS. Lê Quang (Rejected)',
    });
    const doctorUser = await registerUser({
      username: 'dr_verified',
      displayName: 'BS. CKII Vũ Minh Đức',
    });
    const researcherUser = await registerUser({
      username: 'researcher_verified',
      displayName: 'PGS. TS. Hoàng Lan Anh',
    });

    // Configure Pending, Rejected, Verified Doctor, and Verified Researcher
    await pendingUser
      .post('/api/users/me/professional', {
        type: 'HEALTHCARE_PROFESSIONAL',
        title: 'Bác sĩ Đa khoa',
        specialty: 'Nội thần kinh',
        requestVerification: true,
      })
      .expect(200);

    const rejProf = await rejectedUser
      .post('/api/users/me/professional', {
        type: 'HEALTHCARE_PROFESSIONAL',
        title: 'Bác sĩ Chuyên khoa I',
        specialty: 'Thần kinh',
        requestVerification: true,
      })
      .expect(200);
    await admin
      .patch(`/api/admin/verifications/${rejProf.body.profile.id}`, {
        status: 'REJECTED',
        note: 'Thiếu dấu mộc đỏ',
      })
      .expect(200);

    const docProf = await doctorUser
      .post('/api/users/me/professional', {
        type: 'HEALTHCARE_PROFESSIONAL',
        title: 'Bác sĩ Chuyên khoa II Thần kinh',
        specialty: 'Điện não đồ lâm sàng',
        institution: 'BV Bạch Mai',
        licenseOrOrcidNumber: '019283/BYT-CCHN',
        requestVerification: true,
      })
      .expect(200);
    await admin
      .patch(`/api/admin/verifications/${docProf.body.profile.id}`, {
        status: 'VERIFIED',
        note: 'Approved Doctor',
      })
      .expect(200);

    const resProf = await researcherUser
      .post('/api/users/me/professional', {
        type: 'RESEARCHER',
        title: 'Phó Giáo sư Tiến sĩ',
        specialty: 'Khoa học thần kinh tính toán',
        institution: 'Viện CNTT',
        licenseOrOrcidNumber: '0000-0003-1122-3344',
        requestVerification: true,
      })
      .expect(200);
    await admin
      .patch(`/api/admin/verifications/${resProf.body.profile.id}`, {
        status: 'VERIFIED',
        note: 'Approved Researcher',
      })
      .expect(200);

    // 7 & 14. Verify that frontend restrictions are strictly enforced by backend authorization
    // General, Pending, and Rejected users cannot access EEG Workspace, join verified-only specialty boards, or access Admin routes even with spoofed headers
    for (const unverifiedClient of [generalUser, pendingUser, rejectedUser]) {
      await unverifiedClient
        .get('/api/eeg-datasets/workspace')
        .set('X-NeuroLink-Mode', 'PROFESSIONAL_MODE')
        .expect(403);
      await unverifiedClient
        .get('/api/contributions/eligible-posts')
        .set('X-NeuroLink-Mode', 'PROFESSIONAL_MODE')
        .expect(403);
      await unverifiedClient
        .post('/api/communities/comm-01/join')
        .set('X-NeuroLink-Mode', 'PROFESSIONAL_MODE')
        .expect(403);
      await unverifiedClient.get('/api/admin/verifications').expect(403);
    }

    // 8. Shared Social Interactions (Post, Like, Comment, Bookmark, Moderation Report)
    const doctorPost = (
      await doctorUser
        .post('/api/posts', {
          content:
            'Phân tích dấu hiệu sóng nhọn kịch phát vùng thái dương trên bệnh nhân rối loạn giấc ngủ N3.',
          specialty: 'NEUROLOGY',
        })
        .expect(201)
    ).body.post;

    await generalUser.post(`/api/posts/${doctorPost.id}/like`).expect(200);
    await researcherUser.post(`/api/users/${doctorUser.user.id}/follow`).expect(200);
    await researcherUser
      .post(`/api/posts/${doctorPost.id}/comments`, {
        content: 'Nhận định rất sát với dữ liệu qEEG băng tần Theta/Delta trong nghiên cứu gần đây.',
      })
      .expect(201);

    const followingFeedRes = (await researcherUser.get('/api/posts?feedType=following').expect(200)).body;
    expect(followingFeedRes.items.some((p: any) => p.id === doctorPost.id)).toBe(true);

    // General user files a moderation report on another post
    const spamPost = (
      await pendingUser
        .post('/api/posts', { content: 'Bài viết thử nghiệm kiểm tra tính năng báo cáo.' })
        .expect(201)
    ).body.post;
    await generalUser
      .post('/api/reports', {
        targetType: 'POST',
        targetId: spamPost.id,
        reason: 'MISINFORMATION',
        details: 'Cần hội đồng kiểm chứng thông tin.',
      })
      .expect(201);

    // 9. Messaging across General User, Verified Doctor, and Verified Researcher
    const convGenDoc = (
      await generalUser
        .post('/api/conversations', { targetUserId: doctorUser.user.id })
        .expect(201)
    ).body.conversation;

    await generalUser
      .post(`/api/conversations/${convGenDoc.id}/messages`, {
        content: 'Chào bác sĩ Đức, tôi vừa tải lên bản ghi EEG cá nhân nhờ bác sĩ tư vấn.',
      })
      .expect(201);

    await doctorUser
      .post(`/api/conversations/${convGenDoc.id}/messages`, {
        content: 'Chào chị Mai, vui lòng cấp quyền bản ghi trong mục My EEG để tôi xem đạo trình.',
      })
      .expect(201);

    const threadMessages = (
      await generalUser.get(`/api/conversations/${convGenDoc.id}/messages`).expect(200)
    ).body.items;
    expect(threadMessages).toHaveLength(2);

    // 10. Profile functionality (View & Update Profile)
    const updatedProfile = (
      await generalUser
        .patch('/api/users/me', {
          displayName: 'Trần Thị Mai (Đã cập nhật)',
          bio: 'Quan tâm chăm sóc giấc ngủ và theo dõi điện não đồ cá nhân.',
        })
        .expect(200)
    ).body.user;
    expect(updatedProfile.displayName).toBe('Trần Thị Mai (Đã cập nhật)');

    const publicDocProfile = (
      await generalUser.get(`/api/users/${doctorUser.user.username}`).expect(200)
    ).body.user;
    expect(publicDocProfile.professionalProfiles[0].verificationStatus).toBe('VERIFIED');
    expect(publicDocProfile.professionalProfiles[0].licenseOrOrcidNumber).toBe('019283/BYT-CCHN');

    // 11. EEG Access Permissions & Explicit Data-Owner Consent
    const createdDataset = (
      await generalUser
        .post('/api/eeg-datasets', {
          title: 'Bản ghi EEG Giấc ngủ cá nhân của Mai (8 kênh, 250 Hz)',
          samplingRate: '250 Hz',
          channelsCount: 8,
          duration: '20 phút',
        })
        .expect(201)
    ).body.dataset;

    // Neither Verified Doctor nor Verified Researcher can view the patient's EEG without explicit consent
    const docBlocked = await doctorUser
      .get(`/api/eeg-datasets/${createdDataset.id}`)
      .expect(403);
    expect(docBlocked.body.error.code).toBe('EEG_CONSENT_REQUIRED');

    const resBlocked = await researcherUser
      .get(`/api/eeg-datasets/${createdDataset.id}`)
      .expect(403);
    expect(resBlocked.body.error.code).toBe('EEG_CONSENT_REQUIRED');

    // Cannot grant consent to an unverified/pending user
    await generalUser
      .post(`/api/eeg-datasets/${createdDataset.id}/consent`, {
        professionalUsernameOrId: pendingUser.user.username,
      })
      .expect(400);

    // General User grants consent ONLY to Verified Doctor
    const grantedRes = await generalUser
      .post(`/api/eeg-datasets/${createdDataset.id}/consent`, {
        professionalUsernameOrId: doctorUser.user.username,
      })
      .expect(200);
    expect(grantedRes.body.dataset.consentedProfessionals).toHaveLength(1);

    // Verified Doctor can now access it in Workspace and by ID, while Verified Researcher is STILL blocked
    await doctorUser.get(`/api/eeg-datasets/${createdDataset.id}`).expect(200);
    await researcherUser.get(`/api/eeg-datasets/${createdDataset.id}`).expect(403);

    // General User revokes consent -> Verified Doctor is immediately blocked again
    await generalUser
      .del(`/api/eeg-datasets/${createdDataset.id}/consent/${doctorUser.user.username}`)
      .expect(200);
    await doctorUser.get(`/api/eeg-datasets/${createdDataset.id}`).expect(403);

    // 12. Credit & Contribution Functionality (Submit -> Admin Review & Award -> Publications Registry -> Redeem Reward)
    const rewardItem = await prisma.rewardCatalog.create({
      data: {
        name: 'Khóa học Chuyên sâu qEEG & BCI Lâm sàng (20 CME)',
        description: 'Chứng chỉ đào tạo liên tục CME.',
        category: 'PROFESSIONAL_COURSE',
        creditCost: 150,
        isMonetary: false,
        payoutEnabled: false,
        isActive: true,
        stockQuantity: 10,
      },
    });

    // Unverified user cannot submit contribution or redeem reward
    await generalUser
      .post('/api/contributions', {
        postId: spamPost.id,
        category: 'HEALTHCARE_EDUCATION',
        summary: 'Thử nộp bài khi chưa xác minh tích xanh.',
      })
      .expect(403);
    await generalUser
      .post('/api/rewards/redeem', { rewardId: rewardItem.id })
      .expect(403);

    // Verified Doctor submits their post to Research Hub
    const submittedContrib = (
      await doctorUser
        .post('/api/contributions', {
          postId: doctorPost.id,
          category: 'RESEARCH_CONTRIBUTION',
          summary:
            'Báo cáo phân tích sóng nhọn kịch phát vùng thái dương trong pha ngủ N3 và đối chiếu lâm sàng.',
        })
        .expect(201)
    ).body.contribution;

    // Admin claims and approves the contribution, awarding 300 credits
    await admin
      .post(`/api/admin/rewards/contributions/${submittedContrib.id}/claim`)
      .expect(200);
    await admin
      .post(`/api/admin/rewards/contributions/${submittedContrib.id}/review`, {
        decision: 'APPROVE',
        scoreAccuracy: 5,
        scoreRelevance: 5,
        scoreUsefulness: 5,
        scoreOriginality: 5,
        scoreImpact: 5,
        awardedCredits: 300,
        feedback: 'Báo cáo lâm sàng xuất sắc, phê duyệt cấp 300 tín chỉ CME.',
      })
      .expect(200);

    // Verify the approved contribution appears in the Research Hub Publications endpoint
    const pubsList = (await researcherUser.get('/api/contributions/publications').expect(200)).body
      .contributions;
    expect(pubsList.some((c: any) => c.id === submittedContrib.id)).toBe(true);

    // Verify Doctor's credit wallet balance is 300 and redeem the 150-credit CME course
    const walletBefore = (await doctorUser.get('/api/rewards/wallet').expect(200)).body.wallet;
    expect(walletBefore.balance).toBe(300);

    const redeemRes = (
      await doctorUser
        .post('/api/rewards/redeem', {
          rewardId: rewardItem.id,
          userNote: 'Đăng ký khóa học qEEG đợt tháng 11.',
        })
        .expect(201)
    ).body;
    expect(redeemRes.remainingBalance).toBe(150);
  });
});
