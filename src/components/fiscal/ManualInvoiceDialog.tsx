import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileDown, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { ProductSelector, type ProductWithFiscal } from './ProductSelector';

interface ManualInvoiceItem {
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
}

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
  const [selectedOrderId, setSelectedOrderId] = useState<string>('manual');

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
  const [items, setItems] = useState<ManualInvoiceItem[]>([
    { codigo: '', descricao: '', ncm: '', cfop: '5102', unidade: 'UN', quantidade: 1, valor_unitario: 0 }
  ]);

  // Fetch orders for import
  useEffect(() => {
    if (open && tenantId) {
      supabase
        .from('orders')
        .select('id, order_number, customer_name, total')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50)
        .then(({ data }) => {
          if (data) setOrders(data);
        });
    }
  }, [open, tenantId]);

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
      setItems([{ codigo: '', descricao: '', ncm: '', cfop: '5102', unidade: 'UN', quantidade: 1, valor_unitario: 0 }]);
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
        };
      });

      setItems(invoiceItems.length > 0 ? invoiceItems : [{ codigo: '', descricao: '', ncm: '', cfop: '5102', unidade: 'UN', quantidade: 1, valor_unitario: 0 }]);

      toast.success('Dados do pedido importados');
    } catch (error) {
      console.error('Error importing order:', error);
      toast.error('Erro ao importar dados do pedido');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { codigo: '', descricao: '', ncm: '', cfop: '5102', unidade: 'UN', quantidade: 1, valor_unitario: 0 }]);
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
    if (!destNome || !destCpfCnpj) {
      toast.error('Preencha nome e CPF/CNPJ do destinatário');
      return;
    }

    if (!destLogradouro || !destNumero || !destMunicipio || !destUf || !destCep) {
      toast.error('Preencha o endereço completo do destinatário');
      return;
    }

    const invalidItems = items.filter(i => !i.descricao || !i.ncm || i.valor_unitario <= 0);
    if (invalidItems.length > 0) {
      toast.error('Preencha descrição, NCM e valor de todos os itens');
      return;
    }

    try {
      setIsLoading(true);

      const { data, error } = await supabase.functions.invoke('fiscal-create-manual', {
        body: {
          order_id: selectedOrderId !== 'manual' ? selectedOrderId : null,
          natureza_operacao: naturezaOperacao,
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
            ncm: item.ncm.replace(/\D/g, ''),
            cfop: item.cfop,
            unidade: item.unidade,
            quantidade: item.quantidade,
            valor_unitario: item.valor_unitario,
          })),
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao criar NF-e');

      toast.success('NF-e criada com sucesso! Status: ' + (data.invoice?.status || 'draft'));
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal-stats'] });
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating manual invoice:', error);
      toast.error(error.message || 'Erro ao criar NF-e');
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
          <DialogTitle>Nova Nota Fiscal</DialogTitle>
          <DialogDescription>
            Crie uma NF-e manualmente ou importe dados de um pedido existente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Import from Order */}
          <div className="space-y-2">
            <Label>Importar de Pedido (opcional)</Label>
            <Select
              value={selectedOrderId}
              onValueChange={(v) => {
                setSelectedOrderId(v);
                handleImportOrder(v);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione para importar dados..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Preencher manualmente</SelectItem>
                {orders.map((order) => (
                  <SelectItem key={order.id} value={order.id}>
                    #{order.order_number} - {order.customer_name || 'Cliente'} - {formatCurrency(order.total)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Destinatário */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Destinatário</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome / Razão Social *</Label>
                  <Input value={destNome} onChange={e => setDestNome(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>CPF / CNPJ *</Label>
                  <Input value={destCpfCnpj} onChange={e => setDestCpfCnpj(e.target.value)} />
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
                  <Input value={destNumero} onChange={e => setDestNumero(e.target.value)} />
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
                  <Input value={destUf} onChange={e => setDestUf(e.target.value)} maxLength={2} />
                </div>
                <div className="space-y-2">
                  <Label>CEP *</Label>
                  <Input value={destCep} onChange={e => setDestCep(e.target.value)} />
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
              {items.map((item, index) => (
                <div key={index} className="p-3 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Item {index + 1}</span>
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
                      <Label className="text-xs">NCM *</Label>
                      <Input
                        value={item.ncm}
                        onChange={e => handleItemChange(index, 'ncm', e.target.value)}
                        placeholder="00000000"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">CFOP</Label>
                      <Input
                        value={item.cfop}
                        onChange={e => handleItemChange(index, 'cfop', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unidade</Label>
                      <Input
                        value={item.unidade}
                        onChange={e => handleItemChange(index, 'unidade', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
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

          {/* Informações Adicionais */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Informações Adicionais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Natureza da Operação</Label>
                <Input
                  value={naturezaOperacao}
                  onChange={e => setNaturezaOperacao(e.target.value)}
                />
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
