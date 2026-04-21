// =============================================================
// Helper compartilhado: normalização canônica de telefone BR
// =============================================================
// Problema resolvido:
// Mensagens inbound do mesmo cliente caíam em conversas diferentes
// quando o telefone vinha com e sem o 9º dígito (ex.: 5573991681425
// vs 557391681425). Este helper define o formato canônico e gera
// variantes para lookup, garantindo que a busca por conversas
// existentes encontre o mesmo contato independente do formato.
//
// Regras:
// 1. Mantém apenas dígitos.
// 2. Se for número brasileiro (DDI 55) com DDD móvel (DDD>=11) e
//    o assinante começar com 6/7/8/9 com 8 dígitos, adiciona o "9".
// 3. Forma canônica = COM 9º dígito (formato moderno padrão Anatel).
// 4. Variants devolve [canônico, sem9digito] quando aplicável.
// =============================================================

export function onlyDigits(input?: string | null): string {
  return (input ?? "").replace(/\D/g, "");
}

/**
 * Retorna o telefone BR no formato canônico (com 9º dígito).
 * Para números não brasileiros ou que não se encaixem no padrão
 * móvel BR, devolve apenas os dígitos sem alteração.
 */
export function canonicalizeBrazilPhone(input?: string | null): string {
  const digits = onlyDigits(input);
  if (!digits) return "";

  // Considera DDI 55 quando começa com 55 e tem 12 ou 13 dígitos.
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const ddi = "55";
    const rest = digits.slice(2); // DDD + assinante
    const ddd = rest.slice(0, 2);
    const subscriber = rest.slice(2);

    // DDD móvel brasileiro válido (>= 11)
    const dddNum = Number(ddd);
    if (Number.isFinite(dddNum) && dddNum >= 11 && dddNum <= 99) {
      // Formato antigo (8 dígitos) começando com 6/7/8/9 → adiciona "9"
      if (subscriber.length === 8 && /^[6-9]/.test(subscriber)) {
        return `${ddi}${ddd}9${subscriber}`;
      }
      // Já está canônico (9 dígitos começando com 9)
      if (subscriber.length === 9) {
        return `${ddi}${ddd}${subscriber}`;
      }
    }
  }

  return digits;
}

/**
 * Gera variantes do telefone para lookup compatível com registros
 * antigos. Retorna sempre o canônico primeiro; quando aplicável,
 * inclui também a forma sem o 9º dígito.
 */
export function phoneVariants(input?: string | null): string[] {
  const canonical = canonicalizeBrazilPhone(input);
  if (!canonical) return [];

  const variants = new Set<string>([canonical]);

  // Para BR móvel, gera também a forma sem 9º dígito (legacy)
  if (canonical.startsWith("55") && canonical.length === 13) {
    const ddd = canonical.slice(2, 4);
    const subscriber = canonical.slice(4); // 9 dígitos
    if (subscriber.length === 9 && subscriber.startsWith("9")) {
      const legacy = `55${ddd}${subscriber.slice(1)}`; // remove o "9" extra
      variants.add(legacy);
    }
  }

  // Inclui também a string original em dígitos crus para compat extra
  const raw = onlyDigits(input);
  if (raw) variants.add(raw);

  return Array.from(variants);
}

/**
 * Gera o filtro `or` aceito pelo PostgREST (.or()) para buscar uma
 * conversa por qualquer uma das variantes do telefone.
 */
export function buildPhoneOrFilter(column: string, input?: string | null): string {
  const variants = phoneVariants(input);
  if (!variants.length) return `${column}.eq.`;
  return variants.map((v) => `${column}.eq.${v}`).join(",");
}
