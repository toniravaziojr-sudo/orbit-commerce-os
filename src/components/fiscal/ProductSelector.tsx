import { useState, useEffect, useMemo } from 'react';
import { ChevronsUpDown, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export interface ProductWithFiscal {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  ncm?: string | null;
  cfop?: string | null;
  unidade?: string | null;
  origem?: number | null;
}

interface ProductSelectorProps {
  onSelect: (product: ProductWithFiscal) => void;
  placeholder?: string;
  className?: string;
}

export function ProductSelector({ onSelect, placeholder = "Buscar produto...", className }: ProductSelectorProps) {
  const { profile } = useAuth();
  const tenantId = profile?.current_tenant_id;
  
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<ProductWithFiscal[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch products with fiscal data
  useEffect(() => {
    if (!tenantId) return;
    
    const fetchProducts = async () => {
      setLoading(true);
      try {
        // Fetch products - cast to bypass deep type inference
        const { data: rawProducts, error: productsError } = await (supabase
          .from('products')
          .select('id, name, sku, price, status') as any)
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .order('name')
          .limit(500);

        if (productsError) throw productsError;
        
        const productsData = (rawProducts || []) as Array<{ id: string; name: string; sku: string | null; price: number }>;
        const productIds = productsData.map(p => p.id);
        
        // Fetch fiscal data
        let fiscalMap: Record<string, { ncm: string | null; cfop_override: string | null; unidade_comercial: string | null; origem: number | null }> = {};
        
        if (productIds.length > 0) {
          const { data: fiscalData } = await (supabase
            .from('fiscal_products')
            .select('product_id, ncm, cfop_override, unidade_comercial, origem') as any)
            .in('product_id', productIds);
          
          for (const fp of (fiscalData || [])) {
            fiscalMap[fp.product_id] = fp;
          }
        }

        const productsWithFiscal: ProductWithFiscal[] = productsData.map((p) => {
          const fiscal = fiscalMap[p.id];
          return {
            id: p.id,
            name: p.name,
            sku: p.sku,
            price: p.price,
            ncm: fiscal?.ncm || null,
            cfop: fiscal?.cfop_override || null,
            unidade: fiscal?.unidade_comercial || 'UN',
            origem: fiscal?.origem ?? 0,
          };
        });

        setProducts(productsWithFiscal);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [tenantId]);

  // Filter products based on search
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(term) ||
      p.sku?.toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

  const handleSelect = (product: ProductWithFiscal) => {
    onSelect(product);
    setOpen(false);
    setSearchTerm('');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
        >
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 shrink-0" />
            <span className="truncate">{placeholder}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Digite para buscar..." 
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? 'Carregando...' : 'Nenhum produto encontrado.'}
            </CommandEmpty>
            <CommandGroup heading={`Produtos (${filteredProducts.length})`}>
              {filteredProducts.slice(0, 50).map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.id}
                  onSelect={() => handleSelect(product)}
                  className="flex flex-col items-start py-3"
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{product.name}</span>
                      {product.sku && (
                        <Badge variant="secondary" className="text-xs">
                          {product.sku}
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatCurrency(product.price)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {product.ncm ? (
                      <Badge variant="outline" className="text-xs font-mono">
                        NCM: {product.ncm}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        Sem NCM
                      </Badge>
                    )}
                    {product.cfop && (
                      <Badge variant="outline" className="text-xs font-mono">
                        CFOP: {product.cfop}
                      </Badge>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
