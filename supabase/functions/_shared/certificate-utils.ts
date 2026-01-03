// =============================================
// CERTIFICATE UTILS - Utilitários para certificado digital
// Compatível com formato salvo por fiscal-upload-certificate
// =============================================

/**
 * Limpa string base64 removendo caracteres inválidos
 */
function cleanBase64(base64: string): string {
  // Remove whitespace, newlines, and any invalid characters
  return base64.replace(/[\s\r\n]/g, '').replace(/[^A-Za-z0-9+/=]/g, '');
}

/**
 * Decodifica base64 de forma segura, tratando diferentes formatos
 */
function safeBase64Decode(base64: string): Uint8Array {
  const cleaned = cleanBase64(base64);
  
  // Try standard atob first
  try {
    return Uint8Array.from(atob(cleaned), c => c.charCodeAt(0));
  } catch {
    // If it fails, try adding padding
    const padded = cleaned + '='.repeat((4 - (cleaned.length % 4)) % 4);
    try {
      return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
    } catch (e) {
      console.error('[certificate-utils] Base64 decode failed:', { 
        originalLength: base64.length, 
        cleanedLength: cleaned.length,
        sample: cleaned.substring(0, 50) 
      });
      throw new Error(`Falha ao decodificar base64: ${e instanceof Error ? e.message : 'formato inválido'}`);
    }
  }
}

/**
 * Descriptografa dados criptografados com AES-CBC
 * O formato esperado é: IV (16 bytes) + dados criptografados, tudo em base64
 * Este é o formato usado por fiscal-upload-certificate
 */
export async function decryptCertificateData(
  encryptedBase64: string,
  encryptionKey: string
): Promise<string> {
  if (!encryptedBase64 || encryptedBase64.trim() === '') {
    throw new Error('Dados criptografados vazios');
  }

  const keyBytes = new TextEncoder().encode(encryptionKey.padEnd(32, '0').slice(0, 32));
  
  // Decodificar base64 que contém IV + dados
  const combined = safeBase64Decode(encryptedBase64);
  
  if (combined.length < 17) {
    throw new Error(`Dados criptografados muito curtos: ${combined.length} bytes`);
  }
  
  // Extrair IV (primeiros 16 bytes) e dados criptografados
  const iv = combined.slice(0, 16);
  const encryptedBytes = combined.slice(16);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-CBC' },
    false,
    ['decrypt']
  );
  
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv },
      cryptoKey,
      encryptedBytes
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.error('[certificate-utils] Decryption failed:', e);
    throw new Error('Falha ao descriptografar. Verifique se o certificado foi enviado corretamente.');
  }
}

/**
 * Converte hex string (formato PostgreSQL bytea) para string ASCII
 * Formato: \x47397750... onde cada par de hex representa um byte ASCII
 */
function hexToString(hex: string): string {
  // Remove o prefixo \x se presente
  const cleanHex = hex.startsWith('\\x') ? hex.slice(2) : hex;
  
  let result = '';
  for (let i = 0; i < cleanHex.length; i += 2) {
    const byte = parseInt(cleanHex.substring(i, i + 2), 16);
    result += String.fromCharCode(byte);
  }
  return result;
}

/**
 * Converte dados que podem vir como Buffer (bytea) ou string para string
 */
function bufferToString(data: unknown): string {
  if (typeof data === 'string') {
    // Check if it's PostgreSQL hex format (starts with \x)
    if (data.startsWith('\\x')) {
      console.log('[certificate-utils] Detected PostgreSQL hex format, converting...');
      return hexToString(data);
    }
    return data;
  }
  
  // Handle Supabase bytea format: { type: 'Buffer', data: number[] }
  if (data && typeof data === 'object') {
    const bufferObj = data as { type?: string; data?: number[] };
    if (bufferObj.type === 'Buffer' && Array.isArray(bufferObj.data)) {
      // Convert byte array to string
      return String.fromCharCode(...bufferObj.data);
    }
  }
  
  // Handle Uint8Array
  if (data instanceof Uint8Array) {
    return new TextDecoder().decode(data);
  }
  
  throw new Error('Formato de dados do certificado não reconhecido');
}

/**
 * Carrega e valida o certificado do tenant
 * Retorna o PFX em base64 e a senha descriptografados
 */
export async function loadTenantCertificate(
  settings: {
    certificado_pfx?: unknown;
    certificado_senha?: string | null;
    certificado_valido_ate?: string | null;
  },
  encryptionKey: string
): Promise<{ pfxBase64: string; password: string }> {
  if (!settings.certificado_pfx) {
    throw new Error('Certificado digital não configurado.');
  }

  if (!settings.certificado_senha) {
    throw new Error('Senha do certificado não configurada.');
  }

  // Verificar validade
  if (settings.certificado_valido_ate) {
    const validUntil = new Date(settings.certificado_valido_ate);
    if (validUntil < new Date()) {
      throw new Error(`Certificado expirado em ${validUntil.toLocaleDateString('pt-BR')}.`);
    }
  }

  // Converter certificado_pfx de Buffer para string se necessário
  const pfxData = bufferToString(settings.certificado_pfx);
  
  console.log('[certificate-utils] Decrypting certificate...', {
    pfxLength: pfxData.length,
    senhaLength: settings.certificado_senha.length,
    pfxSample: pfxData.substring(0, 30)
  });

  // Descriptografar PFX (que é o PFX em base64 criptografado)
  const pfxBase64 = await decryptCertificateData(pfxData, encryptionKey);
  
  // Descriptografar senha
  const password = await decryptCertificateData(settings.certificado_senha, encryptionKey);

  console.log('[certificate-utils] Certificate decrypted successfully');

  return { pfxBase64, password };
}
