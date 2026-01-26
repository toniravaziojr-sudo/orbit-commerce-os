/**
 * LGPD/Redaction - Mascaramento de PII para Brasil
 * 
 * Este módulo remove/mascara dados pessoais sensíveis de textos
 * antes de logs, métricas ou armazenamento.
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
  // +55 (11) 99999-9999, (11) 9 9999-9999, 11999999999, etc.
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

/**
 * Redacta PII de um texto
 * @param text Texto a ser processado
 * @returns Texto com PII mascarado
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
 * Redacta PII de campos sensíveis em um objeto
 * @param obj Objeto com campos potencialmente sensíveis
 * @returns Objeto com campos sensíveis redactados
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
      // Redactar se for campo sensível ou contiver padrões de PII
      const shouldRedact = sensitiveKeys.some(sk => 
        key.toLowerCase().includes(sk.toLowerCase())
      );
      result[key] = shouldRedact ? redactPII(value) : value;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Recursivo para objetos aninhados
      result[key] = redactForLog(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      // Processar arrays
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

/**
 * Verifica se um texto contém PII
 * @param text Texto a verificar
 * @returns true se contém PII
 */
export function containsPII(text: string | null | undefined): boolean {
  if (!text) return false;
  
  return PII_PATTERNS.some(({ pattern }) => {
    // Reset lastIndex para patterns globais
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

/**
 * Extrai lista de tipos de PII encontrados em um texto
 * @param text Texto a analisar
 * @returns Lista de tipos de PII encontrados
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
  
  return [...new Set(foundTypes)]; // Remove duplicatas
}
