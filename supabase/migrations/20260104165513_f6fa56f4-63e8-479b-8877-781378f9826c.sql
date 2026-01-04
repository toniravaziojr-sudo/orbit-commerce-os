-- Atualizar menus existentes com location='footer' para 'footer_1'
UPDATE public.menus SET location = 'footer_1' WHERE location = 'footer';

-- Normalizar item_type='link' para 'external'
UPDATE public.menu_items SET item_type = 'external' WHERE item_type = 'link';

-- Adicionar ON DELETE CASCADE na FK de menu_items para menus
ALTER TABLE public.menu_items DROP CONSTRAINT IF EXISTS menu_items_menu_id_fkey;
ALTER TABLE public.menu_items 
  ADD CONSTRAINT menu_items_menu_id_fkey 
  FOREIGN KEY (menu_id) REFERENCES public.menus(id) ON DELETE CASCADE;