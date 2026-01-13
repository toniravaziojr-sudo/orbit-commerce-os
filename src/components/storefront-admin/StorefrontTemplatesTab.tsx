import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useStorefrontTemplates } from '@/hooks/useBuilderData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutTemplate, 
  Sparkles,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Globe,
  Pencil,
  Eye
} from 'lucide-react';
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
import { toast } from 'sonner';
import { getPublicHomeUrl } from '@/lib/publicUrls';

export function StorefrontTemplatesTab() {
  const { currentTenant } = useAuth();
  const { settings } = useStoreSettings();
  const { data: templates } = useStorefrontTemplates();
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showBlankDialog, setShowBlankDialog] = useState(false);
  
  // Find the home template to check if it has been published
  const homeTemplate = templates?.find(t => t.page_type === 'home');
  const hasPublishedVersion = homeTemplate?.published_version != null && homeTemplate.published_version > 0;
  const hasDraftVersion = homeTemplate?.draft_version != null && homeTemplate.draft_version > 0;
  
  // Consider store as having template if:
  // 1. Has published_version > 0, OR
  // 2. Store is published (is_published = true), OR
  // 3. Template exists (was initialized)
  const hasExistingTemplate = hasPublishedVersion || settings?.is_published || !!homeTemplate;
  const hasDraft = hasDraftVersion;
  
  // Get template name based on published status
  const getCurrentTemplateName = () => {
    if (!homeTemplate) return null;
    // If store is published, assume template is in use
    if (settings?.is_published || hasPublishedVersion) {
      return 'Template Cosméticos';
    } else if (hasDraft) {
      return 'Rascunho';
    } else if (homeTemplate) {
      return 'Template Padrão';
    }
    return null;
  };
  
  const currentTemplateName = getCurrentTemplateName();
  
  const lastEdited = homeTemplate?.updated_at 
    ? new Date(homeTemplate.updated_at).toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : settings?.updated_at 
    ? new Date(settings.updated_at).toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;
    
  const previewUrl = getPublicHomeUrl(currentTenant?.slug || '', true);

  const handleApplyTemplate = () => {
    // For now, just navigate to builder with template
    toast.success('Template aplicado! Abrindo o editor...');
    setShowTemplateDialog(false);
    window.location.href = '/storefront/builder?edit=home';
  };

  const handleStartBlank = () => {
    toast.success('Estrutura limpa criada! Abrindo o editor...');
    setShowBlankDialog(false);
    window.location.href = '/storefront/builder?edit=home&blank=true';
  };

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
                <Badge variant={settings?.is_published ? 'default' : 'secondary'}>
                  {settings?.is_published ? 'Publicada' : 'Rascunho'}
                </Badge>
              </div>
              {lastEdited && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Última edição: {lastEdited}</span>
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

      {/* Current Template Card - only show if has published template */}
      {currentTemplateName && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <LayoutTemplate className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Template Atual</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    {currentTemplateName}
                    {settings?.is_published && (
                      <Badge variant="default" className="text-xs">Publicado</Badge>
                    )}
                    {!settings?.is_published && (
                      <Badge variant="secondary" className="text-xs">Rascunho</Badge>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link to="/storefront/builder?edit=home">
                  <Button variant="outline" size="sm">
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                </Link>
                <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm">
                    <Eye className="mr-2 h-4 w-4" />
                    Ver Loja
                  </Button>
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Template Card */}
        <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-colors">
          <div className="absolute top-3 right-3">
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              Recomendado
            </Badge>
          </div>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <LayoutTemplate className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Template Cosméticos</CardTitle>
                <CardDescription>Layout profissional pronto para usar</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cria um layout inicial completo e editável com blocos e seções prontas para loja de cosméticos. 
              Inclui hero banner, vitrines, categorias e muito mais.
            </p>
            <ul className="text-sm space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Home com banner e vitrines</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Páginas de categoria e produto</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Carrinho, checkout e obrigado</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>100% editável no Builder</span>
              </li>
            </ul>
            <Button 
              className="w-full" 
              onClick={() => hasExistingTemplate ? setShowTemplateDialog(true) : handleApplyTemplate()}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {hasExistingTemplate ? 'Trocar Template' : 'Aplicar Template'}
            </Button>
          </CardContent>
        </Card>

        {/* Blank Card */}
        <Card className="border-2 hover:border-muted-foreground/30 transition-colors">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">Iniciar do Zero</CardTitle>
                <CardDescription>Página em branco para criar</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Comece com uma estrutura mínima (apenas header e footer) e adicione os blocos que quiser. 
              Ideal para quem quer controle total do layout.
            </p>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Estrutura mínima</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Header e footer inclusos</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Adicione blocos livremente</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Controle total do design</span>
              </li>
            </ul>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => hasExistingTemplate ? setShowBlankDialog(true) : handleStartBlank()}
            >
              <FileText className="mr-2 h-4 w-4" />
              {hasExistingTemplate ? 'Reiniciar do Zero' : 'Criar do Zero'}
            </Button>
          </CardContent>
        </Card>
      </div>

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
                Escolha um template ou comece do zero. Depois, use o <strong>Editor Visual</strong> para 
                personalizar cada página: Home, Categoria, Produto, Carrinho, Checkout, Obrigado, Blog e Rastreio.
                A seleção de páginas é feita dentro do editor através do menu dropdown.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Replace Template Dialog */}
      <AlertDialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Trocar Template
            </AlertDialogTitle>
            <AlertDialogDescription>
              Isso substituirá o layout atual da sua loja pelo template selecionado. 
              Suas configurações (logo, cores, contato) serão mantidas, mas os blocos e seções 
              personalizados serão substituídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleApplyTemplate}>
              Aplicar Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Start Blank Dialog */}
      <AlertDialog open={showBlankDialog} onOpenChange={setShowBlankDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Reiniciar do Zero
            </AlertDialogTitle>
            <AlertDialogDescription>
              Isso removerá todo o conteúdo atual das páginas da loja, mantendo apenas a estrutura 
              básica (header e footer). Suas configurações serão mantidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleStartBlank} className="bg-destructive hover:bg-destructive/90">
              Reiniciar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
