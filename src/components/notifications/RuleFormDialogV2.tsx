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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RuleTypeSelector } from "./RuleTypeSelector";
import { TriggerConditionSelector } from "./TriggerConditionSelector";
import { ChannelSelector } from "./ChannelSelector";
import { MessageEditor } from "./MessageEditor";
import { DelaySelector } from "./DelaySelector";
import { ProductScopeSelector } from "./ProductScopeSelector";
import type { 
  NotificationRuleV2, 
  NotificationRuleInputV2, 
  RuleType, 
  TriggerCondition,
  NotificationChannel,
  DelayUnit 
} from "@/hooks/useNotificationRulesV2";

interface RuleFormDialogV2Props {
  rule: NotificationRuleV2 | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: NotificationRuleInputV2) => Promise<NotificationRuleV2 | null>;
  onUpdate: (id: string, input: Partial<NotificationRuleInputV2>) => Promise<boolean>;
}

export function RuleFormDialogV2({
  rule,
  open,
  onOpenChange,
  onSave,
  onUpdate,
}: RuleFormDialogV2Props) {
  const isEditing = !!rule;

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [ruleType, setRuleType] = useState<RuleType>('payment');
  const [triggerCondition, setTriggerCondition] = useState<TriggerCondition>('payment_approved');
  const [channels, setChannels] = useState<NotificationChannel[]>(['whatsapp']);
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [delayValue, setDelayValue] = useState(0);
  const [delayUnit, setDelayUnit] = useState<DelayUnit>('minutes');
  const [productScope, setProductScope] = useState<'all' | 'specific'>('all');
  const [productIds, setProductIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when rule changes
  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setDescription(rule.description || '');
      setIsEnabled(rule.is_enabled);
      setRuleType(rule.rule_type);
      setTriggerCondition(rule.trigger_condition);
      setChannels(rule.channels);
      setWhatsappMessage(rule.whatsapp_message || '');
      setEmailSubject(rule.email_subject || '');
      setEmailBody(rule.email_body || '');
      // Convert stored seconds back to display value based on unit
      const unit = rule.delay_unit || 'minutes';
      let value = rule.delay_seconds || 0;
      if (unit === 'hours') value = Math.round(value / 60);
      if (unit === 'days') value = Math.round(value / (60 * 24));
      setDelayValue(value);
      setDelayUnit(unit);
      setProductScope(rule.product_scope);
      setProductIds(rule.product_ids || []);
    } else {
      // Defaults for new rule
      setName('');
      setDescription('');
      setIsEnabled(true);
      setRuleType('payment');
      setTriggerCondition('payment_approved');
      setChannels(['whatsapp']);
      setWhatsappMessage('Olá {{customer_first_name}}! Seu pagamento foi confirmado. 🎉\n\nPedido: {{order_number}}\nValor: {{order_total}}');
      setEmailSubject('Pagamento confirmado - Pedido {{order_number}}');
      setEmailBody('Olá {{customer_first_name}},\n\nSeu pagamento foi confirmado com sucesso!\n\n**Pedido:** {{order_number}}\n**Valor:** {{order_total}}\n\nObrigado por comprar conosco!\n\n{{store_name}}');
      setDelayValue(0);
      setDelayUnit('minutes');
      setProductScope('all');
      setProductIds([]);
    }
    setErrors([]);
  }, [rule, open]);

  // Update trigger condition when rule type changes
  useEffect(() => {
    if (ruleType === 'payment') {
      setTriggerCondition('payment_approved');
    } else if (ruleType === 'shipping') {
      setTriggerCondition('posted');
    } else {
      setTriggerCondition(null);
    }
  }, [ruleType]);

  const validate = (): boolean => {
    const errs: string[] = [];
    if (!name.trim()) errs.push('Nome é obrigatório');
    if (channels.length === 0) errs.push('Selecione ao menos um canal');
    if (channels.includes('whatsapp') && !whatsappMessage.trim()) {
      errs.push('Mensagem do WhatsApp é obrigatória');
    }
    if (channels.includes('email')) {
      if (!emailSubject.trim()) errs.push('Título do e-mail é obrigatório');
      if (!emailBody.trim()) errs.push('Corpo do e-mail é obrigatório');
    }
    if (productScope === 'specific' && productIds.length === 0) {
      errs.push('Selecione ao menos um produto');
    }
    setErrors(errs);
    return errs.length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);

    const input: NotificationRuleInputV2 = {
      name: name.trim(),
      description: description.trim() || undefined,
      is_enabled: isEnabled,
      rule_type: ruleType,
      trigger_condition: triggerCondition,
      channels,
      whatsapp_message: whatsappMessage.trim() || undefined,
      email_subject: emailSubject.trim() || undefined,
      email_body: emailBody.trim() || undefined,
      delay_seconds: delayValue,
      delay_unit: delayUnit,
      product_scope: productScope,
      product_ids: productScope === 'specific' ? productIds : undefined,
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
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{isEditing ? 'Editar Regra' : 'Nova Regra de Notificação'}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-140px)] px-6">
          <div className="space-y-6 py-4">
            {errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside">
                    {errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Nome e Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Regra *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Notificar pagamento aprovado"
                />
              </div>
              <div className="flex items-center gap-3 pt-8">
                <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
                <Label>Regra ativa</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição da regra..."
                rows={2}
              />
            </div>

            {/* Tipo de Regra */}
            <RuleTypeSelector 
              value={ruleType} 
              onChange={setRuleType}
              disabled={isEditing}
            />

            {/* Condição */}
            <TriggerConditionSelector
              ruleType={ruleType}
              value={triggerCondition}
              onChange={setTriggerCondition}
            />

            {/* Canais */}
            <ChannelSelector
              value={channels}
              onChange={setChannels}
            />

            {/* Mensagens */}
            <MessageEditor
              channels={channels}
              whatsappMessage={whatsappMessage}
              emailSubject={emailSubject}
              emailBody={emailBody}
              onWhatsappMessageChange={setWhatsappMessage}
              onEmailSubjectChange={setEmailSubject}
              onEmailBodyChange={setEmailBody}
            />

            {/* Delay */}
            <DelaySelector
              value={delayValue}
              unit={delayUnit}
              onValueChange={setDelayValue}
              onUnitChange={setDelayUnit}
            />

            {/* Escopo de Produtos */}
            <ProductScopeSelector
              scope={productScope}
              productIds={productIds}
              onScopeChange={setProductScope}
              onProductIdsChange={setProductIds}
            />
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar Regra'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
