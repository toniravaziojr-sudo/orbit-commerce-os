-- Onda 3.1 — REVOKE Grupo VERDE: Tokens (8 funções)
-- Padrão: REVOKE de anon, authenticated e PUBLIC. service_role mantém acesso por default.

REVOKE EXECUTE ON FUNCTION public.accept_invitation(text, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_billing_checkout_token(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_order_number(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_order_retry_token(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_review_token(uuid, uuid, uuid, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_unsubscribe_token(uuid, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_meta_grant_token(uuid, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_meta_grant_token(uuid, text, text, text, timestamptz) FROM anon, authenticated, PUBLIC;