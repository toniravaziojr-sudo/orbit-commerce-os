import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useTemplateSets } from '@/hooks/useTemplatesSets';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutTemplate, 
  Sparkles,
  FileText,
  Clock,
  Eye,
  Copy,
  Trash2,
  MoreVertical,
  ExternalLink,
  Play,
} from 'lucide-react';
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
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getPublicHomeUrl } from '@/lib/publicUrls';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { CreateTemplateDialog } from './CreateTemplateDialog';
import { RenameTemplateDialog } from './RenameTemplateDialog';
import { PublishTemplateDialog } from './PublishTemplateDialog';

// Preset thumbnails - ilustrações estáticas para cada tipo de template
const PRESET_THUMBNAILS: Record<string, string> = {
  cosmetics: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&h=400&fit=crop&q=80',
  blank: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&h=400&fit=crop&q=80',
  custom: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop&q=80',
};

const PRESET_INFO = {
  cosmetics: {
    name: 'Template Cosméticos',
    description: 'Template elegante para lojas de beleza e cosméticos, com seções para produtos em destaque, categorias e promoções.',
    badge: 'Recomendado',
    badgeVariant: 'default' as const,
  },
  blank: {
    name: 'Iniciar do Zero',
    description: 'Comece com uma estrutura limpa e personalize completamente sua loja do jeito que quiser.',
    badge: 'Novo',
    badgeVariant: 'secondary' as const,
  },
};

export function StorefrontTemplatesTab() {
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const { settings } = useStoreSettings();
  const { 
    templates, 
    publishedTemplateId, 
    publishedTemplate,
    isStorePublished,
    isLoading,
    createTemplate,
    renameTemplate,
    duplicateTemplate,
    deleteTemplate,
    setPublishedTemplate,
  } = useTemplateSets();

  // Dialog states
  const [createPreset, setCreatePreset] = useState<'cosmetics' | 'blank' | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [publishTarget, setPublishTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const storeUrl = getPublicHomeUrl(currentTenant?.slug || '', false);
  const previewUrl = getPublicHomeUrl(currentTenant?.slug || '', true);

  const handleCreateTemplate = async (name: string) => {
    if (!createPreset) return;
    const result = await createTemplate.mutateAsync({ name, basePreset: createPreset });
    setCreatePreset(null);
    navigate(`/storefront/builder?templateId=${result.id}&edit=home`);
  };

  const handleRenameTemplate = async (newName: string) => {
    if (!renameTarget) return;
    await renameTemplate.mutateAsync({ templateId: renameTarget.id, newName });
    setRenameTarget(null);
  };

  const handlePublishTemplate = async () => {
    if (!publishTarget) return;
    await setPublishedTemplate.mutateAsync(publishTarget.id);
    setPublishTarget(null);
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTarget) return;
    await deleteTemplate.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleDuplicateTemplate = async (templateId: string) => {
    await duplicateTemplate.mutateAsync(templateId);
  };

  const handleEditTemplate = (templateId: string) => {
    navigate(`/storefront/builder?templateId=${templateId}&edit=home`);
  };

  const handlePreviewTemplate = (templateId: string) => {
    navigate(`/storefront/builder?templateId=${templateId}&edit=home&mode=preview`);
  };

  // Templates que NÃO são o publicado
  const otherTemplates = templates.filter((t) => t.id !== publishedTemplateId);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
        <Skeleton className="h-[400px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="text-2xl font-semibold tracking-tight">Temas</h2>
        <a 
          href={storeUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Eye className="h-4 w-4" />
          Ver minha loja virtual
        </a>
      </div>

      {/* Botão Personalizar Loja - Acima do tema ativo */}
      {publishedTemplate && (
        <div className="flex justify-end">
          <Button 
            onClick={() => navigate(`/storefront/builder?templateId=${publishedTemplate.id}&edit=home`)}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Personalizar loja
          </Button>
        </div>
      )}

      {/* Seção A: Tema Ativo */}
      <section className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start">
        {/* Coluna esquerda - Info */}
        <div className="space-y-3">
          <h3 className="text-lg font-medium">Tema ativo na loja virtual</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Este é o tema que seus clientes verão quando visitarem a sua loja.
          </p>
          <a 
            href="#" 
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Play className="h-4 w-4" />
            Veja como configurar o tema da sua loja
          </a>
        </div>

        {/* Coluna direita - Card do tema ativo */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          {publishedTemplate ? (
            <>
              {/* Header do card - nome + badge */}
              <div className="flex items-center justify-between p-5 border-b bg-muted/30">
                <div className="flex items-center gap-3">
                  <h4 className="text-lg font-semibold">{publishedTemplate.name}</h4>
                  <Badge className="bg-emerald-500 text-white">Ativo</Badge>
                </div>
              </div>

              {/* Preview do template */}
              <div className="relative aspect-[16/9] bg-muted">
                <img 
                  src={PRESET_THUMBNAILS[publishedTemplate.base_preset] || PRESET_THUMBNAILS.custom}
                  alt={`Preview do ${publishedTemplate.name}`}
                  className="w-full h-full object-cover"
                />
                {/* Overlay com info de edição */}
                {publishedTemplate.last_edited_at && (
                  <div className="absolute bottom-4 right-4">
                    <span className="text-xs text-white/90 bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
                      Editado {formatDistanceToNow(new Date(publishedTemplate.last_edited_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* Preview devices (simulação visual igual Yampi) */}
              <div className="p-4 bg-muted/20 border-t flex items-center justify-center gap-4">
                <div className="w-48 h-28 rounded-lg border bg-card shadow-sm overflow-hidden">
                  <img 
                    src={PRESET_THUMBNAILS[publishedTemplate.base_preset] || PRESET_THUMBNAILS.custom}
                    alt="Desktop preview"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div className="w-16 h-28 rounded-lg border bg-card shadow-sm overflow-hidden">
                  <img 
                    src={PRESET_THUMBNAILS[publishedTemplate.base_preset] || PRESET_THUMBNAILS.custom}
                    alt="Mobile preview"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center border-2 border-dashed border-primary/30 rounded-lg bg-primary/5">
              <LayoutTemplate className="h-16 w-16 text-primary/50 mx-auto mb-4" />
              <h4 className="font-medium text-lg mb-2">Selecione abaixo o template para a sua loja virtual</h4>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Escolha um dos temas disponíveis para começar a personalizar sua loja.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Seção B: Outros Temas */}
      <section className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start">
        {/* Coluna esquerda - Info */}
        <div className="space-y-3">
          <h3 className="text-lg font-medium">Outros temas</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Você pode escolher outros temas para personalizar a sua loja.
          </p>
        </div>

        {/* Coluna direita - Grid de temas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Templates existentes do tenant (que não são o publicado) */}
          {otherTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              name={template.name}
              thumbnail={PRESET_THUMBNAILS[template.base_preset] || PRESET_THUMBNAILS.custom}
              editedAt={template.last_edited_at}
              badge={template.published_content ? 'Já publicado' : undefined}
              badgeVariant="secondary"
              onPreview={() => handlePreviewTemplate(template.id)}
              onInstall={() => setPublishTarget({ id: template.id, name: template.name })}
              menuActions={[
                { label: 'Renomear', icon: FileText, onClick: () => setRenameTarget({ id: template.id, name: template.name }) },
                { label: 'Duplicar', icon: Copy, onClick: () => handleDuplicateTemplate(template.id) },
                { label: 'Excluir', icon: Trash2, onClick: () => setDeleteTarget({ id: template.id, name: template.name }), destructive: true },
              ]}
            />
          ))}

          {/* Presets disponíveis para criar novos templates - sempre disponíveis para criar mais templates */}
          <PresetCard
            name={PRESET_INFO.cosmetics.name}
            description={PRESET_INFO.cosmetics.description}
            thumbnail={PRESET_THUMBNAILS.cosmetics}
            badge={PRESET_INFO.cosmetics.badge}
            badgeVariant={PRESET_INFO.cosmetics.badgeVariant}
            onPreview={() => navigate('/storefront/builder?preset=cosmetics&mode=preview')}
            onInstall={() => setCreatePreset('cosmetics')}
          />

          <PresetCard
            name={PRESET_INFO.blank.name}
            description={PRESET_INFO.blank.description}
            thumbnail={PRESET_THUMBNAILS.blank}
            badge={PRESET_INFO.blank.badge}
            badgeVariant={PRESET_INFO.blank.badgeVariant}
            onPreview={() => navigate('/storefront/builder?preset=blank&mode=preview')}
            onInstall={() => setCreatePreset('blank')}
          />
        </div>
      </section>

      {/* Dialogs */}
      <CreateTemplateDialog
        open={createPreset !== null}
        onOpenChange={(open) => !open && setCreatePreset(null)}
        onConfirm={handleCreateTemplate}
        preset={createPreset || 'blank'}
        isLoading={createTemplate.isPending}
      />

      <RenameTemplateDialog
        open={renameTarget !== null}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        onConfirm={handleRenameTemplate}
        currentName={renameTarget?.name || ''}
        isLoading={renameTemplate.isPending}
      />

      <PublishTemplateDialog
        open={publishTarget !== null}
        onOpenChange={(open) => !open && setPublishTarget(null)}
        onConfirm={handlePublishTemplate}
        templateName={publishTarget?.name || ''}
        isStorePublished={isStorePublished}
        isLoading={setPublishedTemplate.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o template "{deleteTarget?.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteTemplate}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============= Sub-componentes =============

interface TemplateCardProps {
  name: string;
  thumbnail: string;
  editedAt?: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'outline';
  onPreview: () => void;
  onInstall: () => void;
  menuActions?: {
    label: string;
    icon: React.ElementType;
    onClick: () => void;
    destructive?: boolean;
  }[];
}

function TemplateCard({ 
  name, 
  thumbnail, 
  editedAt, 
  badge, 
  badgeVariant = 'secondary',
  onPreview, 
  onInstall,
  menuActions,
}: TemplateCardProps) {
  return (
    <div className="group rounded-xl border bg-card shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Header com nome e menu */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <h4 className="font-medium">{name}</h4>
          {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
        </div>
        {menuActions && menuActions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {menuActions.map((action, index) => (
                <DropdownMenuItem 
                  key={action.label}
                  onClick={action.onClick}
                  className={action.destructive ? 'text-destructive' : undefined}
                >
                  <action.icon className="mr-2 h-4 w-4" />
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Thumbnail */}
      <div className="relative aspect-[4/3] bg-muted">
        <img 
          src={thumbnail}
          alt={`Preview de ${name}`}
          className="w-full h-full object-cover"
        />
        {editedAt && (
          <div className="absolute bottom-2 left-2">
            <span className="text-xs text-white/90 bg-black/50 px-2 py-1 rounded backdrop-blur-sm flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Editado {formatDistanceToNow(new Date(editedAt), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="flex items-center gap-2 p-4 border-t bg-muted/20">
        <Button variant="outline" size="sm" className="flex-1" onClick={onPreview}>
          Ver loja modelo
        </Button>
        <Button size="sm" className="flex-1" onClick={onInstall}>
          Instalar
        </Button>
      </div>
    </div>
  );
}

interface PresetCardProps {
  name: string;
  description: string;
  thumbnail: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'outline';
  onPreview: () => void;
  onInstall: () => void;
}

function PresetCard({
  name, 
  description, 
  thumbnail, 
  badge, 
  badgeVariant = 'secondary',
  onPreview, 
  onInstall,
}: PresetCardProps) {
  return (
    <div className="group rounded-xl border bg-card shadow-sm overflow-hidden hover:shadow-md transition-shadow border-dashed border-primary/30">
      {/* Header com nome */}
      <div className="flex items-center gap-2 p-4 border-b">
        <Sparkles className="h-4 w-4 text-primary" />
        <h4 className="font-medium">{name}</h4>
        {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
      </div>

      {/* Thumbnail */}
      <div className="relative aspect-[4/3] bg-muted">
        <img 
          src={thumbnail}
          alt={`Preview de ${name}`}
          className="w-full h-full object-cover"
        />
        {/* Overlay com gradiente */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-xs text-white/90 line-clamp-2">{description}</p>
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-2 p-4 border-t bg-muted/20">
        <Button variant="outline" size="sm" className="flex-1" onClick={onPreview}>
          Ver loja modelo
        </Button>
        <Button 
          size="sm" 
          className="flex-1" 
          onClick={onInstall}
        >
          Instalar
        </Button>
      </div>
    </div>
  );
}
