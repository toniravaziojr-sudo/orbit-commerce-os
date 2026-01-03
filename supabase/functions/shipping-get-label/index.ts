/**
 * shipping-get-label
 * 
 * Obtém etiqueta de envio da transportadora.
 * Suporta: Correios, Loggi
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LabelRequest {
  shipment_id?: string;
  order_id?: string;
  tracking_code?: string;
  format?: 'pdf' | 'zpl' | 'a4' | 'a6'; // Default: pdf
}

interface LabelResult {
  success: boolean;
  label_url?: string;
  label_base64?: string;
  format?: string;
  error?: string;
}

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
    const body: LabelRequest = await req.json();
    const { shipment_id, order_id, tracking_code, format = 'pdf' } = body;

    if (!shipment_id && !order_id && !tracking_code) {
      return new Response(
        JSON.stringify({ success: false, error: 'shipment_id, order_id ou tracking_code é obrigatório' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[shipping-get-label] Getting label for shipment/order/tracking: ${shipment_id || order_id || tracking_code}`);

    // Find shipment
    let query = supabase
      .from('shipments')
      .select('id, order_id, carrier, tracking_code, label_url, provider_shipment_id')
      .eq('tenant_id', tenantId);

    if (shipment_id) {
      query = query.eq('id', shipment_id);
    } else if (order_id) {
      query = query.eq('order_id', order_id);
    } else if (tracking_code) {
      query = query.eq('tracking_code', tracking_code);
    }

    const { data: shipment, error: shipmentError } = await query.single();

    if (shipmentError || !shipment) {
      console.error('[shipping-get-label] Shipment not found:', shipmentError);
      return new Response(
        JSON.stringify({ success: false, error: 'Remessa não encontrada' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If we already have a label URL, return it
    if (shipment.label_url) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          label_url: shipment.label_url,
          format: 'pdf',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Need to fetch label from carrier
    const carrier = shipment.carrier?.toLowerCase() || '';

    // Get provider credentials
    const { data: providerRecord } = await supabase
      .from('shipping_providers')
      .select('credentials, settings, is_enabled')
      .eq('tenant_id', tenantId)
      .eq('provider', carrier)
      .eq('is_enabled', true)
      .single();

    if (!providerRecord) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Transportadora ${carrier} não configurada` 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const credentials = providerRecord.credentials as Record<string, unknown>;
    let result: LabelResult;

    switch (carrier) {
      case 'correios':
        result = await getCorreiosLabel(shipment.tracking_code, credentials, format);
        break;
      case 'loggi':
        result = await getLoggiLabel(shipment.tracking_code, shipment.provider_shipment_id, credentials);
        break;
      default:
        result = { success: false, error: `Etiqueta não disponível para ${carrier}` };
    }

    // Update shipment with label URL if successful
    if (result.success && result.label_url) {
      await supabase
        .from('shipments')
        .update({ label_url: result.label_url })
        .eq('id', shipment.id);
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[shipping-get-label] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ========== CORREIOS LABEL ==========

async function getCorreiosLabel(
  trackingCode: string,
  credentials: Record<string, unknown>,
  format: string
): Promise<LabelResult> {
  console.log('[Correios] Getting label for:', trackingCode);

  try {
    // Authenticate
    const authMode = credentials.auth_mode as string || (credentials.token ? 'token' : 'oauth');
    let token: string;

    if (authMode === 'token') {
      token = credentials.token as string;
      if (!token) {
        return { success: false, error: 'Token Correios não configurado' };
      }
    } else {
      const usuario = credentials.usuario as string;
      const senha = credentials.senha as string;
      const cartaoPostagem = credentials.cartao_postagem as string;

      if (!usuario || !senha || !cartaoPostagem) {
        return { success: false, error: 'Credenciais Correios incompletas' };
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
        return { success: false, error: 'Falha na autenticação Correios' };
      }

      const authData = await authResponse.json();
      token = authData.token;
    }

    // Get label - determine format
    let tipoRotulo = 'P'; // P=PDF, Z=ZPL
    if (format === 'zpl') tipoRotulo = 'Z';

    // Correios etiqueta endpoint
    const labelUrl = `https://api.correios.com.br/prepostagem/v1/prepostagens/${trackingCode}/etiqueta?tipoRotulo=${tipoRotulo}`;

    console.log('[Correios] Fetching label from:', labelUrl);

    const response = await fetch(labelUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': format === 'zpl' ? 'application/x-zpl' : 'application/pdf',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Correios] Label error:', response.status, errorText);
      return { success: false, error: `Erro ao obter etiqueta: ${response.status}` };
    }

    // For PDF, we need to convert to base64 or return URL
    // Correios might return the PDF directly or a URL
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/pdf') || contentType.includes('application/x-zpl')) {
      const buffer = await response.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      
      return {
        success: true,
        label_base64: base64,
        format: format,
      };
    }

    // If response is JSON with URL
    try {
      const data = await response.json();
      if (data.url || data.urlEtiqueta) {
        return {
          success: true,
          label_url: data.url || data.urlEtiqueta,
          format: 'pdf',
        };
      }
    } catch {
      // Not JSON, might be direct PDF
    }

    return { success: false, error: 'Formato de resposta inesperado' };

  } catch (error: any) {
    console.error('[Correios] Label error:', error);
    return { success: false, error: error.message };
  }
}

// ========== LOGGI LABEL ==========
// API Docs: https://docs.api.loggi.com/reference/labels
// Endpoint: GET /v1/companies/{company_id}/labels?loggiKeys={loggiKey}
// IMPORTANT: Use loggiKey (not trackingCode) to fetch labels
// Auth: Platform secrets (LOGGI_CLIENT_ID, LOGGI_CLIENT_SECRET)
// Tenant provides: company_id

async function getLoggiLabel(
  trackingCode: string,
  providerShipmentId: string | null, // This should be the loggiKey from shipment creation
  credentials: Record<string, unknown>
): Promise<LabelResult> {
  console.log('[Loggi] Getting label for trackingCode:', trackingCode, 'loggiKey:', providerShipmentId);

  // Platform secrets (integrator credentials)
  const clientId = Deno.env.get('LOGGI_CLIENT_ID');
  const clientSecret = Deno.env.get('LOGGI_CLIENT_SECRET');
  
  // Tenant credentials
  const companyId = (credentials.company_id || credentials.shipper_id) as string;

  if (!clientId || !clientSecret) {
    return { success: false, error: 'Loggi não configurado na plataforma. Entre em contato com o suporte.' };
  }

  if (!companyId) {
    return { success: false, error: 'ID do Embarcador não configurado. Configure em Configurações → Transportadoras → Loggi.' };
  }

  // loggiKey is required for label retrieval
  const loggiKey = providerShipmentId || trackingCode;
  if (!loggiKey) {
    return { success: false, error: 'loggiKey não disponível para obter etiqueta.' };
  }

  try {
    // Step 1: Authenticate with platform secrets
    console.log('[Loggi] Authenticating with platform credentials...');
    const authResponse = await fetch('https://api.loggi.com/v2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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

    // Step 2: Get label using the correct endpoint
    // Endpoint: GET /v1/companies/{company_id}/labels?loggiKeys={loggiKey}
    const labelUrl = `https://api.loggi.com/v1/companies/${companyId}/labels?loggiKeys=${encodeURIComponent(loggiKey)}`;

    console.log('[Loggi] Fetching label from:', labelUrl);

    const response = await fetch(labelUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/pdf',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Loggi] Label error:', response.status, errorText);
      
      // Try to parse error message
      try {
        const errorData = JSON.parse(errorText);
        const errorMsg = errorData.message || errorData.error || `Erro ${response.status}`;
        return { success: false, error: errorMsg };
      } catch {
        return { success: false, error: `Erro ao obter etiqueta Loggi: ${response.status}` };
      }
    }

    const contentType = response.headers.get('content-type') || '';

    // PDF response - convert to base64
    if (contentType.includes('application/pdf')) {
      const buffer = await response.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      
      console.log('[Loggi] Label retrieved successfully as PDF');
      return {
        success: true,
        label_base64: base64,
        format: 'pdf',
      };
    }

    // Try to parse JSON response for URL
    try {
      const data = await response.json();
      console.log('[Loggi] Label response:', JSON.stringify(data).substring(0, 500));
      
      if (data.url || data.label_url || data.labels?.[0]?.url) {
        const labelUrlFromResponse = data.url || data.label_url || data.labels?.[0]?.url;
        return {
          success: true,
          label_url: labelUrlFromResponse,
          format: 'pdf',
        };
      }
      
      // If response contains base64 directly
      if (data.base64 || data.content) {
        return {
          success: true,
          label_base64: data.base64 || data.content,
          format: 'pdf',
        };
      }
    } catch {
      // Not JSON, might be direct binary
    }

    return { success: false, error: 'Formato de resposta de etiqueta não reconhecido.' };

  } catch (error: any) {
    console.error('[Loggi] Label error:', error);
    return { success: false, error: error.message || 'Erro ao obter etiqueta Loggi.' };
  }
}
