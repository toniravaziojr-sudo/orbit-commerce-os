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
      <AlertDialogContent className="!max-w-lg !bg-white !text-slate-900 !border-slate-200">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 !text-slate-900">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Alterações não salvas
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left !text-slate-600">
            Você tem alterações que ainda não foram salvas. O que deseja fazer?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="!flex !flex-row !justify-end !gap-2 !space-x-0">
          <AlertDialogCancel asChild>
            <Button 
              variant="outline" 
              size="sm"
              disabled={isSaving}
              className="!bg-white !text-slate-900 !border-slate-300 hover:!bg-slate-100 !px-3"
            >
              Continuar editando
            </Button>
          </AlertDialogCancel>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              onLeaveWithoutSaving();
            }}
            disabled={isSaving}
            className="!gap-1.5 !bg-white !text-red-600 !border-red-300 hover:!bg-red-50 !px-3"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair sem salvar
          </Button>
          <AlertDialogAction asChild>
            <Button
              size="sm"
              onClick={onSaveAndLeave}
              disabled={isSaving}
              className="!gap-1.5 !bg-blue-600 !text-white hover:!bg-blue-700 !px-3"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? 'Salvando...' : 'Salvar e sair'}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
