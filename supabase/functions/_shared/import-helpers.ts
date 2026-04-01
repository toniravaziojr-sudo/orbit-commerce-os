/**
 * Shared Import Helpers — Motor Único de Importação
 * 
 * Provides unified tracking, types, and utilities for all canonical import motors.
 * Every motor (import-products, import-orders, import-customers, import-store-categories, import-menus)
 * MUST use these helpers to ensure consistent behavior.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ===========================================
// TYPES — Unified Import Contract
// ===========================================

/** Standard envelope returned by every canonical motor */
export interface ImportResponse {
  success: boolean;
  results: ImportResults;
  error?: string;
  version?: string;
  duration_ms?: number;
}

export interface ImportResults {
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  errors: number;
  itemErrors: ItemError[];
}

export interface ItemError {
  index: number;
  identifier: string;
  error: string;
}

/** Tracking record for import_items table */
export interface ImportItemTracking {
  internalId: string;
  externalId: string;
  result: 'created' | 'updated' | 'unchanged' | 'skipped';
}

// ===========================================
// FACTORY — Create results accumulator
// ===========================================

export function createImportResults(): ImportResults {
  return {
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    errors: 0,
    itemErrors: [],
  };
}

export function createImportResponse(
  results: ImportResults,
  opts?: { version?: string; startTime?: number; error?: string }
): ImportResponse {
  return {
    success: results.errors < (results.created + results.updated + results.unchanged + results.skipped + results.errors),
    results,
    error: opts?.error,
    version: opts?.version,
    duration_ms: opts?.startTime ? Date.now() - opts.startTime : undefined,
  };
}

// ===========================================
// TRACKING — import_items persistence
// ===========================================

/**
 * Track a single imported item in import_items.
 * status = 'success' | 'error' (technical)
 * result = 'created' | 'updated' | 'unchanged' | 'skipped' (business)
 */
export async function trackImportedItem(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  jobId: string,
  module: string,
  internalId: string,
  externalId: string,
  result: 'created' | 'updated' | 'unchanged' | 'skipped'
): Promise<void> {
  try {
    const effectiveExternalId = (externalId && externalId.trim())
      ? externalId.trim()
      : `internal:${internalId}`;

    const { error } = await supabase.from('import_items').upsert({
      tenant_id: tenantId,
      job_id: jobId,
      module,
      internal_id: internalId,
      external_id: effectiveExternalId,
      status: 'success',
      result,
    }, {
      onConflict: 'tenant_id,module,external_id',
      ignoreDuplicates: false,
    });

    if (error) {
      console.error(`[import-helpers] trackImportedItem error:`, error.message);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[import-helpers] trackImportedItem exception:`, msg);
  }
}

/**
 * Batch track imported items (much faster than individual calls).
 */
export async function trackImportedItemsBatch(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  jobId: string,
  module: string,
  items: ImportItemTracking[]
): Promise<void> {
  if (items.length === 0) return;

  try {
    const upsertData = items.map(item => ({
      tenant_id: tenantId,
      job_id: jobId,
      module,
      internal_id: item.internalId,
      external_id: (item.externalId && item.externalId.trim())
        ? item.externalId.trim()
        : `internal:${item.internalId}`,
      status: 'success',
      result: item.result,
    }));

    const { error } = await supabase.from('import_items').upsert(upsertData, {
      onConflict: 'tenant_id,module,external_id',
      ignoreDuplicates: false,
    });

    if (error) {
      console.error(`[import-helpers] trackImportedItemsBatch error:`, error.message);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[import-helpers] trackImportedItemsBatch exception:`, msg);
  }
}

/**
 * Track a failed item in import_items.
 */
export async function trackFailedItem(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  jobId: string,
  module: string,
  externalId: string,
  errorMessage: string
): Promise<void> {
  try {
    const effectiveExternalId = (externalId && externalId.trim())
      ? externalId.trim()
      : `error:${Date.now()}`;

    await supabase.from('import_items').upsert({
      tenant_id: tenantId,
      job_id: jobId,
      module,
      external_id: effectiveExternalId,
      status: 'error',
      result: null,
      errors: [{ message: errorMessage, at: new Date().toISOString() }],
    }, {
      onConflict: 'tenant_id,module,external_id',
      ignoreDuplicates: false,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[import-helpers] trackFailedItem exception:`, msg);
  }
}

// ===========================================
// UTILITIES — Shared across motors
// ===========================================

/** Generate URL-safe slug from text */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

/** Deterministic hash for SKU generation */
export function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/** Parse numeric field — handles numbers, strings, currency, locale formats */
export function parseNumericField(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;

  let str = String(value).trim();
  if (!str) return 0;

  // Remove currency symbols and spaces
  str = str.replace(/R\$\s*/gi, '').replace(/\s/g, '');

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      str = str.replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  }

  const result = parseFloat(str);
  return isNaN(result) ? 0 : result;
}

/** Parse integer field with fallback */
export function parseIntField(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Math.floor(value);
  const parsed = parseInt(String(value).replace(/\D/g, ''), 10);
  return isNaN(parsed) ? 0 : parsed;
}

// ===========================================
// CORS — Standard headers
// ===========================================

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

/** Create JSON response with CORS headers */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Standard CORS preflight response */
export function corsResponse(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// ===========================================
// PAYMENT/STATUS MAPPERS — Shared by orders
// ===========================================

/** Map raw payment method string to valid enum */
export function mapPaymentMethod(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const n = raw.toLowerCase().trim();
  if (n.includes('pix')) return 'pix';
  if (n.includes('credit') || n.includes('crédito') || n.includes('credito') || n.includes('cartão de crédito') || n.includes('card')) return 'credit_card';
  if (n.includes('debit') || n.includes('débito') || n.includes('debito')) return 'debit_card';
  if (n.includes('boleto') || n.includes('billet')) return 'boleto';
  if (n.includes('mercado pago') || n.includes('mercadopago')) return 'mercado_pago';
  if (n.includes('pagar.me') || n.includes('pagarme')) return 'pagarme';
  return null;
}

/** Map raw payment status to valid enum */
export function mapPaymentStatus(raw: string | null | undefined): string {
  if (!raw) return 'pending';
  const n = raw.toLowerCase().trim();
  if (['approved', 'paid', 'confirmed', 'completed', 'aprovado'].includes(n)) return 'approved';
  if (['processing', 'pending_payment', 'processando'].includes(n)) return 'processing';
  if (['declined', 'failed', 'refused', 'voided', 'expired', 'recusado', 'expirado'].includes(n)) return 'declined';
  return 'pending';
}

/** Map raw shipping status to valid enum */
export function mapShippingStatus(raw: string | null | undefined): string {
  if (!raw) return 'pending';
  const n = raw.toLowerCase().trim();
  if (['delivered', 'fulfilled', 'completed', 'entregue'].includes(n)) return 'delivered';
  if (['in_transit', 'in-transit', 'out_for_delivery', 'em trânsito', 'em_transito'].includes(n)) return 'in_transit';
  if (['shipped', 'dispatched', 'partial', 'partially_fulfilled', 'enviado'].includes(n)) return 'shipped';
  if (['processing', 'preparing', 'em separação', 'em_separacao', 'processando'].includes(n)) return 'processing';
  return 'pending';
}
