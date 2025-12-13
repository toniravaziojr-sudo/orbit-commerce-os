// =============================================
// BUILDER TOOLBAR - Top toolbar with actions
// =============================================

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Undo2,
  Redo2,
  Save,
  Upload,
  Eye,
  EyeOff,
  MoreVertical,
  RotateCcw,
  History,
  Settings,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

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
  onSettings,
  onBack,
}: BuilderToolbarProps) {
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
  return (
    <div className="h-14 flex items-center justify-between px-4 bg-background border-b">
      {/* Left: Back & Title */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Voltar
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <div>
          <h2 className="font-semibold text-sm flex items-center gap-2">
            {pageTitle}
            {isDirty && <span className="text-destructive">•</span>}
          </h2>
          <p className="text-xs text-muted-foreground capitalize">{pageType}</p>
        </div>
        <Badge variant="outline" className="text-xs">
          {isPreviewMode ? 'Preview' : 'Editando'}
        </Badge>
      </div>

      {/* Center: History Controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onUndo}
          disabled={!canUndo || isPreviewMode}
          title="Desfazer (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRedo}
          disabled={!canRedo || isPreviewMode}
          title="Refazer (Ctrl+Shift+Z)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onTogglePreview}
          className={cn(isPreviewMode && 'bg-primary text-primary-foreground hover:bg-primary/90')}
        >
          {isPreviewMode ? (
            <>
              <EyeOff className="h-4 w-4 mr-1" />
              Sair Preview
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </>
          )}
        </Button>

        {tenantSlug && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenPreview}
            title="Abrir preview em nova aba"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Abrir
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onSave}
          disabled={!isDirty || isSaving}
        >
          <Save className="h-4 w-4 mr-1" />
          {isSaving ? 'Salvando...' : 'Salvar'}
        </Button>

        <Button
          size="sm"
          onClick={onPublish}
          disabled={isPublishing}
        >
          <Upload className="h-4 w-4 mr-1" />
          {isPublishing ? 'Publicando...' : 'Publicar'}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onReset && (
              <DropdownMenuItem onClick={onReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Resetar para padrão
              </DropdownMenuItem>
            )}
            {onViewHistory && (
              <DropdownMenuItem onClick={onViewHistory}>
                <History className="h-4 w-4 mr-2" />
                Ver histórico
              </DropdownMenuItem>
            )}
            {onSettings && (
              <DropdownMenuItem onClick={onSettings}>
                <Settings className="h-4 w-4 mr-2" />
                Configurações
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
