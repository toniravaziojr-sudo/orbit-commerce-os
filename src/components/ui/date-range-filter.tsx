import { useState, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, startOfDay, endOfDay, parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type PresetType = 'today' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'select_month' | 'custom';

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

const presets: { value: PresetType; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'this_week', label: 'Esta semana' },
  { value: 'last_week', label: 'Semana passada' },
  { value: 'this_month', label: 'Este mês' },
  { value: 'last_month', label: 'Mês passado' },
  { value: 'select_month', label: 'Selecionar mês' },
  { value: 'custom', label: 'Período customizado' },
];

function getPresetDates(preset: PresetType, selectedMonth?: Date): { start: Date; end: Date } {
  const now = new Date();
  
  switch (preset) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'this_week':
      return { start: startOfWeek(now, { locale: ptBR }), end: endOfWeek(now, { locale: ptBR }) };
    case 'last_week':
      const lastWeek = subWeeks(now, 1);
      return { start: startOfWeek(lastWeek, { locale: ptBR }), end: endOfWeek(lastWeek, { locale: ptBR }) };
    case 'this_month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'last_month':
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    case 'select_month':
      if (selectedMonth) {
        return { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) };
      }
      return { start: startOfMonth(now), end: endOfMonth(now) };
    default:
      return { start: now, end: now };
  }
}

function detectPreset(start?: Date, end?: Date): PresetType | null {
  if (!start || !end) return null;
  
  const now = new Date();
  
  // Check today
  if (format(start, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd') && 
      format(end, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')) {
    return 'today';
  }
  
  // Check this week
  const thisWeekStart = startOfWeek(now, { locale: ptBR });
  const thisWeekEnd = endOfWeek(now, { locale: ptBR });
  if (format(start, 'yyyy-MM-dd') === format(thisWeekStart, 'yyyy-MM-dd') && 
      format(end, 'yyyy-MM-dd') === format(thisWeekEnd, 'yyyy-MM-dd')) {
    return 'this_week';
  }
  
  // Check last week
  const lastWeek = subWeeks(now, 1);
  const lastWeekStart = startOfWeek(lastWeek, { locale: ptBR });
  const lastWeekEnd = endOfWeek(lastWeek, { locale: ptBR });
  if (format(start, 'yyyy-MM-dd') === format(lastWeekStart, 'yyyy-MM-dd') && 
      format(end, 'yyyy-MM-dd') === format(lastWeekEnd, 'yyyy-MM-dd')) {
    return 'last_week';
  }
  
  // Check this month
  if (format(start, 'yyyy-MM-dd') === format(startOfMonth(now), 'yyyy-MM-dd') && 
      format(end, 'yyyy-MM-dd') === format(endOfMonth(now), 'yyyy-MM-dd')) {
    return 'this_month';
  }
  
  // Check last month
  const lastMonth = subMonths(now, 1);
  if (format(start, 'yyyy-MM-dd') === format(startOfMonth(lastMonth), 'yyyy-MM-dd') && 
      format(end, 'yyyy-MM-dd') === format(endOfMonth(lastMonth), 'yyyy-MM-dd')) {
    return 'last_month';
  }
  
  return 'custom';
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
  const [activePreset, setActivePreset] = useState<PresetType | null>(() => detectPreset(startDate, endDate));
  const [startInputValue, setStartInputValue] = useState(startDate ? format(startDate, 'dd/MM/yyyy') : '');
  const [endInputValue, setEndInputValue] = useState(endDate ? format(endDate, 'dd/MM/yyyy') : '');
  const [calendarMonth, setCalendarMonth] = useState<Date>(startDate || new Date());
  
  // Sync local state when props change
  useEffect(() => {
    setLocalStartDate(startDate);
    setLocalEndDate(endDate);
    setStartInputValue(startDate ? format(startDate, 'dd/MM/yyyy') : '');
    setEndInputValue(endDate ? format(endDate, 'dd/MM/yyyy') : '');
    setActivePreset(detectPreset(startDate, endDate));
  }, [startDate, endDate]);
  
  const hasFilter = startDate && endDate;
  
  const handlePresetClick = (preset: PresetType) => {
    if (preset === 'custom') {
      setActivePreset('custom');
      return;
    }
    
    if (preset === 'select_month') {
      setActivePreset('select_month');
      // Use the calendar month for month selection
      const { start, end } = getPresetDates('select_month', calendarMonth);
      setLocalStartDate(start);
      setLocalEndDate(end);
      setStartInputValue(format(start, 'dd/MM/yyyy'));
      setEndInputValue(format(end, 'dd/MM/yyyy'));
      return;
    }
    
    setActivePreset(preset);
    const { start, end } = getPresetDates(preset);
    setLocalStartDate(start);
    setLocalEndDate(end);
    setStartInputValue(format(start, 'dd/MM/yyyy'));
    setEndInputValue(format(end, 'dd/MM/yyyy'));
  };
  
  const handleStartDateSelect = (date: Date | undefined) => {
    setLocalStartDate(date);
    setStartInputValue(date ? format(date, 'dd/MM/yyyy') : '');
    setActivePreset('custom');
  };
  
  const handleEndDateSelect = (date: Date | undefined) => {
    setLocalEndDate(date);
    setEndInputValue(date ? format(date, 'dd/MM/yyyy') : '');
    setActivePreset('custom');
  };
  
  const handleStartInputChange = (value: string) => {
    setStartInputValue(value);
    const parsed = parse(value, 'dd/MM/yyyy', new Date());
    if (isValid(parsed)) {
      setLocalStartDate(parsed);
      setActivePreset('custom');
    }
  };
  
  const handleEndInputChange = (value: string) => {
    setEndInputValue(value);
    const parsed = parse(value, 'dd/MM/yyyy', new Date());
    if (isValid(parsed)) {
      setLocalEndDate(parsed);
      setActivePreset('custom');
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
    onChange(undefined, undefined);
    setIsOpen(false);
  };
  
  const handleCancel = () => {
    // Reset to original values
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
  
  const displayText = hasFilter
    ? `${label}: ${format(startDate, 'dd/MM/yyyy')} até ${format(endDate, 'dd/MM/yyyy')}`
    : label;
  
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
            {/* Two Calendars */}
            <div className="flex gap-2">
              <CalendarComponent
                mode="single"
                selected={localStartDate}
                onSelect={handleStartDateSelect}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
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
              <CalendarComponent
                mode="single"
                selected={localEndDate}
                onSelect={handleEndDateSelect}
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
            </div>
            
            {/* Presets */}
            <div className="flex flex-col gap-1 min-w-[140px]">
              {presets.map((preset) => (
                <Button
                  key={preset.value}
                  variant={activePreset === preset.value ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    'justify-start h-8 text-sm',
                    activePreset === preset.value && 'bg-primary text-primary-foreground'
                  )}
                  onClick={() => handlePresetClick(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
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
