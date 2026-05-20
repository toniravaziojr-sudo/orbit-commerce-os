import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, FileDown, Plus, Trash2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { showErrorToast } from '@/lib/error-toast';
import { useQueryClient } from '@tanstack/react-query';
import { ProductSelector, type ProductWithFiscal } from './ProductSelector';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface OrderItem {
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  // Vínculo direto com o cadastro do produto. Quando preenchido, é a
  // fonte única de verdade para desmembramento de kits na transição PV→NF.
  // Preenchido sempre que o item vier do ProductSelector ou de uma duplicação
  // de PV/NF que já tinha o vínculo.
  product_id?: string | null;
  // Campos fiscais carregados invisivelmente quando duplicando — preservam dados do original.
  ncm?: string;
  cfop?: string;
  origem?: string;
  csosn?: string;
  valor_desconto?: number;
  valor_frete?: number;
  gtin?: string;
  gtin_tributavel?: string;
  cest?: string;
}

export interface ManualInvoiceInitialData {
  destinatario: {
    nome: string;
    cpf_cnpj: string;
    email?: string;
    telefone?: string;
    endereco: {
      logradouro: string;
      numero: string;
      complemento?: string;
      bairro: string;
      municipio: string;
      uf: string;
      cep: string;
    };
  };
  itens: OrderItem[];
  observacoes?: string;
  natureza_operacao?: string;
  // Totais e ajustes — preservados na duplicação
  valor_desconto?: number;
  valor_frete?: number;
  valor_seguro?: number;
  valor_outras_despesas?: number;
  modalidade_frete?: string;
  transportadora_nome?: string;
  transportadora_servico?: string;
  transportadora_cnpj?: string;
  peso_bruto?: number;
  peso_liquido?: number;
  quantidade_volumes?: number;
  pagamento_meio?: string;
  informacoes_fisco?: string;
}

function isValidCpfCnpj(value: string): boolean {
  const numbers = value.replace(/\D/g, '');
  return numbers.length === 11 || numbers.length === 14;
}

function isValidCep(value: string): boolean {
  const numbers = value.replace(/\D/g, '');
  return numbers.length === 8;
}

const UF_OPTIONS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

interface ManualInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Modo do diálogo. 'create' = novo pedido em branco. 'duplicate' = pré-preenchido. */
  mode?: 'create' | 'duplicate';
  /** Dados pré-preenchidos para duplicação. */
  initialData?: ManualInvoiceInitialData;
  /** Título customizado. Default depende de `mode`. */
  title?: string;
  /** Descrição customizada. */
  description?: string;
  /** Rótulo do botão de salvar. */
  submitLabel?: string;
  /** Mensagem de sucesso. */
  successMessage?: string;
  /** Callback opcional após criar com sucesso, recebe o id da nova invoice. */
  onCreated?: (newInvoiceId: string) => void;
}

export function ManualInvoiceDialog({
  open,
  onOpenChange,
  mode = 'create',
  initialData,
  title,
  description,
  submitLabel,
  successMessage,
  onCreated,
}: ManualInvoiceDialogProps) {
  const { profile } = useAuth();
  const tenantId = profile?.current_tenant_id;
  const queryClient = useQueryClient();

  const [isLoading, setIsLoading] = useState(false);

  // Customer search state
  const [customerMode, setCustomerMode] = useState<'existing' | 'manual'>('manual');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Form state
  const [destNome, setDestNome] = useState('');
  const [destCpfCnpj, setDestCpfCnpj] = useState('');
  const [destEmail, setDestEmail] = useState('');
  const [destTelefone, setDestTelefone] = useState('');
  const [destLogradouro, setDestLogradouro] = useState('');
  const [destNumero, setDestNumero] = useState('');
  const [destComplemento, setDestComplemento] = useState('');
  const [destBairro, setDestBairro] = useState('');
  const [destMunicipio, setDestMunicipio] = useState('');
  const [destUf, setDestUf] = useState('');
  const [destCep, setDestCep] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [naturezaOperacao, setNaturezaOperacao] = useState('VENDA DE MERCADORIA');
  const [items, setItems] = useState<OrderItem[]>([
    { codigo: '', descricao: '', unidade: 'UN', quantidade: 1, valor_unitario: 0 }
  ]);

  // Totais e ajustes
  const [discountMode, setDiscountMode] = useState<'valor' | 'percent'>('valor');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [valorDesconto, setValorDesconto] = useState<number>(0);
  const [valorFrete, setValorFrete] = useState<number>(0);
  const [valorSeguro, setValorSeguro] = useState<number>(0);
  const [valorOutras, setValorOutras] = useState<number>(0);
  const [modalidadeFrete, setModalidadeFrete] = useState<string>('9');
  const [informacoesFisco, setInformacoesFisco] = useState<string>('');
  // Campos preservados invisivelmente na duplicação (não exibidos nesta etapa)
  const [transportadoraNome, setTransportadoraNome] = useState<string>('');
  const [transportadoraCnpj, setTransportadoraCnpj] = useState<string>('');
  const [pesoBruto, setPesoBruto] = useState<number | null>(null);
  const [pesoLiquido, setPesoLiquido] = useState<number | null>(null);
  const [quantidadeVolumes, setQuantidadeVolumes] = useState<number | null>(null);
  const [pagamentoMeio, setPagamentoMeio] = useState<string>('99');

  // Pré-preenche quando abre em modo duplicação
  useEffect(() => {
    if (!open) return;
    if (mode === 'duplicate' && initialData) {
      const d = initialData.destinatario;
      setCustomerMode('manual');
      setSelectedCustomerId(null);
      setDestNome(d.nome || '');
      setDestCpfCnpj((d.cpf_cnpj || '').replace(/\D/g, ''));
      setDestEmail(d.email || '');
      setDestTelefone(d.telefone || '');
      setDestLogradouro(d.endereco.logradouro || '');
      setDestNumero(d.endereco.numero || '');
      setDestComplemento(d.endereco.complemento || '');
      setDestBairro(d.endereco.bairro || '');
      setDestMunicipio(d.endereco.municipio || '');
      setDestUf(d.endereco.uf || '');
      setDestCep((d.endereco.cep || '').replace(/\D/g, ''));
      setObservacoes(initialData.observacoes || '');
      setNaturezaOperacao(initialData.natureza_operacao || 'VENDA DE MERCADORIA');
      setItems(
        initialData.itens.length
          ? initialData.itens.map((it) => ({ ...it }))
          : [{ codigo: '', descricao: '', unidade: 'UN', quantidade: 1, valor_unitario: 0 }]
      );
      setDiscountMode('valor');
      setDiscountPercent(0);
      setValorDesconto(Number(initialData.valor_desconto) || 0);
      setValorFrete(Number(initialData.valor_frete) || 0);
      setValorSeguro(Number(initialData.valor_seguro) || 0);
      setValorOutras(Number(initialData.valor_outras_despesas) || 0);
      setModalidadeFrete(initialData.modalidade_frete || '9');
      setInformacoesFisco(initialData.informacoes_fisco || '');
      setTransportadoraNome(initialData.transportadora_nome || '');
      setTransportadoraCnpj(initialData.transportadora_cnpj || '');
      setPesoBruto(initialData.peso_bruto ?? null);
      setPesoLiquido(initialData.peso_liquido ?? null);
      setQuantidadeVolumes(initialData.quantidade_volumes ?? null);
      setPagamentoMeio(initialData.pagamento_meio || '99');
    } else if (mode === 'create') {
      // Reset para criar novo limpo
      setCustomerMode('manual');
      setSelectedCustomerId(null);
      setDestNome('');
      setDestCpfCnpj('');
      setDestEmail('');
      setDestTelefone('');
      setDestLogradouro('');
      setDestNumero('');
      setDestComplemento('');
      setDestBairro('');
      setDestMunicipio('');
      setDestUf('');
      setDestCep('');
      setObservacoes('');
      setNaturezaOperacao('VENDA DE MERCADORIA');
      setItems([{ codigo: '', descricao: '', unidade: 'UN', quantidade: 1, valor_unitario: 0 }]);
      setDiscountMode('valor');
      setDiscountPercent(0);
      setValorDesconto(0);
      setValorFrete(0);
      setValorSeguro(0);
      setValorOutras(0);
      setModalidadeFrete('9');
      setInformacoesFisco('');
      setTransportadoraNome('');
      setTransportadoraCnpj('');
      setPesoBruto(null);
      setPesoLiquido(null);
      setQuantidadeVolumes(null);
      setPagamentoMeio('99');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  // Customer search with debounce
  useEffect(() => {
    if (customerMode !== 'existing' || !customerSearchTerm || customerSearchTerm.length < 2 || !tenantId) {
      setCustomerSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingCustomer(true);
      try {
        const search = customerSearchTerm.trim();
        const searchDigits = search.replace(/\D/g, '');
        
        let query = supabase
          .from('customers')
          .select('id, full_name, email, cpf, phone, customer_addresses(street, number, complement, neighborhood, city, state, postal_code, is_default)')
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .limit(10);

        const orFilters: string[] = [];
        orFilters.push(`full_name.ilike.%${search}%`);
        if (search.includes('@')) {
          orFilters.push(`email.ilike.%${search}%`);
        }
        if (searchDigits.length >= 3) {
          orFilters.push(`cpf.ilike.%${searchDigits}%`);
        }
        
        query = query.or(orFilters.join(','));
        
        const { data, error } = await query;
        if (error) {
          console.error('Error searching customers:', error);
        }
        setCustomerSearchResults(data || []);
      } catch (error) {
        console.error('Error searching customers:', error);
      } finally {
        setIsSearchingCustomer(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [customerSearchTerm, customerMode, tenantId]);

  const handleSelectCustomer = (customer: any) => {
    setSelectedCustomerId(customer.id);
    setDestNome(customer.full_name || '');
    setDestCpfCnpj(customer.cpf?.replace(/\D/g, '') || '');
    setDestEmail(customer.email || '');
    setDestTelefone(customer.phone || '');
    
    const addresses = customer.customer_addresses || [];
    const addr = addresses.find((a: any) => a.is_default) || addresses[0];
    if (addr) {
      setDestLogradouro(addr.street || '');
      setDestNumero(addr.number || '');
      setDestComplemento(addr.complement || '');
      setDestBairro(addr.neighborhood || '');
      setDestMunicipio(addr.city || '');
      setDestUf(addr.state || '');
      setDestCep(addr.postal_code?.replace(/\D/g, '') || '');
    }
    
    setCustomerSearchTerm('');
    setCustomerSearchResults([]);
    toast.success(`Cliente "${customer.full_name}" selecionado`);
  };

  const handleClearCustomer = () => {
    setSelectedCustomerId(null);
    setDestNome('');
    setDestCpfCnpj('');
    setDestEmail('');
    setDestTelefone('');
    setDestLogradouro('');
    setDestNumero('');
    setDestComplemento('');
    setDestBairro('');
    setDestMunicipio('');
    setDestUf('');
    setDestCep('');
  };

  const handleAddItem = () => {
    setItems([...items, { codigo: '', descricao: '', unidade: 'UN', quantidade: 1, valor_unitario: 0 }]);
  };

  const handleAddProductFromCatalog = (product: ProductWithFiscal) => {
    const pesoGramas = Number(product.weight ?? 0);
    if (!pesoGramas || pesoGramas <= 0) {
      toast.error(
        `Produto "${product.name}" está sem peso cadastrado.`,
        { description: 'Cadastre o peso (em gramas) na ficha do produto antes de adicionar ao pedido.' },
      );
      return;
    }
    const newItem: OrderItem = {
      codigo: product.sku || product.id.substring(0, 8),
      descricao: product.name,
      unidade: product.unidade || 'UN',
      quantidade: 1,
      valor_unitario: product.price,
    };
    setItems([...items, newItem]);
    toast.success(`Produto "${product.name}" adicionado`);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: keyof OrderItem, value: string | number) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.quantidade * item.valor_unitario), 0);
  };

  // Desconto efetivo: se modo "percent", converte sobre o subtotal; caso contrário usa valor digitado
  const effectiveDiscount = () => {
    const sub = calculateSubtotal();
    if (discountMode === 'percent') {
      const pct = Math.max(0, Math.min(100, Number(discountPercent) || 0));
      return +(sub * pct / 100).toFixed(2);
    }
    return Math.max(0, Number(valorDesconto) || 0);
  };

  // Regra oficial: total = subtotal - desconto + frete + seguro + outras (nunca negativo)
  const calculateTotal = () => {
    const sub = calculateSubtotal();
    const desc = effectiveDiscount();
    const total = sub - desc + (Number(valorFrete) || 0) + (Number(valorSeguro) || 0) + (Number(valorOutras) || 0);
    return Math.max(0, +total.toFixed(2));
  };

  const handleSubmit = async () => {
    const errors: string[] = [];
    
    if (!destNome?.trim()) errors.push('Nome do destinatário é obrigatório');
    
    const cpfCnpj = destCpfCnpj.replace(/\D/g, '');
    if (!cpfCnpj) {
      errors.push('CPF/CNPJ do destinatário é obrigatório');
    } else if (!isValidCpfCnpj(cpfCnpj)) {
      errors.push(`CPF/CNPJ inválido: deve ter 11 (CPF) ou 14 (CNPJ) dígitos`);
    }

    if (!destLogradouro?.trim()) errors.push('Logradouro é obrigatório');
    if (!destNumero?.trim()) errors.push('Número é obrigatório');
    if (!destBairro?.trim()) errors.push('Bairro é obrigatório');
    if (!destMunicipio?.trim()) errors.push('Município é obrigatório');
    if (!destUf?.trim()) errors.push('UF é obrigatório');
    
    const cep = destCep.replace(/\D/g, '');
    if (!cep) {
      errors.push('CEP é obrigatório');
    } else if (!isValidCep(cep)) {
      errors.push(`CEP inválido: deve ter 8 dígitos`);
    }

    items.forEach((item, idx) => {
      if (!item.descricao?.trim()) errors.push(`Item ${idx + 1}: Descrição é obrigatória`);
      if (item.valor_unitario <= 0) errors.push(`Item ${idx + 1}: Valor unitário deve ser maior que zero`);
    });

    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }

    try {
      setIsLoading(true);

      const { data, error } = await supabase.functions.invoke('fiscal-create-manual', {
        body: {
          natureza_operacao: naturezaOperacao || 'VENDA DE MERCADORIA',
          observacoes,
          // Totais e ajustes (regra oficial aplicada no backend também)
          valor_desconto: effectiveDiscount(),
          valor_frete: Number(valorFrete) || 0,
          valor_seguro: Number(valorSeguro) || 0,
          valor_outras_despesas: Number(valorOutras) || 0,
          modalidade_frete: modalidadeFrete || '9',
          transportadora_nome: transportadoraNome || null,
          transportadora_cnpj: transportadoraCnpj || null,
          peso_bruto: pesoBruto,
          peso_liquido: pesoLiquido,
          quantidade_volumes: quantidadeVolumes,
          informacoes_fisco: informacoesFisco || null,
          pagamento_meio: pagamentoMeio || '99',
          destinatario: {
            nome: destNome,
            cpf_cnpj: destCpfCnpj.replace(/\D/g, ''),
            email: destEmail,
            telefone: destTelefone,
            endereco: {
              logradouro: destLogradouro,
              numero: destNumero,
              complemento: destComplemento,
              bairro: destBairro,
              municipio: destMunicipio,
              uf: destUf,
              cep: destCep.replace(/\D/g, ''),
            },
          },
          itens: items.map((item, index) => ({
            numero_item: index + 1,
            codigo: item.codigo,
            descricao: item.descricao,
            ncm: item.ncm || '',
            cfop: item.cfop || '5102',
            unidade: item.unidade,
            quantidade: item.quantidade,
            valor_unitario: item.valor_unitario,
            valor_desconto: Number(item.valor_desconto) || 0,
            valor_frete: Number(item.valor_frete) || 0,
            origem: item.origem || '0',
            csosn: item.csosn || '102',
            gtin: item.gtin || '',
            gtin_tributavel: item.gtin_tributavel || item.gtin || '',
            cest: item.cest || '',
          })),
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao salvar');

      const newId: string | undefined = data?.invoice?.id;
      const okMsg = successMessage || (mode === 'duplicate'
        ? 'Pedido de venda duplicado com sucesso.'
        : 'Pedido de venda criado com sucesso.');

      toast.success(okMsg);

      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal-stats'] });
      onOpenChange(false);

      // Sempre dispara o callback após sucesso (sem depender de clique do usuário no toast).
      // Para duplicação de NF, isso garante validação automática e movimentação para a aba Notas Fiscais.
      if (newId && onCreated) {
        try { onCreated(newId); } catch (e) { console.warn('[ManualInvoiceDialog] onCreated handler error:', e); }
      }
    } catch (error) {
      showErrorToast(error, {
        module: 'fiscal',
        action: mode === 'duplicate' ? 'duplicar' : 'criar pedido de venda',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const dialogTitle = title || (mode === 'duplicate' ? 'Duplicar Pedido de Venda' : 'Novo Pedido de Venda');
  const dialogDescription = description || (mode === 'duplicate'
    ? 'Revise os dados copiados e ajuste o que for necessário antes de salvar. Nenhuma NF é emitida nesta etapa.'
    : 'Crie um rascunho de pedido de venda para posterior emissão de NF-e.');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">

          {/* Destinatário */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer mode selector */}
              <RadioGroup
                value={customerMode}
                onValueChange={(v) => {
                  setCustomerMode(v as 'existing' | 'manual');
                  if (v === 'manual') {
                    handleClearCustomer();
                    setCustomerSearchResults([]);
                    setCustomerSearchTerm('');
                  }
                }}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="existing" id="customer-existing" />
                  <Label htmlFor="customer-existing" className="cursor-pointer">Cliente existente</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manual" id="customer-manual" />
                  <Label htmlFor="customer-manual" className="cursor-pointer">Preencher manualmente</Label>
                </div>
              </RadioGroup>

              {/* Customer search */}
              {customerMode === 'existing' && !selectedCustomerId && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={customerSearchTerm}
                      onChange={e => setCustomerSearchTerm(e.target.value)}
                      placeholder="Buscar por nome, email ou CPF..."
                      className="pl-9"
                    />
                    {isSearchingCustomer && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {customerSearchResults.length > 0 && (
                    <div className="border rounded-md max-h-48 overflow-y-auto divide-y bg-popover shadow-md">
                      {customerSearchResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCustomer(c)}
                          className="w-full text-left px-3 py-2 hover:bg-accent transition-colors text-sm"
                        >
                          <div className="font-medium">{c.full_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.email && <span>{c.email}</span>}
                            {c.cpf && <span> · CPF: {c.cpf}</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {customerSearchTerm.length >= 2 && !isSearchingCustomer && customerSearchResults.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
                  )}
                </div>
              )}

              {/* Selected customer indicator */}
              {customerMode === 'existing' && selectedCustomerId && (
                <div className="flex items-center justify-between p-2 bg-accent/50 rounded-md">
                  <span className="text-sm font-medium">Cliente: {destNome}</span>
                  <Button variant="ghost" size="sm" onClick={handleClearCustomer}>
                    Trocar
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome / Razão Social *</Label>
                  <Input value={destNome} onChange={e => setDestNome(e.target.value)} disabled={customerMode === 'existing' && !!selectedCustomerId} />
                </div>
                <div className="space-y-2">
                  <Label>CPF / CNPJ *</Label>
                  <Input 
                    value={destCpfCnpj} 
                    onChange={e => setDestCpfCnpj(e.target.value.replace(/\D/g, ''))} 
                    maxLength={14}
                    placeholder="Apenas números"
                    className={`font-mono ${destCpfCnpj && !isValidCpfCnpj(destCpfCnpj) ? 'border-destructive' : ''}`}
                    disabled={customerMode === 'existing' && !!selectedCustomerId}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={destEmail} onChange={e => setDestEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={destTelefone} onChange={e => setDestTelefone(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Logradouro *</Label>
                  <Input value={destLogradouro} onChange={e => setDestLogradouro(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Número *</Label>
                  <Input value={destNumero} onChange={e => setDestNumero(e.target.value)} placeholder="S/N se não houver" />
                </div>
                <div className="space-y-2">
                  <Label>Complemento</Label>
                  <Input value={destComplemento} onChange={e => setDestComplemento(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Bairro *</Label>
                  <Input value={destBairro} onChange={e => setDestBairro(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Município *</Label>
                  <Input value={destMunicipio} onChange={e => setDestMunicipio(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>UF *</Label>
                  <Select value={destUf} onValueChange={setDestUf}>
                    <SelectTrigger>
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {UF_OPTIONS.map(uf => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>CEP *</Label>
                  <Input 
                    value={destCep} 
                    onChange={e => setDestCep(e.target.value.replace(/\D/g, ''))} 
                    maxLength={8}
                    placeholder="00000000"
                    className={`font-mono ${destCep && !isValidCep(destCep) ? 'border-destructive' : ''}`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Itens */}
          <Card>
            <CardHeader className="py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Produtos</CardTitle>
              <div className="flex items-center gap-2">
                <ProductSelector 
                  onSelect={handleAddProductFromCatalog}
                  placeholder="Buscar produto"
                  className="h-8"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="p-3 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Item {index + 1}</span>
                      <span className="text-primary font-bold">{formatCurrency(item.quantidade * item.valor_unitario)}</span>
                    </div>
                    {items.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-6 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Código</Label>
                      <Input
                        value={item.codigo}
                        onChange={e => handleItemChange(index, 'codigo', e.target.value)}
                        placeholder="SKU"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Descrição *</Label>
                      <Input
                        value={item.descricao}
                        onChange={e => handleItemChange(index, 'descricao', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unidade</Label>
                      <Input
                        value={item.unidade}
                        onChange={e => handleItemChange(index, 'unidade', e.target.value.toUpperCase())}
                        maxLength={6}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Quantidade *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantidade}
                        onChange={e => handleItemChange(index, 'quantidade', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Valor Unitário *</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.valor_unitario}
                        onChange={e => handleItemChange(index, 'valor_unitario', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex justify-end pt-2 border-t">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Subtotal dos Produtos</p>
                  <p className="text-lg font-semibold">{formatCurrency(calculateSubtotal())}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Totais e ajustes */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Totais e ajustes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Desconto</Label>
                  <div className="flex gap-2">
                    <Select value={discountMode} onValueChange={(v) => setDiscountMode(v as 'valor' | 'percent')}>
                      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="valor">R$</SelectItem>
                        <SelectItem value="percent">%</SelectItem>
                      </SelectContent>
                    </Select>
                    {discountMode === 'valor' ? (
                      <Input type="number" min="0" step="0.01" value={valorDesconto}
                        onChange={e => setValorDesconto(parseFloat(e.target.value) || 0)} />
                    ) : (
                      <Input type="number" min="0" max="100" step="0.01" value={discountPercent}
                        onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)} />
                    )}
                  </div>
                  {discountMode === 'percent' && (
                    <p className="text-xs text-muted-foreground">Equivale a {formatCurrency(effectiveDiscount())}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Frete (R$)</Label>
                  <Input type="number" min="0" step="0.01" value={valorFrete}
                    onChange={e => setValorFrete(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Seguro (R$)</Label>
                  <Input type="number" min="0" step="0.01" value={valorSeguro}
                    onChange={e => setValorSeguro(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Outras despesas (R$)</Label>
                  <Input type="number" min="0" step="0.01" value={valorOutras}
                    onChange={e => setValorOutras(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Modalidade de frete</Label>
                  <Select value={modalidadeFrete} onValueChange={setModalidadeFrete}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="9">Sem frete</SelectItem>
                      <SelectItem value="0">CIF (por conta do emitente)</SelectItem>
                      <SelectItem value="1">FOB (por conta do destinatário)</SelectItem>
                      <SelectItem value="2">Terceiros</SelectItem>
                      <SelectItem value="3">Próprio (remetente)</SelectItem>
                      <SelectItem value="4">Próprio (destinatário)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Observações fiscais / Informações ao Fisco</Label>
                <Textarea value={informacoesFisco}
                  onChange={e => setInformacoesFisco(e.target.value)}
                  placeholder="Informações de interesse do Fisco (campo infAdFisco)"
                  rows={2} />
              </div>
              <div className="flex justify-between items-end pt-3 border-t gap-4 flex-wrap">
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>Subtotal: {formatCurrency(calculateSubtotal())}</p>
                  <p>− Desconto: {formatCurrency(effectiveDiscount())}</p>
                  <p>+ Frete: {formatCurrency(Number(valorFrete) || 0)}</p>
                  <p>+ Seguro: {formatCurrency(Number(valorSeguro) || 0)}</p>
                  <p>+ Outras: {formatCurrency(Number(valorOutras) || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total final</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(calculateTotal())}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Observações */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Observações</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                placeholder="Observações do pedido..."
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              {submitLabel || (mode === 'duplicate' ? 'Salvar duplicação' : 'Criar Pedido de Venda')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
