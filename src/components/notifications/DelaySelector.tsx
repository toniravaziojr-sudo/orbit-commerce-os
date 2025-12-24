import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DelayUnit } from "@/hooks/useNotificationRulesV2";

interface DelaySelectorProps {
  value: number;
  unit: DelayUnit;
  onValueChange: (value: number) => void;
  onUnitChange: (unit: DelayUnit) => void;
}

const delayUnits: { value: DelayUnit; label: string }[] = [
  { value: 'minutes', label: 'Minutos' },
  { value: 'hours', label: 'Horas' },
  { value: 'days', label: 'Dias' },
];

export function DelaySelector({ value, unit, onValueChange, onUnitChange }: DelaySelectorProps) {
  return (
    <div className="space-y-2">
      <Label>Tempo de Disparo (delay)</Label>
      <p className="text-xs text-muted-foreground">
        Quanto tempo após a condição ser atingida a mensagem será enviada
      </p>
      <div className="flex gap-2">
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onValueChange(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-24"
          placeholder="0"
        />
        <Select value={unit} onValueChange={(v) => onUnitChange(v as DelayUnit)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {delayUnits.map((u) => (
              <SelectItem key={u.value} value={u.value}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
