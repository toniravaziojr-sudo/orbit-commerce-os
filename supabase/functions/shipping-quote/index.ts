// =============================================
// SHIPPING QUOTE - Agregador multi-provider de cotação de frete
// Consulta todos providers ativos em paralelo e retorna opções unificadas
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-store-host',
};

// ========== TYPES ==========

interface ShippingQuoteRequest {
  recipient_cep: string;
  items: Array<{
    quantity: number;
    weight?: number;
    height?: number;
    width?: number;
    length?: number;
    price: number;
  }>;
  store_host?: string;
  tenant_id?: string; // fallback for dev
}

interface ShippingOption {
  source_provider: string; // frenet, correios, loggi
  carrier: string; // Carrier name (e.g., "Correios", "Jadlog")
  service_code: string;
  service_name: string;
  price: number;
  estimated_days: number;
  delivery_date?: string;
  metadata?: Record<string, unknown>;
}

interface ProviderRecord {
  id: string;
  provider: string;
  is_enabled: boolean;
  supports_quote: boolean;
  credentials: Record<string, unknown>;
  settings: Record<string, unknown>;
}

interface ProviderQuoteResult {
  provider: string;
  options: ShippingOption[];
  error?: string;
  duration_ms: number;
}

interface QuoteWarning {
  provider: string;
  code: string;
  message?: string;
}

// ========== TENANT RESOLUTION ==========

async function resolveTenantByHost(
  supabase: any,
  host: string
): Promise<string | null> {
  const normalizedHost = host.toLowerCase().trim().replace(/:\d+$/, '');
  
  // Check custom domains first
  const { data: customDomain } = await supabase
    .from('tenant_domains')
    .select('tenant_id')
    .eq('domain', normalizedHost)
    .eq('status', 'verified')
    .eq('ssl_active', true)
    .single();

  if (customDomain?.tenant_id) {
    return customDomain.tenant_id;
  }

  // Check subdomain pattern: {slug}.shops.comandocentral.com.br
  const subdomainMatch = normalizedHost.match(/^([^.]+)\.shops\.comandocentral\.com\.br$/);
  if (subdomainMatch) {
    const slug = subdomainMatch[1];
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single();
    
    if (tenant?.id) {
      return tenant.id;
    }
  }

  return null;
}

// ========== UTILITY: Normalize carrier and service for deduplication ==========

function normalizeCarrier(carrier: string): string {
  const lc = carrier.toLowerCase().trim();
  // Normalize common variations
  if (lc.includes('correios') || lc.includes('cep ') || lc === 'pac' || lc === 'sedex') {
    return 'correios';
  }
  if (lc.includes('jadlog')) return 'jadlog';
  if (lc.includes('loggi')) return 'loggi';
  if (lc.includes('total express')) return 'total_express';
  return lc.replace(/[^a-z0-9]/g, '_');
}

function normalizeServiceCode(code: string): string {
  return code.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

// ========== PROVIDER ADAPTERS ==========

// Frenet Quote Adapter
async function quoteFrenet(
  provider: ProviderRecord,
  originCep: string,
  recipientCep: string,
  totals: { weight: number; height: number; width: number; length: number; value: number }
): Promise<ShippingOption[]> {
  const token = provider.credentials.token as string || Deno.env.get('FRENET_TOKEN');
  
  if (!token) {
    console.error('[Frenet] No token available');
    return [];
  }

  try {
    const payload = {
      SellerCEP: originCep.replace(/\D/g, ''),
      RecipientCEP: recipientCep.replace(/\D/g, ''),
      ShipmentInvoiceValue: totals.value,
      ShippingItemArray: [{
        Height: totals.height,
        Length: totals.length,
        Width: totals.width,
        Weight: totals.weight,
        Quantity: 1,
      }],
    };

    console.log('[Frenet] Requesting quote with:', JSON.stringify(payload));

    const response = await fetch('https://api.frenet.com.br/shipping/quote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'token': token,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('[Frenet] API error:', response.status);
      return [];
    }

    const data = await response.json();
    const services = data.ShippingSevicesArray || [];

    return services
      .filter((s: any) => !s.Error && s.ShippingPrice > 0)
      .map((s: any) => ({
        source_provider: 'frenet',
        carrier: s.Carrier || 'Frenet',
        service_code: s.ServiceCode || s.Carrier,
        service_name: s.ServiceDescription || s.Carrier,
        price: parseFloat(s.ShippingPrice) || 0,
        estimated_days: parseInt(s.DeliveryTime, 10) || 0,
        metadata: {
          carrier_name: s.Carrier,
          original_delivery_time: s.OriginalDeliveryTime,
        },
      }));
  } catch (error) {
    console.error('[Frenet] Quote error:', error);
    return [];
  }
}

// Correios Quote Adapter - OAuth2 API
async function quoteCorreios(
  provider: ProviderRecord,
  originCep: string,
  recipientCep: string,
  totals: { weight: number; height: number; width: number; length: number; value: number }
): Promise<ShippingOption[]> {
  const usuario = provider.credentials.usuario as string;
  const senha = provider.credentials.senha as string;
  const cartaoPostagem = provider.credentials.cartao_postagem as string;

  if (!usuario || !senha || !cartaoPostagem) {
    console.log('[Correios] Missing credentials - usuario:', !!usuario, 'senha:', !!senha, 'cartao:', !!cartaoPostagem);
    return [];
  }

  try {
    // Step 1: Get OAuth2 token using Basic Auth
    const authString = btoa(`${usuario}:${senha}`);
    console.log('[Correios] Authenticating with cartaoPostagem:', cartaoPostagem);
    
    const authResponse = await fetch('https://api.correios.com.br/token/v1/autentica/cartaopostagem', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ numero: cartaoPostagem }),
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error('[Correios] Auth failed:', authResponse.status, errorText);
      return [];
    }

    const authData = await authResponse.json();
    const token = authData.token;

    if (!token) {
      console.error('[Correios] No token in auth response:', authData);
      return [];
    }

    console.log('[Correios] Auth successful, got token');

    // Step 2: Get price and deadline for each service
    // Default services: SEDEX (04014) and PAC (04510)
    const serviceCodes = (provider.settings?.service_codes as string[]) || ['04014', '04510'];
    const options: ShippingOption[] = [];

    // Clean CEPs
    const cleanOrigin = originCep.replace(/\D/g, '');
    const cleanDestination = recipientCep.replace(/\D/g, '');

    for (const serviceCode of serviceCodes) {
      try {
        const params = new URLSearchParams({
          cepOrigem: cleanOrigin,
          cepDestino: cleanDestination,
          psObjeto: String(Math.max(300, Math.round(totals.weight * 1000))), // weight in grams, min 300g
          tpObjeto: '2', // 2 = package
          comprimento: String(Math.max(16, Math.round(totals.length))),
          largura: String(Math.max(11, Math.round(totals.width))),
          altura: String(Math.max(2, Math.round(totals.height))),
          vlDeclarado: String(Math.round(totals.value * 100) / 100),
        });

        const priceUrl = `https://api.correios.com.br/preco/v1/nacional/${serviceCode}?${params}`;
        console.log('[Correios] Fetching price:', priceUrl);

        const priceResponse = await fetch(priceUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });

        if (!priceResponse.ok) {
          const errorText = await priceResponse.text();
          console.error(`[Correios] Price API error for ${serviceCode}:`, priceResponse.status, errorText);
          continue;
        }

        const priceData = await priceResponse.json();
        console.log(`[Correios] Price response for ${serviceCode}:`, priceData);

        // Map service codes to readable names
        const serviceName = serviceCode === '04014' ? 'SEDEX' : 
                           serviceCode === '04510' ? 'PAC' : 
                           serviceCode === '04065' ? 'SEDEX 10' :
                           serviceCode === '04707' ? 'PAC Mini' :
                           `Correios ${serviceCode}`;

        const price = parseFloat(priceData.pcFinal) || parseFloat(priceData.pcBase) || 0;
        const days = parseInt(priceData.prazoEntrega, 10) || 0;

        if (price > 0) {
          options.push({
            source_provider: 'correios',
            carrier: 'Correios',
            service_code: serviceCode,
            service_name: serviceName,
            price,
            estimated_days: days,
            metadata: {
              pc_base: priceData.pcBase,
              pc_final: priceData.pcFinal,
            },
          });
        }
      } catch (serviceError) {
        console.error(`[Correios] Service ${serviceCode} error:`, serviceError);
      }
    }

    console.log(`[Correios] Returning ${options.length} options`);
    return options;
  } catch (error) {
    console.error('[Correios] Quote error:', error);
    return [];
  }
}

// Loggi Quote Adapter
async function quoteLoggi(
  provider: ProviderRecord,
  originCep: string,
  recipientCep: string,
  totals: { weight: number; height: number; width: number; length: number; value: number }
): Promise<ShippingOption[]> {
  const apiKey = provider.credentials.api_key as string;
  const companyId = provider.credentials.company_id as string;

  if (!apiKey || !companyId) {
    console.log('[Loggi] Missing credentials for quote');
    return [];
  }

  try {
    const response = await fetch(
      `https://api.loggi.com/v1/companies/${companyId}/shipping/quote`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin: { cep: originCep.replace(/\D/g, '') },
          destination: { cep: recipientCep.replace(/\D/g, '') },
          packages: [{
            weight: totals.weight,
            height: totals.height,
            width: totals.width,
            length: totals.length,
          }],
          declared_value: totals.value,
        }),
      }
    );

    if (!response.ok) {
      console.error('[Loggi] API error:', response.status);
      return [];
    }

    const data = await response.json();
    const services = data.services || [];

    return services.map((s: any) => ({
      source_provider: 'loggi',
      carrier: 'Loggi',
      service_code: s.code || 'loggi_standard',
      service_name: s.name || 'Loggi',
      price: parseFloat(s.price) || 0,
      estimated_days: parseInt(s.delivery_days, 10) || 0,
      metadata: {
        original_response: s,
      },
    }));
  } catch (error) {
    console.error('[Loggi] Quote error:', error);
    return [];
  }
}

// ========== DEDUPLICATION ==========

function deduplicateOptions(options: ShippingOption[]): ShippingOption[] {
  // Group by carrier_normalized + service_code_normalized + estimated_days
  const groups = new Map<string, ShippingOption[]>();

  for (const opt of options) {
    const carrierNorm = normalizeCarrier(opt.carrier);
    const codeNorm = normalizeServiceCode(opt.service_code);
    const key = `${carrierNorm}|${codeNorm}|${opt.estimated_days}`;
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(opt);
  }

  // Keep the one with lowest price from each group
  const dedupedOptions: ShippingOption[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => a.price - b.price);
    dedupedOptions.push(group[0]);
  }

  return dedupedOptions;
}

// ========== MAIN HANDLER ==========

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const quoteWarnings: QuoteWarning[] = [];

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: ShippingQuoteRequest = await req.json();
    const { recipient_cep, items, store_host, tenant_id } = body;

    if (!recipient_cep || !items || items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'recipient_cep e items são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve tenant
    const host = store_host || req.headers.get('x-store-host') || '';
    let resolvedTenantId = await resolveTenantByHost(supabase, host);

    // Fallback for dev environment
    if (!resolvedTenantId && tenant_id) {
      console.log('[ShippingQuote] Using fallback tenant_id:', tenant_id);
      resolvedTenantId = tenant_id;
    }

    if (!resolvedTenantId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tenant não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ShippingQuote] Tenant: ${resolvedTenantId}, CEP: ${recipient_cep}`);

    // Get active providers with supports_quote=true
    const { data: providers, error: providersError } = await supabase
      .from('shipping_providers')
      .select('id, provider, is_enabled, supports_quote, credentials, settings')
      .eq('tenant_id', resolvedTenantId)
      .eq('is_enabled', true)
      .eq('supports_quote', true);

    if (providersError) {
      console.error('[ShippingQuote] Error fetching providers:', providersError);
      throw providersError;
    }

    if (!providers || providers.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          options: [], 
          message: 'Nenhum provedor de frete ativo',
          quote_warnings: [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ShippingQuote] Active quote providers: ${providers.map(p => p.provider).join(', ')}`);

    // Get store settings for origin CEP
    const { data: storeSettings } = await supabase
      .from('store_settings')
      .select('settings')
      .eq('tenant_id', resolvedTenantId)
      .single();

    const originCep = (storeSettings?.settings as any)?.origin_cep || 
                      (storeSettings?.settings as any)?.cep || 
                      '01310100'; // Default to SP if not set

    // Calculate totals from items
    const totals = items.reduce(
      (acc, item) => ({
        weight: acc.weight + (item.weight || 0.3) * item.quantity,
        height: Math.max(acc.height, item.height || 2),
        width: Math.max(acc.width, item.width || 11),
        length: Math.max(acc.length, item.length || 16),
        value: acc.value + item.price * item.quantity,
      }),
      { weight: 0, height: 0, width: 0, length: 0, value: 0 }
    );

    // Ensure minimum values
    totals.weight = Math.max(0.3, totals.weight);
    totals.height = Math.max(2, totals.height);
    totals.width = Math.max(11, totals.width);
    totals.length = Math.max(16, totals.length);

    console.log('[ShippingQuote] Totals:', totals, 'Origin:', originCep);

    // Query all providers in parallel with timeout
    const TIMEOUT_MS = 10000;
    const quoteResults: ProviderQuoteResult[] = [];

    const quotePromises: Promise<ProviderQuoteResult>[] = providers.map(async (provider: ProviderRecord) => {
      const providerName = provider.provider.toLowerCase();
      const providerStart = Date.now();
      
      try {
        let options: ShippingOption[] = [];
        
        if (providerName === 'frenet') {
          options = await quoteFrenet(provider, originCep, recipient_cep, totals);
        } else if (providerName === 'correios') {
          options = await quoteCorreios(provider, originCep, recipient_cep, totals);
        } else if (providerName === 'loggi') {
          options = await quoteLoggi(provider, originCep, recipient_cep, totals);
        } else {
          console.log(`[ShippingQuote] Unknown provider: ${providerName}`);
          return {
            provider: providerName,
            options: [],
            error: 'Unknown provider',
            duration_ms: Date.now() - providerStart,
          };
        }

        return {
          provider: providerName,
          options,
          duration_ms: Date.now() - providerStart,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[ShippingQuote] Error from ${providerName}:`, error);
        return {
          provider: providerName,
          options: [],
          error: errorMsg,
          duration_ms: Date.now() - providerStart,
        };
      }
    });

    // Wrap all with timeout
    const timeoutResults = await Promise.all(
      quotePromises.map(async (promise, index) => {
        const providerName = providers[index].provider.toLowerCase();
        const timeoutPromise = new Promise<ProviderQuoteResult>((resolve) => {
          setTimeout(() => {
            resolve({
              provider: providerName,
              options: [],
              error: 'Timeout',
              duration_ms: TIMEOUT_MS,
            });
          }, TIMEOUT_MS);
        });

        return Promise.race([promise, timeoutPromise]);
      })
    );

    // Collect results and warnings
    let allOptions: ShippingOption[] = [];
    for (const result of timeoutResults) {
      quoteResults.push(result);
      if (result.error) {
        quoteWarnings.push({
          provider: result.provider,
          code: result.error === 'Timeout' ? 'TIMEOUT' : 'ERROR',
          message: result.error,
        });
      }
      allOptions = allOptions.concat(result.options);
    }

    console.log(`[ShippingQuote] Raw options count: ${allOptions.length}`);

    // Deduplicate options
    const dedupedOptions = deduplicateOptions(allOptions);
    console.log(`[ShippingQuote] After deduplication: ${dedupedOptions.length}`);

    // Sort by price
    dedupedOptions.sort((a, b) => a.price - b.price);

    console.log(`[ShippingQuote] Total options: ${dedupedOptions.length} in ${Date.now() - startTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        options: dedupedOptions,
        origin_cep: originCep,
        recipient_cep,
        totals,
        quote_warnings: quoteWarnings,
        providers_queried: quoteResults.map(r => ({
          provider: r.provider,
          options_count: r.options.length,
          duration_ms: r.duration_ms,
          error: r.error ? true : undefined,
        })),
        duration_ms: Date.now() - startTime,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[ShippingQuote] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        quote_warnings: quoteWarnings,
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
