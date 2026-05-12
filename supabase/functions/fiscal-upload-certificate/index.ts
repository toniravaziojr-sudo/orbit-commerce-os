// =============================================
// FISCAL UPLOAD CERTIFICATE - Upload de Certificado A1
// =============================================
// ARQUITETURA (Caminho B - delegação ao Focus NFe):
// - NÃO abrimos o .pfx aqui. A leitura local (PKI.js / forge) era frágil
//   no runtime de borda e quebrava certificados modernos (AES-256/PBES2).
// - Estratégia: salvamos o .pfx cifrado e a senha cifrada, depois chamamos
//   a sincronização com o Focus NFe, que é quem valida senha, integridade,
//   expiração, CNPJ e cifra. Os metadados (CN, validade, CNPJ, serial) são
//   preenchidos a partir da resposta do Focus.
// - Erros do Focus são traduzidos para PT-BR amigável.
// - Envelope: 200 OK + success:false para erros de negócio.
// =============================================
import { errorResponse } from "../_shared/error-response.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
// deno-lint-ignore-file no-explicit-any
import { translateFocusCertificateError, isCertificateRelatedError } from "../_shared/focus-error-translator.ts";

import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AES-CBC encryption usando Web Crypto API
async function encryptData(data: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key.padEnd(32, '0').slice(0, 32));
  const iv = crypto.getRandomValues(new Uint8Array(16));

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    encoder.encode(data)
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  await loadPlatformCredentials();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const encryptionKey = Deno.env.get('FISCAL_ENCRYPTION_KEY');

    if (!encryptionKey) {
      console.error('[fiscal-upload-certificate] FISCAL_ENCRYPTION_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Chave de criptografia não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sessão expirada. Faça login novamente.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('[fiscal-upload-certificate] Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Sessão expirada. Faça login novamente.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.current_tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nenhuma loja selecionada. Selecione uma loja antes de enviar o certificado.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = profile.current_tenant_id;
    console.log('[fiscal-upload-certificate] Processing for tenant:', tenantId);

    const contentType = req.headers.get('content-type') || '';
    let pfxBase64: string;
    let password: string;

    if (contentType.includes('application/json')) {
      const body = await req.json();
      pfxBase64 = body.pfx_base64;
      password = body.password;
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Formato de envio inválido. Tente novamente pela tela de configurações fiscais.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pfxBase64 || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Selecione o arquivo do certificado e informe a senha.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanity mínima: detectar PEM disfarçado e arquivos obviamente inválidos
    if (/-----BEGIN /.test(pfxBase64)) {
      return new Response(
        JSON.stringify({ success: false, error: 'O arquivo enviado está em formato PEM, não PKCS#12 (.pfx). Reexporte como .pfx com senha.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let firstByte = -1;
    try {
      firstByte = atob(pfxBase64.slice(0, 8)).charCodeAt(0);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Arquivo de certificado inválido. Reenvie o arquivo .pfx.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (firstByte !== 0x30) {
      return new Response(
        JSON.stringify({ success: false, error: 'O arquivo enviado não tem assinatura de PKCS#12 (.pfx). Reexporte o certificado e tente novamente.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fiscal-upload-certificate] Encrypting and storing certificate (validation will run via Focus NFe)...');

    const encryptedPfx = await encryptData(pfxBase64, encryptionKey);
    const encryptedPassword = await encryptData(password, encryptionKey);

    // Salva o cert cifrado SEM metadados (CN/validade/CNPJ virão do Focus).
    // Limpa quaisquer metadados de cert anterior para evitar UI inconsistente.
    const { data: existing } = await supabase
      .from('fiscal_settings')
      .select('id, focus_empresa_id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const certificateData: Record<string, any> = {
      certificado_pfx: encryptedPfx,
      certificado_senha: encryptedPassword,
      certificado_uploaded_at: new Date().toISOString(),
      // Metadados serão preenchidos pela sincronização com o Focus NFe
      certificado_valido_ate: null,
      certificado_cn: null,
      certificado_serial: null,
      certificado_cnpj: null,
    };

    let savedRow: any;
    if (existing) {
      const { data, error } = await supabase
        .from('fiscal_settings')
        .update(certificateData)
        .eq('id', existing.id)
        .select('id, certificado_uploaded_at, cnpj, razao_social, focus_empresa_id')
        .single();
      if (error) throw error;
      savedRow = data;
    } else {
      const { data, error } = await supabase
        .from('fiscal_settings')
        .insert({ tenant_id: tenantId, ...certificateData })
        .select('id, certificado_uploaded_at, cnpj, razao_social, focus_empresa_id')
        .single();
      if (error) throw error;
      savedRow = data;
    }

    console.log('[fiscal-upload-certificate] Certificate stored. Triggering Focus NFe sync for validation...');

    // Validação via Focus NFe: a sincronização da empresa carrega o cert,
    // valida senha, integridade, expiração e CNPJ no servidor do Focus.
    const focusToken = Deno.env.get('FOCUS_NFE_TOKEN');

    if (!focusToken) {
      // Sem Focus configurado, não conseguimos validar — devolvemos sucesso parcial
      // para que o lojista possa pelo menos preencher dados e tentar depois.
      return new Response(
        JSON.stringify({
          success: true,
          status: 'pending_validation',
          message: 'Certificado armazenado com segurança. A validação fiscal será concluída quando a integração com o Focus NFe estiver ativa.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Empresa incompleta? Não tem como o Focus validar sem CNPJ + razão social.
    if (!savedRow.cnpj || !savedRow.razao_social) {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'pending_validation',
          message: 'Certificado armazenado com segurança. Preencha os dados da empresa (CNPJ e razão social) e salve para concluir a validação.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Dispara sync — quem responde define se o certificado é válido
    let syncBody: any = null;
    try {
      const syncResponse = await fetch(`${supabaseUrl}/functions/v1/fiscal-sync-focus-nfe`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      syncBody = await syncResponse.json().catch(() => null);
    } catch (e: any) {
      console.error('[fiscal-upload-certificate] Falha ao chamar sync:', e?.message);
      return new Response(
        JSON.stringify({
          success: true,
          status: 'pending_validation',
          message: 'Certificado armazenado, mas a validação fiscal está temporariamente indisponível. Tente sincronizar em alguns minutos.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (syncBody?.success) {
      // Sync deu certo. Re-lê os metadados que o sync persistiu (validade vinda do Focus).
      const { data: refreshed } = await supabase
        .from('fiscal_settings')
        .select('certificado_cn, certificado_valido_ate, certificado_serial, certificado_cnpj, certificado_uploaded_at, focus_empresa_id')
        .eq('tenant_id', tenantId)
        .single();

      const validUntil = refreshed?.certificado_valido_ate ? new Date(refreshed.certificado_valido_ate) : null;
      const daysUntilExpiry = validUntil
        ? Math.floor((validUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;

      return new Response(
        JSON.stringify({
          success: true,
          status: 'validated',
          certificate: {
            cn: refreshed?.certificado_cn ?? null,
            cnpj: refreshed?.certificado_cnpj ?? null,
            valid_until: refreshed?.certificado_valido_ate ?? null,
            serial: refreshed?.certificado_serial ?? null,
            days_until_expiry: daysUntilExpiry,
            uploaded_at: refreshed?.certificado_uploaded_at ?? savedRow.certificado_uploaded_at,
          },
          focus_empresa_id: refreshed?.focus_empresa_id ?? null,
          message: 'Certificado validado e empresa sincronizada com sucesso.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sync falhou. Traduz a mensagem do Focus.
    const focusErr = String(syncBody?.error ?? 'Erro desconhecido na validação');
    console.warn('[fiscal-upload-certificate] Focus sync failed:', focusErr);

    if (isCertificateRelatedError(focusErr)) {
      // Erro do certificado em si — apaga o cert salvo para o lojista reenviar
      await supabase
        .from('fiscal_settings')
        .update({
          certificado_pfx: null,
          certificado_senha: null,
          certificado_uploaded_at: null,
          certificado_valido_ate: null,
          certificado_cn: null,
          certificado_serial: null,
          certificado_cnpj: null,
        })
        .eq('tenant_id', tenantId);

      return new Response(
        JSON.stringify({ success: false, error: translateFocusCertificateError(focusErr) }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Erro NÃO é do certificado (ex.: dados de empresa faltando) — mantém cert salvo
    return new Response(
      JSON.stringify({
        success: true,
        status: 'pending_validation',
        message: translateFocusCertificateError(focusErr),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    return errorResponse(error, corsHeaders, { module: 'fiscal', action: 'upload-certificate' });
  }
});
