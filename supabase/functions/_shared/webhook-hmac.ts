/**
 * Webhook HMAC Verification — Log Mode (v2.0 — tenant-aware)
 * 
 * Verifica assinaturas HMAC de webhooks de provedores de pagamento.
 * MODO ATUAL: Apenas LOG (não rejeita requisições sem assinatura válida).
 * Quando o enforcement for ativado, passará a retornar 401 para assinaturas inválidas.
 * 
 * ARQUITETURA MULTI-TENANT:
 * O secret de verificação é lido das credenciais do TENANT dono do evento,
 * não de variável de ambiente global. Cada lojista configura seu próprio
 * webhook_secret no painel de integrações.
 * 
 * Provedores suportados:
 * - Mercado Pago: x-signature header com HMAC-SHA256
 * - Pagar.me: x-hub-signature header com HMAC-SHA256
 * - PagBank: sem HMAC nativo (apenas log de aviso)
 */

// ============================================
// TYPES
// ============================================

interface HmacVerificationResult {
  valid: boolean;
  reason: string;
  provider: string;
  /** Se true, o header de assinatura estava presente */
  signaturePresent: boolean;
  /** Tenant ID para correlação (quando disponível) */
  tenantId?: string;
}

// ============================================
// CORE HMAC
// ============================================

async function computeHmacSha256(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ============================================
// MERCADO PAGO
// ============================================

/**
 * Verifica assinatura HMAC do Mercado Pago (tenant-aware).
 * 
 * MP envia header `x-signature` no formato:
 *   ts=<timestamp>,v1=<hmac>
 * 
 * O HMAC é calculado sobre:
 *   id:<data.id>;request-id:<x-request-id>;ts:<timestamp>;<template>
 * 
 * O secret é lido das credenciais do tenant (payment_providers.credentials.webhook_secret),
 * NÃO de variável de ambiente global.
 * 
 * @param req Request original
 * @param body Body parseado do webhook
 * @param tenantSecret webhook_secret do tenant (de payment_providers.credentials)
 * @param tenantId ID do tenant para log estruturado
 * 
 * @see https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
export async function verifyMercadoPagoHmac(
  req: Request,
  body: Record<string, unknown>,
  tenantSecret: string | undefined | null,
  tenantId?: string,
): Promise<HmacVerificationResult> {
  const provider = 'mercadopago';
  const signatureHeader = req.headers.get('x-signature');
  
  if (!signatureHeader) {
    return { valid: false, reason: 'x-signature header missing', provider, signaturePresent: false, tenantId };
  }
  
  if (!tenantSecret) {
    return { valid: false, reason: 'tenant has no webhook_secret configured', provider, signaturePresent: true, tenantId };
  }
  
  // Parse ts and v1 from header
  const parts = signatureHeader.split(',');
  const tsEntry = parts.find(p => p.trim().startsWith('ts='));
  const v1Entry = parts.find(p => p.trim().startsWith('v1='));
  
  if (!tsEntry || !v1Entry) {
    return { valid: false, reason: 'x-signature format invalid', provider, signaturePresent: true, tenantId };
  }
  
  const ts = tsEntry.split('=')[1];
  const receivedHmac = v1Entry.split('=')[1];
  
  // Build the template string per MP docs
  const dataId = (body as any)?.data?.id || (body as any)?.id || '';
  const requestId = req.headers.get('x-request-id') || '';
  
  // MP template: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
  const template = `id:${dataId};request-id:${requestId};ts:${ts};`;
  
  const expectedHmac = await computeHmacSha256(tenantSecret, template);
  const isValid = timingSafeEqual(receivedHmac, expectedHmac);
  
  return {
    valid: isValid,
    reason: isValid ? 'HMAC valid' : 'HMAC mismatch',
    provider,
    signaturePresent: true,
    tenantId,
  };
}

// ============================================
// PAGAR.ME
// ============================================

/**
 * Verifica assinatura HMAC do Pagar.me (tenant-aware).
 * 
 * Pagar.me envia header `x-hub-signature`:
 *   sha256=<hmac_hex>
 * 
 * O HMAC é calculado sobre o body raw (string).
 * 
 * O secret é lido das credenciais do tenant (payment_providers.credentials.webhook_secret),
 * NÃO de variável de ambiente global.
 * 
 * @param req Request original
 * @param rawBody Body cru (string) para cálculo do HMAC
 * @param tenantSecret webhook_secret do tenant (de payment_providers.credentials)
 * @param tenantId ID do tenant para log estruturado
 * 
 * @see https://docs.pagar.me/docs/webhooks
 */
export async function verifyPagarmeHmac(
  req: Request,
  rawBody: string,
  tenantSecret: string | undefined | null,
  tenantId?: string,
): Promise<HmacVerificationResult> {
  const provider = 'pagarme';
  const signatureHeader = req.headers.get('x-hub-signature');
  
  if (!signatureHeader) {
    return { valid: false, reason: 'x-hub-signature header missing', provider, signaturePresent: false, tenantId };
  }
  
  if (!tenantSecret) {
    return { valid: false, reason: 'tenant has no webhook_secret configured', provider, signaturePresent: true, tenantId };
  }
  
  // Format: sha256=<hex>
  const receivedHmac = signatureHeader.replace('sha256=', '');
  const expectedHmac = await computeHmacSha256(tenantSecret, rawBody);
  const isValid = timingSafeEqual(receivedHmac, expectedHmac);
  
  return {
    valid: isValid,
    reason: isValid ? 'HMAC valid' : 'HMAC mismatch',
    provider,
    signaturePresent: true,
    tenantId,
  };
}

// ============================================
// PAGBANK
// ============================================

/**
 * PagBank não tem HMAC nativo.
 * Esta função apenas registra que a verificação não é possível.
 */
export function verifyPagbankHmac(tenantId?: string): HmacVerificationResult {
  return {
    valid: false,
    reason: 'PagBank does not support HMAC verification',
    provider: 'pagbank',
    signaturePresent: false,
    tenantId,
  };
}

// ============================================
// LOG MODE HANDLER
// ============================================

/**
 * Loga o resultado da verificação HMAC sem bloquear a requisição.
 * Em modo enforcement futuro, esta função retornará Response | null.
 * 
 * @param result Resultado da verificação HMAC
 * @param requestId ID da requisição para correlação
 * @returns null (sempre permite a requisição em modo log)
 */
export function handleHmacResult(
  result: HmacVerificationResult,
  requestId: string,
): Response | null {
  const tenantTag = result.tenantId ? ` tenant=${result.tenantId.slice(0, 8)}` : '';
  const prefix = `[${requestId}][HMAC:${result.provider}${tenantTag}]`;
  
  if (result.valid) {
    console.log(`${prefix} ✅ Signature verified`);
  } else if (!result.signaturePresent) {
    console.warn(`${prefix} ⚠️ No signature header — ${result.reason}`);
  } else if (result.reason.includes('no webhook_secret configured')) {
    console.warn(`${prefix} ⚠️ Tenant missing webhook_secret — skipping verification`);
  } else {
    console.warn(`${prefix} ❌ INVALID signature — ${result.reason}`);
  }
  
  // LOG MODE: sempre retorna null (não bloqueia)
  // ENFORCEMENT MODE (futuro): retornaria Response com 401 quando result.valid === false
  return null;
}
