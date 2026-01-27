/**
 * Hook for managing AI credits system
 * - Credit wallet balance
 * - Credit packages for purchase
 * - Credit ledger (transaction history)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// Types
export interface CreditPackage {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  credits: number;
  bonus_credits: number;
  price_cents: number;
  is_active: boolean;
  sort_order: number;
}

export interface CreditWallet {
  id: string;
  tenant_id: string;
  balance_credits: number;
  reserved_credits: number;
  lifetime_purchased: number;
  lifetime_consumed: number;
  created_at: string;
  updated_at: string;
}

export interface CreditLedgerEntry {
  id: string;
  tenant_id: string;
  user_id: string | null;
  transaction_type: 'purchase' | 'reserve' | 'consume' | 'refund' | 'adjust' | 'bonus';
  provider: string | null;
  model: string | null;
  feature: string | null;
  units_json: Record<string, number> | null;
  cost_usd: number | null;
  sell_usd: number | null;
  credits_delta: number;
  idempotency_key: string | null;
  job_id: string | null;
  metadata: Record<string, unknown> | null;
  description: string | null;
  created_at: string;
}

export interface AIPricing {
  id: string;
  provider: string;
  model: string;
  pricing_type: string;
  cost_usd: number;
  resolution: string | null;
  quality: string | null;
  has_audio: boolean | null;
}

// Constants
export const CREDIT_USD = 0.01; // 1 credit = US$ 0.01
export const CREDIT_MARKUP = 1.5; // 50% markup

/**
 * Calculate credits needed for a given cost
 */
export function calculateCreditsForCost(costUsd: number): number {
  const sellUsd = costUsd * CREDIT_MARKUP;
  return Math.ceil(sellUsd / CREDIT_USD);
}

/**
 * Format credits as display string
 */
export function formatCredits(credits: number): string {
  return credits.toLocaleString('pt-BR');
}

/**
 * Format price in BRL
 */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

/**
 * Hook to fetch credit packages
 */
export function useCreditPackages() {
  return useQuery({
    queryKey: ['credit-packages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_packages')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      return (data || []) as CreditPackage[];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch tenant's credit wallet
 */
export function useCreditWallet() {
  const { currentTenant } = useAuth();

  return useQuery({
    queryKey: ['credit-wallet', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const { data, error } = await supabase
        .from('credit_wallet')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error) throw error;
      return data as CreditWallet | null;
    },
    enabled: !!currentTenant?.id,
  });
}

/**
 * Hook to fetch credit ledger (transaction history)
 */
export function useCreditLedger(limit = 50) {
  const { currentTenant } = useAuth();

  return useQuery({
    queryKey: ['credit-ledger', currentTenant?.id, limit],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as CreditLedgerEntry[];
    },
    enabled: !!currentTenant?.id,
  });
}

/**
 * Hook to fetch AI pricing table
 */
export function useAIPricing() {
  return useQuery({
    queryKey: ['ai-pricing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_pricing')
        .select('*')
        .is('effective_until', null)
        .order('provider')
        .order('model');

      if (error) throw error;
      return (data || []) as AIPricing[];
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Hook for credit operations
 */
export function useCreditOperations() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  // Check balance before operation
  const checkBalance = async (creditsNeeded: number) => {
    if (!currentTenant?.id) return { hasBalance: false, currentBalance: 0, creditsMissing: creditsNeeded };

    const { data, error } = await supabase
      .rpc('check_credit_balance', {
        p_tenant_id: currentTenant.id,
        p_credits_needed: creditsNeeded,
      });

    if (error) throw error;
    return data?.[0] || { has_balance: false, current_balance: 0, credits_missing: creditsNeeded };
  };

  // Reserve credits for long-running job
  const reserveCredits = useMutation({
    mutationFn: async ({ credits, idempotencyKey, jobId }: { credits: number; idempotencyKey: string; jobId?: string }) => {
      if (!currentTenant?.id) throw new Error('Tenant não encontrado');

      const { data, error } = await supabase
        .rpc('reserve_credits', {
          p_tenant_id: currentTenant.id,
          p_credits: credits,
          p_idempotency_key: idempotencyKey,
          p_job_id: jobId || null,
        });

      if (error) throw error;
      const result = data?.[0];
      if (!result?.success) {
        throw new Error(result?.error_message || 'Erro ao reservar créditos');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-wallet'] });
      queryClient.invalidateQueries({ queryKey: ['credit-ledger'] });
    },
    onError: (error) => {
      console.error('Error reserving credits:', error);
      toast.error(error.message || 'Erro ao reservar créditos');
    },
  });

  // Consume credits (after operation)
  const consumeCredits = useMutation({
    mutationFn: async ({
      credits,
      idempotencyKey,
      provider,
      model,
      feature,
      unitsJson,
      costUsd,
      jobId,
      fromReserve,
    }: {
      credits: number;
      idempotencyKey: string;
      provider: string;
      model: string;
      feature: string;
      unitsJson: Record<string, number>;
      costUsd: number;
      jobId?: string;
      fromReserve?: boolean;
    }) => {
      if (!currentTenant?.id) throw new Error('Tenant não encontrado');

      const { data, error } = await supabase
        .rpc('consume_credits', {
          p_tenant_id: currentTenant.id,
          p_user_id: null, // Will be filled by edge function
          p_credits: credits,
          p_idempotency_key: idempotencyKey,
          p_provider: provider,
          p_model: model,
          p_feature: feature,
          p_units_json: unitsJson,
          p_cost_usd: costUsd,
          p_job_id: jobId || null,
          p_from_reserve: fromReserve || false,
        });

      if (error) throw error;
      const result = data?.[0];
      if (!result?.success) {
        throw new Error(result?.error_message || 'Erro ao consumir créditos');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-wallet'] });
      queryClient.invalidateQueries({ queryKey: ['credit-ledger'] });
    },
  });

  return {
    checkBalance,
    reserveCredits,
    consumeCredits,
  };
}

/**
 * Get estimated cost for an AI operation
 */
export function getEstimatedCost(
  provider: string,
  model: string,
  estimatedUnits: { tokensIn?: number; tokensOut?: number; seconds?: number; images?: number; minutes?: number },
  pricing: AIPricing[]
): { costUsd: number; credits: number } {
  let costUsd = 0;

  const modelPricing = pricing.filter(p => p.provider === provider && p.model === model);

  if (estimatedUnits.tokensIn) {
    const inputPrice = modelPricing.find(p => p.pricing_type === 'per_1m_tokens_in');
    if (inputPrice) {
      costUsd += (estimatedUnits.tokensIn / 1_000_000) * inputPrice.cost_usd;
    }
  }

  if (estimatedUnits.tokensOut) {
    const outputPrice = modelPricing.find(p => p.pricing_type === 'per_1m_tokens_out');
    if (outputPrice) {
      costUsd += (estimatedUnits.tokensOut / 1_000_000) * outputPrice.cost_usd;
    }
  }

  if (estimatedUnits.seconds) {
    const perSecondPrice = modelPricing.find(p => p.pricing_type === 'per_second');
    if (perSecondPrice) {
      costUsd += estimatedUnits.seconds * perSecondPrice.cost_usd;
    }
  }

  if (estimatedUnits.images) {
    const perImagePrice = modelPricing.find(p => p.pricing_type === 'per_image');
    if (perImagePrice) {
      costUsd += estimatedUnits.images * perImagePrice.cost_usd;
    }
  }

  if (estimatedUnits.minutes) {
    const perMinutePrice = modelPricing.find(p => p.pricing_type === 'per_minute');
    if (perMinutePrice) {
      costUsd += estimatedUnits.minutes * perMinutePrice.cost_usd;
    }
  }

  return {
    costUsd,
    credits: calculateCreditsForCost(costUsd),
  };
}

/**
 * AI feature cost estimates (average)
 * For display purposes in UI
 */
export const AI_COST_ESTIMATES = {
  // Chat/Support (per message, ~1000 tokens average)
  chat_message: { provider: 'openai', model: 'gpt-5.2', avgCredits: 3 },
  
  // Vision analysis (per image)
  vision_analysis: { provider: 'openai', model: 'gpt-4o', avgCredits: 5 },
  
  // Audio transcription (per minute)
  audio_transcription: { provider: 'openai', model: 'whisper-1', avgCredits: 1 },
  
  // SEO generation (per generation)
  seo_generation: { provider: 'gemini', model: 'gemini-2.5-flash', avgCredits: 2 },
  
  // Image generation (per image, medium quality)
  image_generation: { provider: 'fal', model: 'gpt-image-1.5', avgCredits: 8 },
  
  // Video generation (per 10 seconds, standard)
  video_generation_10s: { provider: 'fal', model: 'sora-2', avgCredits: 150 },
  
  // Avatar generation (per 10 seconds)
  avatar_generation_10s: { provider: 'fal', model: 'kling-avatar-v2-pro', avgCredits: 175 },
  
  // Embedding (per 1000 tokens)
  embedding: { provider: 'openai', model: 'text-embedding-3-small', avgCredits: 1 },
} as const;
