import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { registerUser, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('milestone 4: direct messaging', () => {
  it('creates conversations, exchanges messages, and updates conversation list', async () => {
    const userA = await registerUser({ username: 'neuro_doc' });
    const userB = await registerUser({ username: 'ai_researcher' });

    // 1. Cannot start conversation with self
    const selfRes = await userA.post('/api/conversations', { targetUserId: userA.user.id });
    expect(selfRes.status).toBe(400);

    // 2. Start conversation with user B
    const startRes = await userA.post('/api/conversations', { targetUserId: userB.user.id }).expect(201);
    const convId = startRes.body.conversation.id;
    expect(startRes.body.conversation.otherUser.username).toBe('ai_researcher');

    // 3. User A sends a message
    const msg1 = await userA
      .post(`/api/conversations/${convId}/messages`, {
        content: 'Hello, did you review the EEG synchronization paper?',
      })
      .expect(201);

    expect(msg1.body.message.content).toBe('Hello, did you review the EEG synchronization paper?');
    expect(msg1.body.message.isSender).toBe(true);

    // 4. User B checks conversation list and sees the new unread message
    const bList = (await userB.get('/api/conversations').expect(200)).body.conversations;
    expect(bList).toHaveLength(1);
    expect(bList[0].id).toBe(convId);
    expect(bList[0].isUnread).toBe(true);
    expect(bList[0].lastMessage.content).toBe('Hello, did you review the EEG synchronization paper?');

    // 5. User B reads messages (marking it read)
    const bMessages = (await userB.get(`/api/conversations/${convId}/messages`).expect(200)).body;
    expect(bMessages.items).toHaveLength(1);
    expect(bMessages.items[0].isSender).toBe(false);

    // After reading, conversation list unread flag is false
    const bListAfterRead = (await userB.get('/api/conversations').expect(200)).body.conversations;
    expect(bListAfterRead[0].isUnread).toBe(false);

    // 6. User B replies
    const msg2 = await userB
      .post(`/api/conversations/${convId}/messages`, {
        content: 'Yes! The gamma band synchronization is particularly compelling.',
      })
      .expect(201);

    expect(msg2.body.message.isSender).toBe(true);

    // 7. User A reads conversation history
    const aMessages = (await userA.get(`/api/conversations/${convId}/messages`).expect(200)).body;
    expect(aMessages.items).toHaveLength(2);
    expect(aMessages.items[0].content).toBe('Hello, did you review the EEG synchronization paper?');
    expect(aMessages.items[1].content).toBe('Yes! The gamma band synchronization is particularly compelling.');
  });

  it('strictly enforces conversation membership: non-participants cannot read or send messages (403 Forbidden)', async () => {
    const userA = await registerUser({ username: 'alice_secret' });
    const userB = await registerUser({ username: 'bob_secret' });
    const eavesdropper = await registerUser({ username: 'eve_eavesdropper' });

    // Alice and Bob start a private conversation
    const conv = (await userA.post('/api/conversations', { targetUserId: userB.user.id }).expect(201)).body.conversation;
    await userA.post(`/api/conversations/${conv.id}/messages`, { content: 'Confidential clinical trial notes' }).expect(201);

    // Eve attempts to view conversation details
    const detailsRes = await eavesdropper.get(`/api/conversations/${conv.id}`);
    expect(detailsRes.status).toBe(403);
    expect(detailsRes.body.error.code).toBe('FORBIDDEN');

    // Eve attempts to read messages
    const readRes = await eavesdropper.get(`/api/conversations/${conv.id}/messages`);
    expect(readRes.status).toBe(403);
    expect(readRes.body.error.code).toBe('FORBIDDEN');

    // Eve attempts to post a message into Alice & Bob's conversation
    const postRes = await eavesdropper.post(`/api/conversations/${conv.id}/messages`, { content: 'Injected message' });
    expect(postRes.status).toBe(403);
    expect(postRes.body.error.code).toBe('FORBIDDEN');

    // Verify no messages were injected
    const legitMessages = (await userA.get(`/api/conversations/${conv.id}/messages`).expect(200)).body.items;
    expect(legitMessages).toHaveLength(1);
    expect(legitMessages[0].content).toBe('Confidential clinical trial notes');
  });

  it('validates message input length', async () => {
    const userA = await registerUser();
    const userB = await registerUser();
    const conv = (await userA.post('/api/conversations', { targetUserId: userB.user.id }).expect(201)).body.conversation;

    // Empty message
    const emptyRes = await userA.post(`/api/conversations/${conv.id}/messages`, { content: '   ' });
    expect(emptyRes.status).toBe(400);

    // Excessively long message (> 4000 characters)
    const longRes = await userA.post(`/api/conversations/${conv.id}/messages`, { content: 'a'.repeat(4001) });
    expect(longRes.status).toBe(400);
  });
});
