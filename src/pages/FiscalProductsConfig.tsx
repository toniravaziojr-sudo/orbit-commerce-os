import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Package, AlertTriangle, CheckCircle, Save, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useFiscalProducts, type FiscalProduct } from '@/hooks/useFiscal';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// CFOP options for merchandise sales
const CFOP_OPTIONS = [
  { value: '', label: 'Usar padrão do emissor' },
  { value: '5102', label: '5102 - Venda de mercadoria (dentro do estado)' },
  { value: '6102', label: '6102 - Venda de mercadoria (fora do estado)' },
  { value: '5405', label: '5405 - Venda de mercadoria ST (dentro do estado)' },
  { value: '6404', label: '6404 - Venda de mercadoria ST (fora do estado)' },
];

// Origem options
const ORIGEM_OPTIONS = [
  { value: '0', label: '0 - Nacional' },
  { value: '1', label: '1 - Estrangeira (importação direta)' },
  { value: '2', label: '2 - Estrangeira (adquirida no mercado interno)' },
  { value: '3', label: '3 - Nacional (+ 40% conteúdo importado)' },
  { value: '4', label: '4 - Nacional (conforme processos básicos)' },
  { value: '5', label: '5 - Nacional (+ 70% conteúdo importado)' },
  { value: '6', label: '6 - Estrangeira (importação direta, sem similar)' },
  { value: '7', label: '7 - Estrangeira (mercado interno, sem similar)' },
  { value: '8', label: '8 - Nacional (+ 70% importado, conforme processos)' },
];

// Unidade comercial options
const UNIDADE_OPTIONS = [
  { value: 'UN', label: 'UN - Unidade' },
  { value: 'PC', label: 'PC - Peça' },
  { value: 'KG', label: 'KG - Quilograma' },
  { value: 'G', label: 'G - Grama' },
  { value: 'L', label: 'L - Litro' },
  { value: 'ML', label: 'ML - Mililitro' },
  { value: 'M', label: 'M - Metro' },
  { value: 'M2', label: 'M² - Metro quadrado' },
  { value: 'M3', label: 'M³ - Metro cúbico' },
  { value: 'CX', label: 'CX - Caixa' },
  { value: 'PCT', label: 'PCT - Pacote' },
  { value: 'PAR', label: 'PAR - Par' },
  { value: 'DZ', label: 'DZ - Dúzia' },
  { value: 'KIT', label: 'KIT - Kit' },
];

type Product = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
};

type FiscalProductEdit = {
  product_id: string;
  product_name: string;
  ncm: string;
  cest: string;
  origem: string;
  unidade_comercial: string;
  cfop_override: string;
};

export default function FiscalProductsConfig() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const tenantId = profile?.current_tenant_id;
  const { fiscalProducts, isLoading: fiscalLoading, saveFiscalProduct } = useFiscalProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [editingProduct, setEditingProduct] = useState<FiscalProductEdit | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch all products
  const fetchProducts = async (): Promise<Product[]> => {
    if (!tenantId) return [];
    const { data, error } = await (supabase as any)
      .from('products')
      .select('id, name, sku, price')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    return (data || []) as Product[];
  };
  
  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['products-for-fiscal', tenantId],
    queryFn: fetchProducts,
    enabled: !!tenantId,
  });

  // Merge products with fiscal data
  const productsWithFiscal = useMemo(() => {
    if (!products) return [];
    
    const fiscalMap = new Map(fiscalProducts?.map(fp => [fp.product_id, fp]));
    
    return products.map(product => {
      const fiscal = fiscalMap.get(product.id);
      return {
        ...product,
        fiscal,
        isConfigured: !!fiscal?.ncm,
      };
    });
  }, [products, fiscalProducts]);

  // Filter products
  const filteredProducts = useMemo(() => {
    let result = productsWithFiscal;
    
    if (showOnlyPending) {
      result = result.filter(p => !p.isConfigured);
    }
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(search) ||
        p.sku?.toLowerCase().includes(search)
      );
    }
    
    return result;
  }, [productsWithFiscal, showOnlyPending, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    const total = productsWithFiscal.length;
    const configured = productsWithFiscal.filter(p => p.isConfigured).length;
    return { total, configured, pending: total - configured };
  }, [productsWithFiscal]);

  const handleEditProduct = (product: typeof productsWithFiscal[0]) => {
    setEditingProduct({
      product_id: product.id,
      product_name: product.name,
      ncm: product.fiscal?.ncm || '',
      cest: product.fiscal?.cest || '',
      origem: String(product.fiscal?.origem ?? '0'),
      unidade_comercial: product.fiscal?.unidade_comercial || 'UN',
      cfop_override: product.fiscal?.cfop_override || '',
    });
  };

  const handleSave = async () => {
    if (!editingProduct) return;
    
    if (!editingProduct.ncm) {
      toast.error('NCM é obrigatório para emissão de NF-e');
      return;
    }

    // Validate NCM format (8 digits)
    const ncmClean = editingProduct.ncm.replace(/\D/g, '');
    if (ncmClean.length !== 8) {
      toast.error('NCM deve ter 8 dígitos');
      return;
    }
    
    setIsSaving(true);
    try {
      await saveFiscalProduct.mutateAsync({
        productId: editingProduct.product_id,
        fiscalData: {
          ncm: ncmClean,
          cest: editingProduct.cest?.replace(/\D/g, '') || null,
          origem: parseInt(editingProduct.origem, 10),
          unidade_comercial: editingProduct.unidade_comercial,
          cfop_override: editingProduct.cfop_override || null,
        },
      });
      toast.success('Dados fiscais salvos com sucesso');
      setEditingProduct(null);
    } catch (error) {
      console.error('Error saving fiscal product:', error);
      toast.error('Erro ao salvar dados fiscais');
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = productsLoading || fiscalLoading;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Configuração Fiscal de Produtos"
        description="Configure NCM e dados fiscais para cada produto"
        actions={
          <Button variant="outline" onClick={() => navigate('/settings/fiscal')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total de Produtos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.configured}</p>
                <p className="text-sm text-muted-foreground">Configurados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className={stats.pending > 0 ? 'border-amber-500/30 bg-amber-500/5' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stats.pending > 0 ? 'bg-amber-500/10' : 'bg-muted'}`}>
                <AlertTriangle className={`h-5 w-5 ${stats.pending > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${stats.pending > 0 ? 'text-amber-600' : ''}`}>{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold">Produtos</CardTitle>
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <Switch
                  id="showPending"
                  checked={showOnlyPending}
                  onCheckedChange={setShowOnlyPending}
                />
                <Label htmlFor="showPending" className="text-sm whitespace-nowrap">
                  Apenas pendentes
                </Label>
              </div>
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {showOnlyPending 
                ? 'Todos os produtos estão configurados! 🎉'
                : 'Nenhum produto encontrado.'
              }
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>NCM</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="max-w-[200px]">
                      <span className="font-medium truncate block">{product.name}</span>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {product.sku || '-'}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {product.fiscal?.ncm || '-'}
                    </TableCell>
                    <TableCell>
                      {product.fiscal?.origem !== undefined ? String(product.fiscal.origem) : '-'}
                    </TableCell>
                    <TableCell>
                      {product.fiscal?.unidade_comercial || 'UN'}
                    </TableCell>
                    <TableCell>
                      {product.isConfigured ? (
                        <Badge variant="default" className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Configurado
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditProduct(product)}
                      >
                        Configurar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configurar Dados Fiscais</DialogTitle>
            <DialogDescription>
              {editingProduct?.product_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="ncm">
                  NCM <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ncm"
                  placeholder="00000000"
                  value={editingProduct?.ncm || ''}
                  onChange={(e) => setEditingProduct(prev => prev ? {...prev, ncm: e.target.value} : null)}
                  maxLength={10}
                />
                <p className="text-xs text-muted-foreground">
                  Nomenclatura Comum do Mercosul - 8 dígitos obrigatórios
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cest">CEST</Label>
                <Input
                  id="cest"
                  placeholder="0000000"
                  value={editingProduct?.cest || ''}
                  onChange={(e) => setEditingProduct(prev => prev ? {...prev, cest: e.target.value} : null)}
                  maxLength={9}
                />
                <p className="text-xs text-muted-foreground">
                  Código Especificador da Substituição Tributária (opcional)
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="origem">Origem</Label>
                <Select
                  value={editingProduct?.origem || '0'}
                  onValueChange={(value) => setEditingProduct(prev => prev ? {...prev, origem: value} : null)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORIGEM_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="unidade">Unidade Comercial</Label>
                <Select
                  value={editingProduct?.unidade_comercial || 'UN'}
                  onValueChange={(value) => setEditingProduct(prev => prev ? {...prev, unidade_comercial: value} : null)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cfop">CFOP Override</Label>
                <Select
                  value={editingProduct?.cfop_override || ''}
                  onValueChange={(value) => setEditingProduct(prev => prev ? {...prev, cfop_override: value} : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Usar padrão do emissor" />
                  </SelectTrigger>
                  <SelectContent>
                    {CFOP_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProduct(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
