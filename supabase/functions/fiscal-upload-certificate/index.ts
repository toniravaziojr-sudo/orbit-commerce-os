// =============================================
// FISCAL UPLOAD CERTIFICATE - Upload de Certificado A1
// Valida, criptografa e armazena o certificado digital
// =============================================
import { errorResponse } from "../_shared/error-response.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
// deno-lint-ignore-file no-explicit-any
import { readPfx, PfxError, pfxErrorToUserMessage } from "../_shared/pfx-reader.ts";

import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple AES encryption using Web Crypto API
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
  
  // Combine IV + encrypted data and encode as base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

async function decryptData(encryptedBase64: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key.padEnd(32, '0').slice(0, 32));
  
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 16);
  const data = combined.slice(16);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-CBC' },
    false,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    data
  );
  
  return new TextDecoder().decode(decrypted);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    // Get auth header
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

    // Get user
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

    // Get user's tenant
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

    // Parse multipart form data or JSON
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

    console.log('[fiscal-upload-certificate] Validating certificate...');

    // Leitura unificada (PKI.js moderno -> fallback forge legado)
    let bundle;
    try {
      bundle = await readPfx(pfxBase64, password);
    } catch (e) {
      const userError = pfxErrorToUserMessage(e);
      console.error('[fiscal-upload-certificate] readPfx falhou:', {
        code: e instanceof PfxError ? e.code : 'UNKNOWN',
        message: String((e as any)?.message ?? e),
      });
      return new Response(
        JSON.stringify({ success: false, error: userError }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cn = bundle.cn ?? 'N/A';
    const certCnpj = bundle.cnpj ?? '';
    const serialNumber = bundle.serialNumber;
    const notBefore = bundle.validity.notBefore;
    const notAfter = bundle.validity.notAfter;

    // Check validity
    const now = new Date();

    if (now < notBefore) {
      return new Response(
        JSON.stringify({ success: false, error: 'Este certificado ainda não está válido. Verifique a data de início de validade.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (now > notAfter) {
      return new Response(
        JSON.stringify({ success: false, error: 'Este certificado está expirado. Solicite a renovação do certificado A1 e tente novamente.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant's CNPJ for validation
    const { data: fiscalSettings } = await supabase
      .from('fiscal_settings')
      .select('cnpj')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    // Validate CNPJ match. Se for diferente do CNPJ atual em fiscal_settings,
    // tratar como TROCA DE EMPRESA: atualizar cnpj e zerar vínculo Focus NFe
    // para que o sync recrie/reaproveite a empresa correta.
    let cnpjMismatch = false;
    let cnpjSwapped = false;
    if (fiscalSettings?.cnpj && certCnpj) {
      const tenantCnpjClean = fiscalSettings.cnpj.replace(/\D/g, '');
      if (tenantCnpjClean !== certCnpj) {
        console.warn('[fiscal-upload-certificate] CNPJ swap detected:', { from: tenantCnpjClean, to: certCnpj });
        cnpjMismatch = true;
        cnpjSwapped = true;
      }
    }

    console.log('[fiscal-upload-certificate] Certificate validated:', { cn, certCnpj, notAfter });

    // Encrypt the PFX and password
    console.log('[fiscal-upload-certificate] Encrypting certificate...', { 
      pfxBase64Length: pfxBase64.length,
      passwordLength: password.length 
    });
    
    const encryptedPfx = await encryptData(pfxBase64, encryptionKey);
    const encryptedPassword = await encryptData(password, encryptionKey);
    
    console.log('[fiscal-upload-certificate] Encrypted successfully:', { 
      encryptedPfxLength: encryptedPfx.length,
      encryptedPasswordLength: encryptedPassword.length,
      encryptedPfxSample: encryptedPfx.substring(0, 50)
    });

    // Save to database
    const { data: existing } = await supabase
      .from('fiscal_settings')
      .select('id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const certificateData: Record<string, any> = {
      certificado_pfx: encryptedPfx,
      certificado_senha: encryptedPassword,
      certificado_valido_ate: notAfter.toISOString(),
      certificado_cn: cn,
      certificado_serial: serialNumber,
      certificado_cnpj: certCnpj || null,
      certificado_uploaded_at: new Date().toISOString(),
    };

    // Em troca de CNPJ: alinhar cnpj e limpar vínculo Focus NFe da empresa antiga.
    if (cnpjSwapped && certCnpj) {
      certificateData.cnpj = certCnpj;
      certificateData.focus_empresa_id = null;
      certificateData.focus_empresa_criada_em = null;
      certificateData.focus_ultima_sincronizacao = null;
    }

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('fiscal_settings')
        .update(certificateData)
        .eq('id', existing.id)
        .select('id, certificado_cn, certificado_valido_ate, certificado_serial, certificado_cnpj, certificado_uploaded_at')
        .single();
      
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('fiscal_settings')
        .insert({ tenant_id: tenantId, ...certificateData })
        .select('id, certificado_cn, certificado_valido_ate, certificado_serial, certificado_cnpj, certificado_uploaded_at')
        .single();
      
      if (error) throw error;
      result = data;
    }

    console.log('[fiscal-upload-certificate] Certificate saved successfully');

    // Calculate days until expiration
    const daysUntilExpiry = Math.floor((notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Tentar sincronizar empresa com Focus NFe automaticamente
    let focusSyncResult: { success: boolean; empresa_id?: string; error?: string } | null = null;
    
    try {
      const focusToken = Deno.env.get('FOCUS_NFE_TOKEN');
      if (focusToken) {
        console.log('[fiscal-upload-certificate] Triggering Focus NFe sync...');
        
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const syncResponse = await fetch(`${supabaseUrl}/functions/v1/fiscal-sync-focus-nfe`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        
        if (syncResponse.ok) {
          focusSyncResult = await syncResponse.json();
          console.log('[fiscal-upload-certificate] Focus NFe sync result:', focusSyncResult);
        } else {
          const errorText = await syncResponse.text();
          console.warn('[fiscal-upload-certificate] Focus NFe sync failed:', errorText);
          focusSyncResult = { success: false, error: 'Falha ao sincronizar com Focus NFe' };
        }
      }
    } catch (syncError: any) {
      console.error('[fiscal-upload-certificate] Focus NFe sync error:', syncError);
      focusSyncResult = { success: false, error: syncError.message };
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        certificate: {
          cn: cn,
          cnpj: certCnpj || null,
          valid_until: notAfter.toISOString(),
          serial: serialNumber,
          days_until_expiry: daysUntilExpiry,
          uploaded_at: certificateData.certificado_uploaded_at,
        },
        focus_sync: focusSyncResult,
        warning: cnpjMismatch ? `CNPJ do certificado (${certCnpj}) não corresponde ao CNPJ cadastrado` : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    return errorResponse(error, corsHeaders, { module: 'fiscal', action: 'upload-certificate' });
  }
});
