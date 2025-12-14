// =============================================
// BLOCK QUICK ACTIONS - Hover actions for blocks
// =============================================

import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, Copy, Trash2, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
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

interface BlockQuickActionsProps {
  blockId: string;
  blockType: string;
  isRemovable: boolean;
  isHidden?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleHidden?: () => void;
}

export function BlockQuickActions({
  blockType,
  isRemovable,
  isHidden = false,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onToggleHidden,
}: BlockQuickActionsProps) {
  // Don't show actions for Page block
  if (blockType === 'Page') return null;

  return (
    <div 
      className={cn(
        "absolute -right-1 top-1/2 -translate-y-1/2 translate-x-full",
        "flex flex-col gap-1 p-1 bg-background border rounded-lg shadow-lg z-20",
        "opacity-100 transition-opacity"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Move Up */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onMoveUp}
        disabled={!canMoveUp}
        title="Mover para cima"
      >
        <ChevronUp className="h-4 w-4" />
      </Button>

      {/* Move Down */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onMoveDown}
        disabled={!canMoveDown}
        title="Mover para baixo"
      >
        <ChevronDown className="h-4 w-4" />
      </Button>

      {/* Toggle Hidden */}
      {onToggleHidden && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onToggleHidden}
          title={isHidden ? "Mostrar bloco" : "Ocultar bloco"}
        >
          {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      )}

      {/* Duplicate */}
      {isRemovable && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onDuplicate}
          title="Duplicar"
        >
          <Copy className="h-4 w-4" />
        </Button>
      )}

      {/* Delete with confirmation */}
      {isRemovable && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Remover"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover bloco?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O bloco será removido permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>Remover</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
