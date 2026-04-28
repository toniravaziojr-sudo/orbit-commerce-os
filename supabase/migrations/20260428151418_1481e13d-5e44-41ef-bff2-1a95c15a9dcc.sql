
-- Onda 4.4 — Hardening final
-- Frente A: revogar EXECUTE de função SECURITY DEFINER administrativa não usada pelo client
REVOKE EXECUTE ON FUNCTION public.update_customer_order_stats(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_customer_order_stats(uuid) TO service_role;

-- Frente D parte 1: ai_model_param_compat tem RLS habilitado mas sem policy
-- É um catálogo de referência de modelos/parâmetros suportados — leitura pública é segura
CREATE POLICY "Anyone can read AI model param compatibility"
ON public.ai_model_param_compat
FOR SELECT
TO anon, authenticated
USING (true);

-- Service role mantém escrita total (default sem policy de WRITE para anon/auth)
CREATE POLICY "Service role manages AI model param compatibility"
ON public.ai_model_param_compat
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
