-- Add chargeback_requested to payment_status enum
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'chargeback_requested';

-- Add columns to checkout_sessions for internal state management
ALTER TABLE public.checkout_sessions 
  ADD COLUMN IF NOT EXISTS internal_state TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS reverted_at TIMESTAMPTZ;

-- Add columns to orders for payment verification scheduling
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS next_payment_check_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_check_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_max_expiry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS chargeback_detected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS chargeback_deadline_at TIMESTAMPTZ;

-- Index for efficient payment verification cron queries
CREATE INDEX IF NOT EXISTS idx_orders_next_payment_check 
  ON public.orders (next_payment_check_at) 
  WHERE next_payment_check_at IS NOT NULL 
    AND payment_status IN ('pending');

-- Index for chargeback monitoring (approved orders with paid_at)
CREATE INDEX IF NOT EXISTS idx_orders_chargeback_monitoring 
  ON public.orders (payment_status, paid_at) 
  WHERE payment_status = 'approved' 
    AND paid_at IS NOT NULL;