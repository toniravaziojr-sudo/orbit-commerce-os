
REVOKE EXECUTE ON FUNCTION public.compute_pedido_venda_pendencias(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_pedido_venda_pendencias() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_pedido_venda_pendencias_from_items() FROM PUBLIC, anon, authenticated;
