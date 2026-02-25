import { useState, useEffect } from 'react';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { FileText, User, Package, MapPin, Calculator, Truck, Save, Send, Trash2, X, Loader2, AlertCircle, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { ProductSelector, type ProductWithFiscal } from './ProductSelector';

// Types
export interface InvoiceData {
  id?: string;
  order_id?: string;
  numero: number;
  serie: number;
  data_emissao: string;
  data_saida?: string;
  natureza_operacao: string;
  cfop: string;
  observacoes?: string;
  // Destinatário
  dest_nome: string;
  dest_cpf_cnpj: string;
  dest_ie?: string;
  dest_tipo_pessoa: 'fisica' | 'juridica';
  dest_consumidor_final: boolean;
  dest_endereco_logradouro: string;
  dest_endereco_numero: string;
  dest_endereco_complemento?: string;
  dest_endereco_bairro: string;
  dest_endereco_municipio: string;
  dest_endereco_municipio_codigo: string;
  dest_endereco_uf: string;
  dest_endereco_cep: string;
  dest_telefone?: string;
  dest_email?: string;
  // Valores
  valor_produtos: number;
  valor_frete: number;
  valor_seguro: number;
  valor_outras_despesas: number;
  valor_desconto: number;
  valor_total: number;
  // Items
  items: InvoiceItemData[];
  // Transporte
  modalidade_frete: string;
  transportadora_nome?: string;
  transportadora_cnpj?: string;
  peso_bruto?: number;
  peso_liquido?: number;
  quantidade_volumes?: number;
  especie_volumes?: string;
}

export interface InvoiceItemData {
  id?: string;
  numero_item: number;
  product_id?: string;
  codigo_produto: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  origem: string;
  csosn?: string;
  cst?: string;
}

// Opções de Origem do produto
const ORIGEM_OPTIONS = [
  { value: '0', label: '0 - Nacional' },
  { value: '1', label: '1 - Estrangeira (importação direta)' },
  { value: '2', label: '2 - Estrangeira (adquirida no mercado interno)' },
  { value: '3', label: '3 - Nacional (mais de 40% conteúdo estrangeiro)' },
  { value: '4', label: '4 - Nacional (processos básicos)' },
  { value: '5', label: '5 - Nacional (menos de 40% conteúdo estrangeiro)' },
  { value: '6', label: '6 - Estrangeira (importação direta, sem similar)' },
  { value: '7', label: '7 - Estrangeira (mercado interno, sem similar)' },
  { value: '8', label: '8 - Nacional (mais de 70% conteúdo nacional)' },
];

// Opções de CSOSN para Simples Nacional
const CSOSN_OPTIONS = [
  { value: '101', label: '101 - Tributada com permissão de crédito' },
  { value: '102', label: '102 - Tributada sem permissão de crédito' },
  { value: '103', label: '103 - Isenção do ICMS para faixa de receita bruta' },
  { value: '201', label: '201 - Com permissão de crédito e cobrança por ST' },
  { value: '202', label: '202 - Sem permissão de crédito e cobrança por ST' },
  { value: '203', label: '203 - Isenção para faixa e cobrança por ST' },
  { value: '300', label: '300 - Imune' },
  { value: '400', label: '400 - Não tributada' },
  { value: '500', label: '500 - ICMS cobrado anteriormente por ST' },
  { value: '900', label: '900 - Outros' },
];

// Funções de validação
function isValidCpfCnpj(value: string): boolean {
  const numbers = value.replace(/\D/g, '');
  return numbers.length === 11 || numbers.length === 14;
}

function isValidCep(value: string): boolean {
  const numbers = value.replace(/\D/g, '');
  return numbers.length === 8;
}

function isValidNcm(value: string): boolean {
  const numbers = value.replace(/\D/g, '');
  return numbers.length === 8;
}

function isValidCfop(value: string): boolean {
  const numbers = value.replace(/\D/g, '');
  return numbers.length === 4;
}

function isValidIbge(value: string): boolean {
  const numbers = value.replace(/\D/g, '');
  return numbers.length === 7;
}

function formatCpfCnpj(value: string): string {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 11) {
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

function formatCep(value: string): string {
  const numbers = value.replace(/\D/g, '');
  return numbers.replace(/(\d{5})(\d{3})/, '$1-$2');
}

const UF_OPTIONS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const NATUREZA_OPTIONS = [
  'Venda de mercadoria adquirida de terceiros',
  'Venda de produção do estabelecimento',
  'Devolução de compra',
  'Remessa para conserto',
  'Remessa para demonstração',
  'VENDA DE MERCADORIA',
];

const MODALIDADE_FRETE_OPTIONS = [
  { value: '0', label: 'Contratação do Frete por conta do Remetente (CIF)' },
  { value: '1', label: 'Contratação do Frete por conta do Destinatário (FOB)' },
  { value: '2', label: 'Contratação do Frete por conta de Terceiros' },
  { value: '3', label: 'Transporte Próprio por conta do Remetente' },
  { value: '4', label: 'Transporte Próprio por conta do Destinatário' },
  { value: '9', label: 'Sem Ocorrência de Transporte' },
];

interface InvoiceEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: InvoiceData;
  onSave: (data: InvoiceData) => Promise<void>;
  onSubmit: (data: InvoiceData) => Promise<void>;
  onDelete?: () => Promise<void>;
  isLoading?: boolean;
  /** Error message from SEFAZ rejection or other error */
  rejectionError?: string;
  /** Invoice status to show appropriate UI */
  invoiceStatus?: string;
}

export function InvoiceEditor({
  open,
  onOpenChange,
  invoice,
  onSave,
  onSubmit,
  onDelete,
  isLoading = false,
  rejectionError,
  invoiceStatus,
}: InvoiceEditorProps) {
  const [data, setData] = useState<InvoiceData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('geral');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (invoice) {
      setData({ ...invoice });
      setValidationErrors([]);
    }
  }, [invoice]);

  const updateField = <K extends keyof InvoiceData>(field: K, value: InvoiceData[K]) => {
    setData(prev => prev ? { ...prev, [field]: value } : null);
  };

  const updateItem = (index: number, field: keyof InvoiceItemData, value: string | number) => {
    if (!data) return;
    const newItems = [...data.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate item total
    if (field === 'quantidade' || field === 'valor_unitario') {
      newItems[index].valor_total = newItems[index].quantidade * newItems[index].valor_unitario;
    }
    
    setData({ ...data, items: newItems });
    recalculateTotals(newItems);
  };

  const addItem = () => {
    if (!data) return;
    const newItem: InvoiceItemData = {
      numero_item: data.items.length + 1,
      codigo_produto: '',
      descricao: '',
      ncm: '',
      cfop: data.cfop || '5102',
      unidade: 'UN',
      quantidade: 1,
      valor_unitario: 0,
      valor_total: 0,
      origem: '0',
    };
    setData({ ...data, items: [...data.items, newItem] });
  };

  const addProductFromCatalog = (product: ProductWithFiscal) => {
    if (!data) return;
    const newItem: InvoiceItemData = {
      numero_item: data.items.length + 1,
      product_id: product.id,
      codigo_produto: product.sku || product.id.substring(0, 8),
      descricao: product.name,
      ncm: product.ncm || '',
      cfop: product.cfop || data.cfop || '5102',
      unidade: product.unidade || 'UN',
      quantidade: 1,
      valor_unitario: product.price,
      valor_total: product.price,
      origem: String(product.origem ?? 0),
    };
    setData({ ...data, items: [...data.items, newItem] });
    recalculateTotals([...data.items, newItem]);
    toast.success(`Produto "${product.name}" adicionado`);
  };

  const removeItem = (index: number) => {
    if (!data) return;
    const newItems = data.items.filter((_, i) => i !== index);
    // Renumber items
    newItems.forEach((item, i) => { item.numero_item = i + 1; });
    setData({ ...data, items: newItems });
    recalculateTotals(newItems);
  };

  const recalculateTotals = (items: InvoiceItemData[]) => {
    if (!data) return;
    const valor_produtos = items.reduce((sum, item) => sum + item.valor_total, 0);
    const valor_total = valor_produtos + (data.valor_frete || 0) + (data.valor_seguro || 0) + (data.valor_outras_despesas || 0) - (data.valor_desconto || 0);
    setData(prev => prev ? { ...prev, valor_produtos, valor_total } : null);
  };

  const validateForSubmission = (): string[] => {
    if (!data) return ['Dados não carregados'];
    
    const errors: string[] = [];
    
    // Recipient validation
    if (!data.dest_nome?.trim()) {
      errors.push('Nome do destinatário é obrigatório');
    }
    
    const cpfCnpj = data.dest_cpf_cnpj?.replace(/\D/g, '') || '';
    if (!cpfCnpj) {
      errors.push('CPF/CNPJ do destinatário é obrigatório');
    } else if (!isValidCpfCnpj(cpfCnpj)) {
      errors.push(`CPF/CNPJ inválido: deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ). Atual: ${cpfCnpj.length} dígitos`);
    }
    
    // Address validation
    if (!data.dest_endereco_logradouro?.trim()) {
      errors.push('Logradouro é obrigatório');
    }
    if (!data.dest_endereco_numero?.trim()) {
      errors.push('Número do endereço é obrigatório (use "S/N" se não houver)');
    }
    if (!data.dest_endereco_bairro?.trim()) {
      errors.push('Bairro é obrigatório');
    }
    if (!data.dest_endereco_municipio?.trim()) {
      errors.push('Município é obrigatório');
    }
    if (!data.dest_endereco_uf?.trim()) {
      errors.push('UF é obrigatório');
    }
    
    const ibge = data.dest_endereco_municipio_codigo?.replace(/\D/g, '') || '';
    if (!ibge) {
      errors.push('Código IBGE do município é obrigatório');
    } else if (!isValidIbge(ibge)) {
      errors.push(`Código IBGE inválido: deve ter exatamente 7 dígitos. Atual: ${ibge.length} dígitos`);
    }
    
    const cep = data.dest_endereco_cep?.replace(/\D/g, '') || '';
    if (!cep) {
      errors.push('CEP é obrigatório');
    } else if (!isValidCep(cep)) {
      errors.push(`CEP inválido: deve ter exatamente 8 dígitos. Atual: ${cep.length} dígitos`);
    }
    
    // CFOP validation
    const cfop = data.cfop?.replace(/\D/g, '') || '';
    if (!cfop) {
      errors.push('CFOP principal é obrigatório');
    } else if (!isValidCfop(cfop)) {
      errors.push(`CFOP inválido: deve ter exatamente 4 dígitos. Atual: ${cfop.length} dígitos`);
    }
    
    // Items validation
    if (data.items.length === 0) {
      errors.push('A NF-e precisa ter pelo menos um item');
    } else {
      data.items.forEach((item, idx) => {
        const itemNum = idx + 1;
        const itemName = item.descricao || `Item ${itemNum}`;
        
        if (!item.descricao?.trim()) {
          errors.push(`Item ${itemNum}: Descrição é obrigatória`);
        }
        
        const ncm = item.ncm?.replace(/\D/g, '') || '';
        if (!ncm) {
          errors.push(`${itemName}: NCM é obrigatório`);
        } else if (!isValidNcm(ncm)) {
          errors.push(`${itemName}: NCM inválido - deve ter exatamente 8 dígitos (atual: ${ncm.length}). Consulte: https://portalunico.siscomex.gov.br/classif`);
        }
        
        const itemCfop = item.cfop?.replace(/\D/g, '') || '';
        if (!itemCfop) {
          errors.push(`${itemName}: CFOP é obrigatório`);
        } else if (!isValidCfop(itemCfop)) {
          errors.push(`${itemName}: CFOP inválido - deve ter 4 dígitos`);
        }
        
        if (item.quantidade <= 0) {
          errors.push(`${itemName}: Quantidade deve ser maior que zero`);
        }
        
        if (item.valor_unitario <= 0) {
          errors.push(`${itemName}: Valor unitário deve ser maior que zero`);
        }
      });
    }
    
    return errors;
  };

  const handleSave = async () => {
    if (!data) return;
    setIsSaving(true);
    try {
      await onSave(data);
      toast.success('Rascunho salvo com sucesso');
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Erro ao salvar rascunho');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!data) return;
    
    // Validate required fields
    const errors = validateForSubmission();
    setValidationErrors(errors);
    
    if (errors.length > 0) {
      toast.error('Corrija os erros antes de emitir');
      setActiveTab('geral'); // Go to first tab to show alert
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting invoice:', error);
      toast.error('Erro ao emitir NF-e');
    } finally {
      setIsSubmitting(false);
    }
  };

  const { confirm: confirmAction, ConfirmDialog: InvoiceConfirmDialog } = useConfirmDialog();

  const handleDelete = async () => {
    if (!onDelete) return;
    const ok = await confirmAction({
      title: "Excluir rascunho",
      description: "Tem certeza que deseja excluir este rascunho? Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!ok) return;
    
    try {
      await onDelete();
      onOpenChange(false);
      toast.success('Rascunho excluído');
    } catch (error) {
      console.error('Error deleting draft:', error);
      toast.error('Erro ao excluir rascunho');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (!data) return null;

  // Check for missing NCM items
  const itemsWithoutNcm = data.items.filter(item => !item.ncm?.trim());

  return (
    <>
    {InvoiceConfirmDialog}
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Editar NF-e - Rascunho
              </DialogTitle>
              <DialogDescription className="mt-1">
                As alterações feitas aqui afetam apenas esta NF-e, não o pedido original.
              </DialogDescription>
            </div>
            <Badge variant="secondary">
              Série {data.serie} - Nº {data.numero}
            </Badge>
          </div>
        </DialogHeader>

        {/* SEFAZ Rejection Error Alert */}
        {rejectionError && (
          <Alert variant="destructive" className="mt-2 border-red-600/50 bg-red-500/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong className="block mb-1">Erro SEFAZ - NF-e Rejeitada:</strong>
              <span className="text-sm">{rejectionError}</span>
            </AlertDescription>
          </Alert>
        )}

        {/* Validation Errors Alert */}
        {validationErrors.length > 0 && !rejectionError && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Corrija os erros antes de emitir:</strong>
              <ul className="list-disc ml-4 mt-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* NCM Warning */}
        {itemsWithoutNcm.length > 0 && validationErrors.length === 0 && (
          <Alert className="mt-2 border-amber-500/50 bg-amber-500/5">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-700">
              {itemsWithoutNcm.length} item(ns) sem NCM preenchido. Preencha na aba "Itens" antes de emitir.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="geral" className="gap-1">
              <FileText className="h-4 w-4" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="destinatario" className="gap-1">
              <User className="h-4 w-4" />
              Destinatário
            </TabsTrigger>
            <TabsTrigger value="itens" className="gap-1 relative">
              <Package className="h-4 w-4" />
              Itens
              {itemsWithoutNcm.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                  !
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="valores" className="gap-1">
              <Calculator className="h-4 w-4" />
              Valores
            </TabsTrigger>
            <TabsTrigger value="transporte" className="gap-1">
              <Truck className="h-4 w-4" />
              Transporte
            </TabsTrigger>
          </TabsList>

          {/* Tab: Geral */}
          <TabsContent value="geral" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados Gerais</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Número da NF-e</Label>
                  <Input value={data.numero} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Série</Label>
                  <Input value={data.serie} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Data de Emissão</Label>
                  <Input
                    type="date"
                    value={data.data_emissao?.split('T')[0] || ''}
                    onChange={(e) => updateField('data_emissao', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Saída</Label>
                  <Input
                    type="date"
                    value={data.data_saida?.split('T')[0] || ''}
                    onChange={(e) => updateField('data_saida', e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Natureza da Operação</Label>
                  <Select
                    value={data.natureza_operacao}
                    onValueChange={(value) => updateField('natureza_operacao', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NATUREZA_OPTIONS.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>CFOP Principal <span className="text-destructive">*</span></Label>
                  <Input
                    value={data.cfop || ''}
                    onChange={(e) => updateField('cfop', e.target.value.replace(/\D/g, ''))}
                    placeholder="Ex: 5102"
                    maxLength={4}
                    className={`font-mono ${data.cfop && !isValidCfop(data.cfop) ? 'border-destructive' : ''}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    5102 (dentro do estado) ou 6102 (fora do estado)
                  </p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Observações / Informações Complementares</Label>
                  <Textarea
                    value={data.observacoes || ''}
                    onChange={(e) => updateField('observacoes', e.target.value)}
                    rows={3}
                    placeholder="Informações adicionais que aparecerão na NF-e..."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Destinatário */}
          <TabsContent value="destinatario" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados do Destinatário</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Nome / Razão Social <span className="text-destructive">*</span></Label>
                  <Input
                    value={data.dest_nome}
                    onChange={(e) => updateField('dest_nome', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CPF/CNPJ <span className="text-destructive">*</span></Label>
                  <Input
                    value={data.dest_cpf_cnpj}
                    onChange={(e) => updateField('dest_cpf_cnpj', e.target.value.replace(/\D/g, ''))}
                    placeholder="Apenas números (11 ou 14 dígitos)"
                    maxLength={14}
                    className={`font-mono ${data.dest_cpf_cnpj && !isValidCpfCnpj(data.dest_cpf_cnpj) ? 'border-destructive' : ''}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    {data.dest_cpf_cnpj?.replace(/\D/g, '').length || 0}/14 dígitos
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Inscrição Estadual</Label>
                  <Input
                    value={data.dest_ie || ''}
                    onChange={(e) => updateField('dest_ie', e.target.value)}
                    placeholder="Isento ou número"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Pessoa</Label>
                  <Select
                    value={data.dest_tipo_pessoa}
                    onValueChange={(value) => updateField('dest_tipo_pessoa', value as 'fisica' | 'juridica')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fisica">Pessoa Física</SelectItem>
                      <SelectItem value="juridica">Pessoa Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={data.dest_consumidor_final}
                    onCheckedChange={(checked) => updateField('dest_consumidor_final', checked)}
                  />
                  <Label>Consumidor Final</Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Endereço</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Logradouro <span className="text-destructive">*</span></Label>
                  <Input
                    value={data.dest_endereco_logradouro}
                    onChange={(e) => updateField('dest_endereco_logradouro', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input
                    value={data.dest_endereco_numero}
                    onChange={(e) => updateField('dest_endereco_numero', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Complemento</Label>
                  <Input
                    value={data.dest_endereco_complemento || ''}
                    onChange={(e) => updateField('dest_endereco_complemento', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input
                    value={data.dest_endereco_bairro}
                    onChange={(e) => updateField('dest_endereco_bairro', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CEP <span className="text-destructive">*</span></Label>
                  <Input
                    value={data.dest_endereco_cep}
                    onChange={(e) => updateField('dest_endereco_cep', e.target.value.replace(/\D/g, ''))}
                    maxLength={8}
                    placeholder="00000000"
                    className={`font-mono ${data.dest_endereco_cep && !isValidCep(data.dest_endereco_cep) ? 'border-destructive' : ''}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    8 dígitos, sem traço
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Município <span className="text-destructive">*</span></Label>
                  <Input
                    value={data.dest_endereco_municipio}
                    onChange={(e) => updateField('dest_endereco_municipio', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Código IBGE <span className="text-destructive">*</span></Label>
                  <Input
                    value={data.dest_endereco_municipio_codigo}
                    onChange={(e) => updateField('dest_endereco_municipio_codigo', e.target.value.replace(/\D/g, ''))}
                    placeholder="7 dígitos"
                    maxLength={7}
                    className={`font-mono ${data.dest_endereco_municipio_codigo && !isValidIbge(data.dest_endereco_municipio_codigo) ? 'border-destructive' : ''}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    Consulte em <a href="https://www.ibge.gov.br/explica/codigos-dos-municipios.php" target="_blank" rel="noopener" className="text-primary underline">ibge.gov.br</a>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>UF <span className="text-destructive">*</span></Label>
                  <Select
                    value={data.dest_endereco_uf}
                    onValueChange={(value) => updateField('dest_endereco_uf', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UF_OPTIONS.map(uf => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={data.dest_telefone || ''}
                    onChange={(e) => updateField('dest_telefone', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    value={data.dest_email || ''}
                    onChange={(e) => updateField('dest_email', e.target.value)}
                    type="email"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Itens */}
          <TabsContent value="itens" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Itens da Nota Fiscal</CardTitle>
                    <CardDescription>
                      Edite os itens livremente. As alterações afetam apenas esta NF-e.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{data.items.length} item(ns)</Badge>
                    <ProductSelector 
                      onSelect={addProductFromCatalog}
                      placeholder="Buscar produto"
                      className="h-9"
                    />
                    <Button variant="outline" size="sm" onClick={addItem}>
                      <Plus className="h-4 w-4 mr-1" />
                      Manual
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Legenda e ajuda */}
                <Alert className="border-blue-200 bg-blue-50">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800 text-xs">
                    <strong>Campos obrigatórios:</strong> NCM (8 dígitos), CFOP (4 dígitos), Descrição, Quantidade e Valor. 
                    Consulte NCM em <a href="https://portalunico.siscomex.gov.br/classif" target="_blank" rel="noopener" className="underline">SISCOMEX</a>
                  </AlertDescription>
                </Alert>

                {data.items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum item adicionado</p>
                    <p className="text-xs">Use os botões acima para adicionar produtos</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.items.map((item, index) => {
                      const ncm = item.ncm?.replace(/\D/g, '') || '';
                      const hasNcmError = !ncm || ncm.length !== 8;
                      const cfop = item.cfop?.replace(/\D/g, '') || '';
                      const hasCfopError = !cfop || cfop.length !== 4;
                      
                      return (
                        <Card key={item.id || index} className={`${hasNcmError ? 'border-amber-400' : ''}`}>
                          <CardHeader className="py-3 px-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono">#{item.numero_item}</Badge>
                                <span className="font-medium text-sm truncate max-w-[300px]">
                                  {item.descricao || 'Sem descrição'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-primary">{formatCurrency(item.valor_total)}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeItem(index)}
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="py-3 px-4 pt-0">
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              {/* Descrição */}
                              <div className="space-y-1 sm:col-span-2">
                                <Label className="text-xs">Descrição <span className="text-destructive">*</span></Label>
                                <Input
                                  value={item.descricao}
                                  onChange={(e) => updateItem(index, 'descricao', e.target.value)}
                                  className="h-8 text-sm"
                                  placeholder="Descrição do produto"
                                />
                              </div>
                              
                              {/* NCM */}
                              <div className="space-y-1">
                                <Label className="text-xs">
                                  NCM <span className="text-destructive">*</span>
                                  {hasNcmError && <span className="text-amber-600 ml-1">(8 dígitos)</span>}
                                </Label>
                                <Input
                                  value={item.ncm}
                                  onChange={(e) => updateItem(index, 'ncm', e.target.value.replace(/\D/g, ''))}
                                  className={`h-8 text-sm font-mono ${hasNcmError ? 'border-amber-500 bg-amber-50' : ''}`}
                                  maxLength={8}
                                  placeholder="00000000"
                                />
                              </div>
                              
                              {/* CFOP */}
                              <div className="space-y-1">
                                <Label className="text-xs">
                                  CFOP <span className="text-destructive">*</span>
                                  {hasCfopError && <span className="text-amber-600 ml-1">(4 dígitos)</span>}
                                </Label>
                                <Input
                                  value={item.cfop}
                                  onChange={(e) => updateItem(index, 'cfop', e.target.value.replace(/\D/g, ''))}
                                  className={`h-8 text-sm font-mono ${hasCfopError ? 'border-amber-500 bg-amber-50' : ''}`}
                                  maxLength={4}
                                  placeholder="5102"
                                />
                              </div>
                              
                              {/* Origem */}
                              <div className="space-y-1">
                                <Label className="text-xs">Origem</Label>
                                <Select
                                  value={item.origem || '0'}
                                  onValueChange={(value) => updateItem(index, 'origem', value)}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ORIGEM_OPTIONS.map(opt => (
                                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              {/* CSOSN */}
                              <div className="space-y-1">
                                <Label className="text-xs">CSOSN (Simples Nacional)</Label>
                                <Select
                                  value={item.csosn || '102'}
                                  onValueChange={(value) => updateItem(index, 'csosn', value)}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {CSOSN_OPTIONS.map(opt => (
                                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              {/* Unidade */}
                              <div className="space-y-1">
                                <Label className="text-xs">Unidade</Label>
                                <Input
                                  value={item.unidade}
                                  onChange={(e) => updateItem(index, 'unidade', e.target.value.toUpperCase())}
                                  className="h-8 text-sm"
                                  maxLength={6}
                                  placeholder="UN"
                                />
                              </div>
                              
                              {/* Quantidade */}
                              <div className="space-y-1">
                                <Label className="text-xs">Quantidade <span className="text-destructive">*</span></Label>
                                <Input
                                  type="number"
                                  value={item.quantidade}
                                  onChange={(e) => updateItem(index, 'quantidade', parseFloat(e.target.value) || 0)}
                                  className="h-8 text-sm"
                                  min={0}
                                  step="0.01"
                                />
                              </div>
                              
                              {/* Valor Unitário */}
                              <div className="space-y-1">
                                <Label className="text-xs">Valor Unitário <span className="text-destructive">*</span></Label>
                                <Input
                                  type="number"
                                  value={item.valor_unitario}
                                  onChange={(e) => updateItem(index, 'valor_unitario', parseFloat(e.target.value) || 0)}
                                  className="h-8 text-sm"
                                  min={0}
                                  step="0.01"
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Valores */}
          <TabsContent value="valores" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Totais da Nota Fiscal</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Total dos Produtos</Label>
                  <Input
                    value={data.valor_produtos.toFixed(2)}
                    disabled
                    className="bg-muted font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Frete</Label>
                  <Input
                    type="number"
                    value={data.valor_frete}
                    onChange={(e) => {
                      updateField('valor_frete', parseFloat(e.target.value) || 0);
                      recalculateTotals(data.items);
                    }}
                    min={0}
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Seguro</Label>
                  <Input
                    type="number"
                    value={data.valor_seguro}
                    onChange={(e) => {
                      updateField('valor_seguro', parseFloat(e.target.value) || 0);
                      recalculateTotals(data.items);
                    }}
                    min={0}
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Outras Despesas</Label>
                  <Input
                    type="number"
                    value={data.valor_outras_despesas}
                    onChange={(e) => {
                      updateField('valor_outras_despesas', parseFloat(e.target.value) || 0);
                      recalculateTotals(data.items);
                    }}
                    min={0}
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Desconto</Label>
                  <Input
                    type="number"
                    value={data.valor_desconto}
                    onChange={(e) => {
                      updateField('valor_desconto', parseFloat(e.target.value) || 0);
                      recalculateTotals(data.items);
                    }}
                    min={0}
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold">TOTAL DA NOTA</Label>
                  <Input
                    value={formatCurrency(data.valor_total)}
                    disabled
                    className="bg-primary/10 font-bold text-lg border-primary"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Transporte */}
          <TabsContent value="transporte" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados do Transporte</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Modalidade do Frete</Label>
                  <Select
                    value={data.modalidade_frete}
                    onValueChange={(value) => updateField('modalidade_frete', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODALIDADE_FRETE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nome/Razão Social da Transportadora</Label>
                  <Input
                    value={data.transportadora_nome || ''}
                    onChange={(e) => updateField('transportadora_nome', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CNPJ/CPF da Transportadora</Label>
                  <Input
                    value={data.transportadora_cnpj || ''}
                    onChange={(e) => updateField('transportadora_cnpj', e.target.value)}
                  />
                </div>
                <Separator className="sm:col-span-2" />
                <div className="space-y-2">
                  <Label>Peso Bruto (kg)</Label>
                  <Input
                    type="number"
                    value={data.peso_bruto || ''}
                    onChange={(e) => updateField('peso_bruto', parseFloat(e.target.value) || undefined)}
                    min={0}
                    step="0.001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Peso Líquido (kg)</Label>
                  <Input
                    type="number"
                    value={data.peso_liquido || ''}
                    onChange={(e) => updateField('peso_liquido', parseFloat(e.target.value) || undefined)}
                    min={0}
                    step="0.001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantidade de Volumes</Label>
                  <Input
                    type="number"
                    value={data.quantidade_volumes || ''}
                    onChange={(e) => updateField('quantidade_volumes', parseInt(e.target.value) || undefined)}
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Espécie dos Volumes</Label>
                  <Input
                    value={data.especie_volumes || ''}
                    onChange={(e) => updateField('especie_volumes', e.target.value)}
                    placeholder="Ex: Caixa, Volume, Pacote"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          <div className="flex gap-2 flex-1">
            {onDelete && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isSaving || isSubmitting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-2" />
              Fechar
            </Button>
            <Button
              variant="secondary"
              onClick={handleSave}
              disabled={isSaving || isSubmitting}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Rascunho
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Emitir NF-e
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
