import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Copy, CheckCircle, Info, Globe } from 'lucide-react';
import { TenantDomain } from '@/hooks/useTenantDomains';
import { getDomainType } from '@/lib/normalizeDomain';
import { toast } from 'sonner';
import { useState } from 'react';

interface DomainInstructionsDialogProps {
  domain: TenantDomain;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cnameTarget: string;
  aRecord: string;
}

export function DomainInstructionsDialog({
  domain,
  open,
  onOpenChange,
  cnameTarget,
  aRecord,
}: DomainInstructionsDialogProps) {
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedCname, setCopiedCname] = useState(false);
  const [copiedA, setCopiedA] = useState(false);

  const domainType = getDomainType(domain.domain);
  const isVerified = domain.status === 'verified';

  const handleCopy = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    toast.success('Copiado!');
    setTimeout(() => setter(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Instruções para {domain.domain}
          </DialogTitle>
          <DialogDescription>
            Configure seu DNS seguindo os passos abaixo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status atual:</span>
            <Badge variant={isVerified ? 'default' : 'secondary'}>
              {isVerified ? 'Verificado' : domain.status === 'failed' ? 'Falhou' : 'Pendente'}
            </Badge>
            <Badge variant="outline">
              {domainType === 'apex' ? 'Domínio raiz' : 'Subdomínio'}
            </Badge>
          </div>

          {/* Step 1: Verification */}
          {!isVerified && (
            <Alert className={domain.status === 'failed' ? 'border-destructive/50' : ''}>
              <Info className="h-4 w-4" />
              <AlertTitle>Passo 1: Verificação de propriedade</AlertTitle>
              <AlertDescription>
                <p className="mb-3">Crie um registro TXT no seu DNS:</p>
                <div className="space-y-2 text-sm bg-muted p-3 rounded">
                  <div className="flex justify-between items-center">
                    <span>Tipo:</span>
                    <code className="bg-background px-2 py-0.5 rounded">TXT</code>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Nome:</span>
                    <code className="bg-background px-2 py-0.5 rounded">_cc-verify</code>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span>Valor:</span>
                    <div className="flex items-center gap-1">
                      <code className="bg-background px-2 py-0.5 rounded text-xs">
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
                </div>
                {domain.last_error && (
                  <p className="mt-2 text-xs text-destructive">{domain.last_error}</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Step 2: DNS Pointing */}
          <Alert className={isVerified ? 'border-primary/50' : ''}>
            <Info className="h-4 w-4" />
            <AlertTitle>
              {isVerified ? 'Configure o apontamento DNS' : 'Passo 2: Apontamento DNS (após verificação)'}
            </AlertTitle>
            <AlertDescription>
              {domainType === 'subdomain' ? (
                <>
                  <p className="mb-3">Para subdomínios, crie um registro CNAME:</p>
                  <div className="space-y-2 text-sm bg-muted p-3 rounded">
                    <div className="flex justify-between items-center">
                      <span>Tipo:</span>
                      <code className="bg-background px-2 py-0.5 rounded">CNAME</code>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Nome:</span>
                      <code className="bg-background px-2 py-0.5 rounded">
                        {domain.domain.split('.')[0]}
                      </code>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span>Destino:</span>
                      <div className="flex items-center gap-1">
                        <code className="bg-background px-2 py-0.5 rounded">{cnameTarget}</code>
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
                  <p className="mb-3">Para domínio raiz, crie um registro A:</p>
                  <div className="space-y-2 text-sm bg-muted p-3 rounded">
                    <div className="flex justify-between items-center">
                      <span>Tipo:</span>
                      <code className="bg-background px-2 py-0.5 rounded">A</code>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Nome:</span>
                      <code className="bg-background px-2 py-0.5 rounded">@</code>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span>IP:</span>
                      <div className="flex items-center gap-1">
                        <code className="bg-background px-2 py-0.5 rounded">{aRecord}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleCopy(aRecord, setCopiedA)}
                        >
                          {copiedA ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    💡 Se seu DNS suportar ALIAS/ANAME, use <code className="bg-muted px-1 rounded">{cnameTarget}</code> em vez do IP.
                  </p>
                </>
              )}
            </AlertDescription>
          </Alert>

          <p className="text-xs text-muted-foreground">
            ⚠️ A propagação DNS pode levar de alguns minutos até 48 horas. Mantenha o registro TXT de verificação até o status ficar "Verificado".
          </p>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
