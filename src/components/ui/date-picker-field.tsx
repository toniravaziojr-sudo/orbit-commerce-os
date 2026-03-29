import { useState } from 'react';
import { CalendarIcon, X } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface DatePickerFieldProps {
  value?: Date;
  onChange: (date?: Date) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  clearable?: boolean;
  className?: string;
  /** Format for display. Default: dd/MM/yyyy */
  displayFormat?: string;
}

export function DatePickerField({
  value,
  onChange,
  placeholder = 'Selecione uma data',
  disabled = false,
  minDate,
  maxDate,
  clearable = true,
  className,
  displayFormat = 'dd/MM/yyyy',
}: DatePickerFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value ? format(value, displayFormat) : '');

  const handleSelect = (date: Date | undefined) => {
    onChange(date);
    setInputValue(date ? format(date, displayFormat) : '');
    setIsOpen(false);
  };

  const handleInputChange = (rawValue: string) => {
    setInputValue(rawValue);
    if (rawValue === '') {
      onChange(undefined);
      return;
    }
    const parsed = parse(rawValue, displayFormat, new Date());
    if (isValid(parsed)) {
      const passesMin = !minDate || parsed >= minDate;
      const passesMax = !maxDate || parsed <= maxDate;
      if (passesMin && passesMax) {
        onChange(parsed);
      }
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
    setInputValue('');
  };

  const disabledDays = (date: Date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

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
          <span className="truncate flex-1">
            {value ? format(value, displayFormat) : placeholder}
          </span>
          {clearable && value && (
            <X
              className="h-3.5 w-3.5 ml-1 opacity-60 hover:opacity-100 shrink-0"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 pb-1 border-b">
          <Input
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="DD/MM/AAAA"
            className="h-8 text-sm"
          />
        </div>
        <Calendar
          mode="single"
          selected={value}
          onSelect={handleSelect}
          disabled={disabledDays}
          locale={ptBR}
          initialFocus
          className={cn('p-3 pointer-events-auto')}
          defaultMonth={value || undefined}
        />
      </PopoverContent>
    </Popover>
  );
}
