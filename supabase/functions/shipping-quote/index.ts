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
  carrier: string;
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
        carrier: 'frenet',
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

// Correios Quote Adapter (placeholder - requires WebService contract)
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
    console.log('[Correios] Missing credentials for quote');
    return [];
  }

  try {
    // Correios preco-prazo API
    // Note: This uses the new Correios API (api.correios.com.br)
    const authString = btoa(`${usuario}:${senha}`);
    
    // Get token first
    const authResponse = await fetch('https://api.correios.com.br/token/v1/autentica/cartaopostagem', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ numero: cartaoPostagem }),
    });

    if (!authResponse.ok) {
      console.error('[Correios] Auth failed:', authResponse.status);
      return [];
    }

    const authData = await authResponse.json();
    const token = authData.token;

    // Get services enabled in settings or use defaults
    const serviceCodes = (provider.settings.service_codes as string[]) || ['04014', '04510']; // SEDEX, PAC

    const options: ShippingOption[] = [];

    for (const serviceCode of serviceCodes) {
      try {
        const priceResponse = await fetch(
          `https://api.correios.com.br/preco/v1/nacional/${serviceCode}?` +
          `cepOrigem=${originCep.replace(/\D/g, '')}&` +
          `cepDestino=${recipientCep.replace(/\D/g, '')}&` +
          `peso=${Math.max(0.3, totals.weight)}&` +
          `altura=${Math.max(2, totals.height)}&` +
          `largura=${Math.max(11, totals.width)}&` +
          `comprimento=${Math.max(16, totals.length)}&` +
          `valorDeclarado=${totals.value}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
            },
          }
        );

        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          
          const serviceName = serviceCode === '04014' ? 'SEDEX' : 
                             serviceCode === '04510' ? 'PAC' : 
                             `Correios ${serviceCode}`;

          options.push({
            carrier: 'correios',
            service_code: serviceCode,
            service_name: serviceName,
            price: parseFloat(priceData.pcFinal) || 0,
            estimated_days: parseInt(priceData.prazoEntrega, 10) || 0,
            metadata: {
              original_response: priceData,
            },
          });
        }
      } catch (serviceError) {
        console.error(`[Correios] Service ${serviceCode} error:`, serviceError);
      }
    }

    return options;
  } catch (error) {
    console.error('[Correios] Quote error:', error);
    return [];
  }
}

// Loggi Quote Adapter (placeholder - requires API contract)
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
    // Loggi API (placeholder - needs real implementation based on contract)
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
      carrier: 'loggi',
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

// ========== MAIN HANDLER ==========

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

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
          message: 'Nenhum provedor de frete ativo' 
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
    const quotePromises: Promise<ShippingOption[]>[] = [];

    for (const provider of providers as ProviderRecord[]) {
      const providerName = provider.provider.toLowerCase();
      
      let quotePromise: Promise<ShippingOption[]>;
      
      if (providerName === 'frenet') {
        quotePromise = quoteFrenet(provider, originCep, recipient_cep, totals);
      } else if (providerName === 'correios') {
        quotePromise = quoteCorreios(provider, originCep, recipient_cep, totals);
      } else if (providerName === 'loggi') {
        quotePromise = quoteLoggi(provider, originCep, recipient_cep, totals);
      } else {
        console.log(`[ShippingQuote] Unknown provider: ${providerName}`);
        continue;
      }

      // Wrap with timeout
      const timeoutPromise = new Promise<ShippingOption[]>((resolve) => {
        setTimeout(() => {
          console.log(`[ShippingQuote] Timeout for ${providerName}`);
          resolve([]);
        }, TIMEOUT_MS);
      });

      quotePromises.push(
        Promise.race([quotePromise, timeoutPromise])
          .catch((error) => {
            console.error(`[ShippingQuote] Error from ${providerName}:`, error);
            return [];
          })
      );
    }

    // Wait for all quotes
    const results = await Promise.all(quotePromises);
    const allOptions = results.flat();

    // Sort by price
    allOptions.sort((a, b) => a.price - b.price);

    console.log(`[ShippingQuote] Total options: ${allOptions.length} in ${Date.now() - startTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        options: allOptions,
        origin_cep: originCep,
        recipient_cep,
        totals,
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
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
