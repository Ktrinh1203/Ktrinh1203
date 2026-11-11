import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { makeAdmin, registerUser, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('unified platform architecture across General Mode & Professional Mode', () => {
  it('shares authentication, user accounts, communities, social interactions, messaging, notifications, and access-control infrastructure across both modes', async () => {
    // 1. Register a General User (experience = GENERAL_MODE) and a Doctor (promoted to VERIFIED -> PROFESSIONAL_MODE)
    const generalUser = await registerUser({
      username: 'patient_lan',
      displayName: 'Lan Nguyen (General Member)',
    });
    const doctorUser = await registerUser({
      username: 'dr_hoang',
      displayName: 'BS. CKII Hoang Tran',
    });
    const admin = await registerUser({ username: 'arch_admin' });
    await makeAdmin(admin.user.id);

    // Doctor submits profile and Admin verifies it -> resolves to PROFESSIONAL_MODE
    const profRes = await doctorUser
      .post('/api/users/me/professional', {
        type: 'HEALTHCARE_PROFESSIONAL',
        title: 'Bác sĩ Chuyên khoa II Thần kinh',
        specialty: 'Thần kinh học lâm sàng',
        institution: 'Bệnh viện Bạch Mai',
        requestVerification: true,
      })
      .expect(200);

    await admin
      .patch(`/api/admin/verifications/${profRes.body.profile.id}`, {
        status: 'VERIFIED',
        note: 'Verified CCHN for unified platform test',
      })
      .expect(200);

    const generalMe = (await generalUser.get('/api/auth/me').expect(200)).body.user;
    const doctorMe = (await doctorUser.get('/api/auth/me').expect(200)).body.user;

    expect(generalMe.experienceResolution.experience).toBe('GENERAL_MODE');
    expect(doctorMe.experienceResolution.experience).toBe('PROFESSIONAL_MODE');

    // 2. Shared Communities API Contract & Backend Access Control (/api/communities)
    const initialComms = (await generalUser.get('/api/communities').expect(200)).body.communities;
    expect(initialComms.length).toBeGreaterThanOrEqual(6);

    // General user can join an open patient/wellness community (comm-05)
    const joinedOpen = (
      await generalUser.post('/api/communities/comm-05/join').expect(200)
    ).body.community;
    expect(joinedOpen.isMember).toBe(true);

    // Doctor querying the same unified /api/communities endpoint sees the updated member count
    const doctorComms = (await doctorUser.get('/api/communities').expect(200)).body.communities;
    const comm05ForDoc = doctorComms.find((c: any) => c.id === 'comm-05');
    expect(comm05ForDoc.membersCount).toBe(joinedOpen.membersCount);

    // Security & Access-Control: General user CANNOT join a verified-only specialty board (comm-01)
    await generalUser.post('/api/communities/comm-01/join').expect(403);

    // Verified Doctor CAN join the verified-only specialty board (comm-01) and leave it
    const docJoinedBoard = (
      await doctorUser.post('/api/communities/comm-01/join').expect(200)
    ).body.community;
    expect(docJoinedBoard.isMember).toBe(true);

    const docLeftBoard = (
      await doctorUser.del('/api/communities/comm-01/join').expect(200)
    ).body.community;
    expect(docLeftBoard.isMember).toBe(false);

    // 3. Shared Social Interactions (Posts, Likes, Comments) & Notifications across modes
    const docPost = (
      await doctorUser
        .post('/api/posts', {
          content: '[Ca lâm sàng] Hướng dẫn nhận biết sớm cơn vắng ý thức ở trẻ em trên EEG.',
        })
        .expect(201)
    ).body.post;

    // General user sees the doctor's post in the unified community feed, likes it, and comments
    const feedRes = (await generalUser.get('/api/posts?feedType=community').expect(200)).body;
    expect(feedRes.items.some((p: any) => p.id === docPost.id)).toBe(true);

    await generalUser.post(`/api/posts/${docPost.id}/like`).expect(200);
    await generalUser
      .post(`/api/posts/${docPost.id}/comments`, {
        content: 'Cảm ơn bác sĩ, bài viết rất hữu ích cho gia đình bệnh nhân!',
      })
      .expect(201);

    // Doctor receives unified notifications for the General User's like & comment
    const docNotifs = (await doctorUser.get('/api/notifications').expect(200)).body;
    expect(docNotifs.unreadCount).toBeGreaterThanOrEqual(2);

    // 4. Shared Direct Messaging across General Mode and Professional Mode
    const convRes = (
      await generalUser
        .post('/api/conversations', { targetUserId: doctorUser.user.id })
        .expect(201)
    ).body.conversation;

    await generalUser
      .post(`/api/conversations/${convRes.id}/messages`, {
        content: 'Chào bác sĩ Hoàng, tôi đã cấp quyền bản ghi My EEG nhờ bác sĩ xem giúp.',
      })
      .expect(201);

    const docMessages = (
      await doctorUser.get(`/api/conversations/${convRes.id}/messages`).expect(200)
    ).body.items;
    expect(docMessages).toHaveLength(1);
    expect(docMessages[0].content).toContain('My EEG');
  });
});
