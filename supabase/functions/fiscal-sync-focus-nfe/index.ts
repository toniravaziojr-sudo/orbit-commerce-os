import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { syncEmpresa, getEmpresa, type FocusNFeConfig } from "../_shared/focus-nfe-client.ts";
import { buildEmpresaPayload } from "../_shared/focus-nfe-adapter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const focusToken = Deno.env.get('FOCUS_NFE_TOKEN');
    
    if (!focusToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token Focus NFe não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Autenticar usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Obter usuário e tenant
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

    const tenantId = profile.current_tenant_id;

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

    // Configuração Focus NFe
    const focusConfig: FocusNFeConfig = {
      token: focusToken,
      ambiente: (settings.focus_ambiente || settings.ambiente || 'homologacao') as 'homologacao' | 'producao',
    };

    console.log(`[fiscal-sync-focus-nfe] Sincronizando empresa ${settings.cnpj} no ambiente ${focusConfig.ambiente}`);

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
          
          console.log('[fiscal-sync-focus-nfe] Certificado descriptografado com sucesso', {
            pfxBase64Length: certificado.pfxBase64.length,
            pfxSample: certificado.pfxBase64.substring(0, 50),
          });
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
      crt: settings.crt?.toString(),
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
    
    console.log('[fiscal-sync-focus-nfe] Payload empresa:', JSON.stringify(empresaPayload, null, 2));

    // Verificar se empresa já existe na Focus NFe
    let empresaId = settings.focus_empresa_id;
    
    if (!empresaId) {
      // Tentar buscar pelo CNPJ
      const checkResult = await getEmpresa(focusConfig, empresaPayload.cnpj);
      if (checkResult.success && checkResult.data?.id) {
        empresaId = checkResult.data.id;
        console.log(`[fiscal-sync-focus-nfe] Empresa já existe na Focus NFe: ${empresaId}`);
      }
    }

    // Sincronizar (criar ou atualizar)
    const result = await syncEmpresa(focusConfig, empresaPayload, empresaId || undefined);

    if (!result.success) {
      console.error(`[fiscal-sync-focus-nfe] Erro ao sincronizar:`, result.error);
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar fiscal_settings com ID da empresa Focus NFe
    const newEmpresaId = result.data?.id || result.data?.cnpj || empresaId;
    
    const { error: updateError } = await supabaseClient
      .from('fiscal_settings')
      .update({
        focus_empresa_id: newEmpresaId,
        focus_empresa_criada_em: empresaId ? undefined : new Date().toISOString(),
        focus_ultima_sincronizacao: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId);

    if (updateError) {
      console.error(`[fiscal-sync-focus-nfe] Erro ao atualizar settings:`, updateError);
    }

    console.log(`[fiscal-sync-focus-nfe] Empresa sincronizada com sucesso: ${newEmpresaId}`);

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
    console.error('[fiscal-sync-focus-nfe] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
