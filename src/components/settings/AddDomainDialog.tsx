import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Info, Copy, CheckCircle, ArrowRight, ShieldCheck, Globe } from 'lucide-react';
import { useTenantDomains, TenantDomain, DEFAULT_TARGET_HOSTNAME } from '@/hooks/useTenantDomains';
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
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedCname, setCopiedCname] = useState(false);

  const handleClose = () => {
    setStep('input');
    setDomain('');
    setError(null);
    setCreatedDomain(null);
    setCopiedToken(false);
    setCopiedCname(false);
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

  const handleCopy = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    toast.success('Copiado!');
    setTimeout(() => setter(false), 2000);
  };

  const domainType = domain ? getDomainType(domain) : null;
  const createdDomainType = createdDomain ? getDomainType(createdDomain.domain) : null;

  // Extrai o subdomínio do domínio completo (ex: "loja" de "loja.exemplo.com.br")
  const getSubdomainName = () => {
    if (!createdDomain) return 'www';
    const parts = createdDomain.domain.split('.');
    return parts.length > 2 ? parts[0] : 'www';
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        {step === 'input' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Adicionar Domínio Personalizado
              </DialogTitle>
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
                  Você precisará configurar seu DNS após adicionar o domínio. Mostraremos as instruções completas no próximo passo.
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
              <DialogTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Configure seu DNS
              </DialogTitle>
              <DialogDescription>
                Siga as instruções abaixo para verificar a propriedade do domínio{' '}
                <strong>{createdDomain?.domain}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Progress indicator */}
              <div className="flex items-center justify-center gap-2 text-sm">
                <Badge variant="secondary" className="gap-1">
                  1
                  Verificação
                </Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline" className="gap-1">
                  2
                  Apontamento
                </Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline" className="gap-1">
                  3
                  SSL
                </Badge>
              </div>

              {/* Step 1: TXT Verification */}
              <Alert className="border-primary/50">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>
                  Passo 1: Acesse o painel de DNS do seu domínio (Cloudflare, Registro.br, etc.)
                </AlertTitle>
                <AlertDescription>
                  <p className="mb-3 mt-2 font-medium">Crie um registro TXT com:</p>
                  <div className="space-y-2 text-sm bg-muted p-3 rounded">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Tipo:</span>
                      <code className="bg-background px-2 py-0.5 rounded font-mono">TXT</code>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Nome/Host:</span>
                      <code className="bg-background px-2 py-0.5 rounded font-mono">_cc-verify</code>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-foreground">Valor:</span>
                      <div className="flex items-center gap-1">
                        <code className="bg-background px-2 py-0.5 rounded text-xs font-mono">
                          cc-verify={createdDomain?.verification_token}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleCopy(`cc-verify=${createdDomain?.verification_token}`, setCopiedToken)}
                        >
                          {copiedToken ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">TTL:</span>
                      <code className="bg-background px-2 py-0.5 rounded font-mono">300</code>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              {/* Step 2: CNAME/DNS Pointing */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>
                  Passo 2: Configure o apontamento DNS
                </AlertTitle>
                <AlertDescription>
                  {createdDomainType === 'subdomain' ? (
                    <>
                      <p className="mb-3 mt-2">Crie um registro <strong>CNAME</strong> para apontar seu subdomínio:</p>
                      <div className="space-y-2 text-sm bg-muted p-3 rounded">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Tipo:</span>
                          <code className="bg-background px-2 py-0.5 rounded font-mono">CNAME</code>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Nome/Host:</span>
                          <code className="bg-background px-2 py-0.5 rounded font-mono">
                            {getSubdomainName()}
                          </code>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-muted-foreground">Destino:</span>
                          <div className="flex items-center gap-1">
                            <code className="bg-background px-2 py-0.5 rounded font-mono">{DEFAULT_TARGET_HOSTNAME}</code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => handleCopy(DEFAULT_TARGET_HOSTNAME, setCopiedCname)}
                            >
                              {copiedCname ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="mb-3 mt-2">Para domínio raiz, você tem duas opções:</p>
                      
                      <div className="space-y-3">
                        <div className="bg-muted p-3 rounded">
                          <p className="font-medium text-sm mb-2">Opção A - CNAME Flattening (Recomendado)</p>
                          <p className="text-xs text-muted-foreground mb-2">
                            Se seu provedor suportar (Cloudflare, Vercel DNS, etc.):
                          </p>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">Tipo:</span>
                              <code className="bg-background px-2 py-0.5 rounded font-mono">CNAME</code>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">Nome:</span>
                              <code className="bg-background px-2 py-0.5 rounded font-mono">@</code>
                            </div>
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-muted-foreground">Destino:</span>
                              <div className="flex items-center gap-1">
                                <code className="bg-background px-2 py-0.5 rounded font-mono">{DEFAULT_TARGET_HOSTNAME}</code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => handleCopy(DEFAULT_TARGET_HOSTNAME, setCopiedCname)}
                                >
                                  {copiedCname ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-muted p-3 rounded">
                          <p className="font-medium text-sm mb-2">Opção B - Usar www como principal</p>
                          <p className="text-xs text-muted-foreground">
                            Configure <code className="bg-background px-1 rounded">www.{createdDomain?.domain}</code> com CNAME e 
                            crie um redirecionamento do domínio raiz para www no seu provedor.
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </AlertDescription>
              </Alert>

              {/* Step 3: SSL */}
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>
                  Passo 3: Ativar SSL (HTTPS)
                </AlertTitle>
                <AlertDescription>
                  <p className="mt-2">
                    Após a verificação do domínio e configuração do DNS, clique em{' '}
                    <strong>"Ativar SSL"</strong> na lista de domínios para habilitar HTTPS automático.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    O certificado SSL é gratuito e renovado automaticamente.
                  </p>
                </AlertDescription>
              </Alert>

              {/* Footer note */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-800">
                <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  A propagação DNS pode levar de alguns minutos até 48 horas. 
                  Após criar o registro, clique em "Verificar agora" na lista de domínios.
                </p>
              </div>
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
