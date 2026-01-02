// =============================================
// CERTIFICATE UTILS - Utilitários para certificado digital
// Compatível com formato salvo por fiscal-upload-certificate
// =============================================

/**
 * Descriptografa dados criptografados com AES-CBC
 * O formato esperado é: IV (16 bytes) + dados criptografados, tudo em base64
 * Este é o formato usado por fiscal-upload-certificate
 */
export async function decryptCertificateData(
  encryptedBase64: string,
  encryptionKey: string
): Promise<string> {
  const keyBytes = new TextEncoder().encode(encryptionKey.padEnd(32, '0').slice(0, 32));
  
  // Decodificar base64 que contém IV + dados
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  
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
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    encryptedBytes
  );
  
  return new TextDecoder().decode(decrypted);
}

/**
 * Carrega e valida o certificado do tenant
 * Retorna o PFX em base64 e a senha descriptografados
 */
export async function loadTenantCertificate(
  settings: {
    certificado_pfx?: string | null;
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

  // Descriptografar PFX (que é o PFX em base64 criptografado)
  const pfxBase64 = await decryptCertificateData(settings.certificado_pfx, encryptionKey);
  
  // Descriptografar senha
  const password = await decryptCertificateData(settings.certificado_senha, encryptionKey);

  return { pfxBase64, password };
}
