import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
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
  const { profile } = useAuth();
  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<SimpleProduct[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tempSelected, setTempSelected] = useState<string[]>([]);

  // Fetch products
  useEffect(() => {
    if (!profile?.current_tenant_id) return;

    const fetchProducts = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('products')
        .select('id, name, sku')
        .eq('tenant_id', profile.current_tenant_id)
        .eq('is_active', true)
        .order('name');
      
      if (data) {
        setProducts(data.map((p: { id: string; name: string; sku: string | null }) => ({ 
          id: p.id, 
          name: p.name, 
          sku: p.sku || '' 
        })));
      }
    };

    fetchProducts();
  }, [profile?.current_tenant_id]);

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
        setSelectedProducts(data.map((p: { id: string; name: string; sku: string | null }) => ({ 
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
                        <p className="text-xs text-muted-foreground">{product.sku}</p>
                      </div>
                    </label>
                  ))}
                  {filteredProducts.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum produto encontrado
                    </p>
                  )}
                </div>
              </ScrollArea>

              <div className="flex justify-between">
                <p className="text-sm text-muted-foreground">
                  {tempSelected.length} selecionado(s)
                </p>
                <Button onClick={handleConfirm}>
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
