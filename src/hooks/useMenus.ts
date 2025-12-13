import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Menu {
  id: string;
  tenant_id: string;
  name: string;
  location: 'header' | 'footer';
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  tenant_id: string;
  menu_id: string;
  label: string;
  item_type: 'category' | 'page' | 'external';
  ref_id: string | null;
  url: string | null;
  sort_order: number;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export type MenuFormData = Omit<Menu, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>;
export type MenuItemFormData = Omit<MenuItem, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>;

export function useMenus() {
  const { currentTenant } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: menus, isLoading, error } = useQuery({
    queryKey: ['menus', currentTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menus')
        .select('*')
        .eq('tenant_id', currentTenant!.id)
        .order('location');

      if (error) throw error;
      return data as Menu[];
    },
    enabled: !!currentTenant?.id,
  });

  const createMenu = useMutation({
    mutationFn: async (formData: MenuFormData) => {
      const { data, error } = await supabase
        .from('menus')
        .insert({ ...formData, tenant_id: currentTenant!.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menus'] });
      toast({ title: 'Menu criado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar menu', description: error.message, variant: 'destructive' });
    },
  });

  const updateMenu = useMutation({
    mutationFn: async ({ id, ...formData }: Partial<Menu> & { id: string }) => {
      const { data, error } = await supabase
        .from('menus')
        .update(formData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menus'] });
      toast({ title: 'Menu atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar menu', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMenu = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('menus').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menus'] });
      toast({ title: 'Menu excluído!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir menu', description: error.message, variant: 'destructive' });
    },
  });

  return {
    menus,
    isLoading,
    error,
    createMenu,
    updateMenu,
    deleteMenu,
  };
}

export function useMenuItems(menuId: string | null) {
  const { currentTenant } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items, isLoading, error } = useQuery({
    queryKey: ['menu-items', menuId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('menu_id', menuId!)
        .order('sort_order');

      if (error) throw error;
      return data as MenuItem[];
    },
    enabled: !!menuId,
  });

  const createItem = useMutation({
    mutationFn: async (formData: MenuItemFormData) => {
      const { data, error } = await supabase
        .from('menu_items')
        .insert({ ...formData, tenant_id: currentTenant!.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items', menuId] });
      toast({ title: 'Item adicionado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao adicionar item', description: error.message, variant: 'destructive' });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...formData }: Partial<MenuItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('menu_items')
        .update(formData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items', menuId] });
      toast({ title: 'Item atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar item', description: error.message, variant: 'destructive' });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('menu_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items', menuId] });
      toast({ title: 'Item excluído!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir item', description: error.message, variant: 'destructive' });
    },
  });

  const reorderItems = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) => 
        supabase.from('menu_items').update({ sort_order: index }).eq('id', id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items', menuId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao reordenar', description: error.message, variant: 'destructive' });
    },
  });

  return {
    items,
    isLoading,
    error,
    createItem,
    updateItem,
    deleteItem,
    reorderItems,
  };
}
