-- Add asset_review status to media_item_status enum
ALTER TYPE media_item_status ADD VALUE IF NOT EXISTS 'asset_review' AFTER 'generating_asset';

-- Add default_time column to media_campaigns for scheduled time preference
ALTER TABLE media_campaigns 
ADD COLUMN IF NOT EXISTS default_time time DEFAULT '10:00:00',
ADD COLUMN IF NOT EXISTS business_context text,
ADD COLUMN IF NOT EXISTS ai_generated_context jsonb;