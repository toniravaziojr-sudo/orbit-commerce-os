-- Add new order_status enum values for the fiscal workflow
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'awaiting_confirmation';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'ready_to_invoice';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'invoice_pending_sefaz';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'invoice_authorized';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'invoice_issued';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'dispatched';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'returning';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'payment_expired';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'invoice_rejected';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'invoice_cancelled';