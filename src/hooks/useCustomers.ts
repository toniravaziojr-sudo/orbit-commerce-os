import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface Customer {
  id: string;
  tenant_id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string;
  cpf: string | null;
  phone: string | null;
  birth_date: string | null;
  gender: 'male' | 'female' | 'other' | 'not_informed' | null;
  status: 'active' | 'inactive' | 'blocked' | null;
  email_verified: boolean | null;
  phone_verified: boolean | null;
  accepts_marketing: boolean | null;
  total_orders: number | null;
  total_spent: number | null;
  average_ticket: number | null;
  first_order_at: string | null;
  last_order_at: string | null;
  loyalty_points: number | null;
  loyalty_tier: 'bronze' | 'silver' | 'gold' | 'platinum' | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  label: string;
  is_default: boolean;
  recipient_name: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerTag {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
}

export interface CustomerNote {
  id: string;
  customer_id: string;
  author_id: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerWithTags extends Customer {
  tags?: CustomerTag[];
}

export type CustomerFormData = {
  email: string;
  full_name: string;
  cpf?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  gender?: 'male' | 'female' | 'other' | 'not_informed' | null;
  status?: 'active' | 'inactive' | 'blocked';
  accepts_marketing?: boolean;
};

export function useCustomerTagAssignments(customerId: string | undefined) {
  const queryClient = useQueryClient();

  const assignmentsQuery = useQuery({
    queryKey: ['customer-tag-assignments', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from('customer_tag_assignments')
        .select('tag_id')
        .eq('customer_id', customerId);

      if (error) throw error;
      return data.map(a => a.tag_id);
    },
    enabled: !!customerId,
  });

  const updateAssignments = useMutation({
    mutationFn: async ({ customerId, tagIds }: { customerId: string; tagIds: string[] }) => {
      // Delete all current assignments
      await supabase
        .from('customer_tag_assignments')
        .delete()
        .eq('customer_id', customerId);

      // Insert new assignments
      if (tagIds.length > 0) {
        const { error } = await supabase
          .from('customer_tag_assignments')
          .insert(tagIds.map(tagId => ({
            customer_id: customerId,
            tag_id: tagId,
          })));

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-tag-assignments', variables.customerId] });
    },
  });

  return {
    tagIds: assignmentsQuery.data ?? [],
    isLoading: assignmentsQuery.isLoading,
    updateAssignments,
  };
}

export function useCustomers(options?: { page?: number; pageSize?: number; search?: string; status?: string }) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const search = options?.search ?? '';
  const status = options?.status ?? 'all';

  const customersQuery = useQuery({
    queryKey: ['customers', currentTenant?.id, page, pageSize, search, status],
    queryFn: async () => {
      if (!currentTenant?.id) return { data: [], count: 0 };
      
      let query = supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .eq('tenant_id', currentTenant.id);

      // Apply filters
      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
      }
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { data: data as Customer[], count: count ?? 0 };
    },
    enabled: !!currentTenant?.id,
  });

  const createCustomer = useMutation({
    mutationFn: async (formData: CustomerFormData) => {
      if (!currentTenant?.id) throw new Error('Tenant não encontrado');

      const { data, error } = await supabase
        .from('customers')
        .insert({
          tenant_id: currentTenant.id,
          ...formData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', currentTenant?.id] });
      toast.success('Cliente criado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao criar cliente:', error);
      if (error.message.includes('unique')) {
        toast.error('Já existe um cliente com este email ou CPF');
      } else {
        toast.error('Erro ao criar cliente');
      }
    },
  });

  const updateCustomer = useMutation({
    mutationFn: async ({ id, ...formData }: CustomerFormData & { id: string }) => {
      const { data, error } = await supabase
        .from('customers')
        .update(formData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', currentTenant?.id] });
      toast.success('Cliente atualizado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar cliente:', error);
      toast.error('Erro ao atualizar cliente');
    },
  });

  const deleteCustomer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', currentTenant?.id] });
      toast.success('Cliente removido com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao remover cliente:', error);
      toast.error('Erro ao remover cliente');
    },
  });

  return {
    customers: customersQuery.data?.data ?? [],
    totalCount: customersQuery.data?.count ?? 0,
    isLoading: customersQuery.isLoading,
    error: customersQuery.error,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    refetch: customersQuery.refetch,
  };
}

export function useCustomerTags() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  const tagsQuery = useQuery({
    queryKey: ['customer-tags', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('customer_tags')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('name');

      if (error) throw error;
      return data as CustomerTag[];
    },
    enabled: !!currentTenant?.id,
  });

  const createTag = useMutation({
    mutationFn: async (formData: { name: string; color?: string; description?: string }) => {
      if (!currentTenant?.id) throw new Error('Tenant não encontrado');

      const { data, error } = await supabase
        .from('customer_tags')
        .insert({
          tenant_id: currentTenant.id,
          ...formData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-tags', currentTenant?.id] });
      toast.success('Tag criada com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao criar tag:', error);
      if (error.message.includes('unique')) {
        toast.error('Já existe uma tag com este nome');
      } else {
        toast.error('Erro ao criar tag');
      }
    },
  });

  const deleteTag = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('customer_tags')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-tags', currentTenant?.id] });
      toast.success('Tag removida com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao remover tag:', error);
      toast.error('Erro ao remover tag');
    },
  });

  return {
    tags: tagsQuery.data ?? [],
    isLoading: tagsQuery.isLoading,
    createTag,
    deleteTag,
  };
}

export function useCustomerNotes(customerId: string | undefined) {
  const queryClient = useQueryClient();

  const notesQuery = useQuery({
    queryKey: ['customer-notes', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from('customer_notes')
        .select('*')
        .eq('customer_id', customerId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CustomerNote[];
    },
    enabled: !!customerId,
  });

  const createNote = useMutation({
    mutationFn: async ({ content, customerId }: { content: string; customerId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('customer_notes')
        .insert({
          customer_id: customerId,
          author_id: user.id,
          content,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-notes', customerId] });
      toast.success('Nota adicionada!');
    },
    onError: (error: Error) => {
      console.error('Erro ao adicionar nota:', error);
      toast.error('Erro ao adicionar nota');
    },
  });

  return {
    notes: notesQuery.data ?? [],
    isLoading: notesQuery.isLoading,
    createNote,
  };
}

export function useCustomerAddresses(customerId: string | undefined) {
  const queryClient = useQueryClient();

  const addressesQuery = useQuery({
    queryKey: ['customer-addresses', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('customer_id', customerId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CustomerAddress[];
    },
    enabled: !!customerId,
  });

  const createAddress = useMutation({
    mutationFn: async (formData: Omit<CustomerAddress, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('customer_addresses')
        .insert(formData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-addresses', customerId] });
      toast.success('Endereço adicionado!');
    },
    onError: (error: Error) => {
      console.error('Erro ao adicionar endereço:', error);
      toast.error('Erro ao adicionar endereço');
    },
  });

  const deleteAddress = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('customer_addresses')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-addresses', customerId] });
      toast.success('Endereço removido!');
    },
    onError: (error: Error) => {
      console.error('Erro ao remover endereço:', error);
      toast.error('Erro ao remover endereço');
    },
  });

  return {
    addresses: addressesQuery.data ?? [],
    isLoading: addressesQuery.isLoading,
    createAddress,
    deleteAddress,
  };
}
