-- Fix stale ref_id references in footer_2 menu items
-- Feedback Clientes: was NULL → 0d2b9d78 (slug: feedback-clientes)
UPDATE public.menu_items SET ref_id = '0d2b9d78-26c3-46fc-9503-ea01a82411f3' WHERE id = '6347f20a-071d-472e-affa-6a8401f089eb';
-- FAQ: was 922e3f54 (deleted) → 04ee3dad (slug: faq)
UPDATE public.menu_items SET ref_id = '04ee3dad-ec9e-440a-8134-27ef2f83de95' WHERE id = '523bc5ad-1a1d-448e-8161-fc199cc81011';
-- Garantia: was 04d848a9 (deleted) → 8e5931f0 (slug: trocas-e-devolucoes)
UPDATE public.menu_items SET ref_id = '8e5931f0-3cfd-4bc5-b544-3fd988a301d1' WHERE id = '1cb34eca-d34c-45b7-a5a2-51fe9e78ebfd';
-- Privacidade: was 6cf63753 (deleted) → 3183ee1d (slug: politica-de-privacidade)
UPDATE public.menu_items SET ref_id = '3183ee1d-a962-48ee-9ffe-4701f8c8ae8f' WHERE id = '74871cd1-36f8-4432-a424-20a544cacdee';