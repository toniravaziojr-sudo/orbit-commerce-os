/**
 * Formatação de datas no fuso de Brasília (America/Sao_Paulo)
 * Para uso em Edge Functions (servidor Deno).
 * 
 * REGRA: Todo horário exibido ao usuário deve refletir BRT.
 * O banco armazena UTC.
 */

const TZ = 'America/Sao_Paulo';

/** "12/04/2026 07:30:45" em BRT */
export function formatTimestampBR(date?: Date | string | null): string {
  const d = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(d);
}

/** "12/04/2026" em BRT */
export function formatDateBR(date?: Date | string | null): string {
  const d = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(d);
}

/** "12/04/2026 07:30" em BRT */
export function formatDateTimeBR(date?: Date | string | null): string {
  const d = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}
