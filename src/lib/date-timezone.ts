/**
 * Utilitários de Timezone — São Paulo como padrão do sistema
 * 
 * Resolve o problema de que `startOfDay()` e `endOfDay()` usam o timezone
 * do browser do usuário. Se o browser estiver em UTC (ex: sandbox),
 * "hoje 00:00 UTC" é "ontem 21:00 em SP", vazando dados do dia errado.
 * 
 * Estas funções calculam o início/fim do dia no timezone de São Paulo
 * e retornam ISOs corretas para queries no banco (que armazena em UTC).
 */

const SAO_PAULO_TIMEZONE = 'America/Sao_Paulo';
const SAO_PAULO_UTC_OFFSET = '-03:00';

/**
 * Retorna a data no formato 'YYYY-MM-DD' conforme o timezone de São Paulo.
 */
export function getSaoPauloDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

/**
 * Retorna o ISO string do início do dia (00:00:00.000) em São Paulo.
 */
export function toSaoPauloStartIso(date: Date): string {
  return new Date(`${getSaoPauloDateKey(date)}T00:00:00.000${SAO_PAULO_UTC_OFFSET}`).toISOString();
}

/**
 * Retorna o ISO string do fim do dia (23:59:59.999) em São Paulo.
 */
export function toSaoPauloEndIso(date: Date): string {
  return new Date(`${getSaoPauloDateKey(date)}T23:59:59.999${SAO_PAULO_UTC_OFFSET}`).toISOString();
}
