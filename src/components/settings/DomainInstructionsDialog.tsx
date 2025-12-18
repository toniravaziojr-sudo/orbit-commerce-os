import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Copy, CheckCircle, Info, Globe, ShieldCheck, ArrowRight } from 'lucide-react';
import { TenantDomain } from '@/hooks/useTenantDomains';
import { getDomainType } from '@/lib/normalizeDomain';
import { toast } from 'sonner';
import { useState } from 'react';

interface DomainInstructionsDialogProps {
  domain: TenantDomain;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cnameTarget: string;
}

export function DomainInstructionsDialog({
  domain,
  open,
  onOpenChange,
  cnameTarget,
}: DomainInstructionsDialogProps) {
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedCname, setCopiedCname] = useState(false);

  const domainType = getDomainType(domain.domain);
  const isVerified = domain.status === 'verified';
  const hasSSL = domain.ssl_status === 'active';

  const handleCopy = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    toast.success('Copiado!');
    setTimeout(() => setter(false), 2000);
  };

  // Extrai o subdomínio do domínio completo (ex: "loja" de "loja.exemplo.com.br")
  const getSubdomainName = () => {
    const parts = domain.domain.split('.');
    return parts.length > 2 ? parts[0] : 'www';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Configure seu DNS
          </DialogTitle>
          <DialogDescription>
            Siga as instruções abaixo para verificar a propriedade do domínio{' '}
            <strong>{domain.domain}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 text-sm">
            <Badge variant={isVerified ? 'default' : 'secondary'} className="gap-1">
              {isVerified ? <CheckCircle className="h-3 w-3" /> : '1'}
              Verificação
            </Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Badge variant={isVerified ? (hasSSL ? 'default' : 'secondary') : 'outline'} className="gap-1">
              {isVerified && hasSSL ? <CheckCircle className="h-3 w-3" /> : '2'}
              Apontamento
            </Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Badge variant={hasSSL ? 'default' : 'outline'} className="gap-1">
              {hasSSL ? <CheckCircle className="h-3 w-3" /> : '3'}
              SSL
            </Badge>
          </div>

          {/* Step 1: Verification TXT */}
          <Alert className={isVerified ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : 'border-primary/50'}>
            <CheckCircle className={`h-4 w-4 ${isVerified ? 'text-green-600' : ''}`} />
            <AlertTitle className="flex items-center gap-2">
              Passo 1: Acesse o painel de DNS do seu domínio (Cloudflare, Registro.br, etc.)
              {isVerified && <Badge variant="default" className="bg-green-600">Concluído</Badge>}
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
                      cc-verify={domain.verification_token}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleCopy(`cc-verify=${domain.verification_token}`, setCopiedToken)}
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
              {domain.last_error && !isVerified && (
                <p className="mt-2 text-xs text-destructive">{domain.last_error}</p>
              )}
            </AlertDescription>
          </Alert>

          {/* Step 2: CNAME/DNS Pointing */}
          <Alert className={isVerified && hasSSL ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : ''}>
            <Info className={`h-4 w-4 ${isVerified && hasSSL ? 'text-green-600' : ''}`} />
            <AlertTitle className="flex items-center gap-2">
              Passo 2: Configure o apontamento DNS
              {isVerified && hasSSL && <Badge variant="default" className="bg-green-600">Concluído</Badge>}
            </AlertTitle>
            <AlertDescription>
              {domainType === 'subdomain' ? (
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
                        <code className="bg-background px-2 py-0.5 rounded font-mono">{cnameTarget}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleCopy(cnameTarget, setCopiedCname)}
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
                            <code className="bg-background px-2 py-0.5 rounded font-mono">{cnameTarget}</code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => handleCopy(cnameTarget, setCopiedCname)}
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
                        Configure <code className="bg-background px-1 rounded">www.{domain.domain}</code> com CNAME e 
                        crie um redirecionamento do domínio raiz para www no seu provedor.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </AlertDescription>
          </Alert>

          {/* Step 3: SSL */}
          <Alert className={hasSSL ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : ''}>
            <ShieldCheck className={`h-4 w-4 ${hasSSL ? 'text-green-600' : ''}`} />
            <AlertTitle className="flex items-center gap-2">
              Passo 3: Ativar SSL (HTTPS)
              {hasSSL && <Badge variant="default" className="bg-green-600">Ativo</Badge>}
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
          <Button onClick={() => onOpenChange(false)}>Entendi, fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
