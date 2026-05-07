import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-mobile';

interface BirthDateInputProps {
  id?: string;
  /** ISO yyyy-MM-dd (source of truth) */
  value: string;
  onChange: (isoValue: string) => void;
  disabled?: boolean;
  className?: string;
  /** ISO yyyy-MM-dd max date */
  max?: string;
}

function isoToBr(iso: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function brToIso(br: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10);
  const year = parseInt(yyyy, 10);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 1900 || year > 9999) return null;
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

function maskBr(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  const len = digits.length;
  if (len <= 2) return digits;
  if (len <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Birth date input.
 * - Desktop: native <input type="date"> (good UX with calendar picker).
 * - Mobile: text input with dd/mm/aaaa auto-mask + numeric keypad,
 *   avoiding the painful native month-by-month picker.
 * Source of truth is always ISO yyyy-MM-dd.
 */
export function BirthDateInput({
  id,
  value,
  onChange,
  disabled,
  className,
  max,
}: BirthDateInputProps) {
  const isMobile = useIsMobile();
  const [localBr, setLocalBr] = useState(() => isoToBr(value));

  // Keep local masked value in sync when ISO changes externally (autofill / reset)
  useEffect(() => {
    setLocalBr(isoToBr(value));
  }, [value]);

  if (!isMobile) {
    return (
      <Input
        id={id}
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        max={max}
        disabled={disabled}
        className={className}
      />
    );
  }

  const handleChange = (raw: string) => {
    const masked = maskBr(raw);
    setLocalBr(masked);
    const iso = brToIso(masked);
    if (iso) {
      onChange(iso);
    } else if (masked === '') {
      onChange('');
    }
  };

  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="bday"
      placeholder="dd/mm/aaaa"
      value={localBr}
      onChange={(e) => handleChange(e.target.value)}
      maxLength={10}
      disabled={disabled}
      className={className}
    />
  );
}
