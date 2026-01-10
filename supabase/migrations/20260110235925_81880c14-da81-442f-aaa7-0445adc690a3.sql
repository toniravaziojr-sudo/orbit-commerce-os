-- Add metadata column to files table for storing source info
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;