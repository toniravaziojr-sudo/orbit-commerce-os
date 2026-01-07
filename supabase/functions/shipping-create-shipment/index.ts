/**
 * shipping-create-shipment
 * 
 * Cria pré-postagem/remessa na transportadora após NF-e autorizada.
 * Suporta: Correios, Loggi, Frenet (via carrier original)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========== TYPES ==========

interface ShipmentRequest {
  order_id: string;
  invoice_id?: string;
  provider_override?: string; // correios, loggi, frenet
}

interface ShipmentResult {
  success: boolean;
  tracking_code?: string;
  label_url?: string;
  carrier?: string;
  provider_shipment_id?: string;
  error?: string;
}

interface OrderData {
  id: string;
  tenant_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_street: string;
  shipping_number: string;
  shipping_complement: string | null;
  shipping_neighborhood: string;
  shipping_city: string;
  shipping_state: string;
  shipping_postal_code: string;
  shipping_carrier: string | null;
  shipping_method: string | null;
  subtotal: number;
  shipping_total: number;
  total: number;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    weight?: number;
    height?: number;
    width?: number;
    length?: number;
  }>;
}

interface ProviderCredentials {
  // Correios
  usuario?: string;
  senha?: string;
  cartao_postagem?: string;
  contrato?: string;
  dr?: string;
  auth_mode?: string;
  token?: string;
  // Loggi
  client_id?: string;
  client_secret?: string;
  company_id?: string;
  shipper_id?: string;
  external_service_id?: string;
  origin_cep?: string;
  // Frenet
  frenet_token?: string;
}

// ========== CORREIOS ADAPTER ==========

async function createCorreiosShipment(
  order: OrderData,
  credentials: ProviderCredentials,
  settings: Record<string, unknown>
): Promise<ShipmentResult> {
  console.log('[Correios] Creating pre-shipment for order:', order.id);
  
  // Authenticate
  const authMode = credentials.auth_mode || (credentials.token ? 'token' : 'oauth');
  let token: string;

  try {
    if (authMode === 'token') {
      token = credentials.token!;
      if (!token) {
        return { success: false, error: 'Token Correios não configurado' };
      }
    } else {
      // OAuth2 authentication
      const usuario = credentials.usuario;
      const senha = credentials.senha;
      const cartaoPostagem = credentials.cartao_postagem;

      if (!usuario || !senha || !cartaoPostagem) {
        return { success: false, error: 'Credenciais Correios incompletas (usuário, senha, cartão postagem)' };
      }

      const authString = btoa(`${usuario}:${senha}`);
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
        return { success: false, error: 'Falha na autenticação Correios' };
      }

      const authData = await authResponse.json();
      token = authData.token;
    }

    // Calculate totals
    const totalWeight = order.items.reduce((sum, item) => {
      const itemWeight = (item.weight || 0.3) * item.quantity;
      return sum + itemWeight;
    }, 0);

    // Get service code - default SEDEX or PAC based on shipping_method
    const shippingMethod = (order.shipping_method || '').toLowerCase();
    let serviceCode = '03220'; // SEDEX
    if (shippingMethod.includes('pac') || shippingMethod.includes('econômico')) {
      serviceCode = '03298'; // PAC
    }
    if (settings?.default_service_code) {
      serviceCode = settings.default_service_code as string;
    }

    // Create pre-shipment (pré-postagem)
    const prepostagemPayload = {
      idCorreios: credentials.cartao_postagem,
      codigoServico: serviceCode,
      peso: Math.max(100, Math.round(totalWeight * 1000)), // grams, min 100g
      alturaEmCentimetro: 10,
      larguraEmCentimetro: 15,
      comprimentoEmCentimetro: 20,
      diametroemCentimetro: 0,
      valorDeclarado: order.total,
      avisoRecebimento: false,
      maoPropria: false,
      objetosPostados: false,
      remetente: {
        nome: settings?.sender_name || 'Loja',
        cpfCnpj: settings?.sender_document || '',
        telefone: settings?.sender_phone || '',
        email: settings?.sender_email || '',
        endereco: {
          cep: (settings?.sender_postal_code as string)?.replace(/\D/g, '') || '',
          logradouro: settings?.sender_street || '',
          numero: settings?.sender_number || '',
          complemento: settings?.sender_complement || '',
          bairro: settings?.sender_neighborhood || '',
          cidade: settings?.sender_city || '',
          uf: settings?.sender_state || '',
        },
      },
      destinatario: {
        nome: order.customer_name,
        cpfCnpj: '', // CPF opcional
        telefone: order.customer_phone?.replace(/\D/g, '') || '',
        email: order.customer_email || '',
        endereco: {
          cep: order.shipping_postal_code.replace(/\D/g, ''),
          logradouro: order.shipping_street,
          numero: order.shipping_number,
          complemento: order.shipping_complement || '',
          bairro: order.shipping_neighborhood,
          cidade: order.shipping_city,
          uf: order.shipping_state,
        },
      },
    };

    console.log('[Correios] Pre-shipment payload:', JSON.stringify(prepostagemPayload).substring(0, 500));

    const response = await fetch('https://api.correios.com.br/prepostagem/v1/prepostagens', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(prepostagemPayload),
    });

    const responseText = await response.text();
    console.log('[Correios] Response:', response.status, responseText.substring(0, 500));

    if (!response.ok) {
      // Try to parse error
      try {
        const errorData = JSON.parse(responseText);
        const errorMsg = errorData.msgs?.map((m: any) => m.texto).join(', ') || 
                         errorData.message || 
                         `Erro ${response.status}`;
        return { success: false, error: errorMsg };
      } catch {
        return { success: false, error: `Erro Correios: ${response.status}` };
      }
    }

    const data = JSON.parse(responseText);
    
    return {
      success: true,
      tracking_code: data.codigoObjeto || data.etiqueta,
      label_url: data.urlEtiqueta,
      carrier: 'Correios',
      provider_shipment_id: data.id || data.codigoObjeto,
    };

  } catch (error: any) {
    console.error('[Correios] Error:', error);
    return { success: false, error: error.message || 'Erro ao criar pré-postagem' };
  }
}

// ========== LOGGI ADAPTER ==========
// API Docs: https://docs.api.loggi.com/reference/nossa-documenta%C3%A7%C3%A3o
// Endpoint: POST /v1/companies/{company_id}/async-shipments (retorna 202)
// Payload: shipFrom + shipTo + packages + externalServiceId
// Auth: Platform secrets (LOGGI_CLIENT_ID, LOGGI_CLIENT_SECRET, LOGGI_EXTERNAL_SERVICE_ID)
// Tenant provides: company_id, origin_cep

async function createLoggiShipment(
  order: OrderData,
  credentials: ProviderCredentials,
  settings: Record<string, unknown>
): Promise<ShipmentResult> {
  console.log('[Loggi] Creating shipment for order:', order.id);

  // Platform secrets (integrator credentials)
  const clientId = Deno.env.get('LOGGI_CLIENT_ID');
  const clientSecret = Deno.env.get('LOGGI_CLIENT_SECRET');
  const externalServiceId = Deno.env.get('LOGGI_EXTERNAL_SERVICE_ID') || 'DLVR-SPOT-DOOR-STAN-01';
  
  // Tenant credentials
  const companyId = credentials.company_id || credentials.shipper_id;

  if (!clientId || !clientSecret) {
    return { success: false, error: 'Loggi não configurado na plataforma. Entre em contato com o suporte.' };
  }

  if (!companyId) {
    return { success: false, error: 'ID do Embarcador não configurado. Configure em Configurações → Transportadoras → Loggi.' };
  }

  try {
    // Step 1: Authenticate with OAuth2 using platform secrets
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
      console.error('[Loggi] Auth failed:', authResponse.status, errorText);
      return { success: false, error: 'Falha na autenticação Loggi. Entre em contato com o suporte.' };
    }

    const authData = await authResponse.json();
    const token = authData.idToken;

    if (!token) {
      return { success: false, error: 'Token Loggi não retornado na autenticação.' };
    }

    console.log('[Loggi] OAuth2 authentication successful');

    // Calculate totals
    const totalWeightGrams = order.items.reduce((sum, item) => {
      const itemWeight = (item.weight || 0.3) * item.quantity * 1000; // Convert kg to grams
      return sum + itemWeight;
    }, 0);

    // Get sender info from settings or fiscal_settings
    const senderCep = (credentials.origin_cep || settings?.sender_postal_code as string || '').replace(/\D/g, '');
    const senderName = settings?.sender_name as string || 'Loja';
    const senderDocument = settings?.sender_document as string || '';
    const senderPhone = (settings?.sender_phone as string || '').replace(/\D/g, '');
    const senderEmail = settings?.sender_email as string || '';
    const senderStreet = settings?.sender_street as string || '';
    const senderNumber = settings?.sender_number as string || '';
    const senderComplement = settings?.sender_complement as string || '';
    const senderNeighborhood = settings?.sender_neighborhood as string || '';
    const senderCity = settings?.sender_city as string || '';
    const senderState = settings?.sender_state as string || '';

    if (!senderCep) {
      return { success: false, error: 'CEP de origem não configurado. Configure origin_cep em Transportadoras → Loggi.' };
    }

    // Build payload using correiosAddress format (official Loggi API format for Brazil)
    const shipmentPayload = {
      shipFrom: {
        name: senderName,
        federalTaxId: senderDocument.replace(/\D/g, ''),
        phone: { number: senderPhone },
        email: senderEmail,
        address: {
          correiosAddress: {
            logradouro: senderStreet,
            numero: senderNumber,
            complemento: senderComplement,
            bairro: senderNeighborhood,
            cep: senderCep,
            cidade: senderCity,
            uf: senderState,
          },
        },
      },
      shipTo: {
        name: order.customer_name,
        phone: { number: order.customer_phone?.replace(/\D/g, '') || '' },
        email: order.customer_email || '',
        address: {
          correiosAddress: {
            logradouro: order.shipping_street,
            numero: order.shipping_number,
            complemento: order.shipping_complement || '',
            bairro: order.shipping_neighborhood,
            cep: order.shipping_postal_code.replace(/\D/g, ''),
            cidade: order.shipping_city,
            uf: order.shipping_state,
          },
        },
      },
      packages: [{
        weightG: Math.max(100, Math.round(totalWeightGrams)), // Minimum 100g
        lengthCm: 20,
        widthCm: 15,
        heightCm: 10,
        declaredValue: order.total,
        description: `Pedido ${order.id.substring(0, 8)}`,
      }],
      externalServiceId: externalServiceId, // Required! e.g. DLVR-SPOT-DOOR-STAN-01
    };

    console.log('[Loggi] Shipment payload:', JSON.stringify(shipmentPayload).substring(0, 800));

    // Step 2: Create async shipment
    const response = await fetch(`https://api.loggi.com/v1/companies/${companyId}/async-shipments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(shipmentPayload),
    });

    const responseText = await response.text();
    console.log('[Loggi] Response:', response.status, responseText.substring(0, 800));

    // Async shipment returns 202 Accepted
    if (!response.ok && response.status !== 202) {
      try {
        const errorData = JSON.parse(responseText);
        const errorMsg = errorData.message || errorData.error || 
                         errorData.errors?.map((e: any) => e.message).join(', ') ||
                         `Erro ${response.status}`;
        return { success: false, error: errorMsg };
      } catch {
        return { success: false, error: `Erro Loggi: ${response.status}` };
      }
    }

    const data = JSON.parse(responseText);
    
    // Response includes packages array with trackingCode and loggiKey
    const firstPackage = data.packages?.[0] || data;
    const trackingCode = firstPackage.trackingCode || data.trackingCode || data.pk;
    const loggiKey = firstPackage.loggiKey || data.loggiKey;

    if (!trackingCode) {
      console.warn('[Loggi] No tracking code in response:', JSON.stringify(data));
      return { success: false, error: 'Loggi não retornou código de rastreio. A remessa pode estar em processamento.' };
    }

    return {
      success: true,
      tracking_code: trackingCode,
      label_url: undefined, // Label must be fetched separately using loggiKey
      carrier: 'Loggi',
      provider_shipment_id: loggiKey || trackingCode, // Store loggiKey for label retrieval
    };

  } catch (error: any) {
    console.error('[Loggi] Error:', error);
    return { success: false, error: error.message || 'Erro ao criar remessa Loggi' };
  }
}

// ========== FRENET ADAPTER ==========

async function createFrenetShipment(
  order: OrderData,
  credentials: ProviderCredentials,
  settings: Record<string, unknown>
): Promise<ShipmentResult> {
  console.log('[Frenet] Frenet is a label marketplace, cannot create shipments via API');
  
  // Frenet is a label marketplace - labels must be purchased via their panel
  // Return requires_manual flag so frontend can guide the user
  return {
    success: false,
    error: 'Frenet não suporta criação automática de remessas. Acesse o painel Frenet para comprar a etiqueta, depois registre o código de rastreio manualmente usando o modo "Manual".',
    requires_manual: true,
  } as ShipmentResult & { requires_manual: boolean };
}

// ========== MAIN HANDLER ==========

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.current_tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tenant não encontrado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = profile.current_tenant_id;

    // Parse request
    const body: ShipmentRequest = await req.json();
    const { order_id, provider_override } = body;

    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'order_id é obrigatório' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[shipping-create-shipment] Processing order ${order_id} for tenant ${tenantId}`);

    // Get order with items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id, tenant_id, customer_name, customer_email, customer_phone,
        shipping_street, shipping_number, shipping_complement, shipping_neighborhood,
        shipping_city, shipping_state, shipping_postal_code, shipping_carrier, shipping_method,
        subtotal, shipping_total, total, tracking_code
      `)
      .eq('id', order_id)
      .eq('tenant_id', tenantId)
      .single();

    if (orderError || !order) {
      console.error('[shipping-create-shipment] Order not found:', orderError);
      return new Response(
        JSON.stringify({ success: false, error: 'Pedido não encontrado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already has tracking
    if (order.tracking_code) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          tracking_code: order.tracking_code,
          message: 'Pedido já possui código de rastreio' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get order items
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('product_name, quantity, unit_price')
      .eq('order_id', order_id);

    const orderData: OrderData = {
      ...order,
      items: (orderItems || []).map(item => ({
        ...item,
        weight: 0.3, // Default weight
        height: 10,
        width: 15,
        length: 20,
      })),
    };

    // Get fiscal settings for default provider
    const { data: fiscalSettings } = await supabase
      .from('fiscal_settings')
      .select('default_shipping_provider, auto_update_order_status')
      .eq('tenant_id', tenantId)
      .single();

    // Determine provider
    const provider = provider_override || 
                     fiscalSettings?.default_shipping_provider || 
                     order.shipping_carrier?.toLowerCase() ||
                     'correios';

    console.log(`[shipping-create-shipment] Using provider: ${provider}`);

    // Get provider credentials
    const { data: providerRecord } = await supabase
      .from('shipping_providers')
      .select('credentials, settings, is_enabled')
      .eq('tenant_id', tenantId)
      .eq('provider', provider)
      .eq('is_enabled', true)
      .single();

    if (!providerRecord) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Transportadora ${provider} não configurada ou desabilitada` 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const credentials = providerRecord.credentials as ProviderCredentials;
    const settings = providerRecord.settings as Record<string, unknown>;

    // Create shipment based on provider
    let result: ShipmentResult;

    switch (provider.toLowerCase()) {
      case 'correios':
        result = await createCorreiosShipment(orderData, credentials, settings);
        break;
      case 'loggi':
        result = await createLoggiShipment(orderData, credentials, settings);
        break;
      case 'frenet':
        result = await createFrenetShipment(orderData, credentials, settings);
        break;
      default:
        result = { success: false, error: `Transportadora ${provider} não suportada` };
    }

    console.log(`[shipping-create-shipment] Result:`, JSON.stringify(result));

    if (result.success && result.tracking_code) {
      // Update order with tracking code, status and shipped_at
      const orderUpdate: Record<string, unknown> = {
        tracking_code: result.tracking_code,
        shipping_carrier: result.carrier,
        status: 'shipped',
        shipped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Update shipping status if enabled
      if (fiscalSettings?.auto_update_order_status !== false) {
        orderUpdate.shipping_status = 'label_created';
      }

      await supabase
        .from('orders')
        .update(orderUpdate)
        .eq('id', order_id);
      
      console.log(`[shipping-create-shipment] Order ${order_id} updated to shipped with tracking: ${result.tracking_code}`);

      // Create/update shipment record via shipment-ingest
      await supabase
        .from('shipments')
        .upsert({
          tenant_id: tenantId,
          order_id: order_id,
          carrier: result.carrier || provider,
          tracking_code: result.tracking_code,
          delivery_status: 'label_created',
          label_url: result.label_url,
          provider_shipment_id: result.provider_shipment_id,
          last_status_at: new Date().toISOString(),
          next_poll_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
          poll_error_count: 0,
        }, {
          onConflict: 'tenant_id,order_id,tracking_code',
        });

      // Log in order history
      await supabase
        .from('order_history')
        .insert({
          order_id: order_id,
          status: 'shipment_created',
          notes: `Remessa criada via ${result.carrier}. Código: ${result.tracking_code}`,
        });

      console.log(`[shipping-create-shipment] Order ${order_id} updated with tracking: ${result.tracking_code}`);
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[shipping-create-shipment] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
