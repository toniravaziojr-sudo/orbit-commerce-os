import { useState, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format, parse, isValid, isSameDay, startOfDay, endOfDay, startOfMonth, endOfMonth, setMonth, setYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  type DatePreset,
  PRESET_OPTIONS,
  getPresetDateRange,
  detectPreset,
  getPresetLabel,
} from '@/lib/date-presets';

interface DateFieldOption {
  value: string;
  label: string;
}

export interface DateRangeFilterProps {
  startDate?: Date;
  endDate?: Date;
  onChange: (start?: Date, end?: Date) => void;
  label?: string;
  dateFieldOptions?: DateFieldOption[];
  selectedDateField?: string;
  onDateFieldChange?: (field: string) => void;
  className?: string;
}

export function DateRangeFilter({
  startDate,
  endDate,
  onChange,
  label = 'Data',
  dateFieldOptions,
  selectedDateField,
  onDateFieldChange,
  className,
}: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localStartDate, setLocalStartDate] = useState<Date | undefined>(startDate);
  const [localEndDate, setLocalEndDate] = useState<Date | undefined>(endDate);
  const [activePreset, setActivePreset] = useState<DatePreset | null>(() => detectPreset(startDate, endDate));
  const [startInputValue, setStartInputValue] = useState(startDate ? format(startDate, 'dd/MM/yyyy') : '');
  const [endInputValue, setEndInputValue] = useState(endDate ? format(endDate, 'dd/MM/yyyy') : '');
  const [calendarMonth, setCalendarMonth] = useState<Date>(startDate || new Date());
  // Selection phase: 'start' = next click sets start date, 'end' = next click sets end date
  const [selectionPhase, setSelectionPhase] = useState<'start' | 'end'>('start');

  // Sync local state when props change
  useEffect(() => {
    setLocalStartDate(startDate);
    setLocalEndDate(endDate);
    setStartInputValue(startDate ? format(startDate, 'dd/MM/yyyy') : '');
    setEndInputValue(endDate ? format(endDate, 'dd/MM/yyyy') : '');
    setActivePreset(detectPreset(startDate, endDate));
  }, [startDate, endDate]);

  const hasFilter = startDate && endDate;

  const handlePresetClick = (preset: DatePreset) => {
    // Reset selection phase when picking a preset
    setSelectionPhase('start');

    if (preset === 'custom') {
      setActivePreset('custom');
      return;
    }

    if (preset === 'all_time') {
      setActivePreset('all_time');
      setLocalStartDate(undefined);
      setLocalEndDate(undefined);
      setStartInputValue('');
      setEndInputValue('');
      return;
    }

    if (preset === 'select_month') {
      setActivePreset('select_month');
      const { start, end } = getPresetDateRange('select_month', calendarMonth);
      setLocalStartDate(start);
      setLocalEndDate(end);
      setStartInputValue(start ? format(start, 'dd/MM/yyyy') : '');
      setEndInputValue(end ? format(end, 'dd/MM/yyyy') : '');
      return;
    }

    setActivePreset(preset);
    const { start, end } = getPresetDateRange(preset);
    setLocalStartDate(start);
    setLocalEndDate(end);
    setStartInputValue(start ? format(start, 'dd/MM/yyyy') : '');
    setEndInputValue(end ? format(end, 'dd/MM/yyyy') : '');
  };

  // Unified calendar click handler — works for both left and right calendars
  const handleCalendarDayClick = (date: Date | undefined) => {
    if (!date) return;

    setActivePreset('custom');

    if (selectionPhase === 'start') {
      // First click: set start, clear end, move to 'end' phase
      const dayStart = startOfDay(date);
      setLocalStartDate(dayStart);
      setLocalEndDate(undefined);
      setStartInputValue(format(dayStart, 'dd/MM/yyyy'));
      setEndInputValue('');
      setSelectionPhase('end');
    } else {
      // Second click: set end date
      const dayEnd = endOfDay(date);
      
      // If same day as start or before start → select single day
      if (localStartDate && (isSameDay(date, localStartDate) || date < localStartDate)) {
        const singleDay = startOfDay(date);
        setLocalStartDate(singleDay);
        setLocalEndDate(endOfDay(date));
        setStartInputValue(format(singleDay, 'dd/MM/yyyy'));
        setEndInputValue(format(date, 'dd/MM/yyyy'));
      } else {
        setLocalEndDate(dayEnd);
        setEndInputValue(format(date, 'dd/MM/yyyy'));
      }
      setSelectionPhase('start');
    }
  };

  const handleStartInputChange = (value: string) => {
    setStartInputValue(value);
    const parsed = parse(value, 'dd/MM/yyyy', new Date());
    if (isValid(parsed)) {
      setLocalStartDate(startOfDay(parsed));
      setActivePreset('custom');
      setSelectionPhase('start');
    }
  };

  const handleEndInputChange = (value: string) => {
    setEndInputValue(value);
    const parsed = parse(value, 'dd/MM/yyyy', new Date());
    if (isValid(parsed)) {
      setLocalEndDate(endOfDay(parsed));
      setActivePreset('custom');
      setSelectionPhase('start');
    }
  };

  const handleApply = () => {
    onChange(localStartDate, localEndDate);
    setIsOpen(false);
  };

  const handleClear = () => {
    setLocalStartDate(undefined);
    setLocalEndDate(undefined);
    setStartInputValue('');
    setEndInputValue('');
    setActivePreset(null);
    setSelectionPhase('start');
    onChange(undefined, undefined);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setLocalStartDate(startDate);
    setLocalEndDate(endDate);
    setStartInputValue(startDate ? format(startDate, 'dd/MM/yyyy') : '');
    setEndInputValue(endDate ? format(endDate, 'dd/MM/yyyy') : '');
    setActivePreset(detectPreset(startDate, endDate));
    setIsOpen(false);
  };

  // Calculate next month for second calendar
  const nextMonth = new Date(calendarMonth);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  // Display text
  const detectedPreset = detectPreset(startDate, endDate);
  const presetLabel = detectedPreset && detectedPreset !== 'custom' && detectedPreset !== 'select_month'
    ? getPresetLabel(detectedPreset)
    : null;

  const displayText = presetLabel
    ? `Período: ${presetLabel}`
    : hasFilter
      ? `Período: ${format(startDate!, 'dd/MM/yyyy')} até ${format(endDate!, 'dd/MM/yyyy')}`
      : `Período: Todo o período`;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'gap-2 h-10',
            hasFilter && 'border-primary text-primary',
            className
          )}
        >
          <Calendar className="h-4 w-4" />
          <span className="truncate max-w-[250px]">{displayText}</span>
          {hasFilter && (
            <X
              className="h-3 w-3 ml-1 opacity-70 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start" sideOffset={4}>
        <div className="p-4 space-y-4">
          {/* Date Field Selector */}
          {dateFieldOptions && dateFieldOptions.length > 0 && (
            <Select value={selectedDateField} onValueChange={onDateFieldChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={label} />
              </SelectTrigger>
              <SelectContent>
                {dateFieldOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Date Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Início do período</Label>
              <Input
                value={startInputValue}
                onChange={(e) => handleStartInputChange(e.target.value)}
                placeholder="DD/MM/AAAA"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Fim do período</Label>
              <Input
                value={endInputValue}
                onChange={(e) => handleEndInputChange(e.target.value)}
                placeholder="DD/MM/AAAA"
                className="h-9"
              />
            </div>
          </div>

          {/* Calendars and Presets */}
          <div className="flex gap-4">
            {/* Calendar area — shows month picker grid or day calendars */}
            <div className="flex gap-2">
              {activePreset === 'select_month' ? (
                <MonthPickerGrid
                  selectedMonth={calendarMonth}
                  onSelectMonth={(month) => {
                    setCalendarMonth(month);
                    const start = startOfMonth(month);
                    const end = endOfMonth(month);
                    setLocalStartDate(start);
                    setLocalEndDate(end);
                    setStartInputValue(format(start, 'dd/MM/yyyy'));
                    setEndInputValue(format(end, 'dd/MM/yyyy'));
                  }}
                />
              ) : (
                <>
                  <CalendarComponent
                    mode="single"
                    selected={localStartDate}
                    onSelect={handleCalendarDayClick}
                    month={calendarMonth}
                    onMonthChange={setCalendarMonth}
                    locale={ptBR}
                    className="rounded-md border pointer-events-auto"
                    modifiers={{
                      range: localStartDate && localEndDate ? {
                        from: localStartDate,
                        to: localEndDate,
                      } : undefined,
                      rangeStart: localStartDate ? localStartDate : undefined,
                    }}
                    modifiersStyles={{
                      range: {
                        backgroundColor: 'hsl(var(--primary) / 0.1)',
                      },
                    }}
                  />
                  <CalendarComponent
                    mode="single"
                    selected={localEndDate}
                    onSelect={handleCalendarDayClick}
                    month={nextMonth}
                    onMonthChange={(month) => {
                      const prev = new Date(month);
                      prev.setMonth(prev.getMonth() - 1);
                      setCalendarMonth(prev);
                    }}
                    locale={ptBR}
                    className="rounded-md border pointer-events-auto"
                    modifiers={{
                      range: localStartDate && localEndDate ? {
                        from: localStartDate,
                        to: localEndDate,
                      } : undefined,
                    }}
                    modifiersStyles={{
                      range: {
                        backgroundColor: 'hsl(var(--primary) / 0.1)',
                      },
                    }}
                  />
                </>
              )}
            </div>

            {/* Presets */}
            <div className="flex flex-col gap-1 min-w-[160px]">
              {PRESET_OPTIONS.map((preset, index) => {
                const prevGroup = index > 0 ? PRESET_OPTIONS[index - 1].group : null;
                const showSeparator = prevGroup && prevGroup !== preset.group;

                return (
                  <div key={preset.value}>
                    {showSeparator && <div className="h-px bg-border my-1" />}
                    <Button
                      variant={activePreset === preset.value ? 'default' : 'ghost'}
                      size="sm"
                      className={cn(
                        'justify-start h-8 text-sm w-full',
                        activePreset === preset.value && 'bg-primary text-primary-foreground'
                      )}
                      onClick={() => handlePresetClick(preset.value)}
                    >
                      {preset.label}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleApply}>
              Filtrar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril',
  'Maio', 'Junho', 'Julho', 'Agosto',
  'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function MonthPickerGrid({
  selectedMonth,
  onSelectMonth,
}: {
  selectedMonth: Date;
  onSelectMonth: (month: Date) => void;
}) {
  const [year, setYear] = useState(selectedMonth.getFullYear());
  const currentMonth = selectedMonth.getMonth();
  const currentYear = selectedMonth.getFullYear();

  return (
    <div className="rounded-md border p-4 min-w-[280px]">
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => setYear(y => y - 1)}
        >
          <span className="sr-only">Ano anterior</span>
          ‹
        </Button>
        <span className="text-sm font-medium">{year}</span>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => setYear(y => y + 1)}
        >
          <span className="sr-only">Próximo ano</span>
          ›
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {MONTH_NAMES.map((name, index) => {
          const isSelected = index === currentMonth && year === currentYear;
          return (
            <Button
              key={name}
              variant={isSelected ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                'h-9 text-xs',
                isSelected && 'bg-primary text-primary-foreground'
              )}
              onClick={() => {
                let d = new Date(year, index, 1);
                onSelectMonth(d);
              }}
            >
              {name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
