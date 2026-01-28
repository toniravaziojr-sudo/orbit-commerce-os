
-- Corrigir a RPC create_tenant_for_user para usar status 'pending_payment_method'
-- ao invés de 'active' para o plano básico

CREATE OR REPLACE FUNCTION public.create_tenant_for_user(p_name text, p_slug text)
RETURNS public.tenants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant public.tenants;
BEGIN
  -- Verificar autenticação
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verificar se slug já existe
  IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'Slug already exists';
  END IF;

  -- Criar tenant com plano básico por padrão
  INSERT INTO public.tenants (name, slug, plan)
  VALUES (p_name, p_slug, 'start')
  RETURNING * INTO v_tenant;

  -- Criar role de owner para o usuário
  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (auth.uid(), v_tenant.id, 'owner')
  ON CONFLICT DO NOTHING;

  -- Atualizar current_tenant_id no profile
  UPDATE public.profiles
  SET current_tenant_id = v_tenant.id
  WHERE id = auth.uid();
  
  -- CORREÇÃO: Criar assinatura no plano básico com status 'pending_payment_method'
  -- O usuário precisa cadastrar cartão para publicar loja e usar funcionalidades completas
  INSERT INTO public.tenant_subscriptions (tenant_id, plan_key, status, billing_cycle)
  VALUES (v_tenant.id, 'basico', 'pending_payment_method', 'monthly')
  ON CONFLICT (tenant_id) DO NOTHING;
  
  -- Inicializar wallet de créditos com saldo zero
  INSERT INTO public.credit_wallet (tenant_id, balance_credits, reserved_credits, lifetime_purchased, lifetime_consumed)
  VALUES (v_tenant.id, 0, 0, 0, 0)
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN v_tenant;
END;
$$;

-- Corrigir usuários que foram criados incorretamente com status 'active' no plano básico
-- mas que NÃO têm método de pagamento cadastrado
UPDATE public.tenant_subscriptions
SET status = 'pending_payment_method'
WHERE plan_key = 'basico'
  AND status = 'active'
  AND payment_method_type IS NULL
  AND card_last_four IS NULL;
