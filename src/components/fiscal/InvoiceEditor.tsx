import { useState, useEffect, useCallback } from 'react';
import { format, parse } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useFiscalReadiness } from '@/hooks/useFiscalReadiness';
import { FileText, User, Package, MapPin, Calculator, Truck, Save, Send, Trash2, X, Loader2, AlertCircle, Plus, Search, CreditCard, ChevronDown, ChevronUp, ExternalLink, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
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
import { SupplierAutocomplete, type SupplierContact } from '@/components/suppliers/SupplierAutocomplete';
import { AddressFields } from '@/components/shared/AddressFields';

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
  tipo_nota?: 'saida' | 'entrada' | 'remessa' | 'devolucao' | 'transferencia';
  tipo_documento?: number; // 0 = entrada, 1 = saída (SEFAZ)
  finalidade_emissao?: number; // 1=Normal, 2=Complementar, 3=Ajuste, 4=Devolução
  chave_acesso_referenciada?: string;
  // SEFAZ IDE
  indicador_presenca: number;
  informacoes_fisco?: string;
  // Destinatário
  dest_nome: string;
  dest_cpf_cnpj: string;
  dest_ie?: string;
  dest_tipo_pessoa: 'fisica' | 'juridica';
  dest_consumidor_final: boolean;
  indicador_ie_dest: number;
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
  // Totais de impostos
  valor_bc_icms: number;
  valor_icms: number;
  valor_pis: number;
  valor_cofins: number;
  // Items
  items: InvoiceItemData[];
  // Transporte
  modalidade_frete: string;
  transportadora_nome?: string;
  transportadora_servico?: string;
  transportadora_cnpj?: string;
  peso_bruto?: number;
  peso_liquido?: number;
  quantidade_volumes?: number;
  especie_volumes?: string;
  // Pagamento
  pagamento_indicador: number;
  pagamento_meio: string;
  pagamento_valor: number;
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
  // Campos SEFAZ novos
  gtin: string;
  gtin_tributavel: string;
  cest: string;
  valor_desconto: number;
  icms_base: number;
  icms_aliquota: number;
  icms_valor: number;
  pis_cst: string;
  pis_base: number;
  pis_aliquota: number;
  pis_valor: number;
  cofins_cst: string;
  cofins_base: number;
  cofins_aliquota: number;
  cofins_valor: number;
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

// Opções SEFAZ: Indicador de Presença
const INDICADOR_PRESENCA_OPTIONS = [
  { value: 0, label: '0 - Não se aplica' },
  { value: 1, label: '1 - Presencial' },
  { value: 2, label: '2 - Internet' },
  { value: 3, label: '3 - Teleatendimento' },
  { value: 4, label: '4 - NFC-e em domicílio' },
  { value: 5, label: '5 - Presencial fora do estabelecimento' },
  { value: 9, label: '9 - Outros' },
];

// Opções SEFAZ: Indicador IE Destinatário
const INDICADOR_IE_DEST_OPTIONS = [
  { value: 1, label: '1 - Contribuinte ICMS' },
  { value: 2, label: '2 - Contribuinte isento' },
  { value: 9, label: '9 - Não Contribuinte' },
];

// Opções SEFAZ: Indicador de Pagamento
const PAGAMENTO_INDICADOR_OPTIONS = [
  { value: 0, label: '0 - À Vista' },
  { value: 1, label: '1 - A Prazo' },
  { value: 2, label: '2 - Outros' },
];

// Opções SEFAZ: Meio de Pagamento (tPag)
const PAGAMENTO_MEIO_OPTIONS = [
  { value: '01', label: '01 - Dinheiro' },
  { value: '02', label: '02 - Cheque' },
  { value: '03', label: '03 - Cartão de Crédito' },
  { value: '04', label: '04 - Cartão de Débito' },
  { value: '05', label: '05 - Crédito Loja' },
  { value: '10', label: '10 - Vale Alimentação' },
  { value: '11', label: '11 - Vale Refeição' },
  { value: '12', label: '12 - Vale Presente' },
  { value: '13', label: '13 - Vale Combustível' },
  { value: '14', label: '14 - Duplicata Mercantil' },
  { value: '15', label: '15 - Boleto Bancário' },
  { value: '16', label: '16 - Depósito Bancário' },
  { value: '17', label: '17 - PIX' },
  { value: '18', label: '18 - Transferência Bancária' },
  { value: '19', label: '19 - Programa de Fidelidade' },
  { value: '90', label: '90 - Sem Pagamento' },
  { value: '99', label: '99 - Outros' },
];

// Opções PIS/COFINS CST
const PIS_COFINS_CST_OPTIONS = [
  { value: '01', label: '01 - Tributável (alíq. básica)' },
  { value: '02', label: '02 - Tributável (alíq. diferenciada)' },
  { value: '04', label: '04 - Tributável monofásica (alíq. zero)' },
  { value: '05', label: '05 - Tributável (ST)' },
  { value: '06', label: '06 - Tributável (alíq. zero)' },
  { value: '07', label: '07 - Isenta' },
  { value: '08', label: '08 - Sem incidência' },
  { value: '09', label: '09 - Com suspensão' },
  { value: '49', label: '49 - Outras operações de saída' },
  { value: '99', label: '99 - Outras operações' },
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

// Naturezas de operação agora são carregadas do banco (fiscal_operation_natures)

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
  onDelete?: () => Promise<void>;
  isLoading?: boolean;
  /** Error message from SEFAZ rejection or other error */
  rejectionError?: string;
  /** Invoice status to show appropriate UI */
  invoiceStatus?: string;
  /** Etapa operacional. 'pedido_venda' troca o editor para o modo Pedido de Venda
   *  (sem ação de Emitir; botão principal vira "Criar Nota Fiscal"). */
  invoiceStage?: string | null;
  /** Acionado quando, no modo Pedido de Venda, o usuário clica em "Criar Nota Fiscal". */
  onPrepare?: (data: InvoiceData) => Promise<void>;
  /** Lista de pendências do Pedido de Venda (peso, NCM, CPF, etc.). Exibe banner amarelo e bloqueia "Criar Nota Fiscal". */
  pendenciaMotivos?: string[];
  /** Lista de avisos informativos do Pedido de Venda (ex.: UF do CEP difere do pedido). NÃO bloqueia emissão. */
  pendenciaAvisos?: string[];
}

// Campos do destinatário monitorados para sincronizar com o cadastro do cliente.
// Cada chave aponta para o rótulo amigável exibido no diálogo de confirmação.
const DEST_FIELDS_LABELS: Array<{ key: keyof InvoiceData; label: string }> = [
  { key: 'dest_nome', label: 'Nome / Razão social' },
  { key: 'dest_cpf_cnpj', label: 'CPF / CNPJ' },
  { key: 'dest_email', label: 'E-mail' },
  { key: 'dest_telefone', label: 'Telefone' },
  { key: 'dest_endereco_cep', label: 'CEP' },
  { key: 'dest_endereco_logradouro', label: 'Endereço' },
  { key: 'dest_endereco_numero', label: 'Número' },
  { key: 'dest_endereco_complemento', label: 'Complemento' },
  { key: 'dest_endereco_bairro', label: 'Bairro' },
  { key: 'dest_endereco_municipio', label: 'Cidade' },
  { key: 'dest_endereco_uf', label: 'Estado' },
];

function captureDestSnapshot(inv: InvoiceData): Record<string, string> {
  const snap: Record<string, string> = {};
  for (const { key } of DEST_FIELDS_LABELS) {
    snap[key as string] = String((inv as any)[key] ?? '').trim();
  }
  return snap;
}

function diffDestSnapshot(
  initial: Record<string, string> | null,
  current: InvoiceData,
): string[] {
  if (!initial) return [];
  const changed: string[] = [];
  for (const { key, label } of DEST_FIELDS_LABELS) {
    const before = initial[key as string] ?? '';
    const after = String((current as any)[key] ?? '').trim();
    if (before !== after) changed.push(label);
  }
  return changed;
}


export function InvoiceEditor({
  open,
  onOpenChange,
  invoice,
  onSave,
  onDelete,
  isLoading = false,
  rejectionError,
  invoiceStatus,
  invoiceStage,
  onPrepare,
  pendenciaMotivos,
  pendenciaAvisos,
}: InvoiceEditorProps) {
  const { profile } = useAuth();
  const tenantId = profile?.current_tenant_id;
  const [data, setData] = useState<InvoiceData | null>(null);
  const [linkedSupplierId, setLinkedSupplierId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('geral');
  const { data: readiness } = useFiscalReadiness();
  const { confirm: confirmAction, ConfirmDialog: InvoiceConfirmDialog } = useConfirmDialog();
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  // NFs filhas deste Pedido de Venda (modo PV) — alimenta o bloco "Vinculado à NF".
  const [childInvoices, setChildInvoices] = useState<Array<{ id: string; numero: number; serie: number; status: string; cancelled_at: string | null }>>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  // Snapshot dos dados do destinatário no momento que o pedido foi carregado.
  // Usado para detectar edições e oferecer atualizar o cadastro do cliente.
  const [initialDest, setInitialDest] = useState<Record<string, string> | null>(null);
  // Diálogo "alterou cadastro do cliente". Aparece ao salvar quando algum
  // campo do destinatário foi modificado e o pedido está vinculado a um cliente.
  const [destSyncDialog, setDestSyncDialog] = useState<{
    open: boolean;
    changedLabels: string[];
    pending: InvoiceData | null;
  }>({ open: false, changedLabels: [], pending: null });
  const [operationNatures, setOperationNatures] = useState<Array<{
    id: string; nome: string; descricao: string | null;
    cfop_intra: string; cfop_inter: string;
    tipo_documento: number; finalidade: number;
    csosn_padrao: string | null; ind_pres: number;
    consumidor_final: boolean; faturada: boolean;
  }>>([]);

  // Load operation natures from database
  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const { data: natures } = await supabase
        .from('fiscal_operation_natures')
        .select('id, nome, descricao, cfop_intra, cfop_inter, tipo_documento, finalidade, csosn_padrao, ind_pres, consumidor_final, faturada')
        .eq('tenant_id', tenantId)
        .eq('ativo', true)
        .order('nome');
      if (natures) setOperationNatures(natures as any);
    };
    load();
  }, [tenantId]);

  // Resolve customer_id from order_id to enable "Abrir cadastro do cliente"
  useEffect(() => {
    const orderId = invoice?.order_id;
    if (!orderId) { setCustomerId(null); return; }
    let cancelled = false;
    (async () => {
      const { data: row } = await supabase
        .from('orders')
        .select('customer_id')
        .eq('id', orderId)
        .maybeSingle();
      if (!cancelled) setCustomerId((row as any)?.customer_id ?? null);
    })();
    return () => { cancelled = true; };
  }, [invoice?.order_id]);

  // Carrega NFs filhas (apenas em modo Pedido de Venda). Mostra vínculo "NF nº X".
  useEffect(() => {
    const pvId = invoice?.id;
    if (!open || !pvId || invoiceStage !== 'pedido_venda') { setChildInvoices([]); return; }
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from('fiscal_invoices')
        .select('id, numero, serie, status, cancelled_at')
        .eq('source_order_invoice_id', pvId)
        .order('created_at', { ascending: false });
      if (!cancelled) setChildInvoices((rows as any) || []);
    })();
    return () => { cancelled = true; };
  }, [open, invoice?.id, invoiceStage]);

  // Filter natures based on selected tipo_nota
  const filteredNatures = operationNatures.filter(n => {
    if (!data?.tipo_nota) return true;
    switch (data.tipo_nota) {
      case 'saida': return n.tipo_documento === 1 && n.finalidade === 1;
      case 'entrada': return n.tipo_documento === 0 && n.finalidade === 1;
      case 'devolucao': return n.finalidade === 4;
      case 'remessa': {
        // Critério oficial Receita Federal: CFOPs de remessa estão na faixa 5900-5999 (intra) / 6900-6999 (inter).
        // Inclui armazém geral, consignação, demonstração, bonificação, amostra, conserto, comodato etc.
        const cfop = parseInt(n.cfop_intra || '0', 10);
        return n.tipo_documento === 1 && cfop >= 5900 && cfop <= 5999;
      }
      case 'transferencia': return n.nome.toLowerCase().includes('transferência') || n.nome.toLowerCase().includes('transferencia');
      default: return true;
    }
  });

  // Auto-fill fields when nature is selected
  const handleNatureChange = useCallback((natureName: string) => {
    const nature = operationNatures.find(n => n.nome === natureName);
    if (!nature || !data) {
      updateField('natureza_operacao', natureName);
      return;
    }
    // Use cfop_intra as default (intrastate); user can change if interstate
    setData(prev => prev ? {
      ...prev,
      natureza_operacao: nature.nome,
      cfop: nature.cfop_intra,
      indicador_presenca: nature.ind_pres ?? 2,
      dest_consumidor_final: nature.consumidor_final ?? true,
    } : null);
  }, [operationNatures, data]);

  useEffect(() => {
    if (invoice) {
      setData({ ...invoice });
      setValidationErrors([]);
      setInitialDest(captureDestSnapshot(invoice));
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
      gtin: '',
      gtin_tributavel: '',
      cest: '',
      valor_desconto: 0,
      icms_base: 0, icms_aliquota: 0, icms_valor: 0,
      pis_cst: '49', pis_base: 0, pis_aliquota: 0, pis_valor: 0,
      cofins_cst: '49', cofins_base: 0, cofins_aliquota: 0, cofins_valor: 0,
    };
    setData({ ...data, items: [...data.items, newItem] });
  };

  const addProductFromCatalog = (product: ProductWithFiscal) => {
    if (!data) return;
    // Regra: produto sempre vem completo do cadastro. Sem peso cadastrado, bloqueia a adição
    // (peso é obrigatório para Declaração de Conteúdo e Remessa).
    const pesoGramas = Number(product.weight ?? 0);
    if (!pesoGramas || pesoGramas <= 0) {
      toast.error(
        `Produto "${product.name}" está sem peso cadastrado.`,
        { description: 'Cadastre o peso (em gramas) na ficha do produto antes de adicionar à NF.' },
      );
      return;
    }
    if (!product.ncm) {
      toast.error(
        `Produto "${product.name}" está sem NCM cadastrado.`,
        { description: 'Cadastre o NCM na ficha do produto antes de adicionar à NF.' },
      );
      return;
    }
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
      gtin: (product as any).gtin || '',
      gtin_tributavel: (product as any).gtin || '',
      cest: (product as any).cest || '',
      valor_desconto: 0,
      icms_base: 0, icms_aliquota: 0, icms_valor: 0,
      pis_cst: '49', pis_base: 0, pis_aliquota: 0, pis_valor: 0,
      cofins_cst: '49', cofins_base: 0, cofins_aliquota: 0, cofins_valor: 0,
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
    const descontoItens = items.reduce((sum, item) => sum + (Number(item.valor_desconto) || 0), 0);
    // Regra: usa o maior entre desconto do cabeçalho e soma dos descontos por item,
    // evitando contar desconto em dobro quando o usuário preenche os dois lados.
    const descontoEfetivo = Math.max(Number(data.valor_desconto) || 0, descontoItens);
    const valor_total = Math.max(0, valor_produtos + (data.valor_frete || 0) + (data.valor_seguro || 0) + (data.valor_outras_despesas || 0) - descontoEfetivo);
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

  // Salva o pedido. Se o usuário alterou dados do destinatário e o pedido
  // está vinculado a um cliente, abre o diálogo de sincronização com cadastro.
  const persistSave = async (
    payload: InvoiceData,
    alsoUpdateCustomer: boolean,
    afterSave?: (payload: InvoiceData) => Promise<void>,
  ) => {
    setIsSaving(true);
    try {
      await onSave(payload);
      if (alsoUpdateCustomer && customerId) {
        const { error: custErr } = await supabase
          .from('customers')
          .update({
            full_name: payload.dest_nome,
            ...(payload.dest_tipo_pessoa === 'fisica'
              ? { cpf: payload.dest_cpf_cnpj?.replace(/\D/g, '') || null }
              : { cnpj: payload.dest_cpf_cnpj?.replace(/\D/g, '') || null }),
            email: payload.dest_email || null,
            phone: payload.dest_telefone || null,
            address_postal_code: payload.dest_endereco_cep || null,
            address_street: payload.dest_endereco_logradouro || null,
            address_number: payload.dest_endereco_numero || null,
            address_complement: payload.dest_endereco_complemento || null,
            address_neighborhood: payload.dest_endereco_bairro || null,
            address_city: payload.dest_endereco_municipio || null,
            address_state: payload.dest_endereco_uf || null,
          })
          .eq('id', customerId);
        if (custErr) {
          console.error('[InvoiceEditor] customer update failed:', custErr);
          toast.warning('Pedido salvo. Não foi possível atualizar o cadastro do cliente — tente novamente pelo módulo Clientes.');
        } else {
          toast.success('Pedido salvo e cadastro do cliente atualizado.');
        }
      } else if (!afterSave) {
        toast.success(alsoUpdateCustomer ? 'Pedido salvo.' : 'Rascunho salvo com sucesso');
      }
      // Atualiza snapshot para próximas edições
      setInitialDest(captureDestSnapshot(payload));
      if (afterSave) {
        await afterSave(payload);
      } else {
        // UX: ao salvar com sucesso (sem fluxo encadeado tipo "Criar NF"),
        // fechar o editor para o usuário voltar à listagem.
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Erro ao salvar rascunho');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  // Pendente para ser executado depois do salvamento, quando o usuário escolher
  // uma opção do diálogo de sincronização. Permite encadear "Criar Nota Fiscal".
  const [destSyncAfterSave, setDestSyncAfterSave] = useState<((payload: InvoiceData) => Promise<void>) | null>(null);

  const handleSave = async () => {
    if (!data) return;
    const changed = diffDestSnapshot(initialDest, data);
    if (changed.length > 0 && customerId) {
      setDestSyncAfterSave(null);
      setDestSyncDialog({ open: true, changedLabels: changed, pending: data });
      return;
    }
    await persistSave(data, false);
  };

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

  // Per-item fiscal data validation (used for the unified pendency banner and per-item alerts)
  const getItemIssues = (item: InvoiceItemData): string[] => {
    const issues: string[] = [];
    if (!item.descricao?.trim()) issues.push('Descrição');
    const ncm = item.ncm?.replace(/\D/g, '') || '';
    if (ncm.length !== 8) issues.push('NCM (8 dígitos)');
    const cfop = item.cfop?.replace(/\D/g, '') || '';
    if (cfop.length !== 4) issues.push('CFOP (4 dígitos)');
    if (item.origem === undefined || item.origem === null || item.origem === '') issues.push('Origem');
    if (!item.gtin?.trim()) issues.push('GTIN (ou "SEM GTIN")');
    return issues;
  };

  const itemsWithIssues = data.items
    .map((item, idx) => ({ idx, item, issues: getItemIssues(item) }))
    .filter(({ issues }) => issues.length > 0);

  const isPedidoVenda = invoiceStage === 'pedido_venda';
  // Edição do destinatário é permitida no Pedido de Venda. Ao salvar, o usuário
  // decide via diálogo se a alteração também atualiza o cadastro do cliente.
  const lockClientFields = false;
  const itemLockedFromRegistry = (item: InvoiceItemData) =>
    isPedidoVenda && !!item.product_id;
  const editorTitle = isPedidoVenda
    ? `Pedido de Venda – Nº ${data.numero}`
    : `Nota Fiscal – Série ${data.serie} / Nº ${data.numero}`;
  const editorDescription = isPedidoVenda
    ? 'Pedido de venda fiscal. Para emitir a Nota Fiscal, use a ação "Criar Nota Fiscal" — a nota é gerada e transmitida na aba Notas Fiscais.'
    : 'As alterações feitas aqui afetam apenas esta NF-e, não o pedido original.';

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
                {editorTitle}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {editorDescription}
              </DialogDescription>
            </div>
            <Badge variant="secondary">
              {isPedidoVenda ? `Pedido Nº ${data.numero}` : `Série ${data.serie} - Nº ${data.numero}`}
            </Badge>
          </div>
        </DialogHeader>

        {/* Pendências do Pedido de Venda (peso, NCM, CPF, endereço, etc.) */}
        {isPedidoVenda && pendenciaMotivos && pendenciaMotivos.length > 0 && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong className="block mb-1">
                Pendências obrigatórias — corrija para liberar a emissão:
              </strong>
              <ul className="list-disc ml-5 mt-1 text-sm space-y-0.5">
                {pendenciaMotivos.map((m, i) => (<li key={i}>{m}</li>))}
              </ul>
              <p className="mt-2 text-xs opacity-90">
                Enquanto houver pendências, não é possível criar a Nota Fiscal nem gerar a Declaração de Conteúdo.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Avisos informativos do Pedido de Venda (não bloqueiam emissão) */}
        {isPedidoVenda && pendenciaAvisos && pendenciaAvisos.length > 0 && (
          <Alert className="mt-2 border-amber-400/60 bg-amber-100/40">
            <AlertCircle className="h-4 w-4 text-amber-700" />
            <AlertDescription>
              <strong className="block mb-1 text-amber-900">
                Avisos sobre o destinatário — não bloqueiam a emissão, mas confira antes de despachar:
              </strong>
              <ul className="list-disc ml-5 mt-1 text-sm text-amber-900 space-y-0.5">
                {pendenciaAvisos.map((m, i) => (<li key={i}>{m}</li>))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Vínculo com Nota(s) Fiscal(is) gerada(s) a partir deste Pedido de Venda */}
        {isPedidoVenda && childInvoices.length > 0 && (() => {
          const ativas = childInvoices.filter(c => !c.cancelled_at && c.status !== 'cancelled');
          if (ativas.length === 0) {
            return (
              <Alert className="mt-2 border-yellow-500/60 bg-yellow-500/10">
                <AlertCircle className="h-4 w-4 text-yellow-700" />
                <AlertDescription className="text-sm text-yellow-900">
                  Todas as Notas Fiscais geradas a partir deste Pedido foram excluídas ou canceladas.
                  Gere uma nova Nota Fiscal para concluir o pedido.
                </AlertDescription>
              </Alert>
            );
          }
          const STATUS_LABEL: Record<string, string> = {
            draft: 'Rascunho',
            ready: 'Pronta para emitir',
            pending: 'Pendente Sefaz',
            rejected: 'Rejeitada',
            authorized: 'Autorizada',
          };
          return (
            <Alert className="mt-2 border-purple-500/40 bg-purple-500/5">
              <FileText className="h-4 w-4 text-purple-700" />
              <AlertDescription>
                <strong className="block mb-1 text-purple-900">
                  {ativas.length === 1
                    ? `Vinculado à Nota Fiscal nº ${ativas[0].numero} (série ${ativas[0].serie})`
                    : `Vinculado a ${ativas.length} Notas Fiscais`}
                </strong>
                <ul className="text-sm text-purple-900 space-y-0.5">
                  {ativas.map(nf => (
                    <li key={nf.id} className="flex items-center gap-2">
                      <span>NF nº {nf.numero} / série {nf.serie}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {STATUS_LABEL[nf.status] || nf.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          );
        })()}

        {/* SEFAZ Rejection Error Alert */}
        {rejectionError && !isPedidoVenda && (
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

        {/* Item Fiscal Pendencies (NCM, GTIN, Origem, ...) */}
        {itemsWithIssues.length > 0 && validationErrors.length === 0 && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong className="block mb-1">
                {itemsWithIssues.length} item(ns) com dados fiscais obrigatórios faltando:
              </strong>
              <ul className="list-disc ml-5 text-xs space-y-0.5">
                {itemsWithIssues.slice(0, 6).map(({ idx, item, issues }) => (
                  <li key={idx}>
                    <span className="font-medium">#{item.numero_item} {item.descricao || 'Item'}</span>
                    {' — '}falta: {issues.join(', ')}
                    {item.product_id && (
                      <Link
                        to="/products"
                        className="ml-2 inline-flex items-center gap-1 underline"
                      >
                        Abrir cadastro <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </li>
                ))}
                {itemsWithIssues.length > 6 && (
                  <li className="opacity-80">…e mais {itemsWithIssues.length - 6} item(ns).</li>
                )}
              </ul>
              {isPedidoVenda && (
                <p className="mt-2 text-xs opacity-90">
                  Os dados fiscais vêm do cadastro do produto. Corrija no cadastro para que o pedido herde automaticamente.
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="geral" className="gap-1 text-xs">
              <FileText className="h-3 w-3" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="destinatario" className="gap-1 text-xs">
              <User className="h-3 w-3" />
              Dest.
            </TabsTrigger>
            <TabsTrigger value="itens" className="gap-1 relative text-xs">
              <Package className="h-3 w-3" />
              Itens
              {itemsWithoutNcm.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                  !
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="valores" className="gap-1 text-xs">
              <Calculator className="h-3 w-3" />
              Valores
            </TabsTrigger>
            <TabsTrigger value="transporte" className="gap-1 text-xs">
              <Truck className="h-3 w-3" />
              Transp.
            </TabsTrigger>
            <TabsTrigger value="pagamento" className="gap-1 text-xs">
              <CreditCard className="h-3 w-3" />
              Pagto.
            </TabsTrigger>
          </TabsList>

          {/* Tab: Geral */}
          <TabsContent value="geral" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados Gerais</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Tipo de Nota <span className="text-destructive">*</span></Label>
                  <Select
                    value={data.tipo_nota || 'saida'}
                    onValueChange={(value) => {
                      updateField('tipo_nota', value as InvoiceData['tipo_nota']);
                      // Reset nature and CFOP when type changes
                      setData(prev => prev ? { ...prev, tipo_nota: value as any, natureza_operacao: '', cfop: '' } : null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="saida">Saída (Venda)</SelectItem>
                      <SelectItem value="entrada">Entrada (Compra)</SelectItem>
                      <SelectItem value="devolucao">Devolução</SelectItem>
                      <SelectItem value="remessa">Remessa</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(data.tipo_nota === 'entrada' || data.tipo_nota === 'devolucao') && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Chave de Acesso da NF-e Referenciada</Label>
                    <Input
                      value={data.chave_acesso_referenciada || ''}
                      onChange={(e) => updateField('chave_acesso_referenciada', e.target.value.replace(/\D/g, ''))}
                      placeholder="44 dígitos da chave de acesso"
                      maxLength={44}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Informe a chave de acesso da NF-e original para referência
                    </p>
                  </div>
                )}
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
                  <DatePickerField
                    value={data.data_emissao ? parse(data.data_emissao.split('T')[0], 'yyyy-MM-dd', new Date()) : undefined}
                    onChange={(date) => updateField('data_emissao', date ? format(date, 'yyyy-MM-dd') : '')}
                    placeholder="Selecione a data"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Saída</Label>
                  <DatePickerField
                    value={data.data_saida ? parse(data.data_saida.split('T')[0], 'yyyy-MM-dd', new Date()) : undefined}
                    onChange={(date) => updateField('data_saida', date ? format(date, 'yyyy-MM-dd') : '')}
                    placeholder="Selecione a data"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Natureza da Operação <span className="text-destructive">*</span></Label>
                  <Select
                    value={data.natureza_operacao}
                    onValueChange={handleNatureChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a natureza..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredNatures.length > 0 ? (
                        filteredNatures.map(n => (
                          <SelectItem key={n.id} value={n.nome}>
                            {n.nome}
                            {n.cfop_intra && <span className="ml-2 text-muted-foreground text-xs">({n.cfop_intra}/{n.cfop_inter})</span>}
                          </SelectItem>
                        ))
                      ) : (
                        operationNatures.map(n => (
                          <SelectItem key={n.id} value={n.nome}>
                            {n.nome}
                            {n.cfop_intra && <span className="ml-2 text-muted-foreground text-xs">({n.cfop_intra}/{n.cfop_inter})</span>}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {data.natureza_operacao && (() => {
                    const selected = operationNatures.find(n => n.nome === data.natureza_operacao);
                    return selected?.descricao ? (
                      <p className="text-xs text-muted-foreground">{selected.descricao}</p>
                    ) : null;
                  })()}
                </div>
                {!isPedidoVenda && (
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
                )}
                <div className="space-y-2">
                  <Label>Indicador de Presença <span className="text-destructive">*</span></Label>
                  <Select
                    value={String(data.indicador_presenca ?? 2)}
                    onValueChange={(value) => updateField('indicador_presenca', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INDICADOR_PRESENCA_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Observações / Informações Complementares</Label>
                  <Textarea
                    value={data.observacoes || ''}
                    onChange={(e) => updateField('observacoes', e.target.value)}
                    rows={2}
                    placeholder="Informações adicionais que aparecerão na NF-e..."
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Informações ao Fisco</Label>
                  <Textarea
                    value={data.informacoes_fisco || ''}
                    onChange={(e) => updateField('informacoes_fisco', e.target.value)}
                    rows={2}
                    placeholder="Informações de interesse do fisco (opcional)..."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Destinatário */}
          <TabsContent value="destinatario" className="space-y-4">
            {/* Conteúdo da aba Destinatário */}

            {/* Cartão unificado para notas de Entrada/Devolução/Remessa/Transferência */}
            {(['entrada','devolucao','remessa','transferencia'] as const).includes((data.tipo_nota || 'saida') as any) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Fornecedor / Remetente</CardTitle>
                  <CardDescription>
                    Busque na base ou preencha os dados abaixo. O botão "Salvar na base" no final do cartão grava tudo (identificação, IE, endereço e contato) no cadastro central.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <SupplierAutocomplete
                    label="Fornecedor / Remetente"
                    required
                    compact
                    value={{
                      id: linkedSupplierId,
                      name: data.dest_nome || '',
                      document: data.dest_cpf_cnpj || '',
                      personType: data.dest_tipo_pessoa === 'juridica' ? 'PJ' : 'PF',
                      email: data.dest_email || null,
                      phone: data.dest_telefone || null,
                      ie: data.dest_ie || null,
                      indicadorIe: data.indicador_ie_dest ?? null,
                      cep: data.dest_endereco_cep || null,
                      logradouro: data.dest_endereco_logradouro || null,
                      numero: data.dest_endereco_numero || null,
                      complemento: data.dest_endereco_complemento || null,
                      bairro: data.dest_endereco_bairro || null,
                      cidade: data.dest_endereco_municipio || null,
                      uf: data.dest_endereco_uf || null,
                      codigoIbge: data.dest_endereco_municipio_codigo || null,
                    }}
                    onChange={(s: SupplierContact) => {
                      setLinkedSupplierId(s.id ?? null);
                      setData(prev => prev ? ({
                        ...prev,
                        dest_nome: s.name || '',
                        dest_cpf_cnpj: (s.document || '').replace(/\D/g, ''),
                        dest_tipo_pessoa: s.personType === 'PJ' ? 'juridica' : 'fisica',
                        dest_ie: s.ie ?? prev.dest_ie,
                        indicador_ie_dest: s.indicadorIe ?? prev.indicador_ie_dest,
                        dest_email: s.email ?? prev.dest_email,
                        dest_telefone: s.phone ?? prev.dest_telefone,
                        dest_endereco_cep: s.cep ?? prev.dest_endereco_cep,
                        dest_endereco_logradouro: s.logradouro ?? prev.dest_endereco_logradouro,
                        dest_endereco_numero: s.numero ?? prev.dest_endereco_numero,
                        dest_endereco_complemento: s.complemento ?? prev.dest_endereco_complemento,
                        dest_endereco_bairro: s.bairro ?? prev.dest_endereco_bairro,
                        dest_endereco_municipio: s.cidade ?? prev.dest_endereco_municipio,
                        dest_endereco_uf: s.uf ?? prev.dest_endereco_uf,
                        dest_endereco_municipio_codigo: s.codigoIbge ?? prev.dest_endereco_municipio_codigo,
                      }) : prev);
                    }}
                  >


                  {/* Identificação */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Identificação</h4>
                    <div className="grid gap-4 sm:grid-cols-2">
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
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fisica">Pessoa Física</SelectItem>
                            <SelectItem value="juridica">Pessoa Jurídica</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Indicador IE <span className="text-destructive">*</span></Label>
                        <Select
                          value={String(data.indicador_ie_dest ?? 9)}
                          onValueChange={(value) => updateField('indicador_ie_dest', parseInt(value))}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {INDICADOR_IE_DEST_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Endereço — componente único com busca automática por CEP */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Endereço</h4>
                    <AddressFields
                      idPrefix="fiscal-supplier"
                      value={{
                        postalCode: data.dest_endereco_cep || '',
                        state: data.dest_endereco_uf || '',
                        city: data.dest_endereco_municipio || '',
                        street: data.dest_endereco_logradouro || '',
                        neighborhood: data.dest_endereco_bairro || '',
                        number: data.dest_endereco_numero || '',
                        complement: data.dest_endereco_complemento || '',
                        ibgeCode: data.dest_endereco_municipio_codigo || '',
                      }}
                      onChange={(next) => {
                        setData((prev) => prev ? ({
                          ...prev,
                          dest_endereco_cep: next.postalCode,
                          dest_endereco_uf: next.state,
                          dest_endereco_municipio: next.city,
                          dest_endereco_logradouro: next.street,
                          dest_endereco_bairro: next.neighborhood,
                          dest_endereco_numero: next.number,
                          dest_endereco_complemento: next.complement,
                          dest_endereco_municipio_codigo: next.ibgeCode || '',
                        }) : null);
                      }}
                    />
                  </div>

                  {/* Contato */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Contato</h4>
                    <div className="grid gap-4 sm:grid-cols-2">
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
                    </div>
                  </div>
                  </SupplierAutocomplete>
                </CardContent>
              </Card>
            )}

            {/* Cartões originais — só para Saída (cliente / consumidor final) */}
            {!(['entrada','devolucao','remessa','transferencia'] as const).includes((data.tipo_nota || 'saida') as any) && (
            <>
            <Card>

              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-base">Dados do Destinatário</CardTitle>
                  {lockClientFields && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Lock className="h-3 w-3" />
                      <span>Dados vindos do cadastro do cliente</span>
                      {customerId && (
                        <Link
                          to={`/customers/${customerId}`}
                          className="inline-flex items-center gap-1 text-primary underline"
                        >
                          Abrir cadastro <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Nome / Razão Social <span className="text-destructive">*</span></Label>
                  <Input
                    value={data.dest_nome}
                    readOnly={lockClientFields}
                    onChange={(e) => updateField('dest_nome', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CPF/CNPJ <span className="text-destructive">*</span></Label>
                  <Input
                    value={data.dest_cpf_cnpj}
                    readOnly={lockClientFields}
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
                    readOnly={lockClientFields}
                    onChange={(e) => updateField('dest_ie', e.target.value)}
                    placeholder="Isento ou número"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Pessoa</Label>
                  <Select
                    value={data.dest_tipo_pessoa}
                    disabled={lockClientFields}
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
                    disabled={lockClientFields}
                    onCheckedChange={(checked) => updateField('dest_consumidor_final', checked)}
                  />
                  <Label>Consumidor Final</Label>
                </div>
                <div className="space-y-2">
                  <Label>Indicador IE Dest. <span className="text-destructive">*</span></Label>
                  <Select
                    value={String(data.indicador_ie_dest ?? 9)}
                    disabled={lockClientFields}
                    onValueChange={(value) => updateField('indicador_ie_dest', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INDICADOR_IE_DEST_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Endereço</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <AddressFields
                  idPrefix="fiscal-customer"
                  disabled={lockClientFields}
                  value={{
                    postalCode: data.dest_endereco_cep || '',
                    state: data.dest_endereco_uf || '',
                    city: data.dest_endereco_municipio || '',
                    street: data.dest_endereco_logradouro || '',
                    neighborhood: data.dest_endereco_bairro || '',
                    number: data.dest_endereco_numero || '',
                    complement: data.dest_endereco_complemento || '',
                    ibgeCode: data.dest_endereco_municipio_codigo || '',
                  }}
                  onChange={(next) => {
                    setData((prev) => prev ? ({
                      ...prev,
                      dest_endereco_cep: next.postalCode,
                      dest_endereco_uf: next.state,
                      dest_endereco_municipio: next.city,
                      dest_endereco_logradouro: next.street,
                      dest_endereco_bairro: next.neighborhood,
                      dest_endereco_numero: next.number,
                      dest_endereco_complemento: next.complement,
                      dest_endereco_municipio_codigo: next.ibgeCode || '',
                    }) : null);
                  }}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={data.dest_telefone || ''}
                      readOnly={lockClientFields}
                      onChange={(e) => updateField('dest_telefone', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input
                      value={data.dest_email || ''}
                      readOnly={lockClientFields}
                      onChange={(e) => updateField('dest_email', e.target.value)}
                      type="email"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            </>
            )}
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
                      const itemIssues = getItemIssues(item);
                      const locked = itemLockedFromRegistry(item);
                      
                      return (
                        <Card key={item.id || index} className={`${hasNcmError ? 'border-amber-400' : ''}`}>
                          <CardHeader className="py-3 px-4">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono">#{item.numero_item}</Badge>
                                <span className="font-medium text-sm truncate max-w-[300px]">
                                  {item.descricao || 'Sem descrição'}
                                </span>
                                {locked && (
                                  <Badge variant="secondary" className="gap-1 text-[10px]">
                                    <Lock className="h-3 w-3" /> do cadastro
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {item.product_id && (
                                  <Link
                                    to="/products"
                                    className="inline-flex items-center gap-1 text-xs text-primary underline"
                                  >
                                    Abrir cadastro <ExternalLink className="h-3 w-3" />
                                  </Link>
                                )}
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
                            {itemIssues.length > 0 && (
                              <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                <strong>Pendência fiscal:</strong> {itemIssues.join(' · ')}
                                {locked && ' — corrija no cadastro do produto.'}
                              </div>
                            )}
                          </CardHeader>
                          <CardContent className="py-3 px-4 pt-0">
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              {/* Descrição */}
                              <div className="space-y-1 sm:col-span-2">
                                <Label className="text-xs">Descrição <span className="text-destructive">*</span></Label>
                                <Input
                                  value={item.descricao}
                                  readOnly={locked}
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
                                  readOnly={locked}
                                  onChange={(e) => updateItem(index, 'ncm', e.target.value.replace(/\D/g, ''))}
                                  className={`h-8 text-sm font-mono ${hasNcmError ? 'border-amber-500 bg-amber-50' : ''}`}
                                  maxLength={8}
                                  placeholder="00000000"
                                />
                              </div>
                              
                              {/* CFOP — somente NF (oculto no Pedido de Venda) */}
                              {!isPedidoVenda && (
                                <div className="space-y-1">
                                  <Label className="text-xs">
                                    CFOP <span className="text-destructive">*</span>
                                    {hasCfopError && <span className="text-amber-600 ml-1">(4 dígitos)</span>}
                                  </Label>
                                  <Input
                                    value={item.cfop}
                                    readOnly={locked}
                                    onChange={(e) => updateItem(index, 'cfop', e.target.value.replace(/\D/g, ''))}
                                    className={`h-8 text-sm font-mono ${hasCfopError ? 'border-amber-500 bg-amber-50' : ''}`}
                                    maxLength={4}
                                    placeholder="5102"
                                  />
                                </div>
                              )}
                              
                              {/* Origem — somente NF */}
                              {!isPedidoVenda && (
                                <div className="space-y-1">
                                  <Label className="text-xs">Origem</Label>
                                  <Select
                                    value={item.origem || '0'}
                                    disabled={locked}
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
                              )}
                              
                              {/* CSOSN — somente NF */}
                              {!isPedidoVenda && (
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
                              )}
                              
                              {/* Unidade */}
                              <div className="space-y-1">
                                <Label className="text-xs">Unidade</Label>
                                <Input
                                  value={item.unidade}
                                  readOnly={locked}
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

                              {/* Desconto do item */}
                              <div className="space-y-1">
                                <Label className="text-xs">Desconto (R$)</Label>
                                <Input
                                  type="number"
                                  value={item.valor_desconto || 0}
                                  onChange={(e) => updateItem(index, 'valor_desconto', parseFloat(e.target.value) || 0)}
                                  className="h-8 text-sm"
                                  min={0}
                                  step="0.01"
                                  placeholder="0,00"
                                />
                              </div>

                              {/* GTIN / EAN */}
                              <div className="space-y-1 sm:col-span-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs">
                                    GTIN / Código de barras
                                  </Label>
                                  {!locked && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-[10px] px-2"
                                      onClick={() => {
                                        updateItem(index, 'gtin', 'SEM GTIN');
                                        updateItem(index, 'gtin_tributavel', 'SEM GTIN');
                                      }}
                                    >
                                      Sem GTIN
                                    </Button>
                                  )}
                                </div>
                                <Input
                                  value={item.gtin || ''}
                                  readOnly={locked}
                                  onChange={(e) => {
                                    const v = e.target.value.toUpperCase();
                                    updateItem(index, 'gtin', v);
                                    // Espelha no tributável quando ainda não tiver valor próprio
                                    if (!item.gtin_tributavel || item.gtin_tributavel === item.gtin) {
                                      updateItem(index, 'gtin_tributavel', v);
                                    }
                                  }}
                                  className="h-8 text-sm font-mono"
                                  placeholder="Ex: 7891234567890 ou SEM GTIN"
                                  maxLength={14}
                                />
                                <p className="text-[10px] text-muted-foreground">
                                  Obrigatório quando o produto tiver código de barras. Se não tiver, marque "Sem GTIN".
                                </p>
                              </div>

                              {/* GTIN tributável — somente NF */}
                              {!isPedidoVenda && (
                                <div className="space-y-1">
                                  <Label className="text-xs">GTIN tributável</Label>
                                  <Input
                                    value={item.gtin_tributavel || ''}
                                    readOnly={locked}
                                    onChange={(e) => updateItem(index, 'gtin_tributavel', e.target.value.toUpperCase())}
                                    className="h-8 text-sm font-mono"
                                    placeholder="Igual ao GTIN ou SEM GTIN"
                                    maxLength={14}
                                  />
                                </div>
                              )}

                              {/* CEST — somente NF */}
                              {!isPedidoVenda && (
                                <div className="space-y-1">
                                  <Label className="text-xs">CEST</Label>
                                  <Input
                                    value={item.cest || ''}
                                    readOnly={locked}
                                    onChange={(e) => updateItem(index, 'cest', e.target.value.replace(/\D/g, ''))}
                                    className="h-8 text-sm font-mono"
                                    placeholder="0000000"
                                    maxLength={7}
                                  />
                                  <p className="text-[10px] text-muted-foreground">
                                    Obrigatório quando houver Substituição Tributária.
                                  </p>
                                </div>
                              )}
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

            {!isPedidoVenda && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Totais de Impostos</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Base de Cálculo ICMS</Label>
                    <Input value={formatCurrency(data.valor_bc_icms || 0)} disabled className="bg-muted font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label>Total ICMS</Label>
                    <Input value={formatCurrency(data.valor_icms || 0)} disabled className="bg-muted font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label>Total PIS</Label>
                    <Input value={formatCurrency(data.valor_pis || 0)} disabled className="bg-muted font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label>Total COFINS</Label>
                    <Input value={formatCurrency(data.valor_cofins || 0)} disabled className="bg-muted font-mono" />
                  </div>
                </CardContent>
              </Card>
            )}
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
                  <Label>Serviço contratado</Label>
                  <Input
                    value={data.transportadora_servico || ''}
                    onChange={(e) => updateField('transportadora_servico', e.target.value)}
                    placeholder="Ex: PAC, SEDEX, Mini Envios, Loggi Express"
                  />
                  <p className="text-xs text-muted-foreground">
                    {data.transportadora_servico
                      ? 'Serviço escolhido pelo cliente no checkout. Edite apenas se for trocar antes do despacho.'
                      : 'Serviço não informado no checkout. Preencha se houver.'}
                  </p>
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

          {/* Tab: Pagamento */}
          <TabsContent value="pagamento" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados de Pagamento</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Indicador de Pagamento <span className="text-destructive">*</span></Label>
                  <Select
                    value={String(data.pagamento_indicador ?? 0)}
                    onValueChange={(value) => updateField('pagamento_indicador', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGAMENTO_INDICADOR_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Meio de Pagamento <span className="text-destructive">*</span></Label>
                  <Select
                    value={data.pagamento_meio || '99'}
                    onValueChange={(value) => updateField('pagamento_meio', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGAMENTO_MEIO_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor do Pagamento <span className="text-destructive">*</span></Label>
                  <Input
                    type="number"
                    value={data.pagamento_valor || data.valor_total || 0}
                    onChange={(e) => updateField('pagamento_valor', parseFloat(e.target.value) || 0)}
                    min={0}
                    step="0.01"
                  />
                  <p className="text-xs text-muted-foreground">
                    Normalmente igual ao valor total da nota
                  </p>
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
              {isPedidoVenda ? 'Salvar Pedido' : 'Salvar Rascunho'}
            </Button>
            {isPedidoVenda ? (
              <Button
                onClick={async () => {
                  if (!data || !onPrepare) return;
                  const runPrepare = async (payload: InvoiceData) => {
                    setIsSubmitting(true);
                    try {
                      await onPrepare(payload);
                      onOpenChange(false);
                    } catch (e) {
                      console.error('[InvoiceEditor] onPrepare error:', e);
                    } finally {
                      setIsSubmitting(false);
                    }
                  };
                  const changed = diffDestSnapshot(initialDest, data);
                  if (changed.length > 0 && customerId) {
                    setDestSyncAfterSave(() => runPrepare);
                    setDestSyncDialog({ open: true, changedLabels: changed, pending: data });
                    return;
                  }
                  try {
                    await persistSave(data, false, runPrepare);
                  } catch {
                    /* persistSave já mostrou toast */
                  }
                }}
                disabled={isSaving || isSubmitting || !onPrepare || (pendenciaMotivos && pendenciaMotivos.length > 0)}
                title={pendenciaMotivos && pendenciaMotivos.length > 0 ? 'Resolva as pendências listadas acima para criar a Nota Fiscal.' : undefined}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Criar Nota Fiscal
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Diálogo: alterou dados do destinatário e o pedido tem cliente vinculado */}
    <Dialog
      open={destSyncDialog.open}
      onOpenChange={(o) => {
        if (!o) {
          setDestSyncDialog({ open: false, changedLabels: [], pending: null });
          setDestSyncAfterSave(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Você alterou dados do cadastro do cliente</DialogTitle>
          <DialogDescription>
            Os campos abaixo estão também no cadastro do cliente. Escolha como deseja salvar.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="mb-1 font-medium">Campos alterados:</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {destSyncDialog.changedLabels.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
        <DialogFooter className="flex flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            onClick={async () => {
              const pending = destSyncDialog.pending;
              const after = destSyncAfterSave;
              setDestSyncDialog({ open: false, changedLabels: [], pending: null });
              setDestSyncAfterSave(null);
              if (pending) {
                try {
                  await persistSave(pending, true, after || undefined);
                } catch { /* toast já mostrado */ }
              }
            }}
            disabled={isSaving || isSubmitting}
            className="w-full"
          >
            Salvar pedido e atualizar cadastro
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              const pending = destSyncDialog.pending;
              const after = destSyncAfterSave;
              setDestSyncDialog({ open: false, changedLabels: [], pending: null });
              setDestSyncAfterSave(null);
              if (pending) {
                try {
                  await persistSave(pending, false, after || undefined);
                } catch { /* toast já mostrado */ }
              }
            }}
            disabled={isSaving || isSubmitting}
            className="w-full"
          >
            Salvar somente neste pedido
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setDestSyncDialog({ open: false, changedLabels: [], pending: null });
              setDestSyncAfterSave(null);
            }}
            disabled={isSaving || isSubmitting}
            className="w-full"
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
