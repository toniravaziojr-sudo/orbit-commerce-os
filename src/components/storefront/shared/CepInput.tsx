import { useCallback, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { sanitizeCep } from '@/lib/cepUtils';

interface CepInputProps
  extends Omit<
    ComponentProps<typeof Input>,
    'type' | 'inputMode' | 'autoComplete' | 'autoCorrect' | 'autoCapitalize' | 'spellCheck' | 'maxLength' | 'value' | 'onChange'
  > {
  value: string;
  onValueChange: (digits: string) => void;
  source?: string;
}

export function CepInput({ value, onValueChange, source, id, placeholder = '00000000', ...props }: CepInputProps) {
  const componentSource = source ?? id ?? 'unknown';

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = sanitizeCep(raw);
    const nativeEvent = e.nativeEvent as InputEvent | undefined;

    console.log('[CepInput:change]', {
      source: componentSource,
      raw,
      digits,
      displayed: sanitizeCep(value),
      selectionStart: e.target.selectionStart,
      selectionEnd: e.target.selectionEnd,
      inputType: nativeEvent?.inputType ?? null,
    });

    onValueChange(digits);
  }, [componentSource, onValueChange, value]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const raw = e.clipboardData.getData('text');
    const digits = sanitizeCep(raw);

    console.log('[CepInput:paste]', {
      source: componentSource,
      raw,
      digits,
    });

    e.preventDefault();
    onValueChange(digits);
  }, [componentSource, onValueChange]);

  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="new-password"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      value={sanitizeCep(value)}
      onChange={handleChange}
      onPaste={handlePaste}
      placeholder={placeholder}
      maxLength={8}
      data-cep-input-source={componentSource}
      {...props}
    />
  );
}
