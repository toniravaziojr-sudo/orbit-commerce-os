/**
 * Ordenação universal por "número do módulo".
 *
 * Regra (acordada com o usuário): listagens operacionais (Pedidos, Pedidos de
 * Venda, Notas Fiscais, Objetos de Postagem, Remessas, Rastreios) devem ficar
 * em ordem decrescente do número nativo do registro. Itens recriados por
 * reconciliação ou recuperados de qualquer forma voltam ao lugar correto
 * (não vão para o topo só por terem data de criação nova).
 *
 * Empate (mesmo número) → desempate pelo segundo critério (geralmente data),
 * mais novo em cima.
 */

/** Extrai apenas dígitos de um valor (string ou número). Retorna null se vazio. */
export function extractNumericKey(value: unknown): number | null {
  if (value == null) return null;
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return null;
  // Number é seguro até 2^53; números de pedido/NF/PV ficam muito abaixo disso.
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

/**
 * Ordena um array (cópia) por número decrescente extraído de `getNumber`.
 * Registros sem número vão para o final, e dentro dos sem número usa-se
 * `getTiebreaker` (timestamp em ms, padrão 0) decrescente.
 */
export function sortByNumberDesc<T>(
  items: readonly T[] | undefined | null,
  getNumber: (item: T) => unknown,
  getTiebreaker?: (item: T) => number | string | Date | null | undefined,
): T[] {
  if (!items || items.length === 0) return [];
  const tb = (it: T): number => {
    const raw = getTiebreaker?.(it);
    if (raw == null) return 0;
    if (raw instanceof Date) return raw.getTime();
    if (typeof raw === 'number') return raw;
    const t = Date.parse(String(raw));
    return Number.isFinite(t) ? t : 0;
  };
  return [...items].sort((a, b) => {
    const na = extractNumericKey(getNumber(a));
    const nb = extractNumericKey(getNumber(b));
    if (na == null && nb == null) return tb(b) - tb(a);
    if (na == null) return 1; // a vai depois
    if (nb == null) return -1;
    if (na !== nb) return nb - na;
    return tb(b) - tb(a);
  });
}
