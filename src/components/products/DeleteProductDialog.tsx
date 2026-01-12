import { useState, useEffect } from 'react';
import { AlertTriangle, ShoppingBag, Package, Link2, Image, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { coreProductsApi, ProductDependencies } from '@/lib/coreApi';

interface DeleteProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string | null;
  productName?: string;
  onConfirm: () => void;
}

export function DeleteProductDialog({
  open,
  onOpenChange,
  productId,
  productName,
  onConfirm,
}: DeleteProductDialogProps) {
  const [dependencies, setDependencies] = useState<ProductDependencies | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && productId) {
      setLoading(true);
      coreProductsApi.checkDependencies(productId).then((result) => {
        if (result.success && result.data) {
          setDependencies(result.data);
        }
        setLoading(false);
      });
    } else {
      setDependencies(null);
    }
  }, [open, productId]);

  const hasDependencies = dependencies?.has_dependencies;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Excluir produto permanentemente?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Verificando vínculos...</span>
                </div>
              ) : (
                <>
                  <p className="text-sm">
                    Você está prestes a excluir <strong>{productName || 'este produto'}</strong> permanentemente.
                  </p>

                  {hasDependencies && (
                    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-3">
                      <p className="font-semibold text-destructive text-sm">
                        ⚠️ ATENÇÃO: Este produto aparece em pedidos existentes:
                      </p>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                          <ShoppingBag className="h-4 w-4 text-destructive" />
                          <span>
                            <strong>{dependencies.orders.count}</strong> pedido(s) contêm este produto
                            {dependencies.orders.affected_customers > 0 && (
                              <> ({dependencies.orders.affected_customers} cliente(s) afetados)</>
                            )}
                          </span>
                        </li>
                      </ul>
                      <p className="text-xs text-muted-foreground mt-2">
                        Os pedidos serão mantidos, mas o produto aparecerá como "[Excluído] {productName}".
                      </p>
                    </div>
                  )}

                  {(dependencies?.component_of.count || 0) > 0 && (
                    <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
                      <p className="text-sm flex items-center gap-2">
                        <Package className="h-4 w-4 text-amber-600" />
                        Este produto é componente de <strong>{dependencies?.component_of.count}</strong> kit(s)/combo(s)
                      </p>
                    </div>
                  )}

                  {(dependencies?.related_products.count || 0) > 0 && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      {dependencies?.related_products.count} produto(s) relacionado(s) serão desvinculados
                    </p>
                  )}

                  {(dependencies?.images.count || 0) > 0 && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      {dependencies?.images.count} imagem(ns) serão excluídas
                    </p>
                  )}

                  <p className="text-sm font-medium text-destructive">
                    Esta ação é IRREVERSÍVEL. O produto será excluído permanentemente.
                  </p>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm} 
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={loading}
          >
            Sim, excluir permanentemente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
