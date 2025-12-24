import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Loader2, AlertCircle, PackageOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

interface ProductScopeSelectorProps {
  scope: 'all' | 'specific';
  productIds: string[];
  onScopeChange: (scope: 'all' | 'specific') => void;
  onProductIdsChange: (ids: string[]) => void;
}

interface SimpleProduct {
  id: string;
  name: string;
  sku: string;
}

export function ProductScopeSelector({
  scope,
  productIds,
  onScopeChange,
  onProductIdsChange,
}: ProductScopeSelectorProps) {
  const { profile, currentTenant } = useAuth();
  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<SimpleProduct[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tempSelected, setTempSelected] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use currentTenant.id or profile.current_tenant_id as fallback
  const tenantId = currentTenant?.id || profile?.current_tenant_id;

  // Fetch products when dialog opens
  useEffect(() => {
    if (!dialogOpen || !tenantId) return;

    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error: queryError } = await (supabase as any)
          .from('products')
          .select('id, name, sku')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .order('name')
          .limit(100);
        
        if (queryError) {
          console.error('[ProductScopeSelector] Query error:', queryError);
          if (queryError?.code === '42501' || queryError?.message?.includes('permission')) {
            setError('Sem permissão para listar produtos. Verifique suas credenciais.');
          } else {
            setError(`Erro ao carregar produtos: ${queryError.message}`);
          }
          return;
        }

        if (data) {
          setProducts(data.map((p) => ({ 
            id: p.id, 
            name: p.name, 
            sku: p.sku || '' 
          })));
        }
      } catch (err) {
        console.error('[ProductScopeSelector] Unexpected error:', err);
        setError('Erro inesperado ao carregar produtos.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [dialogOpen, tenantId]);

  // Fetch selected products details
  useEffect(() => {
    if (productIds.length === 0) {
      setSelectedProducts([]);
      return;
    }

    const fetchSelected = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('products')
        .select('id, name, sku')
        .in('id', productIds);
      
      if (data) {
        setSelectedProducts(data.map((p) => ({ 
          id: p.id, 
          name: p.name, 
          sku: p.sku || '' 
        })));
      }
    };

    fetchSelected();
  }, [productIds]);

  const handleOpenDialog = () => {
    setTempSelected(productIds);
    setSearch('');
    setDialogOpen(true);
  };

  const handleConfirm = () => {
    onProductIdsChange(tempSelected);
    setDialogOpen(false);
  };

  const toggleProduct = (id: string) => {
    setTempSelected(prev => 
      prev.includes(id) 
        ? prev.filter(p => p !== id)
        : [...prev, id]
    );
  };

  const removeProduct = (id: string) => {
    onProductIdsChange(productIds.filter(p => p !== id));
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <Label>Escopo de Produtos</Label>
      
      <RadioGroup 
        value={scope} 
        onValueChange={(v) => {
          onScopeChange(v as 'all' | 'specific');
          if (v === 'all') {
            onProductIdsChange([]);
          }
        }}
        className="flex gap-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="all" id="scope-all" />
          <label htmlFor="scope-all" className="text-sm font-medium cursor-pointer">
            Todos os produtos
          </label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="specific" id="scope-specific" />
          <label htmlFor="scope-specific" className="text-sm font-medium cursor-pointer">
            Produtos específicos
          </label>
        </div>
      </RadioGroup>

      {scope === 'specific' && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {selectedProducts.map((product) => (
              <Badge key={product.id} variant="secondary" className="gap-1">
                {product.name}
                <button
                  type="button"
                  onClick={() => removeProduct(product.id)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className="gap-1"
                onClick={handleOpenDialog}
              >
                <Plus className="h-4 w-4" />
                Selecionar Produtos
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Selecionar Produtos</DialogTitle>
              </DialogHeader>
              
              <Input
                placeholder="Buscar por nome ou SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <ScrollArea className="h-64">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <AlertCircle className="h-8 w-8 text-destructive mb-2" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredProducts.map((product) => (
                      <label
                        key={product.id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={tempSelected.includes(product.id)}
                          onCheckedChange={() => toggleProduct(product.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{product.name}</p>
                          {product.sku && (
                            <p className="text-xs text-muted-foreground">{product.sku}</p>
                          )}
                        </div>
                      </label>
                    ))}
                    {filteredProducts.length === 0 && products.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <PackageOpen className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">
                          Nenhum produto cadastrado
                        </p>
                        <Button asChild variant="outline" size="sm">
                          <Link to="/products" onClick={() => setDialogOpen(false)}>
                            Ir para Produtos
                          </Link>
                        </Button>
                      </div>
                    )}
                    {filteredProducts.length === 0 && products.length > 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum produto encontrado para "{search}"
                      </p>
                    )}
                  </div>
                )}
              </ScrollArea>

              <div className="flex justify-between">
                <p className="text-sm text-muted-foreground">
                  {tempSelected.length} selecionado(s)
                </p>
                <Button onClick={handleConfirm} disabled={isLoading}>
                  Confirmar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
