import { useState, useEffect } from 'react';
import { useProducts, Product } from '@/hooks/useProducts';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Package, Copy, ImageIcon, Eye } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { DeleteProductDialog } from './DeleteProductDialog';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { usePrimaryPublicHost, buildPublicStorefrontUrl } from '@/hooks/usePrimaryPublicHost';

interface ProductListProps {
  onCreateProduct: () => void;
  onEditProduct: (product: Product) => void;
}

interface ProductWithImage extends Product {
  primary_image_url?: string | null;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  active: { label: 'Ativo', variant: 'default' },
  inactive: { label: 'Inativo', variant: 'outline' },
  archived: { label: 'Arquivado', variant: 'destructive' },
};

export function ProductList({ onCreateProduct, onEditProduct }: ProductListProps) {
  const { products, isLoading, deleteProduct, createProduct } = useProducts();
  const { currentTenant } = useAuth();
  const { primaryOrigin } = usePrimaryPublicHost(currentTenant?.id, currentTenant?.slug);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [productImages, setProductImages] = useState<Record<string, string>>({});
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Load primary images for all products
  useEffect(() => {
    if (products.length > 0) {
      loadProductImages();
    }
  }, [products]);

  const loadProductImages = async () => {
    const productIds = products.map(p => p.id);
    
    const { data, error } = await supabase
      .from('product_images')
      .select('product_id, url')
      .in('product_id', productIds)
      .eq('is_primary', true);

    if (!error && data) {
      const imageMap: Record<string, string> = {};
      data.forEach(img => {
        imageMap[img.product_id] = img.url;
      });
      setProductImages(imageMap);
    }
  };

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.sku.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = () => {
    if (deleteId) {
      deleteProduct.mutate(deleteId);
      setDeleteId(null);
    }
  };

  const handleDuplicate = async (product: Product) => {
    if (!currentTenant?.id) {
      toast.error('Nenhuma loja selecionada');
      return;
    }

    setIsDuplicating(true);
    
    try {
      // Generate unique SKU and slug
      const timestamp = Date.now();
      const newSku = `${product.sku}-COPY-${timestamp}`;
      const newSlug = `${product.slug}-copy-${timestamp}`;

      await createProduct.mutateAsync({
        name: `${product.name} (Cópia)`,
        sku: newSku,
        slug: newSlug,
        description: product.description,
        short_description: product.short_description,
        cost_price: product.cost_price,
        price: product.price,
        compare_at_price: product.compare_at_price,
        promotion_start_date: product.promotion_start_date,
        promotion_end_date: product.promotion_end_date,
        stock_quantity: product.stock_quantity,
        low_stock_threshold: product.low_stock_threshold,
        manage_stock: product.manage_stock,
        allow_backorder: product.allow_backorder,
        weight: product.weight,
        width: product.width,
        height: product.height,
        depth: product.depth,
        barcode: null,
        gtin: product.gtin,
        ncm: product.ncm,
        seo_title: product.seo_title,
        seo_description: product.seo_description,
        status: 'draft',
        is_featured: false,
        has_variants: product.has_variants,
        product_format: product.product_format || 'simple',
        stock_type: product.stock_type || 'physical',
        regulatory_info: (product as any).regulatory_info ?? {},
        warranty_type: (product as any).warranty_type ?? null,
        warranty_duration: (product as any).warranty_duration ?? null,
      });

      toast.success('Produto duplicado com sucesso!');
    } catch (error) {
      console.error('Error duplicating product:', error);
      toast.error('Erro ao duplicar produto');
    } finally {
      setIsDuplicating(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={onCreateProduct}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Produto
        </Button>
      </div>

      {filteredProducts.length === 0 ? (
        <EmptyState
          icon={Package}
          title={search ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
          description={
            search
              ? 'Tente buscar com outros termos'
              : 'Comece criando seu primeiro produto'
          }
          action={
            !search
              ? { label: 'Criar Produto', onClick: onCreateProduct }
              : undefined
          }
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]"></TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="w-10 h-10 rounded border bg-muted overflow-hidden flex items-center justify-center">
                      {productImages[product.id] ? (
                        <img
                          src={productImages[product.id]}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center');
                          }}
                        />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{product.name}</span>
                      {product.has_variants && (
                        <span className="text-xs text-muted-foreground">
                          Com variações
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span>{formatCurrency(product.price)}</span>
                      {product.compare_at_price && (
                        <span className="text-xs text-muted-foreground line-through">
                          {formatCurrency(product.compare_at_price)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        product.stock_quantity <= (product.low_stock_threshold || 5)
                          ? 'text-destructive font-medium'
                          : ''
                      }
                    >
                      {product.stock_quantity}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusConfig[product.status]?.variant || 'default'}>
                      {statusConfig[product.status]?.label || product.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => {
                            // Opens PUBLIC URL using canonical origin (shops or custom domain)
                            if (primaryOrigin && product.slug) {
                              const url = buildPublicStorefrontUrl(primaryOrigin, `/p/${product.slug}`);
                              window.open(url, '_blank');
                            }
                          }}
                          disabled={!product.slug || !primaryOrigin}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEditProduct(product)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDuplicate(product)}
                          disabled={isDuplicating}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(product.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DeleteProductDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        productId={deleteId}
        productName={products.find(p => p.id === deleteId)?.name}
        onConfirm={handleDelete}
      />
    </div>
  );
}
