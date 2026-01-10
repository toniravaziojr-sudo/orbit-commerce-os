import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Globe, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface StoreUrlInputProps {
  url: string;
  onUrlChange: (url: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  analysisResult?: {
    success: boolean;
    platform?: string;
    error?: string;
  } | null;
}

export function StoreUrlInput({ 
  url, 
  onUrlChange, 
  onAnalyze, 
  isAnalyzing,
  analysisResult 
}: StoreUrlInputProps) {
  const [inputValue, setInputValue] = useState(url);

  const handleInputChange = (value: string) => {
    setInputValue(value);
    onUrlChange(value);
  };

  const isValidUrl = (urlString: string) => {
    if (!urlString.trim()) return false;
    // Accept with or without protocol
    const urlToTest = urlString.startsWith('http') ? urlString : `https://${urlString}`;
    try {
      new URL(urlToTest);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          <Globe className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">Informe o link da sua loja</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Iremos analisar sua loja atual para extrair as categorias, visual, banners e toda a identidade visual.
        </p>
      </div>

      <div className="space-y-4 max-w-md mx-auto">
        <div className="space-y-2">
          <Label htmlFor="store-url">URL da loja</Label>
          <div className="flex gap-2">
            <Input
              id="store-url"
              type="url"
              placeholder="www.minhaloja.com.br"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={onAnalyze}
              disabled={!isValidUrl(inputValue) || isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analisando
                </>
              ) : (
                'Analisar'
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Exemplo: respeiteohomem.com.br
          </p>
        </div>

        {analysisResult && (
          <Alert variant={analysisResult.success ? 'default' : 'destructive'}>
            {analysisResult.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              {analysisResult.success 
                ? `Loja identificada! Plataforma: ${analysisResult.platform || 'Detectada'}`
                : analysisResult.error || 'Não foi possível analisar a loja'}
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="bg-muted/50 rounded-lg p-4 max-w-lg mx-auto">
        <h4 className="font-medium mb-2">O que será importado:</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Produtos do catálogo</li>
          <li>• Clientes e contatos</li>
          <li>• Pedidos e histórico</li>
          <li>• Categorias da loja</li>
          <li>• Páginas institucionais</li>
          <li>• Estrutura de menus</li>
        </ul>
      </div>
    </div>
  );
}
