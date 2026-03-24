-- v8.20.1: Add tracking identity columns to checkout_sessions
-- These capture browser-side identity data at checkout time
-- so server-side Purchase CAPI (process-events) can include full identity

ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS visitor_id TEXT,
  ADD COLUMN IF NOT EXISTS fbp TEXT,
  ADD COLUMN IF NOT EXISTS fbc TEXT,
  ADD COLUMN IF NOT EXISTS client_ip TEXT,
  ADD COLUMN IF NOT EXISTS client_user_agent TEXT;