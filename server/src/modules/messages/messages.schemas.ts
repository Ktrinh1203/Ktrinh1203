import { z } from 'zod';

export const startConversationSchema = z.object({
  targetUserId: z.string().uuid('Invalid target user ID'),
});

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message cannot be empty').max(4000, 'Message cannot exceed 4000 characters'),
});

export const getMessagesQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type StartConversationInput = z.infer<typeof startConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type GetMessagesQuery = z.infer<typeof getMessagesQuerySchema>;
