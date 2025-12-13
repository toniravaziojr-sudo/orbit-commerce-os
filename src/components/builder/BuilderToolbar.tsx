// =============================================
// BUILDER TOOLBAR - Top toolbar with actions
// =============================================

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Undo2,
  Redo2,
  Save,
  Upload,
  Eye,
  MoreVertical,
  RotateCcw,
  History,
  ArrowLeft,
  ExternalLink,
  ChevronRight,
  Package,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

interface BuilderToolbarProps {
  pageTitle: string;
  pageType: string;
  tenantSlug?: string;
  isDirty: boolean;
  isPreviewMode: boolean;
  canUndo: boolean;
  canRedo: boolean;
  isSaving?: boolean;
  isPublishing?: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onPublish: () => void;
  onTogglePreview: () => void;
  onReset?: () => void;
  onViewHistory?: () => void;
  onSettings?: () => void;
  onBack: () => void;
  onPageChange?: (pageType: string) => void;
  // NEW: Example selectors
  exampleProductId?: string;
  exampleCategoryId?: string;
  onExampleProductChange?: (productId: string) => void;
  onExampleCategoryChange?: (categoryId: string) => void;
}

const pageTypeLabels: Record<string, string> = {
  home: 'Página Inicial',
  category: 'Categoria',
  product: 'Produto',
  cart: 'Carrinho',
  checkout: 'Checkout',
  institutional: 'Página',
};

export function BuilderToolbar({
  pageTitle,
  pageType,
  tenantSlug,
  isDirty,
  isPreviewMode,
  canUndo,
  canRedo,
  isSaving = false,
  isPublishing = false,
  onUndo,
  onRedo,
  onSave,
  onPublish,
  onTogglePreview,
  onReset,
  onViewHistory,
  onBack,
  onPageChange,
  exampleProductId,
  exampleCategoryId,
  onExampleProductChange,
  onExampleCategoryChange,
}: BuilderToolbarProps) {
  const navigate = useNavigate();
  const { currentTenant } = useAuth();

  // Fetch products for Product template
  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['builder-example-products', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'active')
        .order('name')
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenant?.id && pageType === 'product',
  });

  // Fetch categories for Category template
  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['builder-example-categories', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .order('name')
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenant?.id && pageType === 'category',
  });

  // Build preview URL based on page type
  const getPreviewUrl = () => {
    if (!tenantSlug) return null;
    const baseUrl = `/store/${tenantSlug}`;
    switch (pageType) {
      case 'home':
        return `${baseUrl}?preview=1`;
      case 'category':
        return `${baseUrl}/c/exemplo?preview=1`;
      case 'product':
        return `${baseUrl}/p/exemplo?preview=1`;
      case 'cart':
        return `${baseUrl}/cart?preview=1`;
      case 'checkout':
        return `${baseUrl}/checkout?preview=1`;
      default:
        return `${baseUrl}?preview=1`;
    }
  };

  const handleOpenPreview = () => {
    const url = getPreviewUrl();
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handlePageChange = (newPageType: string) => {
    if (isDirty) {
      if (!confirm('Você tem alterações não salvas. Deseja trocar de página?')) {
        return;
      }
    }
    navigate(`/admin/storefront/builder?edit=${newPageType}`);
  };

  return (
    <div className="h-14 flex items-center justify-between px-4 bg-background border-b shadow-sm">
      {/* Left: Breadcrumb & Page Selector */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
        
        <Separator orientation="vertical" className="h-6" />
        
        {/* Breadcrumb */}
        <div className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground">
          <span>Builder</span>
          <ChevronRight className="h-4 w-4" />
        </div>
        
        {/* Page Selector */}
        <Select value={pageType} onValueChange={handlePageChange}>
          <SelectTrigger className="w-[160px] h-9 font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="home">🏠 Página Inicial</SelectItem>
            <SelectItem value="category">📁 Categoria</SelectItem>
            <SelectItem value="product">📦 Produto</SelectItem>
            <SelectItem value="cart">🛒 Carrinho</SelectItem>
            <SelectItem value="checkout">💳 Checkout</SelectItem>
          </SelectContent>
        </Select>

        {/* Example Product Selector - Only for Product template */}
        {pageType === 'product' && onExampleProductChange && (
          <>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              {isLoadingProducts ? (
                <Skeleton className="h-9 w-[180px]" />
              ) : (
                <Select value={exampleProductId || ''} onValueChange={onExampleProductChange}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Produto exemplo" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                    {(!products || products.length === 0) && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Nenhum produto encontrado
                      </div>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          </>
        )}

        {/* Example Category Selector - Only for Category template */}
        {pageType === 'category' && onExampleCategoryChange && (
          <>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              {isLoadingCategories ? (
                <Skeleton className="h-9 w-[180px]" />
              ) : (
                <Select value={exampleCategoryId || ''} onValueChange={onExampleCategoryChange}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Categoria exemplo" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                    {(!categories || categories.length === 0) && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Nenhuma categoria encontrada
                      </div>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          </>
        )}

        {/* Dirty indicator */}
        {isDirty && (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
            Alterações não salvas
          </Badge>
        )}
      </div>

      {/* Center: Undo/Redo */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onUndo}
          disabled={!canUndo || isPreviewMode}
          title="Desfazer (Ctrl+Z)"
          className="h-8 w-8"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRedo}
          disabled={!canRedo || isPreviewMode}
          title="Refazer (Ctrl+Y)"
          className="h-8 w-8"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Preview Button */}
        <Button
          variant={isPreviewMode ? 'default' : 'outline'}
          size="sm"
          onClick={onTogglePreview}
          className="gap-1"
        >
          <Eye className="h-4 w-4" />
          <span className="hidden sm:inline">
            {isPreviewMode ? 'Sair Preview' : 'Preview'}
          </span>
        </Button>

        {/* Open in new tab */}
        {tenantSlug && (
          <Button
            variant="outline"
            size="icon"
            onClick={handleOpenPreview}
            title="Abrir preview em nova aba"
            className="h-9 w-9"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}

        {/* Save */}
        <Button
          variant="outline"
          size="sm"
          onClick={onSave}
          disabled={!isDirty || isSaving}
          className="gap-1"
        >
          <Save className="h-4 w-4" />
          <span className="hidden sm:inline">
            {isSaving ? 'Salvando...' : 'Salvar'}
          </span>
        </Button>

        {/* Publish with confirmation */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" disabled={isPublishing} className="gap-1">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">
                {isPublishing ? 'Publicando...' : 'Publicar'}
              </span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Publicar alterações?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso tornará as alterações visíveis para todos os visitantes da loja.
                O conteúdo atual será substituído pelo novo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onPublish}>
                Sim, publicar agora
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* More options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {onViewHistory && (
              <DropdownMenuItem onClick={onViewHistory}>
                <History className="h-4 w-4 mr-2" />
                Ver histórico
              </DropdownMenuItem>
            )}
            {onReset && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onReset} className="text-destructive">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Resetar para padrão
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
