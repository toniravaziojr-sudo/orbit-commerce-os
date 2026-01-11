import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { FileUsage } from "@/hooks/useFileUsageDetection";

interface DeleteFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  usages: FileUsage[];
  onConfirm: () => void;
  isPending?: boolean;
}

export function DeleteFileDialog({
  open,
  onOpenChange,
  fileName,
  usages,
  onConfirm,
  isPending,
}: DeleteFileDialogProps) {
  const isInUse = usages.length > 0;
  const usageLabels = usages.map((u) => u.label).join(' e ');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isInUse && <AlertTriangle className="h-5 w-5 text-amber-500" />}
            {isInUse ? 'Isso impactará sua loja' : 'Excluir arquivo'}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            {isInUse ? (
              <>
                <p>
                  <strong>Este arquivo está em uso como {usageLabels}.</strong>
                </p>
                <p>
                  Se continuar, a loja ficará sem {usageLabels.toLowerCase()} até você enviar outro arquivo.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Arquivo: {fileName}
                </p>
              </>
            ) : (
              <p>
                Tem certeza que deseja excluir <strong>{fileName}</strong>? Esta ação não pode ser desfeita.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className={isInUse ? 'bg-destructive hover:bg-destructive/90' : ''}
          >
            {isPending ? 'Excluindo...' : isInUse ? 'Desvincular e excluir' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
