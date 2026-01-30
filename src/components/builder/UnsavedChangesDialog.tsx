// =============================================
// UNSAVED CHANGES DIALOG - Confirmation dialog for leaving builder with unsaved changes
// =============================================

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
import { Button } from '@/components/ui/button';
import { Save, LogOut, AlertTriangle } from 'lucide-react';

interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveAndLeave: () => void;
  onLeaveWithoutSaving: () => void;
  isSaving?: boolean;
}

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onSaveAndLeave,
  onLeaveWithoutSaving,
  isSaving = false,
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Alterações não salvas
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            Você tem alterações que ainda não foram salvas. O que deseja fazer?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel disabled={isSaving}>
            Continuar editando
          </AlertDialogCancel>
          <Button
            variant="outline"
            onClick={onLeaveWithoutSaving}
            disabled={isSaving}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sair sem salvar
          </Button>
          <Button
            onClick={onSaveAndLeave}
            disabled={isSaving}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Salvando...' : 'Salvar e sair'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
