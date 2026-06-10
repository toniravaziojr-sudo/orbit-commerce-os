import { errorResponse } from "../_shared/error-response.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { syncEmpresa, getEmpresa, type FocusNFeConfig } from "../_shared/focus-nfe-client.ts";
import { resolveFocusCredentials } from "../_shared/focus-credentials.ts";
import { buildEmpresaPayload } from "../_shared/focus-nfe-adapter.ts";
import { chargeAfter } from "../_shared/credits/charge-after.ts";

import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  await loadPlatformCredentials();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // Operação ADMINISTRATIVA da conta Focus → token resolvido como account_admin abaixo.

    // Autenticar: aceita JWT do usuário OU chamada interna service-role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const isServiceRoleCall = authHeader === `Bearer ${supabaseServiceKey}`;

    let tenantId: string;
    if (isServiceRoleCall) {
      // Chamada interna: tenant_id obrigatório no body
      const bodyTmp = await req.clone().json().catch(() => ({}));
      if (!bodyTmp?.tenant_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'tenant_id é obrigatório em chamada interna' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      tenantId = bodyTmp.tenant_id;
      console.log(`[fiscal-sync-focus-nfe] Chamada interna service-role. tenant=${tenantId}`);
    } else {
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
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('current_tenant_id')
        .eq('id', user.id)
        .single();
      if (!profile?.current_tenant_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Tenant não encontrado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      tenantId = profile.current_tenant_id;
    }

    // Buscar fiscal_settings
    const { data: settings, error: settingsError } = await supabaseClient
      .from('fiscal_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ success: false, error: 'Configurações fiscais não encontradas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar dados obrigatórios
    if (!settings.cnpj || !settings.razao_social) {
      return new Response(
        JSON.stringify({ success: false, error: 'CNPJ e Razão Social são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Configuração Focus NFe — admin da conta usa o token PRINCIPAL DA CONTA.
    const ambiente = (settings.focus_ambiente || settings.ambiente || 'homologacao') as 'homologacao' | 'producao';
    const creds = resolveFocusCredentials({ ambiente, operationKind: 'account_admin' });
    if (!creds.ok || !creds.token) {
      return new Response(
        JSON.stringify({ success: false, error: creds.error, code: creds.errorCode }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // baseUrl vem do resolver: account_admin sempre roda contra api.focusnfe.com.br
    // (o domínio de homologação não expõe /v2/empresas e retorna "endpoint não encontrado").
    const focusConfig: FocusNFeConfig = { token: creds.token, ambiente, baseUrl: creds.baseUrl };

    console.log(`[fiscal-sync-focus-nfe] Sincronizando empresa ${settings.cnpj} no ambiente ${focusConfig.ambiente} | crt=${JSON.stringify(settings.crt)} typeof=${typeof settings.crt}`);

    // Preparar certificado se disponível
    let certificado: { pfxBase64: string; password: string } | undefined;
    
    if (settings.certificado_pfx && settings.certificado_senha) {
      try {
        const encryptionKey = Deno.env.get('FISCAL_ENCRYPTION_KEY');
        if (encryptionKey) {
          // Usar loadTenantCertificate que já faz toda a descriptografia
          const { loadTenantCertificate } = await import("../_shared/certificate-utils.ts");
          
          certificado = await loadTenantCertificate(
            {
              certificado_pfx: settings.certificado_pfx,
              certificado_senha: settings.certificado_senha,
              certificado_valido_ate: settings.certificado_valido_ate,
            },
            encryptionKey
          );
          
          // SECURITY: nunca logar amostra do PFX descriptografado, mesmo curta.
          console.log('[fiscal-sync-focus-nfe] Certificado descriptografado com sucesso (conteúdo não logado por segurança)');
        } else {
          console.warn('[fiscal-sync-focus-nfe] FISCAL_ENCRYPTION_KEY não configurada');
        }
      } catch (error: any) {
        console.error('[fiscal-sync-focus-nfe] Erro ao processar certificado:', error.message);
        // Continuar sem certificado - a empresa será cadastrada mas NF-e não poderá ser emitida
      }
    }

    // Montar payload da empresa - mapeando campos corretos do banco
    const empresaPayload = buildEmpresaPayload({
      cnpj: settings.cnpj,
      razao_social: settings.razao_social,
      nome_fantasia: settings.nome_fantasia,
      inscricao_estadual: settings.inscricao_estadual,
      inscricao_municipal: settings.inscricao_municipal,
      crt: settings.crt, // adapter aceita string | number
      // Mapeamento correto: banco usa endereco_* prefix
      logradouro: settings.endereco_logradouro || '',
      numero: settings.endereco_numero || 'S/N',
      complemento: settings.endereco_complemento,
      bairro: settings.endereco_bairro || '',
      cidade: settings.endereco_municipio || '',
      uf: settings.endereco_uf || '',
      cep: settings.endereco_cep || '',
      telefone: settings.telefone,
      email: settings.email,
    }, certificado);
    
    // SECURITY: nunca logar arquivo_certificado_base64 nem senha_certificado.
    const _safePayload = { ...empresaPayload, arquivo_certificado_base64: '[REDACTED]', senha_certificado: '[REDACTED]' };
    console.log('[fiscal-sync-focus-nfe] Payload empresa (sanitizado):', JSON.stringify(_safePayload).substring(0, 500));

    // Verificar se empresa já existe na Focus NFe
    let empresaId = settings.focus_empresa_id;

    if (!empresaId) {
      const checkResult = await getEmpresa(focusConfig, empresaPayload.cnpj);
      if (checkResult.success && checkResult.data?.id) {
        empresaId = checkResult.data.id;
        console.log(`[fiscal-sync-focus-nfe] Empresa já existe na Focus NFe: ${empresaId}`);
      }
    }

    // Sincronizar (PUT se já existe; se PUT falhar com "não encontrado", cai para POST)
    let result = await syncEmpresa(focusConfig, empresaPayload, empresaId || undefined);
    if (!result.success && empresaId && /n[aã]o.{0,15}(encontrad|localizad)/i.test(result.error || '')) {
      console.warn('[fiscal-sync-focus-nfe] Empresa não encontrada via PUT, recriando via POST...');
      result = await syncEmpresa(focusConfig, empresaPayload, undefined);
    }

    if (!result.success) {
      console.error(`[fiscal-sync-focus-nfe] Erro ao sincronizar:`, result.error);
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar fiscal_settings com ID da empresa Focus NFe
    const newEmpresaId = result.data?.id || result.data?.cnpj || empresaId;

    // Buscar snapshot completo da empresa na Focus para obter metadados do certificado
    // (PUT/POST nem sempre devolvem certificado_valido_ate / certificado_cnpj).
    let focusSnapshot: any = result.data || {};
    try {
      const snap = await getEmpresa(focusConfig, String(newEmpresaId));
      if (snap.success && snap.data) {
        focusSnapshot = { ...focusSnapshot, ...snap.data };
      }
    } catch (e) {
      console.warn('[fiscal-sync-focus-nfe] Falha ao buscar snapshot da empresa:', e);
    }

    const certValidoAteRaw =
      focusSnapshot.certificado_valido_ate ||
      focusSnapshot.certificado_validade ||
      null;
    const certCnpjRaw =
      focusSnapshot.certificado_cnpj ||
      (result.data?.cnpj ?? settings.cnpj ?? '');
    const certCnRaw =
      focusSnapshot.nome ||
      focusSnapshot.razao_social ||
      settings.razao_social ||
      null;

    const updatePayload: Record<string, any> = {
      focus_empresa_id: newEmpresaId,
      focus_empresa_criada_em: empresaId ? undefined : new Date().toISOString(),
      focus_ultima_sincronizacao: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (certValidoAteRaw) {
      updatePayload.certificado_valido_ate = new Date(certValidoAteRaw).toISOString();
      updatePayload.certificado_cnpj = String(certCnpjRaw).replace(/\D/g, '') || null;
      updatePayload.certificado_cn = certCnRaw;
    }

    // ----------------------------------------------------------------
    // CAPTURA AUTOMÁTICA DOS TOKENS DA EMPRESA
    // ----------------------------------------------------------------
    // A Focus NFe devolve `token_producao` e `token_homologacao` na resposta
    // dos endpoints administrativos (POST/PUT/GET /v2/empresas/{cnpj}) quando
    // autenticado com o token PRINCIPAL DA CONTA. O lojista NÃO precisa colar
    // esses tokens. Eles são gravados em colunas com SELECT revogado para
    // authenticated/anon — só rotinas com service_role conseguem ler.
    // NUNCA logar o valor.
    const tokenProd = typeof focusSnapshot.token_producao === 'string'
      ? focusSnapshot.token_producao.trim() : '';
    const tokenHom = typeof focusSnapshot.token_homologacao === 'string'
      ? focusSnapshot.token_homologacao.trim() : '';
    if (tokenProd) updatePayload.focus_token_producao = tokenProd;
    if (tokenHom) updatePayload.focus_token_homologacao = tokenHom;
    console.log('[fiscal-sync-focus-nfe] Tokens capturados automaticamente', {
      producao_capturado: !!tokenProd,
      homologacao_capturado: !!tokenHom,
    });

    // Para readiness, considerar tokens já existentes (se a Focus não devolver)
    const { data: tokenStatus } = await supabaseClient
      .from('fiscal_settings')
      .select('focus_token_producao, focus_token_homologacao')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    const hasProdToken = !!(tokenProd || (tokenStatus as any)?.focus_token_producao);
    const hasHomToken = !!(tokenHom || (tokenStatus as any)?.focus_token_homologacao);
    const ambienteToken = ambiente === 'producao' ? hasProdToken : hasHomToken;

    // Recalcular is_configured com base nos requisitos canônicos
    const certValid = updatePayload.certificado_valido_ate
      ? new Date(updatePayload.certificado_valido_ate) > new Date()
      : (settings.certificado_valido_ate ? new Date(settings.certificado_valido_ate) > new Date() : false);
    const hasCert = !!settings.certificado_pfx;
    updatePayload.is_configured = !!(
      settings.razao_social &&
      settings.cnpj &&
      (settings.ie_isento || settings.inscricao_estadual) &&
      settings.endereco_logradouro &&
      settings.endereco_numero &&
      settings.endereco_municipio &&
      settings.endereco_uf &&
      settings.endereco_cep &&
      settings.serie_nfe &&
      hasCert && certValid &&
      ambienteToken
    );

    const { error: updateError } = await supabaseClient
      .from('fiscal_settings')
      .update(updatePayload)
      .eq('tenant_id', tenantId);

    if (updateError) {
      console.error(`[fiscal-sync-focus-nfe] Erro ao atualizar settings:`, updateError);
    }

    console.log(`[fiscal-sync-focus-nfe] Empresa sincronizada com sucesso: ${newEmpresaId}`);

    chargeAfter({
      tenantId,
      serviceKey: "focus-nfe-sync",
      units: { count: 1 },
      jobId: `focus-sync-${tenantId}-${Date.now()}`,
      feature: "fiscal-sync-focus-nfe",
    }).catch(() => {});

    return new Response(
      JSON.stringify({
        success: true,
        empresa_id: newEmpresaId,
        certificado_validade: result.data?.certificado_validade,
        message: empresaId ? 'Empresa atualizada' : 'Empresa cadastrada',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return errorResponse(error, corsHeaders, { module: 'fiscal', action: 'sync-focus-nfe' });
  }
});
