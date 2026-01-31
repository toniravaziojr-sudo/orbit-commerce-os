// =============================================
// BLOCK QUICK ACTIONS - Hover actions for blocks
// Responsive: popover no mobile, barra lateral no desktop
// =============================================

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, Copy, Trash2, Eye, EyeOff, Lock, MoreVertical } from 'lucide-react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

type ViewportSize = 'desktop' | 'tablet' | 'mobile';

interface BlockQuickActionsProps {
  blockId: string;
  blockType: string;
  isRemovable: boolean;
  isEssential?: boolean;
  essentialReason?: string;
  isHidden?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleHidden?: () => void;
  viewport?: ViewportSize;
}

// Componente de ações reutilizável
function ActionButtons({
  isRemovable,
  isEssential,
  essentialReason,
  isHidden,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onToggleHidden,
  isMobile = false,
}: Omit<BlockQuickActionsProps, 'blockId' | 'blockType' | 'viewport'> & { isMobile?: boolean }) {
  const buttonSize = isMobile ? "h-9 w-9" : "h-7 w-7";
  const iconSize = isMobile ? "h-5 w-5" : "h-4 w-4";

  return (
    <>
      {/* Move Up */}
      <Button
        variant="ghost"
        size="icon"
        className={buttonSize}
        onClick={onMoveUp}
        disabled={!canMoveUp}
        title="Mover para cima"
      >
        <ChevronUp className={iconSize} />
      </Button>

      {/* Move Down */}
      <Button
        variant="ghost"
        size="icon"
        className={buttonSize}
        onClick={onMoveDown}
        disabled={!canMoveDown}
        title="Mover para baixo"
      >
        <ChevronDown className={iconSize} />
      </Button>

      {/* Toggle Hidden */}
      {onToggleHidden && (
        <Button
          variant="ghost"
          size="icon"
          className={buttonSize}
          onClick={onToggleHidden}
          title={isHidden ? "Mostrar bloco" : "Ocultar bloco"}
        >
          {isHidden ? <EyeOff className={iconSize} /> : <Eye className={iconSize} />}
        </Button>
      )}

      {/* Duplicate - only for non-essential, removable blocks */}
      {isRemovable && !isEssential && (
        <Button
          variant="ghost"
          size="icon"
          className={buttonSize}
          onClick={onDuplicate}
          title="Duplicar"
        >
          <Copy className={iconSize} />
        </Button>
      )}

      {/* Essential/Required block indicator */}
      {isEssential && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn(buttonSize, "flex items-center justify-center text-amber-600 dark:text-amber-400")}>
                <Lock className={iconSize} />
              </div>
            </TooltipTrigger>
            <TooltipContent side={isMobile ? "top" : "left"} className="max-w-[240px]">
              <div className="space-y-1">
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  🔒 Estrutura obrigatória
                </p>
                <p className="text-xs text-muted-foreground">
                  {essentialReason || 'Este bloco é necessário para o funcionamento da página e não pode ser removido.'}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Delete with confirmation - only for non-essential, removable blocks */}
      {isRemovable && !isEssential && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(buttonSize, "text-destructive hover:text-destructive hover:bg-destructive/10")}
              title="Remover"
            >
              <Trash2 className={iconSize} />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover bloco?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O bloco será removido permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

export function BlockQuickActions({
  blockType,
  isRemovable,
  isEssential = false,
  essentialReason,
  isHidden = false,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onToggleHidden,
  viewport = 'desktop',
}: BlockQuickActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Don't show actions for Page block
  if (blockType === 'Page') return null;

  const isMobileViewport = viewport === 'mobile';

  // Mobile: Popover com botão de 3 pontos no canto superior direito
  if (isMobileViewport) {
    return (
      <div 
        className="absolute top-2 right-2 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-full shadow-md bg-background/95 backdrop-blur-sm border"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            side="left" 
            align="start"
            className="w-auto p-1"
            sideOffset={8}
          >
            <div className="flex flex-row gap-0.5">
              <ActionButtons
                isRemovable={isRemovable}
                isEssential={isEssential}
                essentialReason={essentialReason}
                isHidden={isHidden}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                onMoveUp={() => { onMoveUp(); setIsOpen(false); }}
                onMoveDown={() => { onMoveDown(); setIsOpen(false); }}
                onDuplicate={() => { onDuplicate(); setIsOpen(false); }}
                onDelete={onDelete}
                onToggleHidden={onToggleHidden ? () => { onToggleHidden(); setIsOpen(false); } : undefined}
                isMobile={true}
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // Desktop/Tablet: Barra no canto superior direito do bloco (dentro do container)
  return (
    <div 
      className={cn(
        "absolute right-2 top-2 z-20",
        "flex flex-row gap-0.5 p-1 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg",
        "opacity-100 transition-opacity"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <ActionButtons
        isRemovable={isRemovable}
        isEssential={isEssential}
        essentialReason={essentialReason}
        isHidden={isHidden}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onToggleHidden={onToggleHidden}
        isMobile={false}
      />
    </div>
  );
}
