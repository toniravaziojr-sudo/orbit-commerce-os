
CREATE OR REPLACE FUNCTION public.sync_subscriber_to_customer_with_tag(
    p_tenant_id UUID,
    p_email TEXT,
    p_name TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_birth_date DATE DEFAULT NULL,
    p_source TEXT DEFAULT 'manual',
    p_list_id UUID DEFAULT NULL
)
RETURNS TABLE(subscriber_id UUID, customer_id UUID, is_new_subscriber BOOLEAN, is_new_customer BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_subscriber_id UUID;
    v_customer_id UUID;
    v_is_new_subscriber BOOLEAN := false;
    v_is_new_customer BOOLEAN := false;
    v_tag_id UUID;
    v_normalized_email TEXT;
BEGIN
    v_normalized_email := LOWER(TRIM(p_email));
    
    SELECT s.id INTO v_subscriber_id
    FROM email_marketing_subscribers s
    WHERE s.tenant_id = p_tenant_id AND s.email = v_normalized_email;
    
    IF v_subscriber_id IS NULL THEN
        INSERT INTO email_marketing_subscribers (
            tenant_id, email, name, phone, source, created_from, status
        ) VALUES (
            p_tenant_id, v_normalized_email, p_name, p_phone, p_source, p_source, 'active'
        ) RETURNING email_marketing_subscribers.id INTO v_subscriber_id;
        v_is_new_subscriber := true;
    ELSE
        UPDATE email_marketing_subscribers s2
        SET 
            name = COALESCE(p_name, s2.name),
            phone = COALESCE(p_phone, s2.phone),
            birth_date = COALESCE(p_birth_date, s2.birth_date),
            updated_at = now()
        WHERE s2.id = v_subscriber_id;
    END IF;
    
    SELECT c.id INTO v_customer_id
    FROM customers c
    WHERE c.tenant_id = p_tenant_id AND c.email = v_normalized_email AND c.deleted_at IS NULL;
    
    IF v_customer_id IS NULL THEN
        INSERT INTO customers (
            tenant_id, email, full_name, phone, birth_date, status, accepts_email_marketing
        ) VALUES (
            p_tenant_id, v_normalized_email, COALESCE(p_name, v_normalized_email), p_phone, p_birth_date, 'active', true
        ) RETURNING customers.id INTO v_customer_id;
        v_is_new_customer := true;
    ELSE
        UPDATE customers c2
        SET 
            full_name = COALESCE(NULLIF(p_name, ''), c2.full_name),
            phone = COALESCE(p_phone, c2.phone),
            birth_date = COALESCE(p_birth_date, c2.birth_date),
            accepts_email_marketing = true,
            updated_at = now()
        WHERE c2.id = v_customer_id;
    END IF;
    
    UPDATE email_marketing_subscribers s3
    SET customer_id = v_customer_id
    WHERE s3.id = v_subscriber_id AND s3.customer_id IS NULL;
    
    IF p_list_id IS NOT NULL THEN
        INSERT INTO email_marketing_list_members (tenant_id, list_id, subscriber_id)
        VALUES (p_tenant_id, p_list_id, v_subscriber_id)
        ON CONFLICT DO NOTHING;
        
        SELECT l.tag_id INTO v_tag_id
        FROM email_marketing_lists l
        WHERE l.id = p_list_id;
        
        IF v_tag_id IS NOT NULL AND v_customer_id IS NOT NULL THEN
            INSERT INTO customer_tag_assignments (customer_id, tag_id)
            VALUES (v_customer_id, v_tag_id)
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
    
    RETURN QUERY SELECT v_subscriber_id, v_customer_id, v_is_new_subscriber, v_is_new_customer;
END;
$$;
