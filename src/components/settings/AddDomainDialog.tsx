import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Info, Copy, CheckCircle } from 'lucide-react';
import { useTenantDomains, TenantDomain } from '@/hooks/useTenantDomains';
import { validateDomainFormat, getDomainType } from '@/lib/normalizeDomain';
import { toast } from 'sonner';

interface AddDomainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'input' | 'instructions';

export function AddDomainDialog({ open, onOpenChange }: AddDomainDialogProps) {
  const { addDomain } = useTenantDomains();
  const [step, setStep] = useState<Step>('input');
  const [domain, setDomain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [createdDomain, setCreatedDomain] = useState<TenantDomain | null>(null);
  const [copied, setCopied] = useState(false);

  const handleClose = () => {
    setStep('input');
    setDomain('');
    setError(null);
    setCreatedDomain(null);
    setCopied(false);
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    const validationError = validateDomainFormat(domain);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await addDomain(domain);
      if (result) {
        setCreatedDomain(result);
        setStep('instructions');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToken = () => {
    if (createdDomain) {
      navigator.clipboard.writeText(`cc-verify=${createdDomain.verification_token}`);
      setCopied(true);
      toast.success('Token copiado!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const domainType = domain ? getDomainType(domain) : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {step === 'input' ? (
          <>
            <DialogHeader>
              <DialogTitle>Adicionar Domínio Personalizado</DialogTitle>
              <DialogDescription>
                Digite o domínio que deseja usar para sua loja.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="domain">Domínio</Label>
                <Input
                  id="domain"
                  placeholder="meusite.com.br ou loja.meusite.com.br"
                  value={domain}
                  onChange={(e) => {
                    setDomain(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                />
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                {domain && !error && domainType && (
                  <p className="text-sm text-muted-foreground">
                    Tipo detectado: <strong>{domainType === 'apex' ? 'Domínio raiz' : 'Subdomínio'}</strong>
                  </p>
                )}
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Você precisará configurar seu DNS após adicionar o domínio. Mostraremos as instruções no próximo passo.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={isLoading || !domain}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Continuar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Configure seu DNS</DialogTitle>
              <DialogDescription>
                Siga as instruções abaixo para verificar a propriedade do domínio <strong>{createdDomain?.domain}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Alert className="bg-primary/5 border-primary/20">
                <CheckCircle className="h-4 w-4 text-primary" />
                <AlertDescription>
                  <strong>Passo 1:</strong> Acesse o painel de DNS do seu domínio (Cloudflare, Registro.br, etc.)
                </AlertDescription>
              </Alert>

              <div className="space-y-3 p-4 bg-muted rounded-lg">
                <h4 className="font-medium">Crie um registro TXT com:</h4>
                
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tipo:</span>
                    <code className="bg-background px-2 py-0.5 rounded">TXT</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nome/Host:</span>
                    <code className="bg-background px-2 py-0.5 rounded">_cc-verify</code>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-muted-foreground">Valor:</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-background px-2 py-0.5 rounded text-xs">
                        cc-verify={createdDomain?.verification_token}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={handleCopyToken}
                      >
                        {copied ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">TTL:</span>
                    <code className="bg-background px-2 py-0.5 rounded">300</code>
                  </div>
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  A propagação DNS pode levar de alguns minutos até 48 horas. Após criar o registro, clique em "Verificar agora" na lista de domínios.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>
                Entendi, fechar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
