import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Layers, Loader2, Globe, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImportPageStructureDialogProps {
  tenantId: string;
  onSuccess: () => void;
}

export function ImportPageStructureDialog({ tenantId, onSuccess }: ImportPageStructureDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [slugOverride, setSlugOverride] = useState('');
  const [createAsDraft, setCreateAsDraft] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    pageTitle?: string;
    blocksCount?: number;
  } | null>(null);

  const isValidUrl = (urlString: string) => {
    try {
      const urlObj = new URL(urlString);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const cleanUrl = (urlString: string): string => {
    try {
      const urlObj = new URL(urlString);
      const paramsToRemove = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
        'fbclid', 'gclid', 'ref', 'source', 'mc_cid', 'mc_eid'
      ];
      paramsToRemove.forEach(param => urlObj.searchParams.delete(param));
      return urlObj.toString();
    } catch {
      return urlString;
    }
  };

  const extractSlugFromUrl = (urlString: string): string => {
    try {
      const urlObj = new URL(urlString);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      const lastPart = pathParts[pathParts.length - 1] || 'pagina-importada';
      
      return lastPart
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        + '-estrutura'; // Suffix to avoid collision
    } catch {
      return 'pagina-importada-estrutura';
    }
  };

  const handleImport = async () => {
    if (!isValidUrl(url)) {
      toast.error('URL inválida');
      return;
    }

    setIsImporting(true);
    setResult(null);

    try {
      const cleanedUrl = cleanUrl(url);
      const finalSlug = slugOverride.trim() || extractSlugFromUrl(cleanedUrl);

      const { data, error } = await supabase.functions.invoke('import-pages-structure', {
        body: {
          tenantId,
          url: cleanedUrl,
          slug: finalSlug,
          createAsDraft,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.success) {
        setResult({
          success: true,
          message: 'Página criada com sucesso usando blocos nativos!',
          pageTitle: data.pageTitle,
          blocksCount: data.blocksCount,
        });
        toast.success('Página importada por estrutura!');
        onSuccess();
      } else {
        throw new Error(data?.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Error importing page by structure:', error);
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
    setSlugOverride('');
    setCreateAsDraft(true);
    setResult(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleClose();
      else setIsOpen(true);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Layers className="mr-2 h-4 w-4" />
          Importar Estrutura
          <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">Beta</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Importar por Estrutura
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">
              <strong>Modo Estrutura:</strong> Extrai a estrutura e conteúdo (textos, imagens, vídeos, botões) 
              e recria a página usando <strong>blocos 100% editáveis</strong> do Comando Central.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              O visual será similar, não idêntico — mas totalmente personalizável no editor.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="structure-url">URL de Referência</Label>
            <Input
              id="structure-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://exemplo.com.br/pagina-de-referencia"
              disabled={isImporting}
            />
            {url && !isValidUrl(url) && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                URL inválida
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="structure-slug">Slug (opcional)</Label>
            <Input
              id="structure-slug"
              value={slugOverride}
              onChange={(e) => setSlugOverride(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder={url ? extractSlugFromUrl(url) : 'deixe vazio para auto-gerar'}
              disabled={isImporting}
            />
            <p className="text-xs text-muted-foreground">
              URL final: /page/{slugOverride || (url ? extractSlugFromUrl(url) : 'slug')}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="create-draft"
              checked={createAsDraft}
              onCheckedChange={(checked) => setCreateAsDraft(checked === true)}
              disabled={isImporting}
            />
            <Label htmlFor="create-draft" className="text-sm cursor-pointer">
              Criar como rascunho (recomendado)
            </Label>
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
                {result.blocksCount && (
                  <p className="text-xs mt-0.5 opacity-80">{result.blocksCount} blocos criados</p>
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
                    Processando...
                  </>
                ) : (
                  <>
                    <Layers className="mr-2 h-4 w-4" />
                    Importar Estrutura
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
