import { useCallback, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { sanitizeCep, formatCepDisplay } from '@/lib/cepUtils';

interface CepInputProps
  extends Omit<
    ComponentProps<typeof Input>,
    'type' | 'inputMode' | 'autoComplete' | 'autoCorrect' | 'autoCapitalize' | 'spellCheck' | 'maxLength' | 'value' | 'onChange' | 'onBlur'
  > {
  value: string;
  onValueChange: (digits: string) => void;
}

export function CepInput({ value, onValueChange, placeholder = '00000-000', ...props }: CepInputProps) {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onValueChange(sanitizeCep(e.target.value));
  }, [onValueChange]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const digits = sanitizeCep(e.target.value);
    if (digits !== sanitizeCep(value)) {
      onValueChange(digits);
    }
  }, [onValueChange, value]);

  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      value={formatCepDisplay(value)}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      maxLength={9}
      {...props}
    />
  );
}
