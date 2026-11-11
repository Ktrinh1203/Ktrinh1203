-- Prevent self-following at the database constraint level
ALTER TABLE "Follow" ADD CONSTRAINT "follow_no_self_follow" CHECK ("followerId" <> "followingId");

-- Enforce lowercase alphanumeric + underscore username format at the database level
ALTER TABLE "User" ADD CONSTRAINT "user_username_format" CHECK ("username" ~ '^[a-z0-9_]{3,30}$');
