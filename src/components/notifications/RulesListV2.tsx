import { useState } from "react";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { NotificationRuleV2, RuleType } from "@/hooks/useNotificationRulesV2";
import { useTenantType } from "@/hooks/useTenantType";

interface RulesListV2Props {
  rules: NotificationRuleV2[];
  isLoading: boolean;
  canEdit: boolean;
  onToggle: (id: string, enabled: boolean) => Promise<boolean>;
  onEdit: (rule: NotificationRuleV2) => void;
  onDelete: (id: string) => Promise<boolean>;
  onCreate: () => void;
}

const ruleTypeConfig: Record<RuleType, { label: string; description: string }> = {
  payment: { label: 'Pagamentos', description: 'Notificações sobre status de pagamento' },
  shipping: { label: 'Envios', description: 'Notificações sobre rastreio e entrega' },
  abandoned_checkout: { label: 'Checkout Abandonado', description: 'Recuperação de carrinhos abandonados' },
  post_sale: { label: 'Pós-vendas', description: 'Mensagens após a compra do cliente' },
};

const triggerConditionLabels: Record<string, string> = {
  payment_approved: 'Pagamento aprovado',
  pix_generated: 'PIX gerado',
  boleto_generated: 'Boleto gerado',
  payment_declined: 'Pagamento recusado',
  payment_expired: 'Pagamento expirado/cancelado',
  posted: 'Enviado/Postado',
  first_movement: 'A caminho (1ª movimentação)',
  out_for_delivery: 'Chegando (em rota)',
  awaiting_pickup: 'Aguardando retirada',
  returning: 'Em devolução',
  issue: 'Imprevisto/Problema',
  delivered: 'Entregue',
};

const delayLabel = (seconds: number, unit: string | null) => {
  if (!seconds || seconds === 0) return 'Imediatamente';
  let value = seconds;
  let unitLabel = 'min';
  if (unit === 'hours') {
    value = Math.round(seconds / 60);
    unitLabel = value === 1 ? 'hora' : 'horas';
  } else if (unit === 'days') {
    value = Math.round(seconds / (60 * 24));
    unitLabel = value === 1 ? 'dia' : 'dias';
  } else {
    unitLabel = value === 1 ? 'minuto' : 'minutos';
  }
  return `${value} ${unitLabel}`;
};

export function RulesListV2({
  rules,
  isLoading,
  canEdit,
  onToggle,
  onEdit,
  onDelete,
  onCreate,
}: RulesListV2Props) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { isPlatformTenant } = useTenantType();

  // Platform tenant (admin) doesn't see "Envios" tab - filter it out
  const visibleRuleTypes: RuleType[] = isPlatformTenant 
    ? ['payment', 'abandoned_checkout', 'post_sale']
    : ['payment', 'shipping', 'abandoned_checkout', 'post_sale'];

  const rulesByType = (type: RuleType) => rules.filter((r) => r.rule_type === type);

  const handleToggle = async (rule: NotificationRuleV2) => {
    setTogglingId(rule.id);
    await onToggle(rule.id, !rule.is_enabled);
    setTogglingId(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeletingId(deleteId);
    await onDelete(deleteId);
    setDeletingId(null);
    setDeleteId(null);
  };

  const renderRuleCard = (rule: NotificationRuleV2) => (
    <Card key={rule.id} className={`transition-opacity ${!rule.is_enabled ? 'opacity-60' : ''}`}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium truncate">{rule.name}</span>
              <Badge variant={rule.is_enabled ? 'default' : 'secondary'}>
                {rule.is_enabled ? 'Ativa' : 'Inativa'}
              </Badge>
            </div>
            {rule.description && (
              <p className="text-sm text-muted-foreground mb-2 truncate">{rule.description}</p>
            )}
            <div className="flex flex-wrap gap-2 text-xs">
              {rule.trigger_condition && (
                <Badge variant="outline">
                  {triggerConditionLabels[rule.trigger_condition] || rule.trigger_condition}
                </Badge>
              )}
              {rule.channels.map((ch) => (
                <Badge key={ch} variant="secondary" className="capitalize">
                  {ch === 'whatsapp' ? 'WhatsApp' : 'E-mail'}
                </Badge>
              ))}
              <Badge variant="outline">
                {delayLabel(rule.delay_seconds || 0, rule.delay_unit)}
              </Badge>
              <Badge variant="outline">
                {rule.product_scope === 'all' ? 'Todos os produtos' : `${rule.product_ids?.length || 0} produto(s)`}
              </Badge>
            </div>
          </div>

          {canEdit && (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleToggle(rule)}
                disabled={togglingId === rule.id}
                title={rule.is_enabled ? 'Desativar' : 'Ativar'}
              >
                {togglingId === rule.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : rule.is_enabled ? (
                  <ToggleRight className="h-4 w-4 text-green-600" />
                ) : (
                  <ToggleLeft className="h-4 w-4" />
                )}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onEdit(rule)} title="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteId(rule.id)}
                title="Excluir"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderTabContent = (type: RuleType) => {
    const typeRules = rulesByType(type);

    if (isLoading) {
      return (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      );
    }

    if (typeRules.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <p className="mb-4">Nenhuma regra de {ruleTypeConfig[type].label.toLowerCase()} cadastrada</p>
          {canEdit && (
            <Button onClick={onCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeira regra
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {typeRules.map(renderRuleCard)}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Configure regras para enviar notificações automáticas via WhatsApp e E-mail
        </p>
        {canEdit && (
          <Button onClick={onCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nova regra
          </Button>
        )}
      </div>

      <Tabs defaultValue="payment" className="space-y-4">
        <TabsList className={`grid w-full ${isPlatformTenant ? 'grid-cols-3' : 'grid-cols-4'}`}>
          <TabsTrigger value="payment" className="text-xs sm:text-sm">
            Pagamentos ({rulesByType('payment').length})
          </TabsTrigger>
          {!isPlatformTenant && (
            <TabsTrigger value="shipping" className="text-xs sm:text-sm">
              Envios ({rulesByType('shipping').length})
            </TabsTrigger>
          )}
          <TabsTrigger value="abandoned_checkout" className="text-xs sm:text-sm">
            Abandonado ({rulesByType('abandoned_checkout').length})
          </TabsTrigger>
          <TabsTrigger value="post_sale" className="text-xs sm:text-sm">
            Pós-vendas ({rulesByType('post_sale').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payment">{renderTabContent('payment')}</TabsContent>
        {!isPlatformTenant && (
          <TabsContent value="shipping">{renderTabContent('shipping')}</TabsContent>
        )}
        <TabsContent value="abandoned_checkout">{renderTabContent('abandoned_checkout')}</TabsContent>
        <TabsContent value="post_sale">{renderTabContent('post_sale')}</TabsContent>
      </Tabs>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A regra será permanentemente removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingId}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={!!deletingId} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingId ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
