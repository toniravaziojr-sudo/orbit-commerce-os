// =============================================
// FISCAL HOOKS - Gerenciamento de NF-e
// =============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Types
export interface FiscalSettings {
  id: string;
  tenant_id: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  inscricao_estadual: string | null;
  ie_isento: boolean;
  cnae: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_municipio: string | null;
  endereco_municipio_codigo: string | null;
  endereco_uf: string | null;
  endereco_cep: string | null;
  crt: number;
  cfop_intrastadual: string;
  cfop_interestadual: string;
  csosn_padrao: string | null;
  cst_padrao: string | null;
  serie_nfe: number;
  numero_nfe_atual: number;
  provider: string;
  provider_token: string | null;
  ambiente: string;
  emissao_automatica: boolean;
  emitir_apos_status: string;
  is_configured: boolean;
  created_at: string;
  updated_at: string;
  // Certificate fields
  certificado_cn: string | null;
  certificado_cnpj: string | null;
  certificado_valido_ate: string | null;
  certificado_serial: string | null;
  certificado_uploaded_at: string | null;
}

export interface CertificateInfo {
  cn: string;
  cnpj: string | null;
  valid_until: string;
  serial: string;
  days_until_expiry: number;
  uploaded_at: string;
}

export interface FiscalProduct {
  id: string;
  product_id: string;
  tenant_id: string;
  ncm: string | null;
  cest: string | null;
  origem: number;
  unidade_comercial: string;
  cfop_override: string | null;
  csosn_override: string | null;
  cst_override: string | null;
}

export interface FiscalInvoice {
  id: string;
  tenant_id: string;
  order_id: string | null;
  numero: number;
  serie: number;
  chave_acesso: string | null;
  protocolo: string | null;
  status: 'draft' | 'pending' | 'authorized' | 'rejected' | 'canceled';
  status_motivo: string | null;
  natureza_operacao: string;
  cfop: string | null;
  valor_total: number;
  valor_produtos: number;
  valor_frete: number;
  valor_desconto: number;
  valor_seguro?: number;
  valor_outras_despesas?: number;
  dest_nome: string;
  dest_cpf_cnpj: string;
  dest_inscricao_estadual?: string | null;
  dest_endereco_logradouro?: string | null;
  dest_endereco_numero?: string | null;
  dest_endereco_complemento?: string | null;
  dest_endereco_bairro?: string | null;
  dest_endereco_municipio?: string | null;
  dest_endereco_municipio_codigo?: string | null;
  dest_endereco_uf: string | null;
  dest_endereco_cep?: string | null;
  dest_telefone?: string | null;
  dest_email?: string | null;
  modalidade_frete?: string;
  transportadora_nome?: string | null;
  transportadora_cnpj?: string | null;
  peso_bruto?: number | null;
  peso_liquido?: number | null;
  quantidade_volumes?: number | null;
  especie_volumes?: string | null;
  observacoes?: string | null;
  danfe_url: string | null;
  danfe_printed_at?: string | null;
  xml_autorizado: string | null;
  created_at: string;
  updated_at: string;
}

export interface FiscalInvoiceItem {
  id: string;
  invoice_id: string;
  numero_item: number;
  codigo_produto: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Hook: Fiscal Settings
export function useFiscalSettings() {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['fiscal-settings'],
    queryFn: async (): Promise<FiscalSettings | null> => {
      const { data, error } = await supabase.functions.invoke('fiscal-settings', {
        method: 'GET',
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao buscar configurações');
      
      return data.settings;
    },
  });

  const saveSettings = useMutation({
    mutationFn: async (settings: Partial<FiscalSettings>) => {
      const { data, error } = await supabase.functions.invoke('fiscal-settings', {
        method: 'POST',
        body: settings,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao salvar configurações');
      
      return data.settings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-settings'] });
      toast.success('Configurações fiscais salvas');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  const uploadCertificate = useMutation({
    mutationFn: async ({ pfxBase64, password }: { pfxBase64: string; password: string }): Promise<CertificateInfo> => {
      const { data, error } = await supabase.functions.invoke('fiscal-upload-certificate', {
        body: { pfx_base64: pfxBase64, password },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao enviar certificado');
      
      return data.certificate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-settings'] });
      toast.success('Certificado digital salvo com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const removeCertificate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('fiscal-remove-certificate', {
        method: 'POST',
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao remover certificado');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-settings'] });
      toast.success('Certificado removido com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    error: settingsQuery.error,
    saveSettings,
    uploadCertificate,
    removeCertificate,
  };
}

// Hook: Fiscal Products
export function useFiscalProducts() {
  const { profile } = useAuth();
  const tenantId = profile?.current_tenant_id;
  const queryClient = useQueryClient();

  const productsQuery = useQuery({
    queryKey: ['fiscal-products', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('fiscal_products')
        .select('*')
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return data as FiscalProduct[];
    },
    enabled: !!tenantId,
  });

  const saveFiscalProduct = useMutation({
    mutationFn: async ({ productId, fiscalData }: { productId: string; fiscalData: Partial<FiscalProduct> }) => {
      if (!tenantId) throw new Error('Tenant não selecionado');

      // Check if exists
      const { data: existing } = await supabase
        .from('fiscal_products')
        .select('id')
        .eq('product_id', productId)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('fiscal_products')
          .update(fiscalData)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('fiscal_products')
          .insert({ ...fiscalData, product_id: productId, tenant_id: tenantId })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-products'] });
    },
  });

  const getFiscalProduct = (productId: string): FiscalProduct | undefined => {
    return productsQuery.data?.find(fp => fp.product_id === productId);
  };

  return {
    fiscalProducts: productsQuery.data || [],
    isLoading: productsQuery.isLoading,
    saveFiscalProduct,
    getFiscalProduct,
  };
}

// Hook: Fiscal Invoices
export function useFiscalInvoices(filters?: { status?: string; startDate?: string; endDate?: string }) {
  const { profile } = useAuth();
  const tenantId = profile?.current_tenant_id;

  return useQuery({
    queryKey: ['fiscal-invoices', tenantId, filters],
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from('fiscal_invoices')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FiscalInvoice[];
    },
    enabled: !!tenantId,
  });
}

// Hook: Invoice Stats
export function useFiscalStats() {
  const { profile } = useAuth();
  const tenantId = profile?.current_tenant_id;
  
  return useQuery({
    queryKey: ['fiscal-stats', tenantId],
    queryFn: async () => {
      if (!tenantId) return { total: 0, authorized: 0, pending: 0, rejected: 0 };

      // Get current month range
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      const { data, error } = await supabase
        .from('fiscal_invoices')
        .select('status')
        .eq('tenant_id', tenantId)
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);

      if (error) throw error;

      const stats = {
        total: data.length,
        authorized: data.filter(i => i.status === 'authorized').length,
        pending: data.filter(i => i.status === 'pending' || i.status === 'draft').length,
        rejected: data.filter(i => i.status === 'rejected').length,
        canceled: data.filter(i => i.status === 'canceled').length,
      };

      return stats;
    },
    enabled: !!tenantId,
  });
}

// Hook: Validate Order for NF-e
export function useValidateOrder() {
  return useMutation({
    mutationFn: async (orderId: string): Promise<ValidationResult> => {
      const { data, error } = await supabase.functions.invoke('fiscal-validate-order', {
        body: { order_id: orderId },
      });

      if (error) throw error;
      if (!data?.success && !data?.valid) throw new Error(data?.error || 'Erro na validação');
      
      return {
        valid: data.valid,
        errors: data.errors || [],
        warnings: data.warnings || [],
      };
    },
  });
}

// Hook: Create Draft NF-e
export function useCreateDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, naturezaOperacao, observacoes }: { 
      orderId: string; 
      naturezaOperacao?: string; 
      observacoes?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('fiscal-create-draft', {
        body: { 
          order_id: orderId,
          natureza_operacao: naturezaOperacao,
          observacoes,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao criar rascunho');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices'] });
    },
  });
}

// Hook: Submit NF-e
export function useSubmitInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase.functions.invoke('fiscal-submit', {
        body: { invoice_id: invoiceId },
      });

      if (error) throw error;
      if (!data?.success && data?.status !== 'authorized' && data?.status !== 'pending') {
        throw new Error(data?.error || 'Erro ao emitir NF-e');
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal-stats'] });
      
      if (data.status === 'authorized') {
        toast.success('NF-e autorizada com sucesso!');
      } else if (data.status === 'pending') {
        toast.info('NF-e em processamento...');
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro ao emitir: ${error.message}`);
    },
  });
}

// Hook: Check Invoice Status
export function useCheckInvoiceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase.functions.invoke('fiscal-get-status', {
        body: { invoice_id: invoiceId },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao consultar status');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal-stats'] });
    },
  });
}

// Hook: Get Invoice for Order
export function useOrderInvoice(orderId?: string) {
  const { profile } = useAuth();
  const tenantId = profile?.current_tenant_id;

  return useQuery({
    queryKey: ['order-invoice', orderId],
    queryFn: async () => {
      if (!orderId || !tenantId) return null;

      const { data, error } = await supabase
        .from('fiscal_invoices')
        .select('*')
        .eq('order_id', orderId)
        .eq('tenant_id', tenantId)
        .neq('status', 'canceled')
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (error) throw error;
      return data as FiscalInvoice | null;
    },
    enabled: !!orderId && !!tenantId,
  });
}

// Hook: Orders pending invoice emission
export function useOrdersPendingInvoice() {
  const { profile } = useAuth();
  const tenantId = profile?.current_tenant_id;

  return useQuery({
    queryKey: ['orders-pending-invoice', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      // Get orders with status 'paid' that don't have an associated invoice
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          created_at,
          total,
          customer_name,
          customer_email,
          status
        `)
        .eq('tenant_id', tenantId)
        .eq('status', 'paid')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get order IDs that already have invoices
      const { data: existingInvoices, error: invoiceError } = await supabase
        .from('fiscal_invoices')
        .select('order_id')
        .eq('tenant_id', tenantId)
        .neq('status', 'canceled')
        .not('order_id', 'is', null);

      if (invoiceError) throw invoiceError;

      const invoicedOrderIds = new Set(existingInvoices?.map(i => i.order_id) || []);
      
      // Filter out orders that already have invoices
      return orders?.filter(o => !invoicedOrderIds.has(o.id)) || [];
    },
    enabled: !!tenantId,
  });
}

// Hook: Fiscal Alerts (orders cancelled/returned with authorized invoices)
export function useFiscalAlerts() {
  const { profile } = useAuth();
  const tenantId = profile?.current_tenant_id;
  const queryClient = useQueryClient();

  const alertsQuery = useQuery({
    queryKey: ['fiscal-alerts', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('fiscal_invoices')
        .select(`
          id,
          numero,
          serie,
          order_id,
          dest_nome,
          valor_total,
          action_reason,
          created_at,
          orders!inner(order_number, status)
        `)
        .eq('tenant_id', tenantId)
        .eq('status', 'authorized')
        .eq('requires_action', true)
        .is('action_dismissed_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const dismissAlert = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from('fiscal_invoices')
        .update({ action_dismissed_at: new Date().toISOString() })
        .eq('id', invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-alerts'] });
      toast.success('Alerta dispensado');
    },
  });

  return {
    alerts: alertsQuery.data || [],
    isLoading: alertsQuery.isLoading,
    dismissAlert,
    refetch: alertsQuery.refetch,
  };
}
