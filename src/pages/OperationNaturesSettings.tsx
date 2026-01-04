import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowLeft, Edit2, Trash2, Loader2, ToggleLeft, ToggleRight, Info } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
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
  descricao: string | null;
  cfop_intra: string;
  cfop_inter: string;
  finalidade: number;
  tipo_documento: number;
  serie: number;
  crt: number;
  ind_pres: number;
  faturada: boolean;
  consumidor_final: boolean;
  operacao_devolucao: boolean;
  csosn_padrao: string | null;
  cst_icms: string | null;
  cst_pis: string | null;
  cst_cofins: string | null;
  info_complementares: string | null;
  info_fisco: string | null;
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

const CRT_OPTIONS = [
  { value: '1', label: '1 - Simples Nacional' },
  { value: '2', label: '2 - Simples Nacional (sublimite)' },
  { value: '3', label: '3 - Regime Normal' },
];

const IND_PRES_OPTIONS = [
  { value: '0', label: '0 - Não se aplica' },
  { value: '1', label: '1 - Presencial' },
  { value: '2', label: '2 - Não presencial, internet' },
  { value: '3', label: '3 - Não presencial, teleatendimento' },
  { value: '4', label: '4 - NFC-e entrega em domicílio' },
  { value: '5', label: '5 - Presencial, fora do estabelecimento' },
  { value: '9', label: '9 - Não presencial, outros' },
];

const CSOSN_OPTIONS = [
  { value: '101', label: '101 - Tributada com permissão de crédito' },
  { value: '102', label: '102 - Tributada sem permissão de crédito' },
  { value: '103', label: '103 - Isenção do ICMS para faixa de receita bruta' },
  { value: '201', label: '201 - Tributada com permissão de crédito e cobrança de ICMS ST' },
  { value: '202', label: '202 - Tributada sem permissão de crédito e cobrança de ICMS ST' },
  { value: '203', label: '203 - Isenção com cobrança de ICMS ST' },
  { value: '300', label: '300 - Imune' },
  { value: '400', label: '400 - Não tributada pelo Simples Nacional' },
  { value: '500', label: '500 - ICMS cobrado anteriormente por ST ou antecipação' },
  { value: '900', label: '900 - Outros' },
];

const CST_PIS_COFINS_OPTIONS = [
  { value: '01', label: '01 - Operação tributável (base cálculo = valor operação)' },
  { value: '02', label: '02 - Operação tributável (base cálculo = valor operação - IPI)' },
  { value: '04', label: '04 - Operação tributável monofásica (revenda a alíquota zero)' },
  { value: '05', label: '05 - Operação tributável por ST' },
  { value: '06', label: '06 - Operação tributável a alíquota zero' },
  { value: '07', label: '07 - Operação isenta da contribuição' },
  { value: '08', label: '08 - Operação sem incidência da contribuição' },
  { value: '09', label: '09 - Operação com suspensão da contribuição' },
  { value: '49', label: '49 - Outras operações de saída' },
  { value: '50', label: '50 - Operação com direito a crédito (entrada)' },
  { value: '99', label: '99 - Outras operações' },
];

const DEFAULT_NATURES = [
  { 
    nome: 'Venda de Mercadoria', 
    descricao: 'Venda de mercadoria adquirida ou recebida de terceiros',
    cfop_intra: '5102', 
    cfop_inter: '6102', 
    finalidade: 1, 
    tipo_documento: 1,
    crt: 1,
    csosn_padrao: '102',
    cst_pis: '49',
    cst_cofins: '49',
    consumidor_final: true,
    faturada: true,
    ind_pres: 9,
  },
  { 
    nome: 'Devolução de Venda', 
    descricao: 'Devolução de venda de mercadoria adquirida ou recebida de terceiros',
    cfop_intra: '1202', 
    cfop_inter: '2202', 
    finalidade: 4, 
    tipo_documento: 0,
    crt: 1,
    csosn_padrao: '900',
    cst_pis: '49',
    cst_cofins: '49',
    operacao_devolucao: true,
    faturada: false,
    ind_pres: 9,
  },
  { 
    nome: 'Remessa para Conserto', 
    descricao: 'Remessa de mercadoria ou bem para conserto ou reparo',
    cfop_intra: '5915', 
    cfop_inter: '6915', 
    finalidade: 1, 
    tipo_documento: 1,
    crt: 1,
    csosn_padrao: '400',
    cst_pis: '08',
    cst_cofins: '08',
    faturada: false,
    ind_pres: 9,
  },
  { 
    nome: 'Retorno de Conserto', 
    descricao: 'Retorno de mercadoria ou bem recebido para conserto ou reparo',
    cfop_intra: '5916', 
    cfop_inter: '6916', 
    finalidade: 1, 
    tipo_documento: 0,
    crt: 1,
    csosn_padrao: '400',
    cst_pis: '08',
    cst_cofins: '08',
    faturada: false,
    ind_pres: 9,
  },
  { 
    nome: 'Bonificação', 
    descricao: 'Remessa de mercadoria ou bem a título de bonificação, doação ou brinde',
    cfop_intra: '5910', 
    cfop_inter: '6910', 
    finalidade: 1, 
    tipo_documento: 1,
    crt: 1,
    csosn_padrao: '400',
    cst_pis: '49',
    cst_cofins: '49',
    faturada: false,
    ind_pres: 9,
  },
  { 
    nome: 'Remessa para Demonstração', 
    descricao: 'Remessa de mercadoria ou bem para demonstração',
    cfop_intra: '5912', 
    cfop_inter: '6912', 
    finalidade: 1, 
    tipo_documento: 1,
    crt: 1,
    csosn_padrao: '400',
    cst_pis: '08',
    cst_cofins: '08',
    faturada: false,
    ind_pres: 9,
  },
  { 
    nome: 'Amostra Grátis', 
    descricao: 'Remessa de amostra grátis',
    cfop_intra: '5911', 
    cfop_inter: '6911', 
    finalidade: 1, 
    tipo_documento: 1,
    crt: 1,
    csosn_padrao: '400',
    cst_pis: '08',
    cst_cofins: '08',
    faturada: false,
    ind_pres: 9,
  },
  { 
    nome: 'Venda para Entrega Futura', 
    descricao: 'Venda de mercadoria com entrega futura (faturamento antecipado)',
    cfop_intra: '5922', 
    cfop_inter: '6922', 
    finalidade: 1, 
    tipo_documento: 1,
    crt: 1,
    csosn_padrao: '102',
    cst_pis: '49',
    cst_cofins: '49',
    consumidor_final: true,
    faturada: true,
    ind_pres: 9,
  },
  { 
    nome: 'Remessa em Consignação', 
    descricao: 'Remessa de mercadoria em consignação mercantil',
    cfop_intra: '5917', 
    cfop_inter: '6917', 
    finalidade: 1, 
    tipo_documento: 1,
    crt: 1,
    csosn_padrao: '400',
    cst_pis: '08',
    cst_cofins: '08',
    faturada: false,
    ind_pres: 9,
  },
  { 
    nome: 'Devolução de Consignação', 
    descricao: 'Devolução de mercadoria recebida em consignação',
    cfop_intra: '5918', 
    cfop_inter: '6918', 
    finalidade: 4, 
    tipo_documento: 1,
    crt: 1,
    csosn_padrao: '400',
    cst_pis: '08',
    cst_cofins: '08',
    operacao_devolucao: true,
    faturada: false,
    ind_pres: 9,
  },
];

interface FormData {
  nome: string;
  codigo: string;
  descricao: string;
  cfop_intra: string;
  cfop_inter: string;
  finalidade: string;
  tipo_documento: string;
  serie: string;
  crt: string;
  ind_pres: string;
  faturada: boolean;
  consumidor_final: boolean;
  operacao_devolucao: boolean;
  csosn_padrao: string;
  cst_icms: string;
  cst_pis: string;
  cst_cofins: string;
  info_complementares: string;
  info_fisco: string;
  ativo: boolean;
}

const initialFormData: FormData = {
  nome: '',
  codigo: '',
  descricao: '',
  cfop_intra: '',
  cfop_inter: '',
  finalidade: '1',
  tipo_documento: '1',
  serie: '1',
  crt: '1',
  ind_pres: '9',
  faturada: true,
  consumidor_final: true,
  operacao_devolucao: false,
  csosn_padrao: '102',
  cst_icms: '',
  cst_pis: '49',
  cst_cofins: '49',
  info_complementares: '',
  info_fisco: '',
  ativo: true,
};

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

  const [formData, setFormData] = useState<FormData>(initialFormData);

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
      setNatures((data as OperationNature[]) || []);

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
        serie: 1,
      }));

      const { data, error } = await supabase
        .from('fiscal_operation_natures')
        .insert(naturesToInsert)
        .select();

      if (error) throw error;
      setNatures((data as OperationNature[]) || []);
      toast.success('Naturezas de operação padrão criadas');
    } catch (error) {
      console.error('Error seeding natures:', error);
    }
  };

  const openCreateDialog = () => {
    setEditingNature(null);
    setFormData(initialFormData);
    setDialogOpen(true);
  };

  const openEditDialog = (nature: OperationNature) => {
    setEditingNature(nature);
    setFormData({
      nome: nature.nome,
      codigo: nature.codigo || '',
      descricao: nature.descricao || '',
      cfop_intra: nature.cfop_intra,
      cfop_inter: nature.cfop_inter,
      finalidade: String(nature.finalidade),
      tipo_documento: String(nature.tipo_documento),
      serie: String(nature.serie || 1),
      crt: String(nature.crt || 1),
      ind_pres: String(nature.ind_pres || 9),
      faturada: nature.faturada ?? true,
      consumidor_final: nature.consumidor_final ?? true,
      operacao_devolucao: nature.operacao_devolucao ?? false,
      csosn_padrao: nature.csosn_padrao || '',
      cst_icms: nature.cst_icms || '',
      cst_pis: nature.cst_pis || '49',
      cst_cofins: nature.cst_cofins || '49',
      info_complementares: nature.info_complementares || '',
      info_fisco: nature.info_fisco || '',
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
        descricao: formData.descricao || null,
        cfop_intra: formData.cfop_intra,
        cfop_inter: formData.cfop_inter,
        finalidade: parseInt(formData.finalidade),
        tipo_documento: parseInt(formData.tipo_documento),
        serie: parseInt(formData.serie) || 1,
        crt: parseInt(formData.crt) || 1,
        ind_pres: parseInt(formData.ind_pres) || 9,
        faturada: formData.faturada,
        consumidor_final: formData.consumidor_final,
        operacao_devolucao: formData.operacao_devolucao,
        csosn_padrao: formData.csosn_padrao || null,
        cst_icms: formData.cst_icms || null,
        cst_pis: formData.cst_pis || null,
        cst_cofins: formData.cst_cofins || null,
        info_complementares: formData.info_complementares || null,
        info_fisco: formData.info_fisco || null,
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

  const isSimples = formData.crt === '1' || formData.crt === '2';

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
            Cada natureza define o CFOP, tributação e tipo de operação para emissão de NF-e
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
                  <TableHead>CFOP Intra/Inter</TableHead>
                  <TableHead>CSOSN</TableHead>
                  <TableHead>Finalidade</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {natures.map((nature) => (
                  <TableRow key={nature.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{nature.nome}</div>
                        {nature.descricao && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {nature.descricao}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {nature.cfop_intra} / {nature.cfop_inter}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {nature.csosn_padrao || '-'}
                      </Badge>
                    </TableCell>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingNature ? 'Editar Natureza de Operação' : 'Nova Natureza de Operação'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Dados Gerais */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Info className="h-4 w-4" />
                Dados Gerais
              </div>

              <div className="grid grid-cols-2 gap-4">
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <textarea
                  id="descricao"
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Descrição detalhada da operação"
                />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="serie">Série</Label>
                  <Input
                    id="serie"
                    type="number"
                    min={1}
                    value={formData.serie}
                    onChange={(e) => setFormData({ ...formData, serie: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
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
                <div className="space-y-2">
                  <Label>CRT</Label>
                  <Select
                    value={formData.crt}
                    onValueChange={(v) => setFormData({ ...formData, crt: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CRT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Indicador Presença</Label>
                  <Select
                    value={formData.ind_pres}
                    onValueChange={(v) => setFormData({ ...formData, ind_pres: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IND_PRES_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="faturada"
                    checked={formData.faturada}
                    onCheckedChange={(checked) => setFormData({ ...formData, faturada: checked })}
                  />
                  <Label htmlFor="faturada">Faturada</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="consumidor_final"
                    checked={formData.consumidor_final}
                    onCheckedChange={(checked) => setFormData({ ...formData, consumidor_final: checked })}
                  />
                  <Label htmlFor="consumidor_final">Consumidor Final</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="operacao_devolucao"
                    checked={formData.operacao_devolucao}
                    onCheckedChange={(checked) => setFormData({ ...formData, operacao_devolucao: checked })}
                  />
                  <Label htmlFor="operacao_devolucao">Operação de Devolução</Label>
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
            </div>

            <Separator />

            {/* Tributação */}
            <div className="space-y-4">
              <Tabs defaultValue="icms">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="icms">ICMS</TabsTrigger>
                  <TabsTrigger value="pis">PIS</TabsTrigger>
                  <TabsTrigger value="cofins">COFINS</TabsTrigger>
                </TabsList>

                <TabsContent value="icms" className="space-y-4 mt-4">
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

                    {isSimples ? (
                      <div className="space-y-2">
                        <Label>CSOSN (Simples Nacional)</Label>
                        <Select
                          value={formData.csosn_padrao}
                          onValueChange={(v) => setFormData({ ...formData, csosn_padrao: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o CSOSN" />
                          </SelectTrigger>
                          <SelectContent>
                            {CSOSN_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="cst_icms">CST ICMS (Regime Normal)</Label>
                        <Input
                          id="cst_icms"
                          value={formData.cst_icms}
                          onChange={(e) => setFormData({ ...formData, cst_icms: e.target.value })}
                          placeholder="Ex: 00, 10, 20..."
                          maxLength={3}
                        />
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="pis" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>CST PIS</Label>
                    <Select
                      value={formData.cst_pis}
                      onValueChange={(v) => setFormData({ ...formData, cst_pis: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o CST" />
                      </SelectTrigger>
                      <SelectContent>
                        {CST_PIS_COFINS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Para Simples Nacional, geralmente usa-se CST 49 (Outras Operações de Saída) ou 08 (Operação sem incidência).
                  </p>
                </TabsContent>

                <TabsContent value="cofins" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>CST COFINS</Label>
                    <Select
                      value={formData.cst_cofins}
                      onValueChange={(v) => setFormData({ ...formData, cst_cofins: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o CST" />
                      </SelectTrigger>
                      <SelectContent>
                        {CST_PIS_COFINS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Para Simples Nacional, geralmente usa-se CST 49 (Outras Operações de Saída) ou 08 (Operação sem incidência).
                  </p>
                </TabsContent>
              </Tabs>
            </div>

            <Separator />

            {/* Informações Adicionais */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Info className="h-4 w-4" />
                Informações Adicionais
              </div>

              <div className="space-y-2">
                <Label htmlFor="info_complementares">Informações Complementares</Label>
                <textarea
                  id="info_complementares"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.info_complementares}
                  onChange={(e) => setFormData({ ...formData, info_complementares: e.target.value })}
                  placeholder="Informações que aparecerão na NF-e (ex: condições de pagamento, garantia, etc.)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="info_fisco">Informações Adicionais de Interesse do Fisco</Label>
                <textarea
                  id="info_fisco"
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.info_fisco}
                  onChange={(e) => setFormData({ ...formData, info_fisco: e.target.value })}
                  placeholder="Informações de interesse do fisco (ex: legislação, portarias, etc.)"
                />
              </div>
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
