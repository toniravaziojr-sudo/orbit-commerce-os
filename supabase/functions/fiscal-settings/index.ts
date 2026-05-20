// =============================================
// FISCAL SETTINGS - CRUD das Configurações Fiscais
// GET: Retorna config do tenant (token mascarado)
// POST: Salva/atualiza configuração
// =============================================
import { errorResponse } from "../_shared/error-response.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeOptionalText(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user token for RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
      console.error('[fiscal-settings] Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.current_tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'No tenant selected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = profile.current_tenant_id;

    // Lote 1.C.1: RBAC — diferenciar owner/admin (acesso completo) de demais perfis
    // (operator/support/finance/viewer recebem apenas payload mínimo operacional).
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: ownerCheck } = await adminClient.rpc('has_role', {
      _user_id: user.id, _tenant_id: tenantId, _role: 'owner',
    });
    const { data: adminCheck } = await adminClient.rpc('has_role', {
      _user_id: user.id, _tenant_id: tenantId, _role: 'admin',
    });
    const isOwnerOrAdmin = !!ownerCheck || !!adminCheck;

    // GET - Fetch settings
    if (req.method === 'GET') {
      console.log('[fiscal-settings] GET for tenant:', tenantId, 'isOwnerOrAdmin:', isOwnerOrAdmin);

      const { data: settings, error } = await supabase
        .from('fiscal_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        console.error('[fiscal-settings] Query error:', error);
        throw error;
      }

      // Operator/support/finance/viewer: payload mínimo, sem segredos nem campos sensíveis.
      if (!isOwnerOrAdmin) {
        const minimal = settings ? {
          tenant_id: settings.tenant_id,
          is_configured: !!settings.is_configured,
          ambiente: settings.ambiente ?? null,
          provider: settings.provider ?? null,
          razao_social: settings.razao_social ?? null,
          // Nada de PFX, senha, token, série, CNAE, CSOSN, endereço, próximo número, etc.
        } : null;
        return new Response(
          JSON.stringify({ success: true, settings: minimal, role_view: 'minimal' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Owner/Admin: payload completo, com token mascarado e PFX/senha removidos.
      let maskedSettings = settings;
      if (settings) {
        maskedSettings = {
          ...settings,
          provider_token: settings.provider_token
            ? settings.provider_token.substring(0, 8) + '****'
            : null,
          // Remove encrypted data from response - only return metadata
          certificado_pfx: null,
          certificado_senha: null,
        };
      }

      return new Response(
        JSON.stringify({ success: true, settings: maskedSettings, role_view: 'full' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Save/update settings (apenas owner/admin)
    if (req.method === 'POST' && !isOwnerOrAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Apenas owner ou admin podem alterar configurações fiscais.', code: 'FORBIDDEN_ROLE' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // POST - Save/update settings
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('[fiscal-settings] POST for tenant:', tenantId, 'body keys:', Object.keys(body));

      // Validate required fields for configuration
      const {
        razao_social,
        cnpj,
        inscricao_estadual,
        ie_isento,
        endereco_logradouro,
        endereco_numero,
        endereco_bairro,
        endereco_municipio,
        endereco_municipio_codigo,
        endereco_uf,
        endereco_cep,
        crt,
        cfop_intrastadual,
        cfop_interestadual,
        csosn_padrao,
        cst_padrao,
        serie_nfe,
        numero_nfe_atual,
        provider,
        provider_token,
        ambiente,
        emissao_automatica,
        emitir_apos_status,
        nome_fantasia,
        endereco_complemento,
        cnae,
        origem_fiscal_padrao,
        email,
        telefone,
      } = body;

      const normalizedEmail = normalizeOptionalText(email)?.toLowerCase() ?? null;
      const normalizedTelefone = normalizeOptionalText(telefone);

      // Check existing certificate data for is_configured validation
      const { data: existingCert } = await supabase
        .from('fiscal_settings')
        .select('certificado_pfx, certificado_valido_ate')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const hasCertificate = !!existingCert?.certificado_pfx;
      const certValid = existingCert?.certificado_valido_ate 
        ? new Date(existingCert.certificado_valido_ate) > new Date() 
        : false;

      // Check if is_configured based on required fields (certificate replaces provider_token)
      const is_configured = !!(
        razao_social &&
        cnpj &&
        (ie_isento || inscricao_estadual) &&
        endereco_logradouro &&
        endereco_numero &&
        endereco_municipio &&
        endereco_uf &&
        endereco_cep &&
        serie_nfe &&
        hasCertificate && certValid
      );

      // Check if record exists
      const { data: existing } = await supabase
        .from('fiscal_settings')
        .select('id, provider_token')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      // Determine token to save (keep existing if masked token sent)
      let tokenToSave = provider_token;
      if (provider_token && provider_token.includes('****') && existing?.provider_token) {
        // User sent masked token, keep the existing one
        tokenToSave = existing.provider_token;
      }

      const normalizedCrt = Number(crt) || 1;
      const normalizedRegimeTributario =
        normalizedCrt === 4
          ? 'mei'
          : normalizedCrt === 3
            ? 'lucro_presumido'
            : 'simples_nacional';

      const settingsData = {
        tenant_id: tenantId,
        razao_social,
        nome_fantasia,
        cnpj,
        inscricao_estadual,
        ie_isento: ie_isento || false,
        cnae,
        endereco_logradouro,
        endereco_numero,
        endereco_complemento,
        endereco_bairro,
        endereco_municipio,
        endereco_municipio_codigo,
        endereco_uf,
        endereco_cep,
        crt: normalizedCrt,
        regime_tributario: normalizedRegimeTributario,
        cfop_intrastadual: cfop_intrastadual || '5102',
        cfop_interestadual: cfop_interestadual || '6102',
        csosn_padrao,
        cst_padrao,
        serie_nfe: serie_nfe || 1,
        numero_nfe_atual: numero_nfe_atual || 1,
        provider: provider || 'focusnfe',
        provider_token: tokenToSave,
        ambiente: ambiente || 'homologacao',
        emissao_automatica: emissao_automatica || false,
        emitir_apos_status: emitir_apos_status || 'paid',
        origem_fiscal_padrao: origem_fiscal_padrao ?? 0,
        email: normalizedEmail,
        telefone: normalizedTelefone,
        is_configured,
      };

      let result;
      if (existing) {
        // Update
        const { data, error } = await supabase
          .from('fiscal_settings')
          .update(settingsData)
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        result = data;
      } else {
        // Insert
        const { data, error } = await supabase
          .from('fiscal_settings')
          .insert(settingsData)
          .select()
          .single();
        
        if (error) throw error;
        result = data;
      }

      // Mask token in response
      if (result?.provider_token) {
        result.provider_token = result.provider_token.substring(0, 8) + '****';
      }

      const savedEmail = normalizeOptionalText(result?.email)?.toLowerCase() ?? null;
      const savedTelefone = normalizeOptionalText(result?.telefone);

      if (savedEmail !== normalizedEmail || savedTelefone !== normalizedTelefone) {
        const { data: confirmedSettings, error: confirmError } = await supabase
          .from('fiscal_settings')
          .select('*')
          .eq('tenant_id', tenantId)
          .single();

        if (confirmError) throw confirmError;

        const confirmedEmail = normalizeOptionalText(confirmedSettings?.email)?.toLowerCase() ?? null;
        const confirmedTelefone = normalizeOptionalText(confirmedSettings?.telefone);

        if (confirmedEmail !== normalizedEmail || confirmedTelefone !== normalizedTelefone) {
          console.error('[fiscal-settings] Contact persistence mismatch after save', {
            tenantId,
            hasEmailInRequest: !!normalizedEmail,
            hasTelefoneInRequest: !!normalizedTelefone,
            hasEmailPersisted: !!confirmedEmail,
            hasTelefonePersisted: !!confirmedTelefone,
          });

          return new Response(
            JSON.stringify({ success: false, error: 'Não foi possível confirmar o salvamento do contato do emitente. Tente novamente.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        result = confirmedSettings;

        if (result?.provider_token) {
          result.provider_token = result.provider_token.substring(0, 8) + '****';
        }
      }

      console.log('[fiscal-settings] Saved successfully, is_configured:', is_configured);

      return new Response(
        JSON.stringify({ success: true, settings: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    return errorResponse(error, corsHeaders, { module: 'fiscal', action: 'settings' });
  }
});
