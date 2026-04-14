import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileDown, Plus, Trash2, Search, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { showErrorToast } from '@/lib/error-toast';
import { useQueryClient } from '@tanstack/react-query';
import { ProductSelector, type ProductWithFiscal } from './ProductSelector';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface ManualInvoiceItem {
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  origem: string;
  csosn: string;
}

interface OperationNature {
  id: string;
  nome: string;
  cfop_intra: string;
  cfop_inter: string;
  csosn_padrao: string | null;
  cst_pis: string | null;
  cst_cofins: string | null;
  info_complementares: string | null;
  ativo: boolean;
}

// Validation helpers
function isValidNcm(value: string): boolean {
  const numbers = value.replace(/\D/g, '');
  return numbers.length === 8;
}

function isValidCpfCnpj(value: string): boolean {
  const numbers = value.replace(/\D/g, '');
  return numbers.length === 11 || numbers.length === 14;
}

function isValidCep(value: string): boolean {
  const numbers = value.replace(/\D/g, '');
  return numbers.length === 8;
}

// Options
const ORIGEM_OPTIONS = [
  { value: '0', label: '0 - Nacional' },
  { value: '1', label: '1 - Estrangeira (importação direta)' },
  { value: '2', label: '2 - Estrangeira (mercado interno)' },
];

const CSOSN_OPTIONS = [
  { value: '101', label: '101 - Tributada com crédito' },
  { value: '102', label: '102 - Tributada sem crédito' },
  { value: '103', label: '103 - Isenção para faixa de receita' },
  { value: '300', label: '300 - Imune' },
  { value: '400', label: '400 - Não tributada' },
  { value: '500', label: '500 - ICMS cobrado anteriormente por ST' },
  { value: '900', label: '900 - Outros' },
];

const UF_OPTIONS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

interface ManualInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualInvoiceDialog({ open, onOpenChange }: ManualInvoiceDialogProps) {
  const { profile } = useAuth();
  const tenantId = profile?.current_tenant_id;
  const queryClient = useQueryClient();

  const [isLoading, setIsLoading] = useState(false);
  const [orders, setOrders] = useState<Array<{ id: string; order_number: string; customer_name: string; total: number }>>([]);
  const [operationNatures, setOperationNatures] = useState<OperationNature[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('manual');
  const [selectedNatureId, setSelectedNatureId] = useState<string>('');

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
  const [naturezaOperacao, setNaturezaOperacao] = useState('VENDA DE MERCADORIA');
  const [observacoes, setObservacoes] = useState('');
  const [indicadorPresenca, setIndicadorPresenca] = useState(2);
  const [indicadorIeDest, setIndicadorIeDest] = useState(9);
  const [pagamentoIndicador, setPagamentoIndicador] = useState(0);
  const [pagamentoMeio, setPagamentoMeio] = useState('99');
  const [items, setItems] = useState<ManualInvoiceItem[]>([
    { codigo: '', descricao: '', ncm: '', cfop: '5102', unidade: 'UN', quantidade: 1, valor_unitario: 0, origem: '0', csosn: '102' }
  ]);

  // Fetch orders and operation natures
  useEffect(() => {
    if (open && tenantId) {
      // Fetch orders
      supabase
        .from('orders')
        .select('id, order_number, customer_name, total')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50)
        .then(({ data }) => {
          if (data) setOrders(data);
        });

      // Fetch operation natures
      supabase
        .from('fiscal_operation_natures')
        .select('id, nome, cfop_intra, cfop_inter, csosn_padrao, cst_pis, cst_cofins, info_complementares, ativo')
        .eq('tenant_id', tenantId)
        .eq('ativo', true)
        .order('nome')
        .then(({ data }) => {
          if (data) {
            setOperationNatures(data as OperationNature[]);
            // Set default nature if available
            const defaultNature = data.find(n => n.nome === 'Venda de Mercadoria');
            if (defaultNature && !selectedNatureId) {
              handleNatureChange(defaultNature.id);
            }
          }
        });
    }
  }, [open, tenantId]);

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

        // Build OR filter
        const orFilters: string[] = [];
        orFilters.push(`full_name.ilike.%${search}%`);
        if (search.includes('@')) {
          orFilters.push(`email.ilike.%${search}%`);
        }
        if (searchDigits.length >= 3) {
          orFilters.push(`cpf.ilike.%${searchDigits}%`);
        }
        
        query = query.or(orFilters.join(','));
        
        const { data } = await query;
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
    
    // Get default address or first address
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

  // Handle nature selection
  const handleNatureChange = (natureId: string) => {
    setSelectedNatureId(natureId);
    const nature = operationNatures.find(n => n.id === natureId);
    if (nature) {
      setNaturezaOperacao(nature.nome);
      // Apply nature's CFOP and CSOSN to items
      setItems(prev => prev.map(item => ({
        ...item,
        cfop: nature.cfop_intra || item.cfop,
        csosn: nature.csosn_padrao || item.csosn,
      })));
      // Apply complementary info as observations
      if (nature.info_complementares) {
        setObservacoes(prev => prev ? `${prev}\n${nature.info_complementares}` : nature.info_complementares || '');
      }
    }
  };

  // Import order data
  const handleImportOrder = async (orderId: string) => {
    if (orderId === 'manual') {
      // Clear form for manual entry
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
      setItems([{ codigo: '', descricao: '', ncm: '', cfop: '5102', unidade: 'UN', quantidade: 1, valor_unitario: 0, origem: '0', csosn: '102' }]);
      return;
    }

    try {
      setIsLoading(true);

      // Fetch order details with customer data
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            id,
            product_id,
            quantity,
            unit_price,
            products(name, sku)
          ),
          customers(cpf)
        `)
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      // Fill form with order data
      const customerData = order.customers as { cpf: string | null } | null;
      setDestNome(order.customer_name || '');
      setDestCpfCnpj(customerData?.cpf || '');
      setDestEmail(order.customer_email || '');
      setDestTelefone(order.customer_phone || '');
      setDestLogradouro(order.shipping_street || '');
      setDestNumero(order.shipping_number || '');
      setDestComplemento(order.shipping_complement || '');
      setDestBairro(order.shipping_neighborhood || '');
      setDestMunicipio(order.shipping_city || '');
      setDestUf(order.shipping_state || '');
      setDestCep(order.shipping_postal_code || '');

      // Get fiscal product data for items
      const productIds = order.order_items?.map((item: any) => item.product_id).filter(Boolean) || [];
      
      let fiscalProducts: Record<string, any> = {};
      if (productIds.length > 0) {
        const { data: fps } = await supabase
          .from('fiscal_products')
          .select('*')
          .in('product_id', productIds);
        
        fiscalProducts = (fps || []).reduce((acc: Record<string, any>, fp: any) => {
          acc[fp.product_id] = fp;
          return acc;
        }, {});
      }

      // Map order items to invoice items
      const invoiceItems: ManualInvoiceItem[] = (order.order_items || []).map((item: any) => {
        const fp = fiscalProducts[item.product_id];
        return {
          codigo: item.products?.sku || item.product_id?.substring(0, 8) || '',
          descricao: item.products?.name || 'Produto',
          ncm: fp?.ncm || '',
          cfop: fp?.cfop_override || '5102',
          unidade: fp?.unidade_comercial || 'UN',
          quantidade: item.quantity || 1,
          valor_unitario: item.unit_price || 0,
          origem: String(fp?.origem ?? 0),
          csosn: fp?.csosn_override || '102',
        };
      });

      setItems(invoiceItems.length > 0 ? invoiceItems : [{ codigo: '', descricao: '', ncm: '', cfop: '5102', unidade: 'UN', quantidade: 1, valor_unitario: 0, origem: '0', csosn: '102' }]);

      toast.success('Dados do pedido importados');
    } catch (error) {
      console.error('Error importing order:', error);
      toast.error('Erro ao importar dados do pedido');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { codigo: '', descricao: '', ncm: '', cfop: '5102', unidade: 'UN', quantidade: 1, valor_unitario: 0, origem: '0', csosn: '102' }]);
  };

  const handleAddProductFromCatalog = (product: ProductWithFiscal) => {
    const newItem: ManualInvoiceItem = {
      codigo: product.sku || product.id.substring(0, 8),
      descricao: product.name,
      ncm: product.ncm || '',
      cfop: product.cfop || '5102',
      unidade: product.unidade || 'UN',
      quantidade: 1,
      valor_unitario: product.price,
      origem: String(product.origem ?? 0),
      csosn: '102',
    };
    setItems([...items, newItem]);
    toast.success(`Produto "${product.name}" adicionado`);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: keyof ManualInvoiceItem, value: string | number) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantidade * item.valor_unitario), 0);
  };

  const handleSubmit = async () => {
    // Validate required fields
    const errors: string[] = [];
    
    if (!destNome?.trim()) {
      errors.push('Nome do destinatário é obrigatório');
    }
    
    const cpfCnpj = destCpfCnpj.replace(/\D/g, '');
    if (!cpfCnpj) {
      errors.push('CPF/CNPJ do destinatário é obrigatório');
    } else if (!isValidCpfCnpj(cpfCnpj)) {
      errors.push(`CPF/CNPJ inválido: deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ). Atual: ${cpfCnpj.length} dígitos`);
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
      errors.push(`CEP inválido: deve ter 8 dígitos. Atual: ${cep.length} dígitos`);
    }

    // Validate items
    items.forEach((item, idx) => {
      const itemName = item.descricao || `Item ${idx + 1}`;
      const ncm = item.ncm.replace(/\D/g, '');
      
      if (!item.descricao?.trim()) {
        errors.push(`Item ${idx + 1}: Descrição é obrigatória`);
      }
      
      if (!ncm) {
        errors.push(`${itemName}: NCM é obrigatório`);
      } else if (!isValidNcm(ncm)) {
        errors.push(`${itemName}: NCM deve ter exatamente 8 dígitos (atual: ${ncm.length})`);
      }
      
      if (item.valor_unitario <= 0) {
        errors.push(`${itemName}: Valor unitário deve ser maior que zero`);
      }
    });

    if (errors.length > 0) {
      toast.error(errors[0]); // Show first error
      console.error('Validation errors:', errors);
      return;
    }

    try {
      setIsLoading(true);

      const { data, error } = await supabase.functions.invoke('fiscal-create-manual', {
        body: {
          order_id: selectedOrderId !== 'manual' ? selectedOrderId : null,
          natureza_operacao: naturezaOperacao,
          observacoes,
          indicador_presenca: indicadorPresenca,
          indicador_ie_dest: indicadorIeDest,
          pagamento_indicador: pagamentoIndicador,
          pagamento_meio: pagamentoMeio,
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
            ncm: item.ncm.replace(/\D/g, ''),
            cfop: item.cfop.replace(/\D/g, ''),
            unidade: item.unidade,
            quantidade: item.quantidade,
            valor_unitario: item.valor_unitario,
            origem: item.origem,
            csosn: item.csosn,
          })),
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao criar NF-e');

      toast.success('NF-e criada com sucesso! Status: ' + (data.invoice?.status || 'draft'));
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal-stats'] });
      onOpenChange(false);
    } catch (error) {
      showErrorToast(error, { module: 'fiscal', action: 'criar NF-e' });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Pedido</DialogTitle>
          <DialogDescription>
            Crie um rascunho de pedido para emissão de NF-e.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">

          {/* Destinatário */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Destinatário</CardTitle>
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
                    <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
                      {customerSearchResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCustomer(c)}
                          className="w-full text-left px-3 py-2 hover:bg-accent transition-colors text-sm"
                        >
                          <div className="font-medium">{c.name}</div>
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
                  <Label>CPF / CNPJ * <span className="text-xs text-muted-foreground">({destCpfCnpj.replace(/\D/g, '').length}/14 dígitos)</span></Label>
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
                  <Label>CEP * <span className="text-xs text-muted-foreground">(8 dígitos)</span></Label>
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
              <CardTitle className="text-base">Produtos / Serviços</CardTitle>
              <div className="flex items-center gap-2">
                <ProductSelector 
                  onSelect={handleAddProductFromCatalog}
                  placeholder="Buscar produto"
                  className="h-8"
                />
                <Button variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Manual
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => {
                const ncm = item.ncm.replace(/\D/g, '');
                const hasNcmError = !ncm || ncm.length !== 8;
                const cfop = item.cfop.replace(/\D/g, '');
                const hasCfopError = !cfop || cfop.length !== 4;
                
                return (
                  <div key={index} className={`p-3 border rounded-lg space-y-3 ${hasNcmError ? 'border-amber-400' : ''}`}>
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
                        <Label className="text-xs">
                          NCM * {hasNcmError && <span className="text-amber-600">(8 dígitos)</span>}
                        </Label>
                        <Input
                          value={item.ncm}
                          onChange={e => handleItemChange(index, 'ncm', e.target.value.replace(/\D/g, ''))}
                          placeholder="00000000"
                          maxLength={8}
                          className={`font-mono ${hasNcmError ? 'border-amber-500 bg-amber-50' : ''}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          CFOP * {hasCfopError && <span className="text-amber-600">(4 dígitos)</span>}
                        </Label>
                        <Input
                          value={item.cfop}
                          onChange={e => handleItemChange(index, 'cfop', e.target.value.replace(/\D/g, ''))}
                          maxLength={4}
                          className={`font-mono ${hasCfopError ? 'border-amber-500 bg-amber-50' : ''}`}
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
                    </div>
                    <div className="grid grid-cols-5 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Origem</Label>
                        <Select 
                          value={item.origem || '0'} 
                          onValueChange={v => handleItemChange(index, 'origem', v)}
                        >
                          <SelectTrigger className="text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ORIGEM_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">CSOSN</Label>
                        <Select 
                          value={item.csosn || '102'} 
                          onValueChange={v => handleItemChange(index, 'csosn', v)}
                        >
                          <SelectTrigger className="text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CSOSN_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                      <div className="space-y-1">
                        <Label className="text-xs">Subtotal</Label>
                        <Input
                          value={formatCurrency(item.quantidade * item.valor_unitario)}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-end pt-2 border-t">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total dos Produtos</p>
                  <p className="text-xl font-bold">{formatCurrency(calculateTotal())}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Informações Adicionais + SEFAZ */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Dados Fiscais e Informações Adicionais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Natureza da Operação</Label>
                  <Select value={selectedNatureId} onValueChange={handleNatureChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a natureza..." />
                    </SelectTrigger>
                    <SelectContent>
                      {operationNatures.map((nature) => (
                        <SelectItem key={nature.id} value={nature.id}>
                          {nature.nome} (CFOP: {nature.cfop_intra}/{nature.cfop_inter})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Ao selecionar, o CFOP e CSOSN serão aplicados aos itens
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Descrição da Natureza</Label>
                  <Input
                    value={naturezaOperacao}
                    onChange={e => setNaturezaOperacao(e.target.value)}
                    placeholder="Ex: VENDA DE MERCADORIA"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Indicador de Presença *</Label>
                  <Select value={String(indicadorPresenca)} onValueChange={v => setIndicadorPresenca(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 - Não se aplica</SelectItem>
                      <SelectItem value="1">1 - Presencial</SelectItem>
                      <SelectItem value="2">2 - Internet</SelectItem>
                      <SelectItem value="3">3 - Teleatendimento</SelectItem>
                      <SelectItem value="4">4 - NFC-e em domicílio</SelectItem>
                      <SelectItem value="5">5 - Presencial fora do estab.</SelectItem>
                      <SelectItem value="9">9 - Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Indicador IE Dest. *</Label>
                  <Select value={String(indicadorIeDest)} onValueChange={v => setIndicadorIeDest(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Contribuinte ICMS</SelectItem>
                      <SelectItem value="2">2 - Contribuinte isento</SelectItem>
                      <SelectItem value="9">9 - Não Contribuinte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Indicador de Pagamento *</Label>
                  <Select value={String(pagamentoIndicador)} onValueChange={v => setPagamentoIndicador(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 - À Vista</SelectItem>
                      <SelectItem value="1">1 - A Prazo</SelectItem>
                      <SelectItem value="2">2 - Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Meio de Pagamento *</Label>
                  <Select value={pagamentoMeio} onValueChange={setPagamentoMeio}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="01">01 - Dinheiro</SelectItem>
                      <SelectItem value="03">03 - Cartão de Crédito</SelectItem>
                      <SelectItem value="04">04 - Cartão de Débito</SelectItem>
                      <SelectItem value="15">15 - Boleto Bancário</SelectItem>
                      <SelectItem value="17">17 - PIX</SelectItem>
                      <SelectItem value="99">99 - Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                  placeholder="Informações adicionais que aparecerão na nota fiscal..."
                  rows={3}
                />
              </div>
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
              Criar NF-e
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}