// =============================================
// useFiscalReadiness — FONTE ÚNICA de prontidão fiscal.
//
// Tanto o card superior "Pronto para emitir NF-e?" quanto o card
// "Validação Fiscal" devem consumir este hook. É proibido criar nova
// validação paralela de readiness no frontend.
//
// O veredito (overall_status) vem do backend (fiscal-integration-validate),
// que é a única fonte de verdade. O frontend apenas traduz para linguagem
// de negócio.
// =============================================
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type FiscalReadinessLevel = 'ok' | 'warn' | 'error' | 'pending';
export type FiscalOverallStatus =
  | 'ready'
  | 'ready_for_test'
  | 'config_pending'
  | 'error'
  | 'blocked';

export type FiscalReasonCode =
  | 'missing_company_data'
  | 'certificate_missing'
  | 'certificate_invalid'
  | 'certificate_expired'
  | 'certificate_cnpj_mismatch'
  | 'provider_setup_pending'
  | 'provider_setup_error'
  | 'credentials_capture_error'
  | 'returns_setup_pending'
  | 'returns_setup_error'
  | 'ready_for_test'
  | 'ready_for_production'
  | 'production_blocked';

export interface FiscalReadinessCard {
  key: string;
  level: FiscalReadinessLevel;
  title: string;
  message: string;
  status_label?: string;
  /** true → existe campo cadastral real para o usuário corrigir (mostrar "Ir para"). */
  goto?: boolean;
  reason_code?: FiscalReasonCode;
  details?: Record<string, any>;
}

export interface FiscalReadinessResult {
  success: boolean;
  ambiente?: 'homologacao' | 'producao';
  overall_status?: FiscalOverallStatus;
  reason_code?: FiscalReasonCode;
  next_action_label?: string | null;
  /** 'goto' = botão "Ir para" (campo cadastral). 'retry' = "Reprocessar configuração fiscal". */
  next_action_kind?: 'goto' | 'retry' | null;
  can_retry_activation?: boolean;
  auto_activation_attempted?: boolean;
  auto_activation_succeeded?: boolean;
  ready_for_production?: boolean;
  ready_for_homologation_smoke?: boolean;
  cards?: FiscalReadinessCard[];
  error?: string;
}

export const FISCAL_READINESS_QUERY_KEY = ['fiscal-integration-validate'] as const;

/**
 * Tradução do overall_status para linguagem de negócio.
 * Sem termos técnicos (token, webhook, API, Focus).
 */
export function readinessHeadline(
  status: FiscalOverallStatus | 'loading' | undefined,
  ambiente?: 'homologacao' | 'producao',
): { title: string; description: string; badge: string; tone: 'ready' | 'pending' | 'blocked' | 'loading' } {
  if (!status || status === 'loading') {
    return {
      title: 'Verificando configuração fiscal…',
      description: 'Aguarde enquanto confirmamos se a loja está pronta para emitir.',
      badge: 'Verificando',
      tone: 'loading',
    };
  }
  if (status === 'ready') {
    return {
      title: 'Pronto para emitir NF-e',
      description: 'Tudo certo. Você já pode emitir notas fiscais para seus clientes.',
      badge: 'Pronto para emitir NF-e',
      tone: 'ready',
    };
  }
  if (status === 'ready_for_test') {
    return {
      title: 'Pronto para teste',
      description: 'Sua loja está em homologação e pode emitir notas de teste sem valor fiscal.',
      badge: 'Pronto para teste',
      tone: 'ready',
    };
  }
  if (status === 'config_pending') {
    return {
      title: 'Configuração fiscal pendente',
      description: 'Faltam informações para concluir a configuração. Veja os itens em destaque abaixo.',
      badge: 'Configuração pendente',
      tone: 'pending',
    };
  }
  if (status === 'error') {
    return {
      title: 'Configuração fiscal com erro',
      description: 'Identificamos um problema na configuração. Resolva os itens em destaque para continuar.',
      badge: 'Configuração com erro',
      tone: 'blocked',
    };
  }
  // blocked
  return {
    title: ambiente === 'producao' ? 'Produção bloqueada' : 'Configuração fiscal bloqueada',
    description: 'Há um requisito impedindo a emissão. Resolva os itens em destaque abaixo.',
    badge: ambiente === 'producao' ? 'Produção bloqueada' : 'Bloqueado',
    tone: 'blocked',
  };
}

export function useFiscalReadiness() {
  return useQuery({
    queryKey: FISCAL_READINESS_QUERY_KEY,
    queryFn: async (): Promise<FiscalReadinessResult> => {
      const { data, error } = await supabase.functions.invoke('fiscal-integration-validate', { body: {} });
      if (error) throw new Error(error.message);
      return data as FiscalReadinessResult;
    },
    staleTime: 30_000,
  });
}
