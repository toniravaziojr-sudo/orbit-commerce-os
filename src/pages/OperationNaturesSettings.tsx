import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowLeft, Edit2, Trash2, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
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

interface OperationNature {
  id: string;
  tenant_id: string;
  nome: string;
  codigo: string | null;
  cfop_intra: string;
  cfop_inter: string;
  finalidade: number;
  tipo_documento: number;
  ativo: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

const FINALIDADE_OPTIONS = [
  { value: '1', label: 'Normal' },
  { value: '2', label: 'Complementar' },
  { value: '3', label: 'Ajuste' },
  { value: '4', label: 'Devolução' },
];

const TIPO_DOCUMENTO_OPTIONS = [
  { value: '0', label: 'Entrada' },
  { value: '1', label: 'Saída' },
];

const DEFAULT_NATURES = [
  { nome: 'Venda de Mercadoria', cfop_intra: '5102', cfop_inter: '6102', finalidade: 1, tipo_documento: 1 },
  { nome: 'Devolução de Venda', cfop_intra: '1202', cfop_inter: '2202', finalidade: 4, tipo_documento: 0 },
  { nome: 'Remessa para Conserto', cfop_intra: '5915', cfop_inter: '6915', finalidade: 1, tipo_documento: 1 },
  { nome: 'Retorno de Conserto', cfop_intra: '5916', cfop_inter: '6916', finalidade: 1, tipo_documento: 0 },
  { nome: 'Bonificação', cfop_intra: '5910', cfop_inter: '6910', finalidade: 1, tipo_documento: 1 },
  { nome: 'Remessa para Demonstração', cfop_intra: '5912', cfop_inter: '6912', finalidade: 1, tipo_documento: 1 },
  { nome: 'Amostra Grátis', cfop_intra: '5911', cfop_inter: '6911', finalidade: 1, tipo_documento: 1 },
  { nome: 'Venda para Entrega Futura', cfop_intra: '5922', cfop_inter: '6922', finalidade: 1, tipo_documento: 1 },
  { nome: 'Remessa em Consignação', cfop_intra: '5917', cfop_inter: '6917', finalidade: 1, tipo_documento: 1 },
  { nome: 'Devolução de Consignação', cfop_intra: '5918', cfop_inter: '6918', finalidade: 4, tipo_documento: 1 },
];

export default function OperationNaturesSettings() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const tenantId = profile?.current_tenant_id;

  const [natures, setNatures] = useState<OperationNature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNature, setEditingNature] = useState<OperationNature | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingNature, setDeletingNature] = useState<OperationNature | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    cfop_intra: '',
    cfop_inter: '',
    finalidade: '1',
    tipo_documento: '1',
    ativo: true,
  });

  useEffect(() => {
    if (tenantId) {
      loadNatures();
    }
  }, [tenantId]);

  const loadNatures = async () => {
    try {
      const { data, error } = await supabase
        .from('fiscal_operation_natures')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('nome');

      if (error) throw error;
      setNatures(data || []);

      // If no natures exist, create default ones
      if (!data || data.length === 0) {
        await seedDefaultNatures();
      }
    } catch (error) {
      console.error('Error loading natures:', error);
      toast.error('Erro ao carregar naturezas de operação');
    } finally {
      setIsLoading(false);
    }
  };

  const seedDefaultNatures = async () => {
    if (!tenantId) return;

    try {
      const naturesToInsert = DEFAULT_NATURES.map(n => ({
        ...n,
        tenant_id: tenantId,
        is_system: true,
        ativo: true,
      }));

      const { data, error } = await supabase
        .from('fiscal_operation_natures')
        .insert(naturesToInsert)
        .select();

      if (error) throw error;
      setNatures(data || []);
      toast.success('Naturezas de operação padrão criadas');
    } catch (error) {
      console.error('Error seeding natures:', error);
    }
  };

  const openCreateDialog = () => {
    setEditingNature(null);
    setFormData({
      nome: '',
      codigo: '',
      cfop_intra: '',
      cfop_inter: '',
      finalidade: '1',
      tipo_documento: '1',
      ativo: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (nature: OperationNature) => {
    setEditingNature(nature);
    setFormData({
      nome: nature.nome,
      codigo: nature.codigo || '',
      cfop_intra: nature.cfop_intra,
      cfop_inter: nature.cfop_inter,
      finalidade: String(nature.finalidade),
      tipo_documento: String(nature.tipo_documento),
      ativo: nature.ativo,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nome || !formData.cfop_intra || !formData.cfop_inter) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        nome: formData.nome,
        codigo: formData.codigo || null,
        cfop_intra: formData.cfop_intra,
        cfop_inter: formData.cfop_inter,
        finalidade: parseInt(formData.finalidade),
        tipo_documento: parseInt(formData.tipo_documento),
        ativo: formData.ativo,
        tenant_id: tenantId,
      };

      if (editingNature) {
        const { error } = await supabase
          .from('fiscal_operation_natures')
          .update(payload)
          .eq('id', editingNature.id);

        if (error) throw error;
        toast.success('Natureza atualizada');
      } else {
        const { error } = await supabase
          .from('fiscal_operation_natures')
          .insert(payload);

        if (error) throw error;
        toast.success('Natureza criada');
      }

      setDialogOpen(false);
      loadNatures();
    } catch (error: any) {
      console.error('Error saving nature:', error);
      toast.error(error.message || 'Erro ao salvar natureza');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingNature) return;

    try {
      const { error } = await supabase
        .from('fiscal_operation_natures')
        .delete()
        .eq('id', deletingNature.id);

      if (error) throw error;
      toast.success('Natureza removida');
      setDeleteDialogOpen(false);
      setDeletingNature(null);
      loadNatures();
    } catch (error: any) {
      console.error('Error deleting nature:', error);
      toast.error(error.message || 'Erro ao remover natureza');
    }
  };

  const handleToggleActive = async (nature: OperationNature) => {
    try {
      const { error } = await supabase
        .from('fiscal_operation_natures')
        .update({ ativo: !nature.ativo })
        .eq('id', nature.id);

      if (error) throw error;
      loadNatures();
    } catch (error) {
      console.error('Error toggling nature:', error);
      toast.error('Erro ao alterar status');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Naturezas de Operação"
        description="Configure as naturezas de operação para diferentes tipos de NF-e"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/settings/fiscal')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Natureza
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Naturezas Cadastradas</CardTitle>
          <CardDescription>
            Cada natureza define o CFOP e tipo de operação para emissão de NF-e
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : natures.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma natureza cadastrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>CFOP Intra</TableHead>
                  <TableHead>CFOP Inter</TableHead>
                  <TableHead>Finalidade</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {natures.map((nature) => (
                  <TableRow key={nature.id}>
                    <TableCell className="font-medium">{nature.nome}</TableCell>
                    <TableCell>{nature.codigo || '-'}</TableCell>
                    <TableCell className="font-mono">{nature.cfop_intra}</TableCell>
                    <TableCell className="font-mono">{nature.cfop_inter}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {FINALIDADE_OPTIONS.find(f => f.value === String(nature.finalidade))?.label || 'Normal'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={nature.tipo_documento === 0 ? 'secondary' : 'default'}>
                        {nature.tipo_documento === 0 ? 'Entrada' : 'Saída'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(nature)}
                        className={nature.ativo ? 'text-green-600' : 'text-muted-foreground'}
                      >
                        {nature.ativo ? (
                          <ToggleRight className="h-5 w-5" />
                        ) : (
                          <ToggleLeft className="h-5 w-5" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(nature)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {!nature.is_system && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingNature(nature);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingNature ? 'Editar Natureza de Operação' : 'Nova Natureza de Operação'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Venda de Mercadoria"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="codigo">Código (opcional)</Label>
              <Input
                id="codigo"
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                placeholder="Ex: VENDA01"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cfop_intra">CFOP Intrastadual *</Label>
                <Input
                  id="cfop_intra"
                  value={formData.cfop_intra}
                  onChange={(e) => setFormData({ ...formData, cfop_intra: e.target.value })}
                  placeholder="Ex: 5102"
                  maxLength={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cfop_inter">CFOP Interestadual *</Label>
                <Input
                  id="cfop_inter"
                  value={formData.cfop_inter}
                  onChange={(e) => setFormData({ ...formData, cfop_inter: e.target.value })}
                  placeholder="Ex: 6102"
                  maxLength={4}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Finalidade</Label>
                <Select
                  value={formData.finalidade}
                  onValueChange={(v) => setFormData({ ...formData, finalidade: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FINALIDADE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de Documento</Label>
                <Select
                  value={formData.tipo_documento}
                  onValueChange={(v) => setFormData({ ...formData, tipo_documento: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_DOCUMENTO_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
              />
              <Label htmlFor="ativo">Ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingNature ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a natureza "{deletingNature?.nome}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
