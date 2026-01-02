// =============================================
// FISCAL UPLOAD CERTIFICATE - Upload de Certificado A1
// Valida, criptografa e armazena o certificado digital
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "https://esm.sh/node-forge@1.3.1?bundle";

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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        JSON.stringify({ success: false, error: 'Envie o certificado em formato JSON com pfx_base64 e password' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pfxBase64 || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Certificado e senha são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fiscal-upload-certificate] Validating certificate...');

    // Decode PFX from base64
    let pfxDer: string;
    try {
      pfxDer = atob(pfxBase64);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Arquivo PFX inválido (base64 malformado)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to load and validate the certificate using node-forge
    let p12Asn1;
    let p12;
    let certBags;
    let keyBags;

    try {
      p12Asn1 = forge.asn1.fromDer(pfxDer);
      p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
    } catch (e) {
      console.error('[fiscal-upload-certificate] Failed to open PFX:', e);
      return new Response(
        JSON.stringify({ success: false, error: 'Senha incorreta ou certificado inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract certificate
    try {
      certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    } catch (e) {
      console.error('[fiscal-upload-certificate] Failed to extract bags:', e);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao extrair certificado do arquivo PFX' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const certBagList = certBags[forge.pki.oids.certBag];
    if (!certBagList || certBagList.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nenhum certificado encontrado no arquivo PFX' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the certificate (usually the first one is the end-entity cert)
    const cert = certBagList[0].cert;
    if (!cert) {
      return new Response(
        JSON.stringify({ success: false, error: 'Certificado inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract certificate info
    const subject = cert.subject;
    const validity = cert.validity;
    const serialNumber = cert.serialNumber;

    // Get CN (Common Name)
    const cnAttr = subject.getField('CN');
    const cn = cnAttr ? cnAttr.value : 'N/A';

    // Get CNPJ from certificate (usually in subject or extensions)
    let certCnpj = '';
    
    // Try to find CNPJ in subject
    for (const attr of subject.attributes) {
      // Check in various OID fields that might contain CNPJ
      if (attr.value && typeof attr.value === 'string') {
        const cnpjMatch = attr.value.match(/\d{14}/);
        if (cnpjMatch) {
          certCnpj = cnpjMatch[0];
          break;
        }
      }
    }

    // If not found in subject, try OID 2.16.76.1.3.3 (ICP-Brasil CNPJ)
    if (!certCnpj && cert.extensions) {
      for (const ext of cert.extensions) {
        if (ext.name === 'subjectAltName' && ext.altNames) {
          for (const altName of ext.altNames) {
            if (altName.value && typeof altName.value === 'string') {
              const cnpjMatch = altName.value.match(/\d{14}/);
              if (cnpjMatch) {
                certCnpj = cnpjMatch[0];
                break;
              }
            }
          }
        }
      }
    }

    // Check validity
    const now = new Date();
    const notBefore = validity.notBefore;
    const notAfter = validity.notAfter;

    if (now < notBefore) {
      return new Response(
        JSON.stringify({ success: false, error: 'Certificado ainda não está válido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (now > notAfter) {
      return new Response(
        JSON.stringify({ success: false, error: 'Certificado expirado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant's CNPJ for validation
    const { data: fiscalSettings } = await supabase
      .from('fiscal_settings')
      .select('cnpj')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    // Validate CNPJ match (if tenant has CNPJ configured and cert has CNPJ)
    if (fiscalSettings?.cnpj && certCnpj) {
      const tenantCnpjClean = fiscalSettings.cnpj.replace(/\D/g, '');
      if (tenantCnpjClean !== certCnpj) {
        console.warn('[fiscal-upload-certificate] CNPJ mismatch:', { tenant: tenantCnpjClean, cert: certCnpj });
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `CNPJ do certificado (${certCnpj}) não corresponde ao CNPJ cadastrado (${tenantCnpjClean})` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('[fiscal-upload-certificate] Certificate validated:', { cn, certCnpj, notAfter });

    // Encrypt the PFX and password
    const encryptedPfx = await encryptData(pfxBase64, encryptionKey);
    const encryptedPassword = await encryptData(password, encryptionKey);

    // Save to database
    const { data: existing } = await supabase
      .from('fiscal_settings')
      .select('id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const certificateData = {
      certificado_pfx: encryptedPfx,
      certificado_senha: encryptedPassword,
      certificado_valido_ate: notAfter.toISOString(),
      certificado_cn: cn,
      certificado_serial: serialNumber,
      certificado_cnpj: certCnpj || null,
      certificado_uploaded_at: new Date().toISOString(),
    };

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
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[fiscal-upload-certificate] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
