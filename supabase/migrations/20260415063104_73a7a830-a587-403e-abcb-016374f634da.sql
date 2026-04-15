
-- Function to attribute email conversions on order approval
CREATE OR REPLACE FUNCTION public.attribute_email_conversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token RECORD;
  v_normalized_email TEXT;
  v_order_value_cents BIGINT;
BEGIN
  -- Only fire when payment just became approved
  IF NEW.payment_status = 'approved' AND (OLD IS NULL OR OLD.payment_status IS DISTINCT FROM 'approved') THEN
    
    -- Need customer email
    IF NEW.customer_email IS NULL OR TRIM(NEW.customer_email) = '' THEN
      RETURN NULL;
    END IF;

    v_normalized_email := LOWER(TRIM(NEW.customer_email));
    v_order_value_cents := COALESCE((NEW.total * 100)::BIGINT, 0);

    -- Skip zero-value orders
    IF v_order_value_cents <= 0 THEN
      RETURN NULL;
    END IF;

    -- Find the most recent click from this email in the last 7 days (last-click attribution)
    SELECT ett.campaign_id, ett.subscriber_id, ett.tenant_id
    INTO v_token
    FROM email_tracking_tokens ett
    JOIN email_marketing_subscribers ems ON ems.id = ett.subscriber_id
    WHERE ems.email = v_normalized_email
      AND ett.tenant_id = NEW.tenant_id
      AND ett.clicked_at IS NOT NULL
      AND ett.clicked_at >= (now() - interval '7 days')
    ORDER BY ett.clicked_at DESC
    LIMIT 1;

    -- If found a click, attribute the conversion
    IF v_token IS NOT NULL THEN
      -- Avoid duplicate: check if this order was already attributed to this campaign
      IF NOT EXISTS (
        SELECT 1 FROM email_conversions
        WHERE order_id = NEW.id AND campaign_id = v_token.campaign_id
      ) THEN
        -- Insert conversion record
        INSERT INTO email_conversions (
          tenant_id, campaign_id, subscriber_id, order_id, value_cents, attributed_at
        ) VALUES (
          NEW.tenant_id, v_token.campaign_id, v_token.subscriber_id,
          NEW.id, v_order_value_cents, now()
        );

        -- Increment campaign counters
        UPDATE email_marketing_campaigns
        SET 
          conversion_count = COALESCE(conversion_count, 0) + 1,
          conversion_value_cents = COALESCE(conversion_value_cents, 0) + v_order_value_cents
        WHERE id = v_token.campaign_id;
      END IF;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- Create trigger (AFTER UPDATE to not interfere with existing BEFORE triggers)
DROP TRIGGER IF EXISTS trg_attribute_email_conversion ON public.orders;
CREATE TRIGGER trg_attribute_email_conversion
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.attribute_email_conversion();
