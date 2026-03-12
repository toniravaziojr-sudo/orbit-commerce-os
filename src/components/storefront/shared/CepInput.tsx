import { useCallback, useRef, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { sanitizeCep, formatCepDisplay } from '@/lib/cepUtils';

interface CepInputProps
  extends Omit<
    ComponentProps<typeof Input>,
    'type' | 'inputMode' | 'autoComplete' | 'autoCorrect' | 'autoCapitalize' | 'spellCheck' | 'maxLength' | 'value' | 'onChange' | 'onBlur' | 'onKeyDown'
  > {
  value: string;
  onValueChange: (digits: string) => void;
}

export function CepInput({ value, onValueChange, placeholder = '00000-000', ...props }: CepInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle backspace/delete near the hyphen to prevent "stuck" feeling
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const pos = el.selectionStart ?? 0;
    const selEnd = el.selectionEnd ?? 0;

    // Only intercept when there's no text selection
    if (pos !== selEnd) return;

    const digits = sanitizeCep(value);

    if (e.key === 'Backspace') {
      // If cursor is right after the hyphen (position 6), skip the hyphen
      // and delete the digit before it (position 4 in digits, which is index 4)
      if (pos === 6 && digits.length >= 5) {
        e.preventDefault();
        const newDigits = digits.slice(0, 4) + digits.slice(5);
        onValueChange(newDigits);
        // Place cursor before where the hyphen will be
        requestAnimationFrame(() => {
          if (inputRef.current) {
            inputRef.current.setSelectionRange(4, 4);
          }
        });
        return;
      }
    }

    if (e.key === 'Delete') {
      // If cursor is right before the hyphen (position 5), skip the hyphen
      // and delete the digit after it (position 5 in digits, which is index 5)
      if (pos === 5 && digits.length > 5) {
        e.preventDefault();
        const newDigits = digits.slice(0, 5) + digits.slice(6);
        onValueChange(newDigits);
        requestAnimationFrame(() => {
          if (inputRef.current) {
            // cursor stays at position 5, but now after hyphen it shows next digit
            inputRef.current.setSelectionRange(6, 6);
          }
        });
        return;
      }
    }
  }, [value, onValueChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const rawValue = el.value;
    const newDigits = sanitizeCep(rawValue);
    const prevDigits = sanitizeCep(value);

    // Calculate where cursor should go after formatting
    const cursorPos = el.selectionStart ?? rawValue.length;
    // Count digits before cursor in the raw input
    const digitsBefore = rawValue.slice(0, cursorPos).replace(/\D/g, '').length;

    onValueChange(newDigits);

    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      if (inputRef.current) {
        const formatted = formatCepDisplay(newDigits);
        // Find position in formatted string that corresponds to digitsBefore digits
        let targetPos = 0;
        let counted = 0;
        for (let i = 0; i < formatted.length && counted < digitsBefore; i++) {
          targetPos = i + 1;
          if (/\d/.test(formatted[i])) {
            counted++;
          }
        }
        inputRef.current.setSelectionRange(targetPos, targetPos);
      }
    });
  }, [onValueChange, value]);

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      value={formatCepDisplay(value)}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      maxLength={9}
      {...props}
    />
  );
}
