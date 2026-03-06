import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Info, Copy, CheckCircle, ArrowRight, ShieldCheck, Globe } from 'lucide-react';
import { useTenantDomains, TenantDomain, DEFAULT_TARGET_HOSTNAME } from '@/hooks/useTenantDomains';
import { validateDomainFormat, getDomainType, normalizeDomain } from '@/lib/normalizeDomain';
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

  // Get raw domain type (preserves www as subdomain) for DNS purposes
  const getRawDomainType = (d: string): 'apex' | 'subdomain' => {
    const normalized = normalizeDomain(d, false);
    const parts = normalized.split('.');
    const twoPartTLDs = ['com.br', 'org.br', 'net.br', 'co.uk', 'com.au', 'co.nz'];
    const lastTwoParts = parts.slice(-2).join('.');
    if (twoPartTLDs.includes(lastTwoParts)) {
      return parts.length <= 3 ? 'apex' : 'subdomain';
    }
    return parts.length <= 2 ? 'apex' : 'subdomain';
  };

  // Extrai o subdomínio do domínio completo (ex: "loja" de "loja.exemplo.com.br")
  const getSubdomainName = () => {
    if (!createdDomain) return 'www';
    const parts = createdDomain.domain.split('.');
    return parts.length > 2 ? parts[0] : '';
  };

  // Compute the correct TXT record name based on the domain
  const getTxtRecordName = () => {
    if (!createdDomain) return '_cc-verify';
    const sub = getSubdomainName();
    if (sub) {
      return `_cc-verify.${sub}`;
    }
    return '_cc-verify';
  };

  const isWwwDomain = createdDomain?.domain.toLowerCase().startsWith('www.') ?? false;
  const isApexDomain = createdDomain ? getRawDomainType(createdDomain.domain) === 'apex' : false;

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
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground">Nome/Host:</span>
                      <div className="flex items-center gap-1">
                        <code className="bg-background px-2 py-1 rounded font-mono text-primary font-bold">
                          {getTxtRecordName()}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleCopy(getTxtRecordName(), setCopiedToken)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        No Cloudflare, digite apenas "<strong>{getTxtRecordName()}</strong>" (sem o domínio)
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground">Valor (copie exatamente):</span>
                      <div className="flex items-center gap-1">
                        <code className="bg-primary/10 border border-primary/30 px-2 py-1 rounded font-mono text-primary font-bold break-all">
                          cc-verify={createdDomain?.verification_token}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 flex-shrink-0"
                          onClick={() => handleCopy(`cc-verify=${createdDomain?.verification_token}`, setCopiedToken)}
                        >
                          {copiedToken ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                      <p className="text-xs text-destructive font-medium">
                        ⚠️ O valor deve ser EXATAMENTE este. Cada domínio tem seu próprio token.
                      </p>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">TTL:</span>
                      <code className="bg-background px-2 py-0.5 rounded font-mono">Auto ou 300</code>
                    </div>
                  </div>

                  {/* For apex domains, also show the www TXT record */}
                  {isApexDomain && (
                    <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-800">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                        📌 Se quiser que <code className="bg-background px-1 rounded">www.{createdDomain?.domain}</code> também funcione, crie um segundo TXT:
                      </p>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Nome:</span>
                          <code className="bg-background px-2 py-0.5 rounded font-mono font-bold">_cc-verify.www</code>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Valor:</span>
                          <span className="text-xs text-muted-foreground">(será gerado ao cadastrar www como domínio separado)</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* For www domains, also mention root TXT */}
                  {isWwwDomain && (
                    <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-800">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                        📌 Se quiser que <code className="bg-background px-1 rounded">{createdDomain?.domain.replace(/^www\./i, '')}</code> (sem www) também funcione, cadastre-o como domínio separado.
                      </p>
                    </div>
                  )}
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
