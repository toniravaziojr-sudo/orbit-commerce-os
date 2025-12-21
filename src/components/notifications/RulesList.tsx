import { useState } from "react";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Zap } from "lucide-react";
import type { NotificationRule } from "@/hooks/useNotificationRules";

interface RulesListProps {
  rules: NotificationRule[];
  isLoading: boolean;
  canEdit: boolean;
  onToggle: (id: string, enabled: boolean) => Promise<boolean>;
  onEdit: (rule: NotificationRule) => void;
  onDelete: (id: string) => Promise<boolean>;
  onCreate: () => void;
}

const dedupeLabels: Record<string, string> = {
  order: 'Por pedido',
  customer: 'Por cliente',
  cart: 'Por carrinho',
  none: 'Nenhum',
};

export function RulesList({
  rules,
  isLoading,
  canEdit,
  onToggle,
  onEdit,
  onDelete,
  onCreate,
}: RulesListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    await onDelete(deleteId);
    setIsDeleting(false);
    setDeleteId(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <EmptyState
        icon={Zap}
        title="Nenhuma regra configurada"
        description="Crie regras para automatizar notificações baseadas em eventos como: pagamento confirmado, pedido enviado, carrinho abandonado, etc."
        action={canEdit ? {
          label: "Criar Primeira Regra",
          onClick: onCreate,
        } : undefined}
      />
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        {canEdit && (
          <Button onClick={onCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Regra
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">Ativa</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Evento</TableHead>
            <TableHead>Dedupe</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead>Ações</TableHead>
            {canEdit && <TableHead className="w-[100px]"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => (
            <TableRow key={rule.id}>
              <TableCell>
                <Switch
                  checked={rule.is_enabled}
                  onCheckedChange={(checked) => onToggle(rule.id, checked)}
                  disabled={!canEdit}
                />
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium">{rule.name}</p>
                  {rule.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{rule.description}</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{rule.trigger_event_type}</Badge>
              </TableCell>
              <TableCell>
                <span className="text-sm">{dedupeLabels[rule.dedupe_scope || 'none'] || rule.dedupe_scope}</span>
              </TableCell>
              <TableCell>
                <span className="text-sm">{rule.priority}</span>
              </TableCell>
              <TableCell>
                <span className="text-xs text-muted-foreground">
                  {rule.actions?.length || 0} ação(ões)
                </span>
              </TableCell>
              {canEdit && (
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(rule)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setDeleteId(rule.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A regra será permanentemente excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
