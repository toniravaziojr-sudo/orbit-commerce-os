import { useState, useEffect } from 'react';
import { AlertTriangle, ShoppingBag, MessageSquare, MapPin, StickyNote, Tag, Loader2 } from 'lucide-react';
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
import { coreCustomersApi, CustomerDependencies } from '@/lib/coreApi';

interface DeleteCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string | null;
  customerName?: string;
  onConfirm: () => void;
}

export function DeleteCustomerDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  onConfirm,
}: DeleteCustomerDialogProps) {
  const [dependencies, setDependencies] = useState<CustomerDependencies | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && customerId) {
      setLoading(true);
      coreCustomersApi.checkDependencies(customerId).then((result) => {
        if (result.success && result.data) {
          setDependencies(result.data);
        }
        setLoading(false);
      });
    } else {
      setDependencies(null);
    }
  }, [open, customerId]);

  const hasDependencies = dependencies?.has_dependencies;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Excluir cliente permanentemente?
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
                    Você está prestes a excluir <strong>{customerName || 'este cliente'}</strong> permanentemente.
                  </p>

                  {hasDependencies && (
                    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-3">
                      <p className="font-semibold text-destructive text-sm">
                        ⚠️ ATENÇÃO: Este cliente possui dados vinculados que serão EXCLUÍDOS:
                      </p>
                      <ul className="space-y-2 text-sm">
                        {dependencies.orders.count > 0 && (
                          <li className="flex items-center gap-2">
                            <ShoppingBag className="h-4 w-4 text-destructive" />
                            <span><strong>{dependencies.orders.count}</strong> pedido(s) serão excluídos permanentemente</span>
                          </li>
                        )}
                        {dependencies.conversations.count > 0 && (
                          <li className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            <span>{dependencies.conversations.count} conversa(s) perderão vínculo</span>
                          </li>
                        )}
                        {dependencies.addresses.count > 0 && (
                          <li className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{dependencies.addresses.count} endereço(s)</span>
                          </li>
                        )}
                        {dependencies.notes.count > 0 && (
                          <li className="flex items-center gap-2">
                            <StickyNote className="h-4 w-4 text-muted-foreground" />
                            <span>{dependencies.notes.count} nota(s)</span>
                          </li>
                        )}
                        {dependencies.tags.count > 0 && (
                          <li className="flex items-center gap-2">
                            <Tag className="h-4 w-4 text-muted-foreground" />
                            <span>{dependencies.tags.count} tag(s)</span>
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  <p className="text-sm font-medium text-destructive">
                    Esta ação é IRREVERSÍVEL. Todos os dados serão perdidos permanentemente.
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
