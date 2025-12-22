import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CheckoutSession {
  id: string;
  tenant_id: string;
  started_at: string;
  last_seen_at: string;
  status: 'active' | 'abandoned' | 'converted' | 'recovered' | 'canceled';
  abandoned_at: string | null;
  converted_at: string | null;
  recovered_at: string | null;
  order_id: string | null;
  cart_id: string | null;
  customer_id: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  region: string | null;
  currency: string;
  total_estimated: number | null;
  items_snapshot: unknown[];
  utm: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CheckoutSessionsFilters {
  search?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  region?: string;
}

export function useCheckoutSessions(filters: CheckoutSessionsFilters = {}) {
  const { currentTenant } = useAuth();

  return useQuery({
    queryKey: ['checkout-sessions', currentTenant?.id, filters],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      // Usar fetch direto pois a tabela ainda não está nos types gerados
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      // Construir query params
      const params = new URLSearchParams();
      params.set('tenant_id', `eq.${currentTenant.id}`);
      params.set('order', 'started_at.desc');
      
      // IMPORTANTE: Só mostrar sessões com contato capturado (email ou telefone)
      // Sessões sem contato não são úteis para recuperação
      params.set('contact_captured_at', 'not.is.null');
      
      // Filtrar por status - agora suporta active também
      if (filters.status === 'abandoned') {
        params.set('status', 'eq.abandoned');
      } else if (filters.status === 'recovered') {
        params.set('status', 'eq.recovered');
      } else if (filters.status === 'active') {
        params.set('status', 'eq.active');
      } else if (filters.status === 'converted') {
        params.set('status', 'eq.converted');
      }
      // Se 'all', não adiciona filtro de status

      if (filters.startDate) {
        params.set('started_at', `gte.${filters.startDate.toISOString()}`);
      }
      if (filters.endDate) {
        params.set('started_at', `lte.${filters.endDate.toISOString()}`);
      }
      if (filters.region && filters.region !== 'all') {
        params.set('region', `eq.${filters.region}`);
      }

      let url = `${supabaseUrl}/rest/v1/checkout_sessions?${params.toString()}`;

      // Busca textual precisa de abordagem diferente
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        url += `&or=(customer_email.ilike.*${searchTerm}*,customer_name.ilike.*${searchTerm}*,customer_phone.ilike.*${searchTerm}*)`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch checkout sessions: ${errorText}`);
      }

      const data = await response.json();
      return data as CheckoutSession[];
    },
    enabled: !!currentTenant?.id,
  });
}

export function useCheckoutSessionsStats() {
  const { currentTenant } = useAuth();

  return useQuery({
    queryKey: ['checkout-sessions-stats', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      // Buscar apenas os campos necessários para stats
      // IMPORTANTE: Só contar sessões com contato capturado
      const params = new URLSearchParams();
      params.set('tenant_id', `eq.${currentTenant.id}`);
      params.set('select', 'status,total_estimated');
      params.set('contact_captured_at', 'not.is.null');

      const response = await fetch(`${supabaseUrl}/rest/v1/checkout_sessions?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!response.ok) {
        return {
          total: 0,
          abandoned: 0,
          recovered: 0,
          notRecovered: 0,
          totalValue: 0,
        };
      }

      const data: { status: string; total_estimated: number | null }[] = await response.json();

      const stats = {
        total: data.filter(c => c.status === 'abandoned' || c.status === 'recovered').length,
        abandoned: data.filter(c => c.status === 'abandoned' || c.status === 'recovered').length,
        recovered: data.filter(c => c.status === 'recovered').length,
        notRecovered: data.filter(c => c.status === 'abandoned').length,
        totalValue: data
          .filter(c => c.status === 'abandoned' || c.status === 'recovered')
          .reduce((sum, c) => sum + (c.total_estimated || 0), 0),
      };

      return stats;
    },
    enabled: !!currentTenant?.id,
  });
}
