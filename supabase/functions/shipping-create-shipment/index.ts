/**
 * shipping-create-shipment
 * 
 * Cria pré-postagem/remessa na transportadora após NF-e autorizada.
 * Suporta: Correios, Loggi, Frenet (via carrier original)
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";
import { runPreflight, type PreflightEmitente } from "../_shared/fiscal-shipping-preflight.ts";
import { downloadAndStoreCorreiosLabel } from "../_shared/correios-label.ts";

import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========== TYPES ==========

interface ShipmentRequest {
  order_id?: string;
  shipment_id?: string; // Novo caminho: despachar a partir do rascunho existente
  invoice_id?: string;
  provider_override?: string;
  tenant_id?: string; // Used by internal service_role calls
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
  customer_cpf?: string | null;
  customer_cnpj?: string | null;
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
  codigo_acesso?: string; // API Code mode (like Bling)
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
  settings: Record<string, unknown>,
  fiscalDoc?: {
    kind: 'nfe' | 'dc';
    nfe_numero?: string | null;
    nfe_serie?: string | null;
    nfe_chave?: string | null;
    nfe_valor?: number | null;
    dc_number?: string | null;
  } | null,
): Promise<ShipmentResult> {
  console.log('[Correios] Creating pre-shipment for order:', order.id);

  const splitPhone = (raw: unknown) => {
    const digits = String(raw || '').replace(/\D/g, '');
    const normalized = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
    if (normalized.length < 10) {
      return { ddd: '', telefone: '', celular: '' };
    }
    const ddd = normalized.slice(0, 2);
    const number = normalized.slice(2);
    if (number.length >= 9) {
      return { ddd, telefone: '', celular: number.slice(0, 9) };
    }
    return { ddd, telefone: number.slice(0, 8), celular: '' };
  };
  
  // Authenticate - support api_code (like Bling), token, and oauth modes
  const authMode = credentials.auth_mode || 
    (credentials.codigo_acesso ? 'api_code' : 
     credentials.token ? 'token' : 'oauth');
  let token: string;
  if (authMode === 'token') {
      if (!credentials.token) {
        return { success: false, error: 'Token Correios não configurado' };
      }
      token = credentials.token;
  } else if (authMode === 'api_code') {
      // API Code mode - usa código de acesso permanente (como Bling)
      if (!credentials.usuario || !credentials.codigo_acesso || !credentials.cartao_postagem) {
        return { success: false, error: 'Credenciais Correios incompletas (usuário, código de acesso, cartão postagem)' };
      }
      
      const basicAuth = btoa(`${credentials.usuario}:${credentials.codigo_acesso}`);
      
      const authResponse = await fetch('https://api.correios.com.br/token/v1/autentica/cartaopostagem', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ numero: credentials.cartao_postagem }),
      });
      
      if (!authResponse.ok) {
        const errorText = await authResponse.text();
        console.error('[Correios] API Code auth failed:', authResponse.status, errorText);
        return { success: false, error: 'Falha na autenticação Correios (verifique o código de acesso)' };
      }
      
      const authData = await authResponse.json();
      token = authData.token;
  } else {
      // OAuth mode (legacy) - usa senha do portal
      if (!credentials.usuario || !credentials.senha || !credentials.cartao_postagem) {
        return { success: false, error: 'Credenciais Correios incompletas (usuário, senha, cartão postagem)' };
      }

      const basicAuth = btoa(`${credentials.usuario}:${credentials.senha}`);
      
      const authResponse = await fetch('https://api.correios.com.br/token/v1/autentica/cartaopostagem', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ numero: credentials.cartao_postagem }),
      });

      if (!authResponse.ok) {
        const errorText = await authResponse.text();
        console.error('[Correios] Auth failed:', authResponse.status, errorText);
        return { success: false, error: 'Falha na autenticação Correios' };
      }

      const authData = await authResponse.json();
      token = authData.token;
  }

  try {
    // Calculate aggregates from order items (already merged with override above).
    const totalWeight = order.items.reduce((sum, item) => {
      const itemWeight = (Number(item.weight) || 300) * (Number(item.quantity) || 1);
      return sum + itemWeight;
    }, 0);
    const aggHeight = order.items.reduce((m, it) => Math.max(m, Number(it.height) || 0), 0) || 10;
    const aggWidth = order.items.reduce((m, it) => Math.max(m, Number(it.width) || 0), 0) || 15;
    const aggLength = order.items.reduce((s, it) => s + (Number(it.length) || 0), 0) || 20;

    // Get service code - default SEDEX or PAC based on shipping_method
    const shippingMethod = (order.shipping_method || '').toLowerCase();
    let serviceCode = '03220'; // SEDEX
    if (shippingMethod.includes('pac') || shippingMethod.includes('econômico')) {
      serviceCode = '03298'; // PAC
    }
    if (settings?.default_service_code) {
      serviceCode = settings.default_service_code as string;
    }

    // ===== Sanitização: telefones só dígitos, máximo 12 (DDD + 9 dígitos) =====
    const senderPhone = splitPhone(settings?.sender_phone);
    const recipientPhone = splitPhone(order.customer_phone);

    // ===== Observação fiscal (Declaração de Conteúdo quando não há NF-e) =====
    let observacao: string | undefined;
    if (fiscalDoc?.kind === 'dc' && fiscalDoc.dc_number) {
      observacao = `Declaracao de Conteudo no ${fiscalDoc.dc_number}`;
    }

    const pesoGramas = Math.max(100, Math.round(totalWeight));
    const formatoObjeto = '2';

    // Create pre-shipment (pré-postagem)
    // Nomes oficiais CWS v1 (ref: correios_api gem 1.0.3): pesoInformado,
    // codigoFormatoObjetoInformado, alturaInformada, larguraInformada,
    // comprimentoInformado, cienteObjetoNaoProibido, modalidadePagamento,
    // itensDeclaracaoConteudo[]. Os nomes antigos (pesoObjeto/codigoFormatoObjeto/
    // alturaEmCentimetro etc.) eram ignorados e geravam PPN-348/null.
    const prepostagemPayload: Record<string, unknown> = {
      idCorreios: credentials.cartao_postagem,
      numeroCartaoPostagem: credentials.cartao_postagem,
      codigoServico: serviceCode,
      modalidadePagamento: '2', // 2 = à faturar (contrato)
      pesoInformado: String(pesoGramas),
      codigoFormatoObjetoInformado: formatoObjeto, // 1=envelope, 2=caixa, 3=cilindro
      alturaInformada: String(Math.max(2, Math.round(aggHeight))),
      larguraInformada: String(Math.max(11, Math.round(aggWidth))),
      comprimentoInformado: String(Math.max(16, Math.round(aggLength))),
      diametroInformado: '0',
      valorDeclarado: order.total,
      avisoRecebimento: false,
      maoPropria: false,
      objetosPostados: false,
      cienteObjetoNaoProibido: '1', // PPN-330: declaração obrigatória de que não há itens proibidos
      remetente: {
        nome: settings?.sender_name || 'Loja',
        cpfCnpj: String(settings?.sender_document || '').replace(/\D/g, ''),
        dddTelefone: senderPhone.telefone ? senderPhone.ddd : undefined,
        telefone: senderPhone.telefone || undefined,
        dddCelular: senderPhone.celular ? senderPhone.ddd : undefined,
        celular: senderPhone.celular || undefined,
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
        cpfCnpj: (order.customer_cpf || order.customer_cnpj || '').replace(/\D/g, ''),
        dddTelefone: recipientPhone.telefone ? recipientPhone.ddd : undefined,
        telefone: recipientPhone.telefone || undefined,
        dddCelular: recipientPhone.celular ? recipientPhone.ddd : undefined,
        celular: recipientPhone.celular || undefined,
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

    // Vínculo fiscal (NF-e: campos estruturados; DC: observação)
    if (fiscalDoc?.kind === 'nfe') {
      if (fiscalDoc.nfe_chave) prepostagemPayload.chaveAcessoNotaFiscal = fiscalDoc.nfe_chave;
      if (fiscalDoc.nfe_numero) prepostagemPayload.numeroNotaFiscal = String(fiscalDoc.nfe_numero);
      if (fiscalDoc.nfe_serie) prepostagemPayload.serieNotaFiscal = String(fiscalDoc.nfe_serie);
      if (fiscalDoc.nfe_valor) prepostagemPayload.valorNotaFiscal = fiscalDoc.nfe_valor;
    }
    if (observacao) {
      prepostagemPayload.observacao = observacao;
      // Itens da Declaração de Conteúdo: enviar conteudo + descricao + quantidade + valor + peso
      // (alguns schemas exigem descricao; "peso" é defensivo para PPN-348).
      prepostagemPayload.itensDeclaracaoConteudo = order.items.map((item) => {
        const desc = item.product_name || 'Item';
        const qtd = Number(item.quantity) || 1;
        const pesoItemG = Math.max(1, Math.round((Number(item.weight) || 100) * qtd));
        return {
          conteudo: desc,
          descricao: desc,
          quantidade: String(qtd),
          valor: Number(item.unit_price || 0).toFixed(2),
          peso: String(pesoItemG),
        };
      });
    }

    console.log('[Correios] Pre-shipment payload:', JSON.stringify(prepostagemPayload).substring(0, 800));

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
    console.log('[Correios] Response:', response.status, responseText.substring(0, 800));

    if (!response.ok) {
      // Parser robusto: CWS atual devolve msgs como string[]; legado devolve {texto}[]
      try {
        const errorData = JSON.parse(responseText);
        const rawMsgs: unknown = errorData.msgs ?? errorData.errors ?? [];
        const messages: string[] = Array.isArray(rawMsgs)
          ? rawMsgs
              .map((m: any) => {
                if (typeof m === 'string') return m;
                if (m && typeof m === 'object') return m.texto || m.mensagem || m.message || '';
                return '';
              })
              .map((s: string) => String(s).trim())
              .filter((s: string) => s.length > 0)
          : [];
        const errorMsg = messages.length > 0
          ? messages.join(' • ')
          : (errorData.message || errorData.error || `Erro ${response.status}`);
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
    return { success: false, error: "Erro interno. Se o problema persistir, entre em contato com o suporte." };
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
      const itemWeight = (item.weight || 300) * item.quantity; // already in grams
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
    return { success: false, error: "Erro interno. Se o problema persistir, entre em contato com o suporte." };
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  await loadPlatformCredentials();

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

    // Parse request body first (needed for both auth modes)
    const body: ShipmentRequest = await req.json();

    // Detect internal service_role call (from nfe-shipment-link or scheduler-tick)
    const isServiceRoleCall = authHeader === `Bearer ${supabaseServiceKey}`;
    let tenantId: string;

    if (isServiceRoleCall && body.tenant_id) {
      // Internal call: trust tenant_id from body
      tenantId = body.tenant_id as string;
      console.log(`[shipping-create-shipment] Internal service_role call for tenant ${tenantId}`);
    } else {
      // User call: authenticate via JWT
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

      tenantId = profile.current_tenant_id;
    }
    const { order_id: bodyOrderId, shipment_id: bodyShipmentId, provider_override } = body;

    if (!bodyOrderId && !bodyShipmentId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Informe order_id ou shipment_id' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ====== Resolve shipment context ======
    // shipmentRow = rascunho atual (quando entrada é shipment_id ou quando existe um rascunho para o pedido)
    // resolvedOrderId = pedido vinculado (pode ser null para PV manual/duplicado)
    // resolvedPvId = Pedido de Venda fiscal vinculado (quando aplicável)
    let shipmentRow: any = null;
    let resolvedOrderId: string | null = bodyOrderId || null;
    let resolvedPvId: string | null = null;

    if (bodyShipmentId) {
      const { data: s, error: sErr } = await supabase
        .from('shipments')
        .select('id, tenant_id, order_id, source_pedido_venda_id, carrier, service_name, service_code, delivery_status, tracking_code, metadata, manually_adjusted')
        .eq('id', bodyShipmentId)
        .maybeSingle();
      if (sErr || !s) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rascunho de remessa não encontrado' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // Para chamada via JWT, validar que o rascunho pertence ao tenant do usuário
      if (!isServiceRoleCall && s.tenant_id !== tenantId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rascunho não pertence a este tenant' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // Para chamada interna, herdar tenant_id do próprio rascunho se não veio
      if (isServiceRoleCall) tenantId = s.tenant_id;

      if (s.tracking_code) {
        return new Response(
          JSON.stringify({ success: true, tracking_code: s.tracking_code, message: 'Rascunho já possui código de rastreio' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      shipmentRow = s;
      resolvedOrderId = s.order_id || null;
      resolvedPvId = s.source_pedido_venda_id || null;
    }

    console.log(`[shipping-create-shipment] tenant=${tenantId} order=${resolvedOrderId} pv=${resolvedPvId} shipment=${shipmentRow?.id || '-'}`);

    // ====== Carrega o pedido (real ou virtual a partir do PV) ======
    let order: any = null;

    if (resolvedOrderId) {
      const { data: orderRow, error: orderError } = await supabase
        .from('orders')
        .select(`
          id, tenant_id, customer_name, customer_email, customer_phone, customer_cpf, customer_cnpj,
          shipping_street, shipping_number, shipping_complement, shipping_neighborhood,
          shipping_city, shipping_state, shipping_postal_code, shipping_carrier, shipping_method,
          subtotal, shipping_total, total, tracking_code
        `)
        .eq('id', resolvedOrderId)
        .eq('tenant_id', tenantId)
        .single();

      if (orderError || !orderRow) {
        return new Response(
          JSON.stringify({ success: false, error: 'Pedido não encontrado' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (orderRow.tracking_code && !bodyShipmentId) {
        return new Response(
          JSON.stringify({ success: true, tracking_code: orderRow.tracking_code, message: 'Pedido já possui código de rastreio' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      order = orderRow;
    }

    // PV manual/duplicado: hidrata "pedido virtual" a partir do Pedido de Venda
    let pvRow: any = null;
    if (resolvedPvId && !order) {
      const { data: pv, error: pvErr } = await supabase
        .from('fiscal_invoices')
        .select('id, tenant_id, dest_nome, dest_email, dest_telefone, dest_cpf_cnpj, dest_endereco_logradouro, dest_endereco_numero, dest_endereco_complemento, dest_endereco_bairro, dest_endereco_municipio, dest_endereco_uf, dest_endereco_cep, transportadora_nome, transportadora_servico, valor_total')
        .eq('id', resolvedPvId)
        .maybeSingle();
      if (pvErr || !pv) {
        console.error('[shipping-create-shipment] PV lookup failed', { resolvedPvId, pvErr });
        return new Response(
          JSON.stringify({ success: false, error: 'Pedido de Venda vinculado ao rascunho não encontrado' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (pv.tenant_id !== tenantId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Pedido de Venda não pertence a este tenant' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      pvRow = pv;
      const docDigits = String(pv.dest_cpf_cnpj || '').replace(/\D/g, '');
      const isCnpj = docDigits.length === 14;
      order = {
        id: pv.id, // identificador virtual
        tenant_id: tenantId,
        customer_name: pv.dest_nome || '',
        customer_email: pv.dest_email || '',
        customer_phone: pv.dest_telefone || '',
        customer_cpf: isCnpj ? null : (docDigits || null),
        customer_cnpj: isCnpj ? docDigits : null,
        shipping_street: pv.dest_endereco_logradouro || '',
        shipping_number: pv.dest_endereco_numero || '',
        shipping_complement: pv.dest_endereco_complemento || '',
        shipping_neighborhood: pv.dest_endereco_bairro || '',
        shipping_city: pv.dest_endereco_municipio || '',
        shipping_state: pv.dest_endereco_uf || '',
        shipping_postal_code: pv.dest_endereco_cep || '',
        shipping_carrier: pv.transportadora_nome || null,
        shipping_method: pv.transportadora_servico || null,
        subtotal: Number(pv.valor_total) || 0,
        shipping_total: 0,
        total: Number(pv.valor_total) || 0,
        tracking_code: null,
      };

    }

    if (!order) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não foi possível resolver o pedido nem o Pedido de Venda do rascunho' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ====== Vínculo fiscal obrigatório para Correios local ======
    // Regra de negócio: Correios exigem NF-e OU Declaração de Conteúdo.
    // - Se houver NF-e autorizada → anexamos número/série/chave.
    // - Senão, se houver Declaração de Conteúdo emitida → anexamos número na observação.
    // - Senão, bloqueamos a emissão da remessa com mensagem clara em PT-BR.
    // O fluxo automático (Frenet/gateway) tem caminho próprio e não cai aqui.
    // Busca canônica pelo PV — pedido real é apenas fallback histórico
    let invoiceData: any = null;
    if (resolvedPvId) {
      const { data: inv } = await supabase
        .from('fiscal_invoices')
        .select('id, chave_acesso, numero, serie, valor_total, status, danfe_url')
        .eq('source_order_invoice_id', resolvedPvId)
        .eq('tenant_id', tenantId)
        .eq('status', 'authorized')
        .maybeSingle();
      invoiceData = inv;
    }
    if (!invoiceData && resolvedOrderId) {
      const { data: inv } = await supabase
        .from('fiscal_invoices')
        .select('id, chave_acesso, numero, serie, valor_total, status, danfe_url')
        .eq('order_id', resolvedOrderId)
        .eq('tenant_id', tenantId)
        .eq('status', 'authorized')
        .maybeSingle();
      invoiceData = inv;
    }

    // Declaração de Conteúdo dos Correios (alternativa à NF-e)
    // Vínculo canônico é com o PV. order_id só é usado como fallback histórico.
    let contentDeclaration: { id: string; dc_number: string } | null = null;
    if (!invoiceData) {
      let dcQuery = supabase
        .from('shipping_content_declarations')
        .select('id, dc_number, order_id, fiscal_invoice_id')
        .eq('tenant_id', tenantId)
        .eq('status', 'issued')
        .order('created_at', { ascending: false })
        .limit(1);
      if (resolvedPvId) {
        dcQuery = dcQuery.eq('fiscal_invoice_id', resolvedPvId);
      } else if (resolvedOrderId) {
        dcQuery = dcQuery.eq('order_id', resolvedOrderId);
      }
      const { data: dcRow } = await dcQuery.maybeSingle();
      if (dcRow) contentDeclaration = { id: dcRow.id, dc_number: dcRow.dc_number };
    }

    if (invoiceData) {
      console.log(`[shipping-create-shipment] NF-e found and will be linked: ${invoiceData.id}`);
    } else if (contentDeclaration) {
      console.log(`[shipping-create-shipment] Declaração de Conteúdo found and will be linked: ${contentDeclaration.dc_number}`);
    } else {
      console.log('[shipping-create-shipment] No fiscal doc found — will block if provider requires it.');
    }



    // ====== Carrega o rascunho (se já não veio por shipment_id) e aplica override ======
    // Vínculo canônico: PV. Pedido real é fallback histórico.
    if (!shipmentRow && resolvedPvId) {
      const { data: draftShipment } = await supabase
        .from('shipments')
        .select('id, tenant_id, order_id, source_pedido_venda_id, carrier, service_name, service_code, metadata, manually_adjusted')
        .eq('source_pedido_venda_id', resolvedPvId)
        .eq('tenant_id', tenantId)
        .eq('delivery_status', 'draft')
        .maybeSingle();
      if (draftShipment) shipmentRow = draftShipment;
    }
    if (!shipmentRow && resolvedOrderId) {
      const { data: draftShipment } = await supabase
        .from('shipments')
        .select('id, tenant_id, order_id, source_pedido_venda_id, carrier, service_name, service_code, metadata, manually_adjusted')
        .eq('order_id', resolvedOrderId)
        .eq('tenant_id', tenantId)
        .eq('delivery_status', 'draft')
        .maybeSingle();
      if (draftShipment) shipmentRow = draftShipment;
    }
    // Se o rascunho não tinha PV vinculado mas resolvemos um, costuramos o vínculo agora
    if (shipmentRow && !shipmentRow.source_pedido_venda_id && resolvedPvId) {
      await supabase.from('shipments').update({ source_pedido_venda_id: resolvedPvId }).eq('id', shipmentRow.id);
      shipmentRow.source_pedido_venda_id = resolvedPvId;
    }

    const meta = (shipmentRow?.metadata as any) || {};
    // Para PV órfão (sem order real), o próprio gatilho de espelho popula metadata com weight/dimensions
    // calculados do PV. Logo: sempre que houver shipmentRow, usamos seu metadata como fonte de peso/dimensões/destinatário.
    const override = shipmentRow ? meta : null;

    if (override) {
      console.log('[shipping-create-shipment] Using shipment.metadata as source for recipient/package');
      if (override.override_recipient_name) order.customer_name = override.override_recipient_name;
      if (override.override_recipient_phone) order.customer_phone = override.override_recipient_phone;
      if (override.override_recipient_doc) {
        const d = String(override.override_recipient_doc);
        if (d.length === 14) (order as any).customer_cnpj = d;
        else (order as any).customer_cpf = d;
      }
      if (override.override_shipping_street) order.shipping_street = override.override_shipping_street;
      if (override.override_shipping_number) order.shipping_number = override.override_shipping_number;
      if (override.override_shipping_complement !== undefined) order.shipping_complement = override.override_shipping_complement;
      if (override.override_shipping_neighborhood) order.shipping_neighborhood = override.override_shipping_neighborhood;
      if (override.override_shipping_city) order.shipping_city = override.override_shipping_city;
      if (override.override_shipping_state) order.shipping_state = override.override_shipping_state;
      if (override.override_shipping_zip) order.shipping_postal_code = override.override_shipping_zip;
    }

    // ====== Itens do pedido (para peso/dimensões quando não há override de pacote) ======
    let orderItems: any[] = [];
    if (resolvedOrderId) {
      const { data } = await supabase
        .from('order_items')
        .select('product_name, quantity, unit_price, product_id')
        .eq('order_id', resolvedOrderId);
      orderItems = data || [];
    } else if (resolvedPvId) {
      // PV manual: usar fiscal_invoice_items
      const { data: pvItems } = await supabase
        .from('fiscal_invoice_items')
        .select('descricao, quantidade, valor_unitario, codigo_produto')
        .eq('fiscal_invoice_id', resolvedPvId);
      // Resolver product_id por SKU
      const skus = (pvItems || []).map((i: any) => i.codigo_produto).filter(Boolean);
      let productsBySku: Record<string, any> = {};
      if (skus.length > 0) {
        const { data: prods } = await supabase
          .from('products')
          .select('id, sku')
          .eq('tenant_id', tenantId)
          .in('sku', skus);
        productsBySku = Object.fromEntries((prods || []).map((p: any) => [p.sku, p]));
      }
      orderItems = (pvItems || []).map((i: any) => ({
        product_name: i.descricao,
        quantity: Number(i.quantidade) || 1,
        unit_price: Number(i.valor_unitario) || 0,
        product_id: i.codigo_produto ? productsBySku[i.codigo_produto]?.id || null : null,
      }));
    }

    // Fetch product physical data
    const productIds = orderItems.map(i => i.product_id).filter(Boolean);
    let productsMap: Record<string, any> = {};
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, weight, height, width, depth')
        .in('id', productIds);
      if (products) {
        productsMap = Object.fromEntries(products.map(p => [p.id, p]));
      }
    }

    const orderData: OrderData = {
      ...order,
      items: orderItems.map(item => {
        const product = item.product_id ? productsMap[item.product_id] : null;
        return {
          ...item,
          weight: product?.weight || 300,
          height: product?.height || 10,
          width: product?.width || 15,
          length: product?.depth || 20,
        };
      }),
    };

    // Quando há override (qualquer rascunho), peso/dimensões agregados do metadata vencem
    if (override) {
      if (override.weight_grams) {
        orderData.items = [{
          product_name: 'Embalagem (rascunho)',
          quantity: 1,
          unit_price: 0,
          weight: Number(override.weight_grams) || 300,
          height: Number(override.height_cm) || 10,
          width: Number(override.width_cm) || 15,
          length: Number(override.depth_cm) || 20,
        }];
      }
      if (override.declared_value) {
        (orderData as any).total = Number(override.declared_value) || orderData.total;
      }
    }

    // Provider para PV órfão: vem do próprio shipment (carrier) já normalizado pelo gatilho
    if (!resolvedOrderId && shipmentRow?.carrier && !order.shipping_carrier) {
      order.shipping_carrier = shipmentRow.carrier;
    }


    // Get fiscal settings for default provider
    const { data: fiscalSettings } = await supabase
      .from('fiscal_settings')
      .select('default_shipping_provider, auto_update_order_status, razao_social, nome_fantasia, cnpj, telefone, endereco_cep, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_municipio, endereco_uf')
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
    // Merge: shipping_providers.settings tem prioridade; fiscal_settings é fallback (emitente da NFe)
    const rawSettings = (providerRecord.settings || {}) as Record<string, unknown>;
    const fs = (fiscalSettings || {}) as Record<string, any>;
    const settings: Record<string, unknown> = {
      ...rawSettings,
      sender_name: rawSettings.sender_name || fs.nome_fantasia || fs.razao_social || '',
      sender_document: rawSettings.sender_document || fs.cnpj || '',
      sender_phone: rawSettings.sender_phone || fs.telefone || '',
      sender_postal_code: rawSettings.sender_postal_code || fs.endereco_cep || '',
      sender_street: rawSettings.sender_street || fs.endereco_logradouro || '',
      sender_number: rawSettings.sender_number || fs.endereco_numero || '',
      sender_complement: rawSettings.sender_complement || fs.endereco_complemento || '',
      sender_neighborhood: rawSettings.sender_neighborhood || fs.endereco_bairro || '',
      sender_city: rawSettings.sender_city || fs.endereco_municipio || '',
      sender_state: rawSettings.sender_state || fs.endereco_uf || '',
    };

    // Create shipment based on provider
    let result: ShipmentResult;

    switch (provider.toLowerCase()) {
      case 'correios': {
        // Bloqueio: Correios exige NF-e autorizada OU Declaração de Conteúdo emitida.
        // IMPORTANTE: não retornar direto aqui — precisamos cair no branch de falha abaixo
        // para que o rascunho seja marcado como 'failed' e apareça na aba "Pendentes".
        if (!invoiceData && !contentDeclaration) {
          result = {
            success: false,
            error: 'Este pedido não tem Nota Fiscal autorizada nem Declaração de Conteúdo. Emita uma das duas em Fiscal antes de despachar pelos Correios.',
          };
          break;
        }

        // ===== PRÉ-FLIGHT UNIFICADO =====
        // Roda o motor único antes de qualquer chamada à API dos Correios.
        // Se faltar dado obrigatório (destinatário, endereço, telefone, peso,
        // emitente), o erro vai para o rascunho com mensagem em PT-BR e a
        // remessa cai na aba "Pendentes" — sem erros crus vindos da API.
        // Doc: docs/especificacoes/fiscal/preflight-fiscal-logistico.md
        const emitenteForPreflight: PreflightEmitente = {
          razao_social: (settings.sender_name as string) || null,
          cnpj: (settings.sender_document as string) || null,
          ie: (fiscalSettings as any)?.ie || null,
          telefone: (settings.sender_phone as string) || null,
          cep: (settings.sender_postal_code as string) || null,
          logradouro: (settings.sender_street as string) || null,
          numero: (settings.sender_number as string) || null,
          bairro: (settings.sender_neighborhood as string) || null,
          municipio: (settings.sender_city as string) || null,
          uf: (settings.sender_state as string) || null,
        };
        const totalPesoG = orderData.items.reduce(
          (s, it) => s + (Number(it.weight) || 0) * (Number(it.quantity) || 0),
          0,
        );
        const maxH = orderData.items.reduce((m, it) => Math.max(m, Number(it.height) || 0), 0);
        const maxW = orderData.items.reduce((m, it) => Math.max(m, Number(it.width) || 0), 0);
        const sumD = orderData.items.reduce((s, it) => s + (Number(it.length) || 0), 0);
        const preflight = runPreflight({
          scopes: ['shipment', 'emitente'],
          destinatario: {
            nome: orderData.customer_name,
            cpf_cnpj: orderData.customer_cpf || orderData.customer_cnpj,
            telefone: orderData.customer_phone,
            email: orderData.customer_email,
            endereco: {
              cep: orderData.shipping_postal_code,
              logradouro: orderData.shipping_street,
              numero: orderData.shipping_number,
              bairro: orderData.shipping_neighborhood,
              municipio: orderData.shipping_city,
              uf: orderData.shipping_state,
            },
          },
          itens: orderData.items.map((it) => ({
            descricao: it.product_name,
            quantidade: it.quantity,
            valor_unitario: it.unit_price,
            peso_unitario_g: it.weight,
          })),
          package: {
            weight_grams: totalPesoG,
            height_cm: maxH || (override?.height_cm as number) || 10,
            width_cm: maxW || (override?.width_cm as number) || 15,
            depth_cm: sumD || (override?.depth_cm as number) || 20,
            carrier: order.shipping_carrier || shipmentRow?.carrier || 'correios',
            service: shipmentRow?.service_name || order.shipping_method || 'PAC',
          },
          emitente: emitenteForPreflight,
          fiscalLink: { hasNfe: !!invoiceData, hasDC: !!contentDeclaration },
        });
        if (!preflight.ok) {
          console.warn('[shipping-create-shipment] Pré-flight bloqueou emissão:', preflight.blockingIssues);
          result = { success: false, error: preflight.message };
          break;
        }

        const fiscalDoc = invoiceData
          ? {
              kind: 'nfe' as const,
              nfe_numero: invoiceData.numero ?? null,
              nfe_serie: invoiceData.serie ?? null,
              nfe_chave: invoiceData.chave_acesso ?? null,
              nfe_valor: invoiceData.valor_total ?? null,
            }
          : { kind: 'dc' as const, dc_number: contentDeclaration!.dc_number };
        result = await createCorreiosShipment(orderData, credentials, settings, fiscalDoc);
        break;
      }
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
      // ===== Pedido real (quando existir): marca como DESPACHADO já na emissão =====
      // Decisão de negócio: emissão da remessa = despacho (sem botão intermediário).
      // O status "shipped/enviado" só será setado quando o polling detectar o
      // primeiro evento real dos Correios (PO/Postado). Ver tracking-poll.
      if (resolvedOrderId) {
        const orderUpdate: Record<string, unknown> = {
          tracking_code: result.tracking_code,
          shipping_carrier: result.carrier,
          updated_at: new Date().toISOString(),
        };
        if (fiscalSettings?.auto_update_order_status !== false) {
          orderUpdate.shipping_status = 'label_created';
          orderUpdate.status = 'dispatched';
          orderUpdate.shipped_at = new Date().toISOString();
        }
        await supabase.from('orders').update(orderUpdate).eq('id', resolvedOrderId);
        console.log(`[shipping-create-shipment] Order ${resolvedOrderId} marcado como dispatched: ${result.tracking_code}`);
      }

      // Pega service_name/service_code do pedido se houver, senão do próprio rascunho
      let serviceName: string | null = null;
      let serviceCode: string | null = null;
      if (resolvedOrderId) {
        const { data: orderForShip } = await supabase
          .from('orders')
          .select('shipping_service_name, shipping_service_code')
          .eq('id', resolvedOrderId)
          .single();
        serviceName = orderForShip?.shipping_service_name || null;
        serviceCode = orderForShip?.shipping_service_code || null;
      }
      serviceName = (result as any).service_name || serviceName || shipmentRow?.service_name || null;
      serviceCode = (result as any).service_code || serviceCode || shipmentRow?.service_code || null;

      // ===== Baixar etiqueta dos Correios e armazenar no bucket privado =====
      // Sem isso, a 2ª chamada `/etiqueta` nunca acontecia e `label_url` ficava NULL.
      let labelStoragePath: string | null = null;
      if (provider.toLowerCase() === 'correios') {
        try {
          const downloadRes = await downloadAndStoreCorreiosLabel(supabase, {
            tenantId,
            shipmentId: shipmentRow?.id || '',
            trackingCode: result.tracking_code,
            prepostId: result.provider_shipment_id,
            credentials: credentials as any,
          });
          // O shipmentId pode ainda não existir (insert mais abaixo); então fazemos
          // dois passos: 1) tentativa com id existente; 2) fallback após o insert.
          if (downloadRes.success && downloadRes.storage_path) {
            labelStoragePath = downloadRes.storage_path;
          } else {
            console.warn('[shipping-create-shipment] Não foi possível baixar etiqueta agora:', downloadRes.error);
          }
        } catch (e: any) {
          console.error('[shipping-create-shipment] Erro ao baixar etiqueta Correios:', e?.message || e);
        }
      }

      const shipmentPatch: Record<string, unknown> = {
        tracking_code: result.tracking_code,
        // Emissão da etiqueta = "Etiqueta gerada". O status "posted" é
        // reservado para o 1º evento real dos Correios, detectado pelo
        // tracking-poll. No pedido (orders.status) o despacho continua
        // sendo registrado como "dispatched" logo acima.
        delivery_status: 'label_created',
        // Mantém label_url só se conseguimos baixar PDF interno; senão deixa para reimpressão
        label_url: labelStoragePath || result.label_url || null,
        provider_shipment_id: result.provider_shipment_id,
        invoice_id: invoiceData?.id ?? null,
        nfe_key: invoiceData?.chave_acesso ?? null,
        carrier: result.carrier || provider,
        service_name: serviceName,
        service_code: serviceCode,
        last_status_at: new Date().toISOString(),
        next_poll_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        poll_error_count: 0,
      };


      let finalShipmentId = shipmentRow?.id || null;
      if (shipmentRow?.id) {
        // Atualiza o rascunho exato (vínculo canônico via PV)
        await supabase.from('shipments').update(shipmentPatch).eq('id', shipmentRow.id);
      } else {
        // Sem rascunho — cria novo registro já amarrado ao PV (canônico) ou ao pedido real (legado)
        const { data: inserted } = await supabase.from('shipments').insert({
          tenant_id: tenantId,
          order_id: resolvedOrderId,
          source_pedido_venda_id: resolvedPvId,
          ...shipmentPatch,
        }).select('id').single();
        finalShipmentId = inserted?.id || null;

        // Se a etiqueta não foi baixada antes (sem shipmentId), tenta agora
        if (!labelStoragePath && finalShipmentId && provider.toLowerCase() === 'correios') {
          try {
            const downloadRes = await downloadAndStoreCorreiosLabel(supabase, {
              tenantId,
              shipmentId: finalShipmentId,
              trackingCode: result.tracking_code,
              prepostId: result.provider_shipment_id,
              credentials: credentials as any,
            });
            if (downloadRes.success && downloadRes.storage_path) {
              await supabase.from('shipments')
                .update({ label_url: downloadRes.storage_path })
                .eq('id', finalShipmentId);
            }
          } catch (e: any) {
            console.error('[shipping-create-shipment] Etiqueta pós-insert falhou:', e?.message || e);
          }
        }
      }

      // Log no histórico do pedido (só quando há pedido real)
      if (resolvedOrderId) {
        await supabase
          .from('order_history')
          .insert({
            order_id: resolvedOrderId,
            action: 'dispatched',
            description: `Remessa emitida e despachada via ${result.carrier}. Rastreio: ${result.tracking_code}`,
          });
      }

      // ===== Evento canônico: remessa despachada =====
      // Consumido por process-events → notification_rules (trigger_condition=dispatched)
      if (finalShipmentId) {
        const idempKey = `shipment_dispatched_${finalShipmentId}`;
        await supabase.from('events_inbox').insert({
          tenant_id: tenantId,
          provider: 'internal',
          event_type: 'shipment.dispatched',
          idempotency_key: idempKey,
          occurred_at: new Date().toISOString(),
          payload_normalized: {
            shipment_id: finalShipmentId,
            order_id: resolvedOrderId,
            pedido_venda_id: resolvedPvId,
            tracking_code: result.tracking_code,
            carrier: result.carrier || provider,
          },
          status: 'new',
        }).then(({ error: evErr }) => {
          if (evErr && !String(evErr.message || '').includes('duplicate')) {
            console.error('[shipping-create-shipment] events_inbox shipment.dispatched error:', evErr);
          }
        });
      }

      // ===== WMS Pratika: fire-and-forget, respeita travas do tenant =====
      // Antes só era chamado no caminho manual de rastreio. Agora também no automático.
      if (invoiceData?.id) {
        fetch(`${supabaseUrl}/functions/v1/wms-pratika-send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            action: 'update_tracking',
            invoice_id: invoiceData.id,
            tracking_code: result.tracking_code,
            tenant_id: tenantId,
          }),
        }).catch(err => console.error('[shipping-create-shipment] WMS Pratika error:', err));
      }

      console.log(`[shipping-create-shipment] Shipment despachado (shipment=${finalShipmentId})`);
    } else if (!result.success) {
      // Marca rascunho como failed e grava o motivo do erro no metadata
      // para que apareça legível na aba "Pendentes".
      const errorMessage = result.error || 'Falha desconhecida ao emitir remessa';
      const failedMetadata = {
        ...((shipmentRow?.metadata as any) || {}),
        error_message: errorMessage,
        last_error_at: new Date().toISOString(),
      };
      if (shipmentRow?.id) {
        await supabase
          .from('shipments')
          .update({
            delivery_status: 'failed',
            last_status_at: new Date().toISOString(),
            metadata: failedMetadata,
          })
          .eq('id', shipmentRow.id);
      } else if (resolvedPvId) {
        await supabase
          .from('shipments')
          .update({
            delivery_status: 'failed',
            last_status_at: new Date().toISOString(),
            metadata: failedMetadata,
          })
          .eq('source_pedido_venda_id', resolvedPvId)
          .eq('tenant_id', tenantId)
          .eq('delivery_status', 'draft');
      } else if (resolvedOrderId) {
        await supabase
          .from('shipments')
          .update({
            delivery_status: 'failed',
            last_status_at: new Date().toISOString(),
            metadata: failedMetadata,
          })
          .eq('order_id', resolvedOrderId)
          .eq('tenant_id', tenantId)
          .eq('delivery_status', 'draft');
      }
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return errorResponse(error, corsHeaders, { module: 'shipping', action: 'create-shipment' });
  }
});
