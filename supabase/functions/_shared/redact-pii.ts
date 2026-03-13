/**
 * LGPD/PCI Redaction - Mascaramento de PII e dados sensíveis de pagamento
 * 
 * Este módulo remove/mascara dados pessoais sensíveis e dados PCI
 * antes de logs, métricas ou armazenamento.
 * 
 * v2.0 - Adicionado: redação PCI (cartão, CVV, tokens), redactPayloadForLog()
 */

interface PIIPattern {
  pattern: RegExp;
  replacement: string;
  description: string;
}

// Padrões de PII para Brasil
const PII_PATTERNS: PIIPattern[] = [
  // CPF (com e sem formatação)
  { 
    pattern: /\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}/g, 
    replacement: "[CPF]",
    description: "CPF"
  },
  
  // CNPJ (com e sem formatação)
  { 
    pattern: /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}[-.]?\d{2}/g, 
    replacement: "[CNPJ]",
    description: "CNPJ"
  },
  
  // Telefones BR (diversos formatos)
  { 
    pattern: /\+?55?\s?\(?0?\d{2}\)?\s?9?\s?\d{4,5}[- ]?\d{4}/g, 
    replacement: "[TELEFONE]",
    description: "Telefone com DDI/DDD"
  },
  { 
    pattern: /\(\d{2}\)\s?\d{4,5}[- ]?\d{4}/g, 
    replacement: "[TELEFONE]",
    description: "Telefone com DDD"
  },
  
  // CEP
  { 
    pattern: /\d{5}[-]?\d{3}/g, 
    replacement: "[CEP]",
    description: "CEP"
  },
  
  // Email
  { 
    pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, 
    replacement: "[EMAIL]",
    description: "Email"
  },
  
  // Chave Pix (UUID)
  { 
    pattern: /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 
    replacement: "[CHAVE_PIX]",
    description: "Chave PIX (UUID)"
  },
  
  // Chave Pix (aleatória 32 chars) - deve vir após UUID
  { 
    pattern: /(?<![a-zA-Z0-9])[a-zA-Z0-9]{32}(?![a-zA-Z0-9])/g, 
    replacement: "[CHAVE_PIX]",
    description: "Chave PIX (aleatória)"
  },
  
  // RG (padrões comuns) - XX.XXX.XXX-X
  { 
    pattern: /\d{2}\.?\d{3}\.?\d{3}[- ]?\d{1}/g, 
    replacement: "[RG]",
    description: "RG"
  },
  
  // Cartão de crédito (4 grupos de 4)
  { 
    pattern: /\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}/g, 
    replacement: "[CARTAO]",
    description: "Cartão de crédito"
  },
  
  // Código de rastreio (Correios) - AA123456789BR
  { 
    pattern: /[A-Z]{2}\d{9}[A-Z]{2}/g, 
    replacement: "[RASTREIO]",
    description: "Código de rastreio"
  },
  
  // CNS (Cartão Nacional de Saúde) - 15 dígitos
  { 
    pattern: /\d{3}\s?\d{4}\s?\d{4}\s?\d{4}/g, 
    replacement: "[CNS]",
    description: "Cartão Nacional de Saúde"
  },
  
  // PIS/PASEP - 11 dígitos
  { 
    pattern: /\d{3}\.?\d{5}\.?\d{2}[-.]?\d{1}/g, 
    replacement: "[PIS]",
    description: "PIS/PASEP"
  },
];

// ============================================
// PCI-SPECIFIC: Chaves de objeto que NUNCA devem ser logadas
// ============================================

/**
 * Chaves de objeto que contêm dados PCI/sensíveis de pagamento.
 * Qualquer campo com esses nomes será completamente mascarado em logs.
 */
const PCI_FORBIDDEN_KEYS = new Set([
  // Dados de cartão (PAN, CVV, etc.)
  'card_number', 'number', 'cvv', 'security_code', 'cvc',
  'exp_month', 'exp_year', 'expiration_month', 'expiration_year',
  'holder_name', 'cardholder', 'holder',
  'encrypted', 'card_hash', 'card_token',
  // Tokens de acesso
  'access_token', 'api_key', 'secret_key', 'token',
  // Senhas
  'password', 'senha',
]);

/**
 * Chaves de objeto que podem conter dados parcialmente sensíveis.
 * O valor é truncado em vez de completamente removido.
 */
const PCI_PARTIAL_KEYS = new Set([
  'first_six_digits', 'last_four_digits',
]);

/**
 * Chaves que indicam objetos "card" inteiros — todo o sub-objeto é mascarado.
 */
const PCI_CARD_OBJECT_KEYS = new Set([
  'card', 'credit_card', 'debit_card',
]);

/**
 * Redacta PII de um texto
 */
export function redactPII(text: string | null | undefined): string {
  if (!text) return "";
  
  let redacted = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

/**
 * Redacta PII de campos sensíveis em um objeto (versão original LGPD)
 */
export function redactForLog(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'content', 'message', 'text', 'body', 'transcription', 
    'description', 'summary', 'notes', 'comment', 'email',
    'phone', 'cpf', 'cnpj', 'address', 'endereco', 'customer_phone',
    'customer_email', 'customer_name', 'full_name', 'nome'
  ];
  
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      result[key] = value;
    } else if (typeof value === 'string') {
      const shouldRedact = sensitiveKeys.some(sk => 
        key.toLowerCase().includes(sk.toLowerCase())
      );
      result[key] = shouldRedact ? redactPII(value) : value;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactForLog(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item => {
        if (typeof item === 'string') return redactPII(item);
        if (typeof item === 'object' && item !== null) {
          return redactForLog(item as Record<string, unknown>);
        }
        return item;
      });
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

// ============================================
// PCI-SAFE LOG FUNCTIONS (v2.0)
// ============================================

/**
 * Redacta dados PCI de um objeto de pagamento para log seguro.
 * Remove completamente: número do cartão, CVV, tokens de acesso.
 * Preserva: status, IDs de transação, valores, timestamps.
 * 
 * @param obj Payload de pagamento (request ou response de gateway)
 * @returns Objeto seguro para logging (sem dados PCI)
 */
export function redactPayloadForLog(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return redactPII(obj);
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactPayloadForLog(item));
  }
  
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const keyLower = key.toLowerCase();
      
      // Objetos de cartão inteiros → mascarar completamente
      if (PCI_CARD_OBJECT_KEYS.has(keyLower) && typeof value === 'object' && value !== null) {
        result[key] = '[REDACTED_CARD_OBJECT]';
        continue;
      }
      
      // Chaves proibidas → mascarar valor
      if (PCI_FORBIDDEN_KEYS.has(keyLower)) {
        result[key] = '[REDACTED]';
        continue;
      }
      
      // Chaves parciais → manter mas indicar
      if (PCI_PARTIAL_KEYS.has(keyLower)) {
        result[key] = value; // first_six_digits e last_four_digits são seguros
        continue;
      }
      
      // Recursão para sub-objetos
      result[key] = redactPayloadForLog(value);
    }
    
    return result;
  }
  
  return obj;
}

/**
 * Wrapper seguro para console.log de payloads de pagamento.
 * Uso: safeLogPayload('[prefix]', 'Descrição:', payload);
 */
export function safeLogPayload(prefix: string, description: string, payload: unknown): void {
  console.log(`${prefix} ${description}`, JSON.stringify(redactPayloadForLog(payload), null, 2));
}

/**
 * Verifica se um texto contém PII
 */
export function containsPII(text: string | null | undefined): boolean {
  if (!text) return false;
  
  return PII_PATTERNS.some(({ pattern }) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

/**
 * Extrai lista de tipos de PII encontrados em um texto
 */
export function detectPIITypes(text: string | null | undefined): string[] {
  if (!text) return [];
  
  const foundTypes: string[] = [];
  
  for (const { pattern, description } of PII_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      foundTypes.push(description);
    }
  }
  
  return [...new Set(foundTypes)];
}
