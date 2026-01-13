import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useTemplateSets } from '@/hooks/useTemplatesSets';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutTemplate, 
  Sparkles,
  FileText,
  CheckCircle2,
  Clock,
  Globe,
  Pencil,
  Eye,
  Copy,
  Trash2,
  MoreVertical,
  Plus,
  ExternalLink,
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

  const previewUrl = getPublicHomeUrl(currentTenant?.slug || '', true);

  const handleCreateTemplate = async (name: string) => {
    if (!createPreset) return;
    const result = await createTemplate.mutateAsync({ name, basePreset: createPreset });
    setCreatePreset(null);
    // Navigate to editor with new template
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Store Status Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Status:</span>
                <Badge variant={isStorePublished ? 'default' : 'secondary'}>
                  {isStorePublished ? 'Publicada' : 'Rascunho'}
                </Badge>
              </div>
              {publishedTemplate && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    Última edição: {formatDistanceToNow(new Date(publishedTemplate.last_edited_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </div>
              )}
            </div>
            {currentTenant?.slug && (
              <div className="text-sm text-muted-foreground">
                Domínio: <span className="font-mono">{currentTenant.slug}.comandocentral.com.br</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Published Template Section */}
      {publishedTemplate && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Template Publicado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <LayoutTemplate className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{publishedTemplate.name}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Badge variant="default" className="text-xs bg-emerald-500">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Ativo
                    </Badge>
                    {publishedTemplate.base_preset === 'cosmetics' && (
                      <span className="text-xs">• Template Cosméticos</span>
                    )}
                    {publishedTemplate.base_preset === 'blank' && (
                      <span className="text-xs">• Criado do zero</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleEditTemplate(publishedTemplate.id)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
                <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Ver Loja
                  </Button>
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates List Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Meus Templates</CardTitle>
              <CardDescription>
                Gerencie seus templates de loja. Cada template é independente.
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Template
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setCreatePreset('cosmetics')}>
                  <LayoutTemplate className="mr-2 h-4 w-4" />
                  Template Cosméticos
                  <Badge variant="secondary" className="ml-2 text-xs">Recomendado</Badge>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCreatePreset('blank')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Iniciar do Zero
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <LayoutTemplate className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">Nenhum template ainda</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crie seu primeiro template para começar a construir sua loja.
              </p>
              <div className="flex justify-center gap-2">
                <Button onClick={() => setCreatePreset('cosmetics')}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Template Cosméticos
                </Button>
                <Button variant="outline" onClick={() => setCreatePreset('blank')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Iniciar do Zero
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border">
              {templates.map((template) => {
                const isPublished = template.id === publishedTemplateId;
                const hasPublishedContent = !!template.published_content;

                return (
                  <div 
                    key={template.id}
                    className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isPublished ? 'bg-primary/10' : 'bg-muted'}`}>
                        <LayoutTemplate className={`h-5 w-5 ${isPublished ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          {template.name}
                          {isPublished && (
                            <Badge variant="default" className="text-xs bg-emerald-500">
                              Publicado
                            </Badge>
                          )}
                          {!isPublished && hasPublishedContent && (
                            <Badge variant="secondary" className="text-xs">
                              Já foi publicado
                            </Badge>
                          )}
                          {!isPublished && !hasPublishedContent && (
                            <Badge variant="outline" className="text-xs">
                              Rascunho
                            </Badge>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {template.base_preset === 'cosmetics' ? 'Template Cosméticos' : 'Criado do zero'}
                          {' · '}
                          Editado {formatDistanceToNow(new Date(template.last_edited_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEditTemplate(template.id)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditTemplate(template.id)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setRenameTarget({ id: template.id, name: template.name })}>
                            <FileText className="mr-2 h-4 w-4" />
                            Renomear
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicateTemplate(template.id)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {!isPublished && (
                            <DropdownMenuItem onClick={() => setPublishTarget({ id: template.id, name: template.name })}>
                              <Globe className="mr-2 h-4 w-4" />
                              Definir como publicado
                            </DropdownMenuItem>
                          )}
                          {!isPublished && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => setDeleteTarget({ id: template.id, name: template.name })}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-full bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Como funciona?</p>
              <p className="text-sm text-muted-foreground">
                Crie quantos templates quiser — cada um é independente. Use o <strong>Editor Visual</strong> para 
                personalizar cada página: Home, Categoria, Produto, Carrinho, Checkout, Obrigado, Blog e Rastreio.
                Ao publicar um template, ele se torna a versão ativa da sua loja.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
