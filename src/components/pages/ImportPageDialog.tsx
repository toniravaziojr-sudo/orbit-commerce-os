import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Loader2, Globe, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImportPageDialogProps {
  tenantId: string;
  onSuccess: () => void;
}

export function ImportPageDialog({ tenantId, onSuccess }: ImportPageDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    pageTitle?: string;
  } | null>(null);

  const isValidUrl = (urlString: string) => {
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Clean URL - remove UTM and tracking parameters
  const cleanUrl = (urlString: string): string => {
    try {
      const url = new URL(urlString);
      // Remove common tracking parameters
      const paramsToRemove = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
        'fbclid', 'gclid', 'ref', 'source', 'mc_cid', 'mc_eid'
      ];
      paramsToRemove.forEach(param => url.searchParams.delete(param));
      return url.toString();
    } catch {
      return urlString;
    }
  };

  const extractPageInfo = (urlString: string) => {
    try {
      const url = new URL(urlString);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const lastPart = pathParts[pathParts.length - 1] || 'pagina-importada';
      
      // Clean the slug
      const slug = lastPart
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      
      // Generate a title from slug
      const title = slug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      return { slug, title };
    } catch {
      return { slug: 'pagina-importada', title: 'Página Importada' };
    }
  };

  const handleImport = async () => {
    if (!isValidUrl(url)) {
      toast.error('URL inválida. Insira uma URL válida começando com http:// ou https://');
      return;
    }

    setIsImporting(true);
    setResult(null);

    try {
      // Clean the URL first (remove UTM params)
      const cleanedUrl = cleanUrl(url);
      const pageInfo = extractPageInfo(cleanedUrl);

      // Call the import-pages edge function with a single page
      const { data, error } = await supabase.functions.invoke('import-pages', {
        body: {
          tenantId,
          pages: [{
            title: pageInfo.title,
            slug: pageInfo.slug,
            url: cleanedUrl,
            source: 'global',
          }],
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.success && data?.results) {
        const { imported, skipped, failed, pages } = data.results;
        
        if (imported > 0) {
          const importedPage = pages?.[0];
          setResult({
            success: true,
            message: importedPage?.hasContent 
              ? 'Página importada com sucesso!' 
              : 'Página criada como rascunho (conteúdo não pôde ser extraído automaticamente).',
            pageTitle: importedPage?.title || pageInfo.title,
          });
          toast.success('Página importada com sucesso!');
          onSuccess();
        } else if (skipped > 0) {
          setResult({
            success: false,
            message: 'Esta página já existe na sua loja.',
          });
          toast.warning('Página já existe');
        } else if (failed > 0) {
          const errorMsg = data.results.errors?.[0] || 'Erro ao importar página';
          setResult({
            success: false,
            message: errorMsg,
          });
          toast.error('Erro ao importar página');
        }
      } else {
        throw new Error(data?.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Error importing page:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao importar página',
      });
      toast.error('Erro ao importar página');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setUrl('');
    setResult(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleClose();
      else setIsOpen(true);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Importar Página
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Importar Página de URL
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Insira a URL de uma página externa e nosso sistema fará uma cópia completa do conteúdo, 
            integrando-a às suas Páginas da Loja.
          </p>

          <div className="space-y-2">
            <Label htmlFor="page-url">URL da Página</Label>
            <Input
              id="page-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://exemplo.com.br/sobre-nos"
              disabled={isImporting}
            />
            {url && !isValidUrl(url) && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                URL inválida
              </p>
            )}
          </div>

          {result && (
            <div className={`p-3 rounded-lg flex items-start gap-2 ${
              result.success 
                ? 'bg-green-500/10 text-green-700 dark:text-green-400' 
                : 'bg-destructive/10 text-destructive'
            }`}>
              {result.success ? (
                <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-sm font-medium">{result.message}</p>
                {result.pageTitle && (
                  <p className="text-xs mt-1 opacity-80">Página: {result.pageTitle}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={handleClose} 
              className="flex-1"
              disabled={isImporting}
            >
              {result?.success ? 'Fechar' : 'Cancelar'}
            </Button>
            {!result?.success && (
              <Button 
                onClick={handleImport} 
                disabled={!url || !isValidUrl(url) || isImporting}
                className="flex-1"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Importar
                  </>
                )}
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
            A importação extrai o conteúdo principal da página (textos, imagens, vídeos) 
            e o adapta para o formato do nosso editor visual.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
