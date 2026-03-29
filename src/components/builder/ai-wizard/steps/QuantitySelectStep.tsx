// =============================================
// QUANTITY SELECT STEP — User picks a number (e.g. slide count, image count)
// =============================================

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface QuantitySelectStepProps {
  value?: number;
  onChange: (count: number) => void;
  min?: number;
  max?: number;
  defaultValue?: number;
}

export function QuantitySelectStep({
  value,
  onChange,
  min = 1,
  max = 10,
  defaultValue = 3,
}: QuantitySelectStepProps) {
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const current = value ?? defaultValue;

  return (
    <div className="space-y-2">
      <Label className="text-sm">Quantidade</Label>
      <Select
        value={String(current)}
        onValueChange={(v) => onChange(Number(v))}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}