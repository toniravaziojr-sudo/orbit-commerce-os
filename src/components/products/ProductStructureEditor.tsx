import { useState, useEffect } from 'react';
import { Plus, Trash2, Package, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useProductComponents, type ProductComponent } from '@/hooks/useProductComponents';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ProductStructureEditorProps {
  productId: string;
  stockType: 'physical' | 'virtual';
  onStockTypeChange: (type: 'physical' | 'virtual') => void;
  onComponentsChange?: (hasComponents: boolean) => void;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  price: number;
  cost_price: number | null;
  stock_quantity: number;
}

export function ProductStructureEditor({ 
  productId, 
  stockType, 
  onStockTypeChange,
  onComponentsChange,
}: ProductStructureEditorProps) {
  const { profile } = useAuth();
  const {
    components,
    isLoading,
    addComponent,
    updateComponent,
    deleteComponent,
    virtualStock,
  } = useProductComponents(productId);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Notify parent when components change
  useEffect(() => {
    onComponentsChange?.(components.length > 0);
  }, [components.length, onComponentsChange]);

  // Search products for component selection
  useEffect(() => {
    const searchProducts = async () => {
      if (!profile?.current_tenant_id || !searchValue.trim()) {
        setProductOptions([]);
        return;
      }

      setIsSearching(true);
      try {
        const { data } = await supabase
          .from('products')
          .select('id, name, sku, price, cost_price, stock_quantity, product_format')
          .eq('tenant_id', profile.current_tenant_id)
          .neq('id', productId) // Exclude the parent product
          .neq('product_format', 'with_composition') // Exclude kits (prevent cycles)
          .or(`name.ilike.%${searchValue}%,sku.ilike.%${searchValue}%`)
          .limit(10);

        const existingIds = new Set(components.map(c => c.component_product_id));
        const filtered = (data || []).filter(p => !existingIds.has(p.id));
        setProductOptions(filtered);
      } catch (error) {
        console.error('Error searching products:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchProducts, 300);
    return () => clearTimeout(debounce);
  }, [searchValue, profile?.current_tenant_id, productId, components]);

  const handleAddComponent = async (product: ProductOption) => {
    if (!productId) return;
    
    await addComponent.mutateAsync({
      parent_product_id: productId,
      component_product_id: product.id,
      quantity: 1,
      cost_price: product.cost_price,
      sale_price: product.price,
      sort_order: components.length,
    });

    setSearchOpen(false);
    setSearchValue('');
  };

  const handleQuantityChange = (component: ProductComponent, newQuantity: number) => {
    if (newQuantity < 0.01) return;
    updateComponent.mutate({
      id: component.id,
      quantity: newQuantity,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Estrutura do Kit
        </CardTitle>
        <CardDescription>
          Configure os produtos que compõem este kit e suas quantidades
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stock Type Selection */}
        <div className="space-y-3">
          <Label>Tipo de Estoque</Label>
          <RadioGroup
            value={stockType}
            onValueChange={(value) => onStockTypeChange(value as 'physical' | 'virtual')}
            className="flex gap-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="virtual" id="virtual" />
              <Label htmlFor="virtual" className="font-normal cursor-pointer">
                Virtual
                <span className="text-xs text-muted-foreground ml-1">
                  (calculado pelos componentes)
                </span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="physical" id="physical" />
              <Label htmlFor="physical" className="font-normal cursor-pointer">
                Físico
                <span className="text-xs text-muted-foreground ml-1">
                  (controle separado)
                </span>
              </Label>
            </div>
          </RadioGroup>
          {stockType === 'virtual' && components.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Estoque disponível: <strong>{virtualStock} unidades</strong> (baseado nos componentes)
            </p>
          )}
        </div>

        {/* Components Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Componentes</Label>
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Componente
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Buscar produto..."
                    value={searchValue}
                    onValueChange={setSearchValue}
                  />
                  <CommandList>
                    {isSearching ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : productOptions.length === 0 ? (
                      <CommandEmpty>
                        {searchValue ? 'Nenhum produto encontrado' : 'Digite para buscar'}
                      </CommandEmpty>
                    ) : (
                      <CommandGroup>
                        {productOptions.map((product) => (
                          <CommandItem
                            key={product.id}
                            onSelect={() => handleAddComponent(product)}
                            className="cursor-pointer"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{product.name}</span>
                              <span className="text-xs text-muted-foreground">
                                SKU: {product.sku} | {formatCurrency(product.price)}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {components.length === 0 ? (
            <div className="border rounded-lg p-8 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum componente adicionado</p>
              <p className="text-sm">Adicione produtos para compor este kit</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">#</TableHead>
                    <TableHead>Componente</TableHead>
                    <TableHead className="w-[120px]">Código</TableHead>
                    <TableHead className="w-[100px] text-center">Quantidade</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {components.map((component, index) => (
                    <TableRow key={component.id}>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        {component.component?.name ?? 'Produto não encontrado'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {component.component?.sku ?? '-'}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0.01}
                          step={0.01}
                          value={component.quantity}
                          onChange={(e) => handleQuantityChange(component, parseFloat(e.target.value) || 1)}
                          className="h-8 w-20 text-center mx-auto"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => deleteComponent.mutate(component.id)}
                          disabled={deleteComponent.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
