-- Add new order_status enum values for chargeback flow
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'chargeback_detected';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'chargeback_lost';

-- Add new payment_status enum value for chargeback analysis
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'under_review';

-- Add column to store the order status before chargeback (for restoration on recovery)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_before_chargeback text;