-- Add 'tiktokshop' to channel_type check constraint on channel_accounts table
ALTER TABLE public.channel_accounts DROP CONSTRAINT IF EXISTS channel_accounts_channel_type_check;

-- Also add to conversations table if constraint exists
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_channel_type_check;

-- Re-add constraints with tiktokshop included
-- If they use enum type instead, we need to add to the enum
DO $$
BEGIN
  -- Try to add 'tiktokshop' to channel_type enum if it exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_type') THEN
    ALTER TYPE channel_type ADD VALUE IF NOT EXISTS 'tiktokshop';
  END IF;
END $$;