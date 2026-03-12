
ALTER TABLE public.checkout_sessions 
  ADD COLUMN IF NOT EXISTS shipping_selected_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_selected_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.checkout_sessions.shipping_selected_at IS 'Timestamp when customer selected shipping method (AddShippingInfo event)';
COMMENT ON COLUMN public.checkout_sessions.payment_selected_at IS 'Timestamp when customer selected payment method (AddPaymentInfo event)';
