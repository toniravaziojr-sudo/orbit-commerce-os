ALTER TABLE public.payment_method_discounts
  ADD COLUMN IF NOT EXISTS free_installments integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS pix_expiration_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS boleto_expiration_days integer NOT NULL DEFAULT 3;