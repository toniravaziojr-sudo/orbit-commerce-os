import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import type { NotificationRule, NotificationRuleInput, NotificationRuleAction, NotificationRuleFilter } from "@/hooks/useNotificationRules";

interface RuleFormDialogProps {
  rule: NotificationRule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: NotificationRuleInput) => Promise<NotificationRule | null>;
  onUpdate: (id: string, input: Partial<NotificationRuleInput>) => Promise<boolean>;
}

const eventTypes = [
  'order.paid',
  'order.created',
  'order.shipped',
  'order.delivered',
  'order.canceled',
  'order.tracking_added',
  'cart.abandoned',
  'customer.created',
];

const dedupeOptions = [
  { value: 'order', label: 'Por pedido' },
  { value: 'customer', label: 'Por cliente' },
  { value: 'cart', label: 'Por carrinho' },
  { value: 'none', label: 'Nenhum (sempre envia)' },
];

export function RuleFormDialog({
  rule,
  open,
  onOpenChange,
  onSave,
  onUpdate,
}: RuleFormDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerEventType, setTriggerEventType] = useState('order.paid');
  const [dedupeScope, setDedupeScope] = useState<'order' | 'customer' | 'cart' | 'none'>('order');
  const [priority, setPriority] = useState(0);
  const [isEnabled, setIsEnabled] = useState(true);
  const [filtersJson, setFiltersJson] = useState('[]');
  const [actionsJson, setActionsJson] = useState('[]');
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!rule;

  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setDescription(rule.description || '');
      setTriggerEventType(rule.trigger_event_type);
      setDedupeScope(rule.dedupe_scope || 'none');
      setPriority(rule.priority);
      setIsEnabled(rule.is_enabled);
      setFiltersJson(JSON.stringify(rule.filters || [], null, 2));
      setActionsJson(JSON.stringify(rule.actions || [], null, 2));
    } else {
      // Default for new rule
      setName('');
      setDescription('');
      setTriggerEventType('order.paid');
      setDedupeScope('order');
      setPriority(0);
      setIsEnabled(true);
      setFiltersJson('[]');
      setActionsJson(JSON.stringify([{
        type: 'enqueue_notification',
        channel: 'whatsapp',
        recipient_path: 'customer_phone',
        template_key: 'order_paid',
        delay_seconds: 0,
      }], null, 2));
    }
    setErrors([]);
  }, [rule, open]);

  const validate = (): boolean => {
    const errs: string[] = [];

    if (!name.trim()) {
      errs.push('Nome é obrigatório');
    }

    // Validate filters JSON
    let filters: NotificationRuleFilter[] = [];
    try {
      filters = JSON.parse(filtersJson);
      if (!Array.isArray(filters)) {
        errs.push('Filtros deve ser um array');
      }
    } catch {
      errs.push('Filtros: JSON inválido');
    }

    // Validate actions JSON
    let actions: NotificationRuleAction[] = [];
    try {
      actions = JSON.parse(actionsJson);
      if (!Array.isArray(actions)) {
        errs.push('Ações deve ser um array');
      } else {
        actions.forEach((action, i) => {
          if (action.type !== 'enqueue_notification') {
            errs.push(`Ação #${i + 1}: tipo deve ser 'enqueue_notification'`);
          }
          if (!action.channel) {
            errs.push(`Ação #${i + 1}: channel é obrigatório`);
          }
          if (!action.template_key) {
            errs.push(`Ação #${i + 1}: template_key é obrigatório`);
          }
          if (!action.recipient_path) {
            errs.push(`Ação #${i + 1}: recipient_path é obrigatório`);
          }
          if (action.delay_seconds === undefined || action.delay_seconds < 0) {
            errs.push(`Ação #${i + 1}: delay_seconds deve ser >= 0`);
          }
        });
      }
    } catch {
      errs.push('Ações: JSON inválido');
    }

    setErrors(errs);
    return errs.length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);

    const input: NotificationRuleInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      trigger_event_type: triggerEventType,
      dedupe_scope: dedupeScope,
      priority,
      is_enabled: isEnabled,
      filters: JSON.parse(filtersJson),
      actions: JSON.parse(actionsJson),
    };

    let success: boolean;
    if (isEditing && rule) {
      success = await onUpdate(rule.id, input);
    } else {
      success = !!(await onSave(input));
    }

    setIsSubmitting(false);

    if (success) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Regra' : 'Nova Regra'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside">
                  {errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Notificar pagamento confirmado"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Prioridade</Label>
              <Input
                id="priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Evento Gatilho</Label>
              <Select value={triggerEventType} onValueChange={setTriggerEventType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map(evt => (
                    <SelectItem key={evt} value={evt}>{evt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Escopo de Dedupe</Label>
              <Select value={dedupeScope} onValueChange={(v) => setDedupeScope(v as typeof dedupeScope)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dedupeOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
            <Label>Regra ativa</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filters">Filtros (JSON)</Label>
            <Textarea
              id="filters"
              value={filtersJson}
              onChange={(e) => setFiltersJson(e.target.value)}
              placeholder='[{"path": "payload.status", "op": "eq", "value": "paid"}]'
              rows={3}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Operadores: eq, neq, exists, gte, lte, contains
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="actions">Ações (JSON) *</Label>
            <Textarea
              id="actions"
              value={actionsJson}
              onChange={(e) => setActionsJson(e.target.value)}
              rows={6}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Cada ação deve ter: type, channel, recipient_path, template_key, delay_seconds
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
