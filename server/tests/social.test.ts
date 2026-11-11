import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { getApp, makeAdmin, registerUser, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('social: posts CRUD and authorization', () => {
  it('allows an authenticated user to create a post and view it in the feed', async () => {
    const author = await registerUser({ username: 'neuro_author' });

    const createRes = await author
      .post('/api/posts', { content: 'Exciting breakthrough in neural oscillations!' })
      .expect(201);

    expect(createRes.body.post).toMatchObject({
      content: 'Exciting breakthrough in neural oscillations!',
      likesCount: 0,
      commentsCount: 0,
      isLiked: false,
      isAuthor: true,
    });
    expect(createRes.body.post.author.username).toBe('neuro_author');

    const feedRes = await author.get('/api/posts').expect(200);
    expect(feedRes.body.items).toHaveLength(1);
    expect(feedRes.body.items[0].id).toBe(createRes.body.post.id);
  });

  it('enforces ownership on editing posts: author can edit, other user receives 403', async () => {
    const author = await registerUser({ username: 'alice' });
    const attacker = await registerUser({ username: 'bob' });

    const post = (await author.post('/api/posts', { content: 'Original content' }).expect(201)).body.post;

    // Attacker attempts to edit Alice's post
    const failRes = await attacker.patch(`/api/posts/${post.id}`, { content: 'Hacked content' });
    expect(failRes.status).toBe(403);
    expect(failRes.body.error.code).toBe('FORBIDDEN');

    // Author edits successfully
    const successRes = await author.patch(`/api/posts/${post.id}`, { content: 'Updated content' }).expect(200);
    expect(successRes.body.post.content).toBe('Updated content');
  });

  it('enforces ownership on deleting posts: author and admin can delete, other user receives 403', async () => {
    const author = await registerUser({ username: 'charlie' });
    const otherUser = await registerUser({ username: 'david' });
    const adminUser = await registerUser({ username: 'admin' });
    await makeAdmin(adminUser.user.id);

    const post1 = (await author.post('/api/posts', { content: 'Post 1' }).expect(201)).body.post;
    const post2 = (await author.post('/api/posts', { content: 'Post 2' }).expect(201)).body.post;

    // Unauthorized user receives 403
    await otherUser.del(`/api/posts/${post1.id}`).expect(403);

    // Author can delete
    await author.del(`/api/posts/${post1.id}`).expect(204);
    await author.get(`/api/posts/${post1.id}`).expect(404);

    // Admin can delete
    await adminUser.del(`/api/posts/${post2.id}`).expect(204);
    await author.get(`/api/posts/${post2.id}`).expect(404);
  });
});

describe('social: likes and comments', () => {
  it('handles liking and unliking without duplicates and updates counts', async () => {
    const author = await registerUser({ username: 'dr_lee' });
    const reader = await registerUser({ username: 'reader' });

    const post = (await author.post('/api/posts', { content: 'Hippocampus mapping study' }).expect(201)).body.post;

    // Reader likes the post
    const likeRes = await reader.post(`/api/posts/${post.id}/like`).expect(200);
    expect(likeRes.body).toEqual({ liked: true, likesCount: 1 });

    // Duplicate like is idempotent
    const dupLike = await reader.post(`/api/posts/${post.id}/like`).expect(200);
    expect(dupLike.body).toEqual({ liked: true, likesCount: 1 });

    // Check feed view for reader: isLiked should be true
    const readerView = (await reader.get(`/api/posts/${post.id}`).expect(200)).body.post;
    expect(readerView.isLiked).toBe(true);
    expect(readerView.likesCount).toBe(1);

    // Unlike post
    const unlikeRes = await reader.del(`/api/posts/${post.id}/like`).expect(200);
    expect(unlikeRes.body).toEqual({ liked: false, likesCount: 0 });

    const readerViewAfter = (await reader.get(`/api/posts/${post.id}`).expect(200)).body.post;
    expect(readerViewAfter.isLiked).toBe(false);
  });

  it('supports creating, reading, editing, and deleting comments with ownership checks', async () => {
    const author = await registerUser({ username: 'researcher_a' });
    const commenter = await registerUser({ username: 'student_b' });
    const bystander = await registerUser({ username: 'user_c' });

    const post = (await author.post('/api/posts', { content: 'Synaptic plasticity discussion' }).expect(201)).body.post;

    // Commenter adds a comment
    const commentRes = await commenter
      .post(`/api/posts/${post.id}/comments`, { content: 'Very insightful findings!' })
      .expect(201);
    const commentId = commentRes.body.comment.id;
    expect(commentRes.body.comment.author.username).toBe('student_b');

    // List comments
    const listRes = await author.get(`/api/posts/${post.id}/comments`).expect(200);
    expect(listRes.body.comments).toHaveLength(1);
    expect(listRes.body.comments[0].content).toBe('Very insightful findings!');

    // Bystander cannot edit commenter's comment
    await bystander.patch(`/api/posts/comments/${commentId}`, { content: 'Tampered' }).expect(403);

    // Commenter can edit own comment
    const editRes = await commenter
      .patch(`/api/posts/comments/${commentId}`, { content: 'Very insightful findings! (edited)' })
      .expect(200);
    expect(editRes.body.comment.content).toBe('Very insightful findings! (edited)');

    // Bystander cannot delete comment
    await bystander.del(`/api/posts/comments/${commentId}`).expect(403);

    // Post author can delete any comment on their post
    await author.del(`/api/posts/comments/${commentId}`).expect(204);
    const afterDel = await author.get(`/api/posts/${post.id}/comments`).expect(200);
    expect(afterDel.body.comments).toHaveLength(0);
  });
});

describe('social: follows and following feed', () => {
  it('prevents self-following and duplicate follows', async () => {
    const user1 = await registerUser({ username: 'dr_smith' });
    const user2 = await registerUser({ username: 'dr_jones' });

    // Self-follow rejected with 400
    const selfRes = await user1.post(`/api/users/${user1.user.id}/follow`);
    expect(selfRes.status).toBe(400);

    // Follow another user
    await user1.post(`/api/users/${user2.user.id}/follow`).expect(200);

    // Duplicate follow is idempotent
    await user1.post(`/api/users/${user2.user.id}/follow`).expect(200);

    // Profile check
    const profile = (await user1.get(`/api/users/${user2.user.id}`).expect(200)).body.user;
    expect(profile.isFollowing).toBe(true);
    expect(profile.stats.followers).toBe(1);

    // Unfollow
    await user1.del(`/api/users/${user2.user.id}/follow`).expect(200);
    const profileAfter = (await user1.get(`/api/users/${user2.user.id}`).expect(200)).body.user;
    expect(profileAfter.isFollowing).toBe(false);
    expect(profileAfter.stats.followers).toBe(0);
  });

  it('filters following feed to only posts by followed users and self', async () => {
    const userA = await registerUser({ username: 'user_a' });
    const userB = await registerUser({ username: 'user_b' });
    const userC = await registerUser({ username: 'user_c' });

    await userA.post('/api/posts', { content: 'Post from A' }).expect(201);
    await userB.post('/api/posts', { content: 'Post from B' }).expect(201);
    await userC.post('/api/posts', { content: 'Post from C' }).expect(201);

    // User A follows User B (does not follow User C)
    await userA.post(`/api/users/${userB.user.id}/follow`).expect(200);

    // Community feed has all 3 posts
    const communityFeed = (await userA.get('/api/posts?feedType=community').expect(200)).body.items;
    expect(communityFeed).toHaveLength(3);

    // Following feed only has posts from B and A
    const followingFeed = (await userA.get('/api/posts?feedType=following').expect(200)).body.items;
    expect(followingFeed).toHaveLength(2);
    const authors = followingFeed.map((p: any) => p.author.username);
    expect(authors).toContain('user_a');
    expect(authors).toContain('user_b');
    expect(authors).not.toContain('user_c');
  });
});
