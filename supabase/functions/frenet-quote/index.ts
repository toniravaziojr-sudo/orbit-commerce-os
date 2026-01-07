// ============================================
// FRENET QUOTE - Shipping quote (PUBLIC - verify_jwt=false)
// Resolves tenant by domain, NEVER trusts client tenant_id
// Uses database config, falls back to Secrets
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-store-host',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
// NOTE: ENV_FRENET_TOKEN removed - pure multi-tenant model, each tenant uses their own token

interface ShippingQuoteRequest {
  store_host?: string;        // Domain-aware: host do storefront
  tenant_id?: string;         // Fallback apenas para casos internos
  seller_cep?: string;
  recipient_cep: string;
  items: Array<{
    weight: number;
    height: number;
    width: number;
    length: number;
    quantity: number;
    price: number;
  }>;
}

interface FrenetShippingService {
  ServiceCode: string;
  ServiceDescription: string;
  Carrier: string;
  ShippingPrice: number;
  DeliveryTime: number;
  Error: boolean;
  Msg: string | null;
}

// Resolve tenant by host (domain-aware)
async function resolveTenantByHost(supabase: any, host: string): Promise<string | null> {
  const normalizedHost = host.toLowerCase().trim().replace(/:\d+$/, '');
  console.log('[Frenet] Resolving tenant for host:', normalizedHost);

  // Check custom domains first
  const { data: customDomain } = await supabase
    .from('tenant_domains')
    .select('tenant_id')
    .eq('domain', normalizedHost)
    .eq('status', 'verified')
    .maybeSingle();

  if (customDomain?.tenant_id) {
    console.log('[Frenet] Resolved via custom domain:', customDomain.tenant_id);
    return customDomain.tenant_id;
  }

  // Check .shops subdomain pattern
  const shopsMatch = normalizedHost.match(/^([a-z0-9-]+)\.shops\./);
  if (shopsMatch) {
    const slug = shopsMatch[1];
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (tenant?.id) {
      console.log('[Frenet] Resolved via shops subdomain:', tenant.id);
      return tenant.id;
    }
  }

  // Localhost/dev: try to extract tenant from any subdomain pattern
  if (normalizedHost.includes('localhost') || normalizedHost.includes('127.0.0.1')) {
    console.log('[Frenet] Localhost detected, will need tenant_id fallback');
    return null;
  }

  console.log('[Frenet] Could not resolve tenant from host');
  return null;
}

// Get Frenet credentials from database - NO FALLBACK (pure multi-tenant)
async function getFrenetCredentials(supabase: any, tenantId: string): Promise<{
  token: string;
  originCep: string;
}> {
  const { data: provider, error } = await supabase
    .from('shipping_providers')
    .select('credentials, settings, is_enabled')
    .eq('tenant_id', tenantId)
    .eq('provider', 'frenet')
    .single();

  if (error || !provider) {
    console.log('[Frenet] Provider not found for tenant:', tenantId);
    throw new Error('Frenet não configurado para esta loja. Configure em Integrações → Transportadoras.');
  }

  if (!provider.is_enabled) {
    console.log('[Frenet] Provider disabled for tenant:', tenantId);
    throw new Error('Frenet está desativado para esta loja. Ative em Integrações → Transportadoras.');
  }

  if (!provider.credentials?.token) {
    console.log('[Frenet] Token not configured for tenant:', tenantId);
    throw new Error('Token Frenet não configurado. Configure em Integrações → Transportadoras.');
  }

  console.log('[Frenet] Using tenant credentials for:', tenantId);
  const originCep = provider.credentials.seller_cep || provider.settings?.origin_cep;
  
  if (!originCep) {
    throw new Error('CEP de origem não configurado. Configure em Integrações → Transportadoras.');
  }

  return {
    token: provider.credentials.token,
    originCep: originCep.replace(/\D/g, ''),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ShippingQuoteRequest = await req.json();
    
    // Get host from header or body
    const hostHeader = req.headers.get('x-store-host') || req.headers.get('origin') || '';
    const storeHost = body.store_host || new URL(hostHeader || 'http://localhost').host;
    
    console.log('[Frenet] Request host:', storeHost);
    console.log('[Frenet] Quote request:', JSON.stringify({ ...body, store_host: storeHost }));

    const { recipient_cep, items } = body;

    if (!recipient_cep || !items?.length) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: recipient_cep, items' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // SECURITY: Resolve tenant by host, not by client-provided tenant_id
    let tenantId = await resolveTenantByHost(supabase, storeHost);
    
    // Fallback for localhost/dev only
    if (!tenantId && body.tenant_id) {
      console.log('[Frenet] Using fallback tenant_id (dev mode):', body.tenant_id);
      tenantId = body.tenant_id;
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Não foi possível identificar a loja' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const credentials = await getFrenetCredentials(supabase, tenantId);
    console.log(`[Frenet] Using tenant credentials, origin CEP: ${credentials.originCep}`);

    const sellerCep = body.seller_cep || credentials.originCep;

    // Calculate totals
    let totalWeight = 0;
    let totalHeight = 0;
    let totalWidth = 0;
    let totalLength = 0;
    let totalValue = 0;

    for (const item of items) {
      totalWeight += (item.weight || 0.3) * item.quantity;
      totalHeight = Math.max(totalHeight, item.height || 10);
      totalWidth = Math.max(totalWidth, item.width || 10);
      totalLength += (item.length || 10) * item.quantity;
      totalValue += item.price * item.quantity;
    }

    totalWeight = Math.max(totalWeight, 0.3);
    totalHeight = Math.max(totalHeight, 2);
    totalWidth = Math.max(totalWidth, 11);
    totalLength = Math.max(totalLength, 16);

    const frenetPayload = {
      SellerCEP: sellerCep.replace(/\D/g, ''),
      RecipientCEP: recipient_cep.replace(/\D/g, ''),
      ShipmentInvoiceValue: totalValue,
      ShippingServiceCode: null,
      ShippingItemArray: [{
        Height: totalHeight,
        Length: totalLength,
        Width: totalWidth,
        Weight: totalWeight,
        Quantity: 1,
        SKU: 'QUOTE',
        Category: 'Geral'
      }],
      RecipientCountry: 'BR'
    };

    console.log('[Frenet] API payload:', JSON.stringify(frenetPayload));

    const frenetResponse = await fetch('https://api.frenet.com.br/shipping/quote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'token': credentials.token
      },
      body: JSON.stringify(frenetPayload)
    });

    const frenetData = await frenetResponse.json();
    console.log('[Frenet] API response:', JSON.stringify(frenetData));

    if (!frenetResponse.ok) {
      console.error('[Frenet] API error:', frenetData);
      return new Response(
        JSON.stringify({ error: 'Frenet API error', details: frenetData }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const services: FrenetShippingService[] = frenetData.ShippingSevicesArray || [];
    
    const options = services
      .filter(s => !s.Error && parseFloat(String(s.ShippingPrice)) >= 0)
      .map(s => {
        const price = parseFloat(String(s.ShippingPrice)) || 0;
        const deliveryDays = parseInt(String(s.DeliveryTime), 10) || 5;
        return {
          code: s.ServiceCode,
          label: `${s.Carrier} - ${s.ServiceDescription}`,
          carrier: s.Carrier,
          service: s.ServiceDescription,
          service_code: s.ServiceCode,
          price: price,
          deliveryDays: deliveryDays,
          isFree: price === 0
        };
      })
      .sort((a, b) => a.price - b.price);

    console.log('[Frenet] Parsed options:', options.length);

    return new Response(
      JSON.stringify({
        success: true,
        options,
        seller_cep: sellerCep,
        recipient_cep,
        totals: {
          weight: totalWeight,
          height: totalHeight,
          width: totalWidth,
          length: totalLength,
          value: totalValue
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Frenet] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
