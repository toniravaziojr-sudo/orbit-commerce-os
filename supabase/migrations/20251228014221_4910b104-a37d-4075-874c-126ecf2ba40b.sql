-- Add 'chat' to support_channel_type enum for the storefront widget
ALTER TYPE support_channel_type ADD VALUE IF NOT EXISTS 'chat';