// =============================================
// FREE SHIPPING RULES TAB
// UI for managing free shipping rules
// =============================================

import { useState } from 'react';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Copy, 
  AlertTriangle,
  MapPin,
  Building2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useShippingFreeRules, formatCep, formatPriceBRL, type ShippingFreeRule } from '@/hooks/useShippingRules';
import { FreeShippingRuleDialog } from './FreeShippingRuleDialog';

export function FreeShippingRulesTab() {
  const { rules, isLoading, create, update, delete: deleteRule, toggle, isCreating, isUpdating } = useShippingFreeRules();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ShippingFreeRule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);

  // Check for overlapping rules
  const getOverlappingRules = (rule: ShippingFreeRule): ShippingFreeRule[] => {
    return rules.filter(r => {
      if (r.id === rule.id) return false;
      const ruleStart = parseInt(rule.cep_start);
      const ruleEnd = parseInt(rule.cep_end);
      const otherStart = parseInt(r.cep_start);
      const otherEnd = parseInt(r.cep_end);
      return (ruleStart <= otherEnd && ruleEnd >= otherStart);
    });
  };

  const handleCreate = () => {
    setEditingRule(null);
    setDialogOpen(true);
  };

  const handleEdit = (rule: ShippingFreeRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const handleDuplicate = (rule: ShippingFreeRule) => {
    create({
      name: `${rule.name} (cópia)`,
      region_type: rule.region_type,
      cep_start: rule.cep_start,
      cep_end: rule.cep_end,
      uf: rule.uf,
      min_order_cents: rule.min_order_cents,
      delivery_days_min: rule.delivery_days_min,
      delivery_days_max: rule.delivery_days_max,
      is_enabled: false,
      sort_order: rule.sort_order + 1,
    });
  };

  const handleDelete = (id: string) => {
    setRuleToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (ruleToDelete) {
      deleteRule(ruleToDelete);
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
    }
  };

  const handleSave = (data: Omit<ShippingFreeRule, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => {
    if (editingRule) {
      update({ id: editingRule.id, ...data });
    } else {
      create(data);
    }
    setDialogOpen(false);
    setEditingRule(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Regras de Frete Grátis</CardTitle>
            <CardDescription>
              Configure regras de frete grátis por região (Capital/Interior) e faixa de CEP
            </CardDescription>
          </div>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Regra
          </Button>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">Nenhuma regra de frete grátis</p>
              <p className="text-sm mt-1">Crie sua primeira regra para oferecer frete grátis em regiões específicas</p>
              <Button onClick={handleCreate} variant="outline" className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Criar Regra
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Faixa de CEP</TableHead>
                    <TableHead>UF</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Mínimo</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => {
                    const overlapping = getOverlappingRules(rule);
                    const hasOverlap = overlapping.length > 0;
                    
                    return (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {rule.name}
                            {hasOverlap && (
                              <span title={`Sobreposição com: ${overlapping.map(r => r.name).join(', ')}`}>
                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={rule.region_type === 'capital' ? 'default' : 'secondary'}>
                            {rule.region_type === 'capital' ? (
                              <><Building2 className="h-3 w-3 mr-1" /> Capital</>
                            ) : (
                              <><MapPin className="h-3 w-3 mr-1" /> Interior</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatCep(rule.cep_start)} - {formatCep(rule.cep_end)}
                        </TableCell>
                        <TableCell>{rule.uf || '-'}</TableCell>
                        <TableCell>
                          {rule.delivery_days_min && rule.delivery_days_max
                            ? `${rule.delivery_days_min}-${rule.delivery_days_max} dias`
                            : rule.delivery_days_min
                            ? `${rule.delivery_days_min} dias`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {rule.min_order_cents 
                            ? formatPriceBRL(rule.min_order_cents)
                            : '-'}
                        </TableCell>
                        <TableCell>{rule.sort_order}</TableCell>
                        <TableCell>
                          <Switch
                            checked={rule.is_enabled}
                            onCheckedChange={(checked) => toggle({ id: rule.id, is_enabled: checked })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleEdit(rule)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDuplicate(rule)}
                              title="Duplicar"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDelete(rule.id)}
                              title="Excluir"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <FreeShippingRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editingRule}
        onSave={handleSave}
        isLoading={isCreating || isUpdating}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir regra</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta regra de frete grátis? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
