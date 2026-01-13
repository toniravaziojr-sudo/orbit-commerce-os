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
import { AlertTriangle, Globe } from 'lucide-react';

interface PublishTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  templateName: string;
  isStorePublished: boolean;
  isLoading?: boolean;
}

export function PublishTemplateDialog({
  open,
  onOpenChange,
  onConfirm,
  templateName,
  isStorePublished,
  isLoading,
}: PublishTemplateDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isStorePublished ? (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            ) : (
              <Globe className="h-5 w-5 text-primary" />
            )}
            Definir como Template Publicado
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Você está prestes a definir <strong>"{templateName}"</strong> como o template ativo da sua loja.
            </p>
            {isStorePublished ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mt-3">
                <p className="text-amber-600 dark:text-amber-400 text-sm font-medium">
                  ⚠️ Sua loja está publicada
                </p>
                <p className="text-amber-600/80 dark:text-amber-400/80 text-sm mt-1">
                  Esta alteração será visível imediatamente para todos os visitantes da sua loja.
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Como sua loja ainda não está publicada, apenas você poderá visualizar as alterações.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Publicando...' : 'Confirmar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
