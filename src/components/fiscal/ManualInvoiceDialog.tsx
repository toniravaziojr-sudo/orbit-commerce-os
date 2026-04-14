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
}

export function ManualInvoiceDialog({ open, onOpenChange }: ManualInvoiceDialogProps) {
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
  const [items, setItems] = useState<OrderItem[]>([
    { codigo: '', descricao: '', unidade: 'UN', quantidade: 1, valor_unitario: 0 }
  ]);

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

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantidade * item.valor_unitario), 0);
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
          natureza_operacao: 'VENDA DE MERCADORIA',
          observacoes,
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
            ncm: '',
            cfop: '5102',
            unidade: item.unidade,
            quantidade: item.quantidade,
            valor_unitario: item.valor_unitario,
            origem: '0',
            csosn: '102',
          })),
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao criar pedido');

      toast.success('Pedido criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal-stats'] });
      onOpenChange(false);
    } catch (error) {
      showErrorToast(error, { module: 'fiscal', action: 'criar pedido' });
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
                <Button variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Manual
                </Button>
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
                  <p className="text-sm text-muted-foreground">Total dos Produtos</p>
                  <p className="text-xl font-bold">{formatCurrency(calculateTotal())}</p>
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
              Criar Pedido
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
