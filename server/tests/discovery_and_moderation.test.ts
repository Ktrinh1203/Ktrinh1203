import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { makeAdmin, registerUser, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('milestone 3: professional profiles & verification', () => {
  it('allows a user to add a professional profile with UNVERIFIED/PENDING status, prevents self-verification', async () => {
    const doctor = await registerUser({ username: 'dr_john' });

    // User submits professional profile
    const res = await doctor.post('/api/users/me/professional', {
      type: 'HEALTHCARE_PROFESSIONAL',
      title: 'Senior Neurologist',
      specialty: 'Clinical Neurophysiology',
      institution: 'City Hospital',
      researchInterests: ['Epilepsy', 'EEG biomarkers'],
      requestVerification: true,
    }).expect(200);

    expect(res.body.profile).toMatchObject({
      type: 'HEALTHCARE_PROFESSIONAL',
      title: 'Senior Neurologist',
      specialty: 'Clinical Neurophysiology',
      institution: 'City Hospital',
      verificationStatus: 'PENDING',
    });

    // Profile in public view has UNVERIFIED/PENDING, not VERIFIED
    const profile = (await doctor.get('/api/users/dr_john').expect(200)).body.user;
    expect(profile.professionalProfiles[0].verificationStatus).toBe('PENDING');

    // Admin verifies the profile
    const admin = await registerUser({ username: 'system_admin' });
    await makeAdmin(admin.user.id);

    const pendingList = (await admin.get('/api/admin/verifications').expect(200)).body.profiles;
    expect(pendingList).toHaveLength(1);
    expect(pendingList[0].id).toBe(res.body.profile.id);

    const verifyRes = await admin.patch(`/api/admin/verifications/${res.body.profile.id}`, {
      status: 'VERIFIED',
      note: 'Verified with state medical board registry',
    }).expect(200);

    expect(verifyRes.body.profile.verificationStatus).toBe('VERIFIED');

    // Non-admin receives 403 on admin verifications
    await doctor.get('/api/admin/verifications').expect(403);
  });
});

describe('milestone 3: search and discovery', () => {
  it('searches users, professionals, and posts with proper filtering', async () => {
    const doc = await registerUser({ username: 'dr_susan', displayName: 'Susan Clark, MD' });
    await doc.post('/api/users/me/professional', {
      type: 'HEALTHCARE_PROFESSIONAL',
      title: 'Neurologist',
      specialty: 'Cognitive Neuroscience',
      institution: 'Brain Institute',
    }).expect(200);

    const researcher = await registerUser({ username: 'prof_alan', displayName: 'Alan Turing' });
    await researcher.post('/api/users/me/professional', {
      type: 'RESEARCHER',
      title: 'Principal Investigator',
      specialty: 'Computational Neuroscience',
      institution: 'Tech University',
      researchInterests: ['Neural networks', 'Signal processing'],
    }).expect(200);

    await doc.post('/api/posts', { content: 'Deep brain stimulation clinical trial updates' }).expect(201);

    // Search by query across all
    const allSearch = (await researcher.get('/api/search?q=brain').expect(200)).body;
    expect(allSearch.posts).toHaveLength(1);
    expect(allSearch.professionals).toHaveLength(1);

    // Search specifically for professionals with specialty filter
    const specialtySearch = (await researcher.get('/api/search?category=professionals&specialty=Cognitive').expect(200)).body;
    expect(specialtySearch.professionals).toHaveLength(1);
    expect(specialtySearch.professionals[0].specialty).toBe('Cognitive Neuroscience');
  });
});

describe('milestone 3: notifications', () => {
  it('receives notifications on interactions and marks them as read', async () => {
    const author = await registerUser({ username: 'author_user' });
    const fan = await registerUser({ username: 'fan_user' });

    const post = (await author.post('/api/posts', { content: 'Breakthrough notification test' }).expect(201)).body.post;

    // Fan likes post
    await fan.post(`/api/posts/${post.id}/like`).expect(200);

    // Fan comments
    await fan.post(`/api/posts/${post.id}/comments`, { content: 'Great news!' }).expect(201);

    // Fan follows author
    await fan.post(`/api/users/${author.user.id}/follow`).expect(200);

    // Author checks notifications
    const notifsRes = (await author.get('/api/notifications').expect(200)).body;
    expect(notifsRes.unreadCount).toBe(3);
    expect(notifsRes.items).toHaveLength(3);

    const firstId = notifsRes.items[0].id;
    // Mark one as read
    await author.patch(`/api/notifications/${firstId}/read`).expect(200);
    const afterOne = (await author.get('/api/notifications').expect(200)).body;
    expect(afterOne.unreadCount).toBe(2);

    // Mark all as read
    await author.post('/api/notifications/read-all').expect(200);
    const afterAllRead = (await author.get('/api/notifications').expect(200)).body;
    expect(afterAllRead.unreadCount).toBe(0);
  });
});

describe('milestone 3: moderation and reporting', () => {
  it('allows users to file reports, and admins to resolve and hide content', async () => {
    const reporter = await registerUser({ username: 'good_citizen' });
    const spammer = await registerUser({ username: 'spammer' });
    const admin = await registerUser({ username: 'moderator' });
    await makeAdmin(admin.user.id);

    const spamPost = (await spammer.post('/api/posts', { content: 'Miracle cure pills 100% guarantee!' }).expect(201)).body.post;

    // File report
    const reportRes = await reporter.post('/api/reports', {
      targetType: 'POST',
      targetId: spamPost.id,
      reason: 'MISINFORMATION',
      details: 'False medical cure advertisement',
    }).expect(201);

    expect(reportRes.body.report.status).toBe('OPEN');

    // Admin views open reports
    const openReports = (await admin.get('/api/admin/reports?status=OPEN').expect(200)).body.reports;
    expect(openReports).toHaveLength(1);

    // Admin resolves report and hides content
    await admin.patch(`/api/admin/reports/${reportRes.body.report.id}`, {
      status: 'RESOLVED',
      resolutionNote: 'Post violates medical advice policy. Content hidden.',
      action: 'HIDE_CONTENT',
    }).expect(200);

    // Post is now hidden from public
    await reporter.get(`/api/posts/${spamPost.id}`).expect(404);
  });
});
