import { useCallback, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { sanitizeCep, formatCepDisplay } from '@/lib/cepUtils';

interface CepInputProps
  extends Omit<
    ComponentProps<typeof Input>,
    'type' | 'inputMode' | 'autoComplete' | 'autoCorrect' | 'autoCapitalize' | 'spellCheck' | 'maxLength' | 'value' | 'onChange'
  > {
  value: string;
  onValueChange: (digits: string) => void;
}

export function CepInput({ value, onValueChange, placeholder = '00000-000', ...props }: CepInputProps) {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // RULE: Always sanitize FIRST, before any logic
    const digits = sanitizeCep(e.target.value);
    console.log('[CepInput]', { raw: e.target.value, digits, prev: value });
    onValueChange(digits);
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
      placeholder={placeholder}
      maxLength={9}
      {...props}
    />
  );
}
