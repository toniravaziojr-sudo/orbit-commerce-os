-- Gatilho de blindagem: garante telefone/e-mail do destinatário no Pedido de Venda
-- copiando do pedido original quando estiverem ausentes. Roda em INSERT e UPDATE.
CREATE OR REPLACE FUNCTION public.ensure_pv_contact_from_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_email TEXT;
  v_phone_digits TEXT;
BEGIN
  -- Aplica somente em Pedidos de Venda com pedido vinculado.
  IF COALESCE(NEW.fiscal_stage, '') <> 'pedido_venda' OR NEW.order_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_phone_digits := regexp_replace(COALESCE(NEW.dest_telefone, ''), '\D', '', 'g');

  -- Só busca no pedido se faltar algum dos dois.
  IF length(v_phone_digits) < 10 OR NEW.dest_email IS NULL OR btrim(NEW.dest_email) = '' THEN
    SELECT customer_phone, customer_email
      INTO v_phone, v_email
      FROM public.orders
      WHERE id = NEW.order_id;

    -- Telefone: sanitiza para dígitos, exige 10–13.
    IF length(v_phone_digits) < 10 AND v_phone IS NOT NULL THEN
      v_phone := regexp_replace(v_phone, '\D', '', 'g');
      IF length(v_phone) BETWEEN 10 AND 13 THEN
        NEW.dest_telefone := v_phone;
      END IF;
    END IF;

    -- E-mail: copia se vier preenchido.
    IF (NEW.dest_email IS NULL OR btrim(NEW.dest_email) = '') AND v_email IS NOT NULL AND btrim(v_email) <> '' THEN
      NEW.dest_email := v_email;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_pv_contact_from_order ON public.fiscal_invoices;
CREATE TRIGGER trg_ensure_pv_contact_from_order
BEFORE INSERT OR UPDATE OF dest_telefone, dest_email, order_id, fiscal_stage
ON public.fiscal_invoices
FOR EACH ROW
EXECUTE FUNCTION public.ensure_pv_contact_from_order();