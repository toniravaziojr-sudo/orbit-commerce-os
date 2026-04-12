/**
 * Formatação de Datas — Horário Oficial de Brasília (BRT)
 * 
 * REGRA DO SISTEMA: Todo horário exibido ao usuário deve refletir
 * o horário oficial de Brasília (America/Sao_Paulo).
 * O banco armazena UTC. A conversão ocorre apenas na camada de apresentação.
 * 
 * Este arquivo é o ponto central de formatação de datas no front-end.
 * Para queries de banco (início/fim do dia), use `date-timezone.ts`.
 * 
 * Todas as funções usam `Intl.DateTimeFormat` com timezone fixo,
 * garantindo resultado correto independente do timezone do browser.
 */

import { getSaoPauloDateKey } from './date-timezone';

const TZ = 'America/Sao_Paulo';

// ─── helpers internos ───────────────────────────────────────────

function toDate(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  return typeof input === 'string' ? new Date(input) : input;
}

function intl(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, ...options }).format(date);
}

// ─── dateKey helpers ────────────────────────────────────────────

function todayKeyBR(): string {
  return getSaoPauloDateKey(new Date());
}

function yesterdayKeyBR(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getSaoPauloDateKey(d);
}

// ─── funções públicas ───────────────────────────────────────────

/** "12/04/2026" */
export function formatDateBR(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '-';
  return intl(d, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** "12/04/2026 07:30" */
export function formatDateTimeBR(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '-';
  return intl(d, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** "12/04/2026 07:30:45" */
export function formatDateTimeSecondsBR(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '-';
  return intl(d, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** "12 de abril de 2026" */
export function formatDateLongBR(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '-';
  return intl(d, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "12 de abril de 2026 às 07:30" */
export function formatDateTimeLongBR(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '-';
  const datePart = intl(d, { day: 'numeric', month: 'long', year: 'numeric' });
  const timePart = intl(d, { hour: '2-digit', minute: '2-digit' });
  return `${datePart} às ${timePart}`;
}

/** "07:30" */
export function formatTimeBR(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '-';
  return intl(d, { hour: '2-digit', minute: '2-digit' });
}

/** "abril 2026" */
export function formatMonthYearBR(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '-';
  return intl(d, { month: 'long', year: 'numeric' });
}

/** "12 abr" */
export function formatDayMonthBR(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '-';
  return intl(d, { day: 'numeric', month: 'short' });
}

/** "12/04" */
export function formatDayMonthNumericBR(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '-';
  return intl(d, { day: '2-digit', month: '2-digit' });
}

/** "dd/MM HH:mm" */
export function formatDayMonthTimeBR(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '-';
  return intl(d, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** "sábado, 12 de abril" */
export function formatWeekdayBR(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '-';
  return intl(d, { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "sáb" / "dom" etc */
export function formatWeekdayShortBR(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '-';
  return intl(d, { weekday: 'long' });
}

/** "dd/MM/yy HH:mm" */
export function formatDateTimeShortBR(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '-';
  return intl(d, { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** "12 abr 2026" */
export function formatDayMonthYearShortBR(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '-';
  return intl(d, { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── comparações com timezone correto ───────────────────────────

/** Verifica se a data é "hoje" em BRT */
export function isTodayBR(input: string | Date | null | undefined): boolean {
  const d = toDate(input);
  if (!d) return false;
  return getSaoPauloDateKey(d) === todayKeyBR();
}

/** Verifica se a data é "ontem" em BRT */
export function isYesterdayBR(input: string | Date | null | undefined): boolean {
  const d = toDate(input);
  if (!d) return false;
  return getSaoPauloDateKey(d) === yesterdayKeyBR();
}

/** Verifica se a data é do ano corrente em BRT */
export function isThisYearBR(input: string | Date | null | undefined): boolean {
  const d = toDate(input);
  if (!d) return false;
  const key = getSaoPauloDateKey(d);
  const todayKey = todayKeyBR();
  return key.substring(0, 4) === todayKey.substring(0, 4);
}

// ─── formatação relativa ────────────────────────────────────────

/**
 * "Hoje, 07:30" / "Ontem" / "12 abr" / "12 abr 2025"
 */
export function formatRelativeDateBR(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '-';
  
  if (isTodayBR(d)) {
    return `Hoje, ${formatTimeBR(d)}`;
  }
  if (isYesterdayBR(d)) {
    return 'Ontem';
  }
  if (isThisYearBR(d)) {
    return formatDayMonthBR(d);
  }
  return formatDayMonthYearShortBR(d);
}

/**
 * "Hoje, 07:30" / "Ontem, 14:00" / "12 abr, 09:15" / "12 abr 2025, 09:15"
 */
export function formatRelativeDateTimeBR(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '-';
  
  if (isTodayBR(d)) {
    return `Hoje, ${formatTimeBR(d)}`;
  }
  if (isYesterdayBR(d)) {
    return `Ontem, ${formatTimeBR(d)}`;
  }
  if (isThisYearBR(d)) {
    return `${formatDayMonthBR(d)}, ${formatTimeBR(d)}`;
  }
  return `${formatDayMonthYearShortBR(d)}, ${formatTimeBR(d)}`;
}

/**
 * Formata data para exibição em email list style:
 * Hoje → "HH:mm" / Ontem → "Ontem" / Este ano → "12 abr" / Outro ano → "12 abr 2025"
 */
export function formatEmailDateBR(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '';
  
  if (isTodayBR(d)) return formatTimeBR(d);
  if (isYesterdayBR(d)) return 'Ontem';
  if (isThisYearBR(d)) return formatDayMonthBR(d);
  return formatDayMonthYearShortBR(d);
}

/**
 * Formata para uso em timestamps de notas/logs no servidor
 * Formato: "12/04/2026 07:30:45" com timezone BRT
 */
export function formatTimestampBR(input: string | Date | null | undefined): string {
  return formatDateTimeSecondsBR(input);
}
