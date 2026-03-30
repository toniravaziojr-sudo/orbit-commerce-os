
-- 1. Add is_first_sale column to orders (immutable flag, default false)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_first_sale BOOLEAN DEFAULT FALSE;

-- 2. Expand auto_tag_cliente trigger to fire on INSERT OR UPDATE
-- Drop old trigger first
DROP TRIGGER IF EXISTS trg_auto_tag_cliente_on_payment ON public.orders;

-- Recreate with INSERT OR UPDATE
CREATE TRIGGER trg_auto_tag_cliente_on_payment
  AFTER INSERT OR UPDATE OF payment_status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_tag_cliente_on_payment_approved();
