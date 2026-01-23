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
  cart_subtotal_cents?: number; // for rule matching
}

interface ShippingOption {
  source_provider: string; // frenet, correios, loggi, free_rule, custom_rule
  carrier: string; // Carrier name (e.g., "Correios", "Jadlog")
  service_code: string;
  service_name: string;
  price: number;
  estimated_days: number;
  estimated_days_min?: number;
  estimated_days_max?: number;
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

interface ShippingFreeRule {
  id: string;
  name: string;
  region_type: string;
  cep_start: string;
  cep_end: string;
  uf: string | null;
  min_order_cents: number | null;
  delivery_days_min: number | null;
  delivery_days_max: number | null;
  is_enabled: boolean;
  sort_order: number;
}

interface ShippingCustomRule {
  id: string;
  name: string;
  region_type: string;
  cep_start: string;
  cep_end: string;
  uf: string | null;
  min_order_cents: number | null;
  price_cents: number;
  delivery_days_min: number | null;
  delivery_days_max: number | null;
  is_enabled: boolean;
  sort_order: number;
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

// Frenet Quote Adapter - NO FALLBACK (pure multi-tenant)
async function quoteFrenet(
  provider: ProviderRecord,
  originCep: string,
  recipientCep: string,
  totals: { weight: number; height: number; width: number; length: number; value: number }
): Promise<ShippingOption[]> {
  const token = provider.credentials.token as string;
  
  if (!token) {
    console.warn('[Frenet] Tenant has no token configured - skipping provider');
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
      .filter((s: any) => !s.Error && parseFloat(s.ShippingPrice) >= 0)
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

// Correios Quote Adapter - API REST v1
// Supports both Token (CWS) and OAuth2 authentication
// Docs: https://cws.correios.com.br/dashboard/pesquisa
async function quoteCorreios(
  provider: ProviderRecord,
  originCep: string,
  recipientCep: string,
  totals: { weight: number; height: number; width: number; length: number; value: number }
): Promise<ShippingOption[]> {
  // Check auth mode - default to 'token' if token is provided, otherwise 'oauth'
  const authMode = provider.credentials.auth_mode as string || 
    (provider.credentials.token ? 'token' : 'oauth');
  
  let token: string;

  try {
    if (authMode === 'token') {
      // Token mode - use static token from CWS portal
      token = provider.credentials.token as string;
      
      if (!token) {
        console.log('[Correios] Token mode selected but no token provided');
        return [];
      }
      
      console.log('[Correios] Using static token from CWS (auth_mode: token)');
    } else {
      // OAuth mode - authenticate with usuario/senha
      const usuario = provider.credentials.usuario as string;
      const senha = provider.credentials.senha as string;
      const cartaoPostagem = provider.credentials.cartao_postagem as string;

      if (!usuario || !senha) {
        console.log('[Correios] OAuth mode but missing credentials - usuario:', !!usuario, 'senha:', !!senha);
        return [];
      }

      console.log('[Correios] Authenticating via OAuth2 - user:', usuario);
      
      const authString = btoa(`${usuario}:${senha}`);
      const authHeaders: Record<string, string> = {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      
      let authUrl: string;
      let authBody: string | undefined;
      
      if (cartaoPostagem) {
        authUrl = 'https://api.correios.com.br/token/v1/autentica/cartaopostagem';
        authBody = JSON.stringify({ numero: cartaoPostagem });
        console.log('[Correios] Auth with cartaoPostagem:', cartaoPostagem);
      } else {
        authUrl = 'https://api.correios.com.br/token/v1/autentica';
        console.log('[Correios] Auth with simple endpoint (no cartao)');
      }
      
      console.log('[Correios] Auth URL:', authUrl);
      
      let authResponse = await fetch(authUrl, {
        method: 'POST',
        headers: authHeaders,
        body: authBody,
      });

      // Fallback to simple auth if cartao postagem fails
      if (!authResponse.ok && cartaoPostagem) {
        console.log('[Correios] Cartao postagem auth failed, trying simple auth...');
        authResponse = await fetch('https://api.correios.com.br/token/v1/autentica', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${authString}`,
            'Accept': 'application/json',
          },
        });
      }

      if (!authResponse.ok) {
        const errorText = await authResponse.text();
        console.error('[Correios] OAuth auth failed:', authResponse.status, errorText);
        return [];
      }

      const authData = await authResponse.json();
      token = authData.token;

      if (!token) {
        console.error('[Correios] No token in auth response:', JSON.stringify(authData));
        return [];
      }

      console.log('[Correios] OAuth successful, token expires:', authData.expiraEm);
    }
    
    console.log('[Correios] Token obtained, proceeding with price quote');

    // Get optional contract info from credentials
    const contrato = provider.credentials.contrato as string;
    const dr = provider.credentials.dr as string;

    // Step 2: Get prices using POST /v1/nacional (batch) or GET /v1/nacional/{coProduto}
    // Using POST for batch request of multiple services at once
    // Default services: SEDEX (03220) and PAC (03298) - new codes for contract
    // Or old codes: SEDEX (04014) and PAC (04510)
    const serviceCodes = (provider.settings?.service_codes as string[]) || ['03220', '03298'];
    
    // Clean CEPs (numbers only)
    const cleanOrigin = originCep.replace(/\D/g, '');
    const cleanDestination = recipientCep.replace(/\D/g, '');
    
    // Weight in grams, minimum 300g
    const weightGrams = String(Math.max(300, Math.round(totals.weight * 1000)));
    
    // Dimensions with minimum values
    const comprimento = String(Math.max(16, Math.round(totals.length)));
    const largura = String(Math.max(11, Math.round(totals.width)));
    const altura = String(Math.max(2, Math.round(totals.height)));

    // Build batch request
    // Try quoting WITHOUT servicosAdicionais first - most contracts work without it
    // ERP-052 (VD required) vs ERP-054 (VD not allowed) depends on contract config
    const valorDeclarado = Math.max(24, Math.round(totals.value * 100) / 100);
    const requireDeclaredValue = provider.settings?.require_declared_value === true;
    
    const parametrosProduto = serviceCodes.map((code, index) => {
      const baseParams: Record<string, unknown> = {
        coProduto: code,
        nuRequisicao: String(index + 1).padStart(4, '0'),
        cepOrigem: cleanOrigin,
        cepDestino: cleanDestination,
        psObjeto: weightGrams,
        tpObjeto: '2', // 2 = package
        comprimento,
        largura,
        altura,
      };
      
      // Add contract info if available
      if (contrato) {
        baseParams.nuContrato = contrato;
        baseParams.nuDR = parseInt(dr || '0', 10);
      }
      
      // Only add Valor Declarado if explicitly required in provider settings
      if (requireDeclaredValue) {
        baseParams.servicosAdicionais = [{
          coServAdicional: '019',
          vlDeclarado: String(valorDeclarado),
        }];
      }
      
      return baseParams;
    });

    const pricePayload = {
      idLote: '001',
      parametrosProduto,
    };

    console.log('[Correios] Price request payload:', JSON.stringify(pricePayload));

    const priceResponse = await fetch('https://api.correios.com.br/preco/v1/nacional', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(pricePayload),
    });

    if (!priceResponse.ok) {
      const errorText = await priceResponse.text();
      console.error('[Correios] Price API error:', priceResponse.status, errorText);
      return [];
    }

    const priceResults = await priceResponse.json();
    console.log('[Correios] Price response:', JSON.stringify(priceResults));

    // Map service codes to readable names
    const serviceNameMap: Record<string, string> = {
      '03220': 'SEDEX',
      '03298': 'PAC',
      '04014': 'SEDEX',
      '04510': 'PAC',
      '04065': 'SEDEX 10',
      '04707': 'PAC Mini',
      '03158': 'SEDEX 10',
      '03140': 'SEDEX 12',
    };

    // Parse response - it's an array of results
    const results = Array.isArray(priceResults) ? priceResults : [priceResults];
    const options: ShippingOption[] = [];

    for (const result of results) {
      const coProduto = result.coProduto;
      
      // Check for errors
      if (result.txErro) {
        console.log(`[Correios] Service ${coProduto} error: ${result.txErro}`);
        continue;
      }

      // Parse price - can be string with comma as decimal separator
      const priceStr = result.pcFinal || result.pcBase || '0';
      const price = parseFloat(String(priceStr).replace(',', '.')) || 0;
      
      // Parse delivery time
      const days = parseInt(result.prazoEntrega, 10) || 0;

      if (price > 0) {
        const serviceName = serviceNameMap[coProduto] || `Correios ${coProduto}`;
        
        options.push({
          source_provider: 'correios',
          carrier: 'Correios',
          service_code: coProduto,
          service_name: serviceName,
          price,
          estimated_days: days,
          metadata: {
            pc_base: result.pcBase,
            pc_final: result.pcFinal,
            prazo_entrega: result.prazoEntrega,
          },
        });
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
// Auth: OAuth2 com client_id/client_secret (secrets da plataforma)
// Tenant fornece: integration_code, company_id, origin_cep + endereço completo
// Docs: https://docs.api.loggi.com/reference/quotationapi
// IMPORTANTE: A API de cotação da Loggi exige endereço completo (correiosAddress), não apenas CEP
async function quoteLoggi(
  provider: ProviderRecord,
  originCep: string,
  recipientCep: string,
  totals: { weight: number; height: number; width: number; length: number; value: number }
): Promise<ShippingOption[]> {
  // Platform secrets (integrator credentials)
  const clientId = Deno.env.get('LOGGI_CLIENT_ID');
  const clientSecret = Deno.env.get('LOGGI_CLIENT_SECRET');
  
  // Tenant credentials
  const companyId = provider.credentials.company_id as string;
  const providerOriginCep = provider.credentials.origin_cep as string;
  
  // Tenant sender address (from credentials or settings)
  const senderStreet = provider.credentials.origin_street as string || provider.settings.sender_street as string || '';
  const senderNumber = provider.credentials.origin_number as string || provider.settings.sender_number as string || '';
  const senderNeighborhood = provider.credentials.origin_neighborhood as string || provider.settings.sender_neighborhood as string || '';
  const senderCity = provider.credentials.origin_city as string || provider.settings.sender_city as string || '';
  const senderState = provider.credentials.origin_state as string || provider.settings.sender_state as string || '';

  if (!clientId || !clientSecret) {
    console.warn('[Loggi] Platform secrets not configured (LOGGI_CLIENT_ID, LOGGI_CLIENT_SECRET)');
    return [];
  }

  if (!companyId) {
    console.warn('[Loggi] Missing company_id - tenant must configure ID do Embarcador');
    return [];
  }

  // Use provider's origin_cep if available
  const effectiveOriginCep = (providerOriginCep || originCep).replace(/\D/g, '');
  const effectiveRecipientCep = recipientCep.replace(/\D/g, '');
  
  if (!effectiveOriginCep) {
    console.warn('[Loggi] No origin CEP available');
    return [];
  }

  try {
    // Step 1: Obter token OAuth2 with platform secrets
    console.log('[Loggi] Authenticating with platform credentials...');
    const authResponse = await fetch('https://api.loggi.com/v2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error('[Loggi] OAuth2 auth error:', authResponse.status, errorText);
      return [];
    }

    const authData = await authResponse.json();
    const token = authData.idToken;

    if (!token) {
      console.error('[Loggi] No token in auth response');
      return [];
    }

    console.log('[Loggi] OAuth2 authentication successful');

    // Step 2: Lookup CEPs to get complete addresses if not provided
    // We need full addresses for Loggi API to work correctly
    let originAddress = {
      logradouro: senderStreet,
      numero: senderNumber,
      bairro: senderNeighborhood,
      cep: effectiveOriginCep,
      cidade: senderCity,
      uf: senderState,
    };

    let recipientAddress = {
      logradouro: '',
      numero: '',
      bairro: '',
      cep: effectiveRecipientCep,
      cidade: '',
      uf: '',
    };

    // If we don't have complete origin address, try CEP lookup
    if (!originAddress.logradouro || !originAddress.cidade) {
      console.log('[Loggi] Origin address incomplete, attempting CEP lookup...');
      const originLookup = await lookupCep(effectiveOriginCep);
      if (originLookup) {
        originAddress = {
          logradouro: originAddress.logradouro || originLookup.logradouro || 'Endereço',
          numero: originAddress.numero || '1',
          bairro: originAddress.bairro || originLookup.bairro || 'Centro',
          cep: effectiveOriginCep,
          cidade: originAddress.cidade || originLookup.localidade || 'São Paulo',
          uf: originAddress.uf || originLookup.uf || 'SP',
        };
      } else {
        // Fallback to generic address if CEP lookup fails
        originAddress = {
          logradouro: originAddress.logradouro || 'Rua Principal',
          numero: originAddress.numero || '1',
          bairro: originAddress.bairro || 'Centro',
          cep: effectiveOriginCep,
          cidade: originAddress.cidade || 'São Paulo',
          uf: originAddress.uf || 'SP',
        };
      }
    }

    // Always lookup recipient CEP for complete address
    const recipientLookup = await lookupCep(effectiveRecipientCep);
    if (recipientLookup) {
      recipientAddress = {
        logradouro: recipientLookup.logradouro || 'Endereço',
        numero: '1', // We don't know the number
        bairro: recipientLookup.bairro || 'Centro',
        cep: effectiveRecipientCep,
        cidade: recipientLookup.localidade || 'São Paulo',
        uf: recipientLookup.uf || 'SP',
      };
    } else {
      // Fallback for recipient
      recipientAddress = {
        logradouro: 'Rua',
        numero: '1',
        bairro: 'Centro',
        cep: effectiveRecipientCep,
        cidade: 'Cidade',
        uf: 'SP',
      };
    }

    // Step 3: Build payload with complete addresses using correiosAddress format
    const quotePayload = {
      shipFrom: {
        address: {
          correiosAddress: {
            logradouro: originAddress.logradouro,
            numero: originAddress.numero,
            bairro: originAddress.bairro,
            cep: originAddress.cep,
            cidade: originAddress.cidade,
            uf: originAddress.uf,
          },
        },
      },
      shipTo: {
        address: {
          correiosAddress: {
            logradouro: recipientAddress.logradouro,
            numero: recipientAddress.numero,
            bairro: recipientAddress.bairro,
            cep: recipientAddress.cep,
            cidade: recipientAddress.cidade,
            uf: recipientAddress.uf,
          },
        },
      },
      packages: [{
        weightG: Math.max(100, Math.round(totals.weight * 1000)), // Convert to grams, min 100g
        heightCm: Math.max(2, Math.round(totals.height)),
        widthCm: Math.max(11, Math.round(totals.width)),
        lengthCm: Math.max(16, Math.round(totals.length)),
      }],
      declaredValue: Math.round(totals.value * 100), // Convert to cents
    };

    console.log('[Loggi] Requesting quote with correiosAddress format:', JSON.stringify(quotePayload));

    const quoteResponse = await fetch(
      `https://api.loggi.com/v1/companies/${companyId}/quotations`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(quotePayload),
      }
    );

    if (!quoteResponse.ok) {
      const errorText = await quoteResponse.text();
      console.error('[Loggi] Quote API error:', quoteResponse.status, errorText);
      return [];
    }

    const quoteData = await quoteResponse.json();
    console.log('[Loggi] Quote response:', JSON.stringify(quoteData));

    // Parse response - estrutura pode variar
    const options: ShippingOption[] = [];
    
    // Loggi retorna opções de entrega com preço e prazo
    if (quoteData.quotations && Array.isArray(quoteData.quotations)) {
      for (const q of quoteData.quotations) {
        options.push({
          source_provider: 'loggi',
          carrier: 'Loggi',
          service_code: q.service_type || 'loggi_standard',
          service_name: q.service_name || 'Loggi Express',
          price: (q.price_cents || q.price || 0) / 100, // Convert from cents
          estimated_days: q.estimated_delivery_days || q.delivery_days || 3,
          metadata: {
            quotation_id: q.id,
            service_type: q.service_type,
          },
        });
      }
    } else if (quoteData.price !== undefined) {
      // Resposta simples com um único preço
      options.push({
        source_provider: 'loggi',
        carrier: 'Loggi',
        service_code: 'loggi_standard',
        service_name: 'Loggi Express',
        price: (quoteData.price_cents || quoteData.price || 0) / 100,
        estimated_days: quoteData.estimated_delivery_days || 3,
        metadata: {
          quotation_id: quoteData.id,
        },
      });
    } else if (quoteData.estimatedPrice) {
      // Alternative response format
      options.push({
        source_provider: 'loggi',
        carrier: 'Loggi',
        service_code: 'loggi_express',
        service_name: 'Loggi Express',
        price: (quoteData.estimatedPrice || 0) / 100,
        estimated_days: quoteData.estimatedDeliveryDays || 3,
        metadata: {},
      });
    }

    console.log(`[Loggi] Returning ${options.length} options`);
    return options;
  } catch (error) {
    console.error('[Loggi] Quote error:', error);
    return [];
  }
}

// Helper function to lookup CEP via ViaCEP API (free, no auth required)
async function lookupCep(cep: string): Promise<{ logradouro: string; bairro: string; localidade: string; uf: string } | null> {
  try {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return null;
    
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.erro) return null;
    
    return {
      logradouro: data.logradouro || '',
      bairro: data.bairro || '',
      localidade: data.localidade || '',
      uf: data.uf || '',
    };
  } catch {
    return null;
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
    const { recipient_cep, items, store_host, tenant_id, cart_subtotal_cents } = body;

    if (!recipient_cep || !items || items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'recipient_cep e items são obrigatórios' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ShippingQuote] Tenant: ${resolvedTenantId}, CEP: ${recipient_cep}`);

    // Normalize CEP to digits only
    const recipientCepDigits = recipient_cep.replace(/\D/g, '').padStart(8, '0');

    // Calculate cart subtotal from items if not provided
    const calculatedSubtotal = cart_subtotal_cents ?? 
      Math.round(items.reduce((acc, item) => acc + item.price * item.quantity * 100, 0));

    // ========== FETCH FREE AND CUSTOM RULES IN PARALLEL ==========
    const [freeRulesResult, customRulesResult, providersResult, storeSettingsResult] = await Promise.all([
      supabase
        .from('shipping_free_rules')
        .select('*')
        .eq('tenant_id', resolvedTenantId)
        .eq('is_enabled', true)
        .order('sort_order', { ascending: false }),
      supabase
        .from('shipping_custom_rules')
        .select('*')
        .eq('tenant_id', resolvedTenantId)
        .eq('is_enabled', true)
        .order('sort_order', { ascending: false }),
      supabase
        .from('shipping_providers')
        .select('id, provider, is_enabled, supports_quote, credentials, settings')
        .eq('tenant_id', resolvedTenantId)
        .eq('is_enabled', true)
        .eq('supports_quote', true),
      supabase
        .from('store_settings')
        .select('settings')
        .eq('tenant_id', resolvedTenantId)
        .single(),
    ]);

    const freeRules = (freeRulesResult.data || []) as ShippingFreeRule[];
    const customRules = (customRulesResult.data || []) as ShippingCustomRule[];
    const providers = (providersResult.data || []) as ProviderRecord[];
    const storeSettings = storeSettingsResult.data;

    console.log(`[ShippingQuote] Found ${freeRules.length} free rules, ${customRules.length} custom rules`);

    // ========== PROCESS RULES ==========
    const ruleOptions: ShippingOption[] = [];

    // Helper: Check if CEP matches rule range
    const cepMatchesRule = (cepDigits: string, cepStart: string, cepEnd: string): boolean => {
      const cep = cepDigits.padStart(8, '0');
      const start = cepStart.replace(/\D/g, '').padStart(8, '0');
      const end = cepEnd.replace(/\D/g, '').padStart(8, '0');
      return cep >= start && cep <= end;
    };

    // Process FREE rules - find first matching
    for (const rule of freeRules) {
      // Check CEP range
      if (!cepMatchesRule(recipientCepDigits, rule.cep_start, rule.cep_end)) {
        continue;
      }

      // Check minimum order if set
      if (rule.min_order_cents !== null && calculatedSubtotal < rule.min_order_cents) {
        continue;
      }

      // Match found!
      const daysMin = rule.delivery_days_min ?? 3;
      const daysMax = rule.delivery_days_max ?? daysMin;
      
      ruleOptions.push({
        source_provider: 'free_rule',
        carrier: 'Frete Grátis',
        service_code: `free_rule:${rule.id}`,
        service_name: rule.name || 'Frete Grátis',
        price: 0,
        estimated_days: daysMax,
        estimated_days_min: daysMin,
        estimated_days_max: daysMax,
        metadata: {
          rule_id: rule.id,
          region_type: rule.region_type,
          is_free: true,
        },
      });

      // Only take first matching free rule
      break;
    }

    // Process CUSTOM rules - collect all matching
    for (const rule of customRules) {
      // Check CEP range
      if (!cepMatchesRule(recipientCepDigits, rule.cep_start, rule.cep_end)) {
        continue;
      }

      // Check minimum order if set
      if (rule.min_order_cents !== null && calculatedSubtotal < rule.min_order_cents) {
        continue;
      }

      // Match found!
      const daysMin = rule.delivery_days_min ?? 3;
      const daysMax = rule.delivery_days_max ?? daysMin;
      const priceInReais = rule.price_cents / 100;

      ruleOptions.push({
        source_provider: 'custom_rule',
        carrier: 'Frete Personalizado',
        service_code: `custom_rule:${rule.id}`,
        service_name: rule.name,
        price: priceInReais,
        estimated_days: daysMax,
        estimated_days_min: daysMin,
        estimated_days_max: daysMax,
        metadata: {
          rule_id: rule.id,
          region_type: rule.region_type,
          price_cents: rule.price_cents,
        },
      });
    }

    console.log(`[ShippingQuote] Matched ${ruleOptions.length} rule options`);

    // ========== PROCESS CARRIER PROVIDERS ==========
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

    // Query all CARRIER providers in parallel with timeout (skip if no providers)
    const TIMEOUT_MS = 10000;
    const quoteResults: ProviderQuoteResult[] = [];
    let carrierOptions: ShippingOption[] = [];

    if (providers.length > 0) {
      console.log(`[ShippingQuote] Active quote providers: ${providers.map((p: ProviderRecord) => p.provider).join(', ')}`);

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

      // Collect carrier results and warnings
      for (const result of timeoutResults) {
        quoteResults.push(result);
        if (result.error) {
          quoteWarnings.push({
            provider: result.provider,
            code: result.error === 'Timeout' ? 'TIMEOUT' : 'ERROR',
            message: result.error,
          });
        }
        carrierOptions = carrierOptions.concat(result.options);
      }

      console.log(`[ShippingQuote] Carrier options count: ${carrierOptions.length}`);
    }

    // ========== COMBINE RULE OPTIONS + CARRIER OPTIONS ==========
    // Rule options come first (Frete Grátis should appear first if matched)
    let allOptions = [...ruleOptions, ...carrierOptions];

    console.log(`[ShippingQuote] Total raw options: ${allOptions.length}`);

    // Deduplicate carrier options (rules are not deduplicated against carriers)
    const dedupedCarrierOptions = deduplicateOptions(carrierOptions);
    
    // Final combined: rules first, then deduped carrier options
    const finalOptions = [...ruleOptions, ...dedupedCarrierOptions];
    
    console.log(`[ShippingQuote] After deduplication: ${finalOptions.length}`);

    // Sort: free options first, then by price
    finalOptions.sort((a, b) => {
      if (a.price === 0 && b.price !== 0) return -1;
      if (b.price === 0 && a.price !== 0) return 1;
      return a.price - b.price;
    });

    console.log(`[ShippingQuote] Total options: ${finalOptions.length} in ${Date.now() - startTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        options: finalOptions,
        origin_cep: originCep,
        recipient_cep,
        totals,
        quote_warnings: quoteWarnings,
        rules_matched: {
          free: ruleOptions.filter(o => o.source_provider === 'free_rule').length,
          custom: ruleOptions.filter(o => o.source_provider === 'custom_rule').length,
        },
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
