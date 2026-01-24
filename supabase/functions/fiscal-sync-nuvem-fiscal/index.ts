import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { syncEmpresa, type NuvemFiscalConfig } from "../_shared/nuvem-fiscal-client.ts";
import { buildEmpresaPayload, buildCertificadoPayload } from "../_shared/nuvem-fiscal-adapter.ts";

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
    const nuvemFiscalClientId = Deno.env.get('NUVEM_FISCAL_CLIENT_ID');
    const nuvemFiscalClientSecret = Deno.env.get('NUVEM_FISCAL_CLIENT_SECRET');
    
    if (!nuvemFiscalClientId || !nuvemFiscalClientSecret) {
      return new Response(
        JSON.stringify({ success: false, error: 'Credenciais Nuvem Fiscal não configuradas' }),
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

    // Configuração Nuvem Fiscal
    const nuvemFiscalConfig: NuvemFiscalConfig = {
      clientId: nuvemFiscalClientId,
      clientSecret: nuvemFiscalClientSecret,
      ambiente: (settings.ambiente || 'homologacao') as 'homologacao' | 'producao',
    };

    console.log(`[fiscal-sync-nuvem-fiscal] Sincronizando empresa ${settings.cnpj} no ambiente ${nuvemFiscalConfig.ambiente}`);

    // Preparar certificado se disponível
    let certificado: { certificado: string; password: string } | undefined;
    
    if (settings.certificado_pfx && settings.certificado_senha) {
      try {
        const encryptionKey = Deno.env.get('FISCAL_ENCRYPTION_KEY');
        if (encryptionKey) {
          // Usar loadTenantCertificate que já faz toda a descriptografia
          const { loadTenantCertificate } = await import("../_shared/certificate-utils.ts");
          
          const certData = await loadTenantCertificate(
            {
              certificado_pfx: settings.certificado_pfx,
              certificado_senha: settings.certificado_senha,
              certificado_valido_ate: settings.certificado_valido_ate,
            },
            encryptionKey
          );
          
          certificado = buildCertificadoPayload(certData.pfxBase64, certData.password);
          
          console.log('[fiscal-sync-nuvem-fiscal] Certificado descriptografado com sucesso');
        }
      } catch (certError: any) {
        console.error('[fiscal-sync-nuvem-fiscal] Erro ao carregar certificado:', certError);
        // Continua sem certificado - pode ser adicionado depois
      }
    }

    // Buscar código IBGE do município
    let codigoMunicipio = settings.codigo_municipio;
    
    if (!codigoMunicipio && settings.cidade && settings.uf) {
      // Tentar buscar na tabela de municípios
      const { data: municipio } = await supabaseClient
        .rpc('get_ibge_municipio_codigo', {
          p_cidade: settings.cidade,
          p_uf: settings.uf
        });
      
      if (municipio) {
        codigoMunicipio = municipio;
        console.log(`[fiscal-sync-nuvem-fiscal] Código IBGE encontrado: ${codigoMunicipio}`);
      }
    }

    // Construir payload da empresa
    const empresaPayload = buildEmpresaPayload({
      cnpj: settings.cnpj,
      razao_social: settings.razao_social,
      nome_fantasia: settings.nome_fantasia,
      inscricao_estadual: settings.inscricao_estadual,
      inscricao_municipal: settings.inscricao_municipal,
      crt: settings.crt,
      logradouro: settings.logradouro || '',
      numero: settings.numero || '',
      complemento: settings.complemento,
      bairro: settings.bairro || '',
      cidade: settings.cidade || '',
      codigo_municipio: codigoMunicipio,
      uf: settings.uf || '',
      cep: settings.cep || '',
      telefone: settings.telefone,
      email: settings.email,
    });

    // Sincronizar empresa na Nuvem Fiscal
    const result = await syncEmpresa(nuvemFiscalConfig, empresaPayload, certificado);

    if (!result.success) {
      console.error('[fiscal-sync-nuvem-fiscal] Erro ao sincronizar:', result.error);
      
      // Atualizar status de erro
      await supabaseClient
        .from('fiscal_settings')
        .update({
          sync_status: 'error',
          sync_error: result.error,
          synced_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId);

      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fiscal-sync-nuvem-fiscal] Empresa sincronizada com sucesso:', result.data);

    // Atualizar status de sucesso
    await supabaseClient
      .from('fiscal_settings')
      .update({
        sync_status: 'synced',
        sync_error: null,
        synced_at: new Date().toISOString(),
        nuvem_fiscal_id: result.data?.cpf_cnpj,
        certificado_valido_ate: result.data?.certificado?.validade || settings.certificado_valido_ate,
      })
      .eq('tenant_id', tenantId);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Empresa sincronizada com sucesso na Nuvem Fiscal',
        data: {
          cnpj: result.data?.cpf_cnpj,
          razaoSocial: result.data?.razao_social,
          certificadoValidade: result.data?.certificado?.validade,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[fiscal-sync-nuvem-fiscal] Erro não tratado:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
