import { useState, useEffect } from 'react';
import { CalendarIcon, Clock, X } from 'lucide-react';
import { format, parse, isValid, setHours, setMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatTimeBR } from "@/lib/date-format";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface DateTimePickerFieldProps {
  value?: Date;
  onChange: (date?: Date) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  clearable?: boolean;
  className?: string;
}

export function DateTimePickerField({
  value,
  onChange,
  placeholder = 'Selecione data e hora',
  disabled = false,
  minDate,
  maxDate,
  clearable = true,
  className,
}: DateTimePickerFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(value);
  const [timeValue, setTimeValue] = useState(value ? formatTimeBR(value) : '00:00');

  useEffect(() => {
    setSelectedDate(value);
    setTimeValue(value ? formatTimeBR(value) : '00:00');
  }, [value]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      setSelectedDate(undefined);
      return;
    }
    // Preserve current time
    const [hours, minutes] = timeValue.split(':').map(Number);
    const withTime = setMinutes(setHours(date, hours || 0), minutes || 0);
    setSelectedDate(withTime);
  };

  const handleTimeChange = (newTime: string) => {
    setTimeValue(newTime);
    if (selectedDate) {
      const [hours, minutes] = newTime.split(':').map(Number);
      const updated = setMinutes(setHours(selectedDate, hours || 0), minutes || 0);
      setSelectedDate(updated);
    }
  };

  const handleApply = () => {
    onChange(selectedDate);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
    setSelectedDate(undefined);
    setTimeValue('00:00');
  };

  const handleCancel = () => {
    setSelectedDate(value);
    setTimeValue(value ? formatTimeBR(value) : '00:00');
    setIsOpen(false);
  };

  const disabledDays = (date: Date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const displayText = value
    ? format(value, "dd/MM/yyyy 'às' HH:mm")
    : placeholder;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal h-10',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate flex-1">{displayText}</span>
          {clearable && value && (
            <X
              className="h-3.5 w-3.5 ml-1 opacity-60 hover:opacity-100 shrink-0"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          disabled={disabledDays}
          locale={ptBR}
          initialFocus
          className={cn('p-3 pointer-events-auto')}
          defaultMonth={selectedDate || undefined}
        />
        <div className="border-t px-3 py-3 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <Label className="text-sm text-muted-foreground shrink-0">Horário</Label>
            <Input
              type="time"
              value={timeValue}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="h-8 w-[110px] text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleApply}>
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
