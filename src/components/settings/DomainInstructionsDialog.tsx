import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Copy, CheckCircle, Info, Globe, ShieldCheck, ArrowRight } from 'lucide-react';
import { TenantDomain } from '@/hooks/useTenantDomains';
import { normalizeDomain } from '@/lib/normalizeDomain';
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

  const isVerified = domain.status === 'verified';
  const hasSSL = domain.ssl_status === 'active';

  const handleCopy = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    toast.success('Copiado!');
    setTimeout(() => setter(false), 2000);
  };

  const getSubdomainName = () => {
    const normalized = domain.domain.toLowerCase().trim();
    const parts = normalized.split('.');
    const twoPartTLDs = ['com.br', 'org.br', 'net.br', 'co.uk', 'com.au', 'co.nz'];
    const lastTwoParts = parts.slice(-2).join('.');
    
    if (twoPartTLDs.includes(lastTwoParts)) {
      return parts.length > 3 ? parts[0] : '';
    }
    return parts.length > 2 ? parts[0] : '';
  };

  const getTxtRecordName = () => {
    const sub = getSubdomainName();
    if (sub) return `_cc-verify.${sub}`;
    return '_cc-verify';
  };

  const getCnameName = () => {
    const sub = getSubdomainName();
    if (sub === 'www') return 'www / @';
    if (sub) return sub;
    return '@';
  };

  const isApexDomain = () => {
    const normalized = normalizeDomain(domain.domain, false);
    const parts = normalized.split('.');
    const twoPartTLDs = ['com.br', 'org.br', 'net.br', 'co.uk', 'com.au', 'co.nz'];
    const lastTwoParts = parts.slice(-2).join('.');
    if (twoPartTLDs.includes(lastTwoParts)) return parts.length <= 3;
    return parts.length <= 2;
  };

  const isApex = isApexDomain();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Instruções de DNS
          </DialogTitle>
          <DialogDescription>
            Configuração para o domínio <strong>{domain.domain}</strong>.
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
              Passo 1: Registro TXT de verificação
              {isVerified && <Badge variant="default" className="bg-green-600">Concluído</Badge>}
            </AlertTitle>
            <AlertDescription>
              <div className="space-y-3 text-sm bg-muted p-3 rounded mt-2">
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
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                      onClick={() => handleCopy(getTxtRecordName(), setCopiedToken)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">Valor:</span>
                  <div className="flex items-center gap-1">
                    <code className="bg-primary/10 border border-primary/30 px-2 py-1 rounded font-mono text-primary font-bold break-all">
                      cc-verify={domain.verification_token}
                    </code>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0"
                      onClick={() => handleCopy(`cc-verify=${domain.verification_token}`, setCopiedToken)}>
                      {copiedToken ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              </div>
              {domain.last_error && !isVerified && (
                <p className="mt-2 text-xs text-destructive">{domain.last_error}</p>
              )}
            </AlertDescription>
          </Alert>

          {/* Step 2: CNAME */}
          <Alert className={isVerified && hasSSL ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : ''}>
            <Info className={`h-4 w-4 ${isVerified && hasSSL ? 'text-green-600' : ''}`} />
            <AlertTitle className="flex items-center gap-2">
              Passo 2: Apontamento CNAME
              {isVerified && hasSSL && <Badge variant="default" className="bg-green-600">Concluído</Badge>}
            </AlertTitle>
            <AlertDescription>
              <div className="space-y-2 text-sm bg-muted p-3 rounded mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Tipo:</span>
                  <code className="bg-background px-2 py-0.5 rounded font-mono">CNAME</code>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Nome/Host:</span>
                  <code className="bg-background px-2 py-0.5 rounded font-mono">{getCnameName()}</code>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground">Destino:</span>
                  <div className="flex items-center gap-1">
                    <code className="bg-background px-2 py-0.5 rounded font-mono">{cnameTarget}</code>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleCopy(cnameTarget, setCopiedCname)}>
                      {copiedCname ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              </div>

              {isApex && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  ⚠️ Domínio raiz: se seu provedor não suporta CNAME no raiz, use um gerenciador como 
                  o <strong>Cloudflare</strong> (CNAME Flattening) ou cadastre a versão <code>www</code>.
                </p>
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
                Após verificação e DNS propagado, clique em <strong>"Ativar SSL"</strong> na lista de domínios.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Certificado SSL gratuito, renovado automaticamente.
              </p>
            </AlertDescription>
          </Alert>

          {/* Tip: redirect for the other version */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
              <p className="font-semibold">💡 Quer que com www e sem www funcionem?</p>
              {domain.domain.toLowerCase().startsWith('www.') ? (
                <div className="space-y-2">
                  <p>Para redirecionar o domínio raiz para www, no Cloudflare:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>
                      Crie registro <strong>A</strong>:{' '}
                      <code className="bg-background px-1 rounded">@</code> →{' '}
                      <code className="bg-background px-1 rounded">192.0.2.1</code>{' '}
                      com <strong>proxy ativado</strong> (nuvem laranja)
                    </li>
                    <li>
                      Em <strong>Rules → Redirect Rules</strong>, crie regra:<br />
                      When: Hostname equals <code className="bg-background px-1 rounded">{domain.domain.replace(/^www\./i, '')}</code><br />
                      Then: 301 → <code className="bg-background px-1 rounded text-[10px]">concat("https://{domain.domain}", http.request.uri.path)</code>
                    </li>
                  </ol>
                </div>
              ) : isApex ? (
                <div className="space-y-2">
                  <p>Para redirecionar www para o domínio raiz, no Cloudflare:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>
                      Crie registro <strong>CNAME</strong>:{' '}
                      <code className="bg-background px-1 rounded">www</code> →{' '}
                      <code className="bg-background px-1 rounded">{domain.domain}</code>{' '}
                      com <strong>proxy ativado</strong> (nuvem laranja)
                    </li>
                    <li>
                      Em <strong>Rules → Redirect Rules</strong>, crie regra:<br />
                      When: Hostname equals <code className="bg-background px-1 rounded">www.{domain.domain}</code><br />
                      Then: 301 → <code className="bg-background px-1 rounded text-[10px]">concat("https://{domain.domain}", http.request.uri.path)</code>
                    </li>
                  </ol>
                </div>
              ) : (
                <p>
                  Configure um <strong>redirect</strong> da outra versão no seu gerenciador de DNS (ex: Cloudflare Redirect Rules).
                </p>
              )}
              <p className="text-[10px] text-blue-600 dark:text-blue-400">
                ⚠️ O registro de redirect precisa do <strong>proxy ativado</strong> (nuvem laranja) para funcionar.
              </p>
            </div>
          </div>

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
