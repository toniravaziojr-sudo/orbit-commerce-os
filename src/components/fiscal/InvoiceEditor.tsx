import { useState, useEffect } from 'react';
import { FileText, User, Package, MapPin, Calculator, Truck, Save, Send, Trash2, X, Loader2, AlertCircle, Plus } from 'lucide-react';
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
}

export function InvoiceEditor({
  open,
  onOpenChange,
  invoice,
  onSave,
  onSubmit,
  onDelete,
  isLoading = false,
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
    if (!data.dest_nome?.trim()) errors.push('Nome do destinatário é obrigatório');
    if (!data.dest_cpf_cnpj?.trim()) errors.push('CPF/CNPJ do destinatário é obrigatório');
    
    // Address validation
    if (!data.dest_endereco_logradouro?.trim()) errors.push('Logradouro é obrigatório');
    if (!data.dest_endereco_municipio?.trim()) errors.push('Município é obrigatório');
    if (!data.dest_endereco_uf?.trim()) errors.push('UF é obrigatório');
    if (!data.dest_endereco_municipio_codigo?.trim()) errors.push('Código IBGE do município é obrigatório');
    if (!data.dest_endereco_cep?.trim()) errors.push('CEP é obrigatório');
    
    // Items validation
    if (data.items.length === 0) {
      errors.push('A NF-e precisa ter pelo menos um item');
    } else {
      const itemsWithoutNcm = data.items.filter(item => !item.ncm?.trim());
      if (itemsWithoutNcm.length > 0) {
        errors.push(`NCM não preenchido em ${itemsWithoutNcm.length} item(ns): ${itemsWithoutNcm.map(i => i.descricao || `Item ${i.numero_item}`).join(', ')}`);
      }
      
      const itemsWithoutDesc = data.items.filter(item => !item.descricao?.trim());
      if (itemsWithoutDesc.length > 0) {
        errors.push(`Descrição não preenchida em ${itemsWithoutDesc.length} item(ns)`);
      }
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

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm('Tem certeza que deseja excluir este rascunho?')) return;
    
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

        {/* Validation Errors Alert */}
        {validationErrors.length > 0 && (
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
                  <Label>CFOP Principal</Label>
                  <Input
                    value={data.cfop || ''}
                    onChange={(e) => updateField('cfop', e.target.value)}
                    placeholder="Ex: 5102"
                    maxLength={4}
                  />
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
                    onChange={(e) => updateField('dest_cpf_cnpj', e.target.value)}
                    placeholder="Apenas números"
                  />
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
                    onChange={(e) => updateField('dest_endereco_cep', e.target.value)}
                    maxLength={9}
                  />
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
                    onChange={(e) => updateField('dest_endereco_municipio_codigo', e.target.value)}
                    placeholder="7 dígitos"
                    maxLength={7}
                  />
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
                    <Button variant="outline" size="sm" onClick={addItem}>
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="w-28">
                          NCM <span className="text-destructive">*</span>
                        </TableHead>
                        <TableHead className="w-16">CFOP</TableHead>
                        <TableHead className="w-16">UN</TableHead>
                        <TableHead className="w-20">Qtd</TableHead>
                        <TableHead className="w-28">Valor Unit.</TableHead>
                        <TableHead className="w-28">Total</TableHead>
                        <TableHead className="w-20">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((item, index) => {
                        const hasNcmError = !item.ncm?.trim();
                        return (
                          <TableRow key={item.id || index}>
                            <TableCell className="font-mono text-xs">{item.numero_item}</TableCell>
                            <TableCell>
                              <Input
                                value={item.descricao}
                                onChange={(e) => updateItem(index, 'descricao', e.target.value)}
                                className="h-8 text-sm"
                                placeholder="Descrição do produto"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.ncm}
                                onChange={(e) => updateItem(index, 'ncm', e.target.value)}
                                className={`h-8 text-sm font-mono ${hasNcmError ? 'border-amber-500 bg-amber-50' : ''}`}
                                maxLength={8}
                                placeholder="00000000"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.cfop}
                                onChange={(e) => updateItem(index, 'cfop', e.target.value)}
                                className="h-8 text-sm font-mono"
                                maxLength={4}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.unidade}
                                onChange={(e) => updateItem(index, 'unidade', e.target.value)}
                                className="h-8 text-sm"
                                maxLength={6}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={item.quantidade}
                                onChange={(e) => updateItem(index, 'quantidade', parseFloat(e.target.value) || 0)}
                                className="h-8 text-sm"
                                min={0}
                                step="0.01"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={item.valor_unitario}
                                onChange={(e) => updateItem(index, 'valor_unitario', parseFloat(e.target.value) || 0)}
                                className="h-8 text-sm"
                                min={0}
                                step="0.01"
                              />
                            </TableCell>
                            <TableCell className="font-medium text-right">
                              {formatCurrency(item.valor_total)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(index)}
                                className="h-8 w-8 text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
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
  );
}
