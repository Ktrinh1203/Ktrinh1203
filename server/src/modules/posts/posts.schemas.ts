import { z } from 'zod';

export const createPostSchema = z.object({
  content: z.string().trim().min(1, 'Post content cannot be empty').max(5000, 'Post content exceeds 5000 characters'),
});

export const updatePostSchema = z.object({
  content: z.string().trim().min(1, 'Post content cannot be empty').max(5000, 'Post content exceeds 5000 characters'),
});

export const getPostsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  feedType: z.enum(['community', 'following']).default('community'),
  authorId: z.string().uuid().optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type GetPostsQuery = z.infer<typeof getPostsQuerySchema>;
