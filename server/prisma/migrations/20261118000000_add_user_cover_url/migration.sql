-- Add cover photo URL to User profile
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "coverUrl" VARCHAR(500);
