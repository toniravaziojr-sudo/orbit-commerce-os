/**
 * Biblioteca Central de Datas — Fonte de verdade do sistema
 * 
 * Regras oficiais:
 * - Início sempre em startOfDay (00:00:00.000)
 * - Fim sempre em endOfDay (23:59:59.999)
 * - Semana começa no Domingo (padrão ptBR)
 * - "Esta semana" e "Este mês" vão até o fim de HOJE (não do período completo)
 * - Timezone: preparado para receber timezone por tenant, por ora usa padrão fixo
 */

import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  subWeeks,
  subMonths,
  differenceInCalendarDays,
  format,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Timezone padrão do sistema — futuramente virá do tenant
export const SYSTEM_TIMEZONE = 'America/Sao_Paulo';

export type DatePreset =
  | 'all_time'
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'last_7_days'
  | 'last_30_days'
  | 'select_month'
  | 'custom';

export interface DateRange {
  start?: Date;
  end?: Date;
}

export interface PresetOption {
  value: DatePreset;
  label: string;
  group: 'fixed' | 'rolling' | 'custom';
}

export const PRESET_OPTIONS: PresetOption[] = [
  { value: 'all_time', label: 'Todo o período', group: 'fixed' },
  { value: 'today', label: 'Hoje', group: 'fixed' },
  { value: 'yesterday', label: 'Ontem', group: 'fixed' },
  { value: 'this_week', label: 'Esta semana', group: 'fixed' },
  { value: 'last_week', label: 'Semana passada', group: 'fixed' },
  { value: 'this_month', label: 'Este mês', group: 'fixed' },
  { value: 'last_month', label: 'Mês passado', group: 'fixed' },
  { value: 'last_7_days', label: 'Últimos 7 dias', group: 'rolling' },
  { value: 'last_30_days', label: 'Últimos 30 dias', group: 'rolling' },
  { value: 'select_month', label: 'Selecionar mês', group: 'custom' },
  { value: 'custom', label: 'Período customizado', group: 'custom' },
];

/**
 * Calcula as datas de início e fim para um preset.
 * _timezone param reservado para uso futuro com timezone do tenant.
 */
export function getPresetDateRange(
  preset: DatePreset,
  selectedMonth?: Date,
  _timezone?: string
): DateRange {
  const now = new Date();

  switch (preset) {
    case 'all_time':
      return { start: undefined, end: undefined };

    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };

    case 'yesterday': {
      const yesterday = subDays(now, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    }

    case 'this_week':
      // Início da semana até o fim de HOJE
      return {
        start: startOfWeek(now, { locale: ptBR }),
        end: endOfDay(now),
      };

    case 'last_week': {
      const lastWeek = subWeeks(now, 1);
      return {
        start: startOfWeek(lastWeek, { locale: ptBR }),
        end: endOfWeek(lastWeek, { locale: ptBR }),
      };
    }

    case 'this_month':
      // Dia 1 até o fim de HOJE
      return {
        start: startOfMonth(now),
        end: endOfDay(now),
      };

    case 'last_month': {
      const lastMonth = subMonths(now, 1);
      return {
        start: startOfMonth(lastMonth),
        end: endOfMonth(lastMonth),
      };
    }

    case 'last_7_days':
      // Hoje + 6 dias anteriores = 7 dias inclusive
      return {
        start: startOfDay(subDays(now, 6)),
        end: endOfDay(now),
      };

    case 'last_30_days':
      // Hoje + 29 dias anteriores = 30 dias inclusive
      return {
        start: startOfDay(subDays(now, 29)),
        end: endOfDay(now),
      };

    case 'select_month': {
      const month = selectedMonth || now;
      return {
        start: startOfMonth(month),
        end: endOfMonth(month),
      };
    }

    case 'custom':
      return { start: undefined, end: undefined };

    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
}

/**
 * Detecta qual preset corresponde a um par de datas.
 */
export function detectPreset(start?: Date, end?: Date): DatePreset | null {
  if (!start && !end) return 'all_time';
  if (!start || !end) return null;

  const now = new Date();
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
  const startStr = fmt(start);
  const endStr = fmt(end);

  // today
  if (startStr === fmt(now) && endStr === fmt(now)) return 'today';

  // yesterday
  const yesterday = subDays(now, 1);
  if (startStr === fmt(yesterday) && endStr === fmt(yesterday)) return 'yesterday';

  // this_week (até hoje)
  const thisWeekStart = startOfWeek(now, { locale: ptBR });
  if (startStr === fmt(thisWeekStart) && endStr === fmt(now)) return 'this_week';

  // last_week
  const lastWeek = subWeeks(now, 1);
  if (
    startStr === fmt(startOfWeek(lastWeek, { locale: ptBR })) &&
    endStr === fmt(endOfWeek(lastWeek, { locale: ptBR }))
  ) return 'last_week';

  // this_month (até hoje)
  if (startStr === fmt(startOfMonth(now)) && endStr === fmt(now)) return 'this_month';

  // last_month
  const lastMonth = subMonths(now, 1);
  if (
    startStr === fmt(startOfMonth(lastMonth)) &&
    endStr === fmt(endOfMonth(lastMonth))
  ) return 'last_month';

  // last_7_days
  if (startStr === fmt(subDays(now, 6)) && endStr === fmt(now)) return 'last_7_days';

  // last_30_days
  if (startStr === fmt(subDays(now, 29)) && endStr === fmt(now)) return 'last_30_days';

  return 'custom';
}

/**
 * Calcula o período anterior equivalente para comparação.
 * Ex.: se o período é 7 dias, o anterior são os 7 dias antes dele.
 */
export function getPreviousPeriod(start?: Date, end?: Date): DateRange {
  if (!start || !end) return { start: undefined, end: undefined };

  const days = differenceInCalendarDays(end, start) + 1; // inclusive
  const prevEnd = subDays(start, 1);
  const prevStart = subDays(start, days);

  return {
    start: startOfDay(prevStart),
    end: endOfDay(prevEnd),
  };
}

/**
 * Retorna o texto comparativo padronizado para exibir nos cards.
 * Baseado no preset ativo ou no intervalo de dias.
 */
export function getComparisonLabel(start?: Date, end?: Date): string {
  if (!start || !end) return 'vs. período anterior';

  const preset = detectPreset(start, end);

  switch (preset) {
    case 'today':
      return 'vs. ontem';
    case 'yesterday':
      return 'vs. anteontem';
    case 'this_week':
      return 'vs. semana passada';
    case 'last_week':
      return 'vs. semana anterior';
    case 'this_month':
      return 'vs. mês passado';
    case 'last_month':
      return 'vs. mês anterior';
    case 'last_7_days':
      return 'vs. 7 dias anteriores';
    case 'last_30_days':
      return 'vs. 30 dias anteriores';
    default: {
      const days = differenceInCalendarDays(end, start) + 1;
      if (days <= 1) return 'vs. dia anterior';
      if (days <= 7) return 'vs. semana anterior';
      if (days <= 31) return 'vs. período anterior';
      return 'vs. período anterior';
    }
  }
}

/**
 * Retorna o label legível de um preset.
 */
export function getPresetLabel(preset: DatePreset): string {
  return PRESET_OPTIONS.find(p => p.value === preset)?.label || 'Período customizado';
}
