import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Info, Copy, CheckCircle, ArrowRight, ShieldCheck, Globe, AlertTriangle } from 'lucide-react';
import { useTenantDomains, TenantDomain, DEFAULT_TARGET_HOSTNAME } from '@/hooks/useTenantDomains';
import { validateDomainFormat, getDomainType, normalizeDomain } from '@/lib/normalizeDomain';
import { toast } from 'sonner';

interface AddDomainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDomainAdded?: () => void;
}

type Step = 'input' | 'instructions';

export function AddDomainDialog({ open, onOpenChange, onDomainAdded }: AddDomainDialogProps) {
  const { addDomain } = useTenantDomains();
  const [step, setStep] = useState<Step>('input');
  const [domain, setDomain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [createdDomain, setCreatedDomain] = useState<TenantDomain | null>(null);
  const [companionDomain, setCompanionDomain] = useState<TenantDomain | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedCompanionToken, setCopiedCompanionToken] = useState(false);
  const [copiedCname, setCopiedCname] = useState(false);
  const [copiedCnameWww, setCopiedCnameWww] = useState(false);

  const handleClose = () => {
    const hadDomain = !!createdDomain;
    setStep('input');
    setDomain('');
    setError(null);
    setCreatedDomain(null);
    setCompanionDomain(null);
    setCopiedToken(false);
    setCopiedCompanionToken(false);
    setCopiedCname(false);
    setCopiedCnameWww(false);
    onOpenChange(false);
    if (hadDomain && onDomainAdded) {
      onDomainAdded();
    }
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
        setCreatedDomain(result.primary);
        setCompanionDomain(result.companion);
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

  // Extrai o subdomínio do domínio completo (considerando TLDs de duas partes)
  const getSubdomainName = (d: string) => {
    const normalized = normalizeDomain(d, false);
    const parts = normalized.split('.');
    const twoPartTLDs = ['com.br', 'org.br', 'net.br', 'co.uk', 'com.au', 'co.nz'];
    const lastTwoParts = parts.slice(-2).join('.');
    
    if (twoPartTLDs.includes(lastTwoParts)) {
      // For two-part TLDs: respeiteohomem.com.br = apex (no sub), www.respeiteohomem.com.br = sub "www"
      return parts.length > 3 ? parts[0] : '';
    }
    // For single-part TLDs: example.com = apex (no sub), www.example.com = sub "www"
    return parts.length > 2 ? parts[0] : '';
  };

  // Compute the correct TXT record name based on the domain
  const getTxtRecordName = (d: string) => {
    const sub = getSubdomainName(d);
    if (sub) {
      return `_cc-verify.${sub}`;
    }
    return '_cc-verify';
  };

  // Determine which is apex and which is www
  const isApexWithWww = createdDomain && companionDomain;
  const apexDomain = isApexWithWww
    ? (getRawDomainType(createdDomain.domain) === 'apex' ? createdDomain : companionDomain)
    : null;
  const wwwDomain = isApexWithWww
    ? (getRawDomainType(createdDomain.domain) === 'apex' ? companionDomain : createdDomain)
    : null;

  // For non-apex subdomains (loja, blog, etc.) - no companion
  const isSimpleSubdomain = createdDomain && !companionDomain;

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
                  placeholder="meusite.com.br ou www.meusite.com.br"
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
                    {(domainType === 'apex' || domain.toLowerCase().startsWith('www.')) && (
                      <span className="block text-xs mt-1">
                        ✅ Ambas as versões (com e sem www) serão configuradas automaticamente.
                      </span>
                    )}
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
                {isApexWithWww ? (
                  <>
                    Siga as instruções abaixo para configurar{' '}
                    <strong>{apexDomain?.domain}</strong> e{' '}
                    <strong>{wwwDomain?.domain}</strong>.
                  </>
                ) : (
                  <>
                    Siga as instruções abaixo para verificar a propriedade do domínio{' '}
                    <strong>{createdDomain?.domain}</strong>.
                  </>
                )}
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

              {/* ===== STEP 1: TXT Verification ===== */}
              <Alert className="border-primary/50">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>
                  Passo 1: Crie os registros TXT de verificação
                </AlertTitle>
                <AlertDescription>
                  <p className="mb-3 mt-2 text-sm text-muted-foreground">
                    Acesse o painel de DNS do seu domínio (Cloudflare, Registro.br, etc.) e crie {isApexWithWww ? 'os registros' : 'o registro'} abaixo:
                  </p>

                  {isApexWithWww && apexDomain && wwwDomain ? (
                    <div className="space-y-3">
                      {/* Apex TXT */}
                      <div className="bg-muted p-3 rounded space-y-2 text-sm">
                        <p className="font-medium text-primary">
                          📋 TXT para <code className="bg-background px-1 rounded">{apexDomain.domain}</code> (sem www)
                        </p>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Tipo:</span>
                          <code className="bg-background px-2 py-0.5 rounded font-mono">TXT</code>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-muted-foreground">Nome/Host:</span>
                          <div className="flex items-center gap-1">
                            <code className="bg-background px-2 py-1 rounded font-mono text-primary font-bold">
                              {getTxtRecordName(apexDomain.domain)}
                            </code>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                              onClick={() => handleCopy(getTxtRecordName(apexDomain.domain), setCopiedToken)}>
                              {copiedToken ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-muted-foreground">Valor:</span>
                          <div className="flex items-center gap-1">
                            <code className="bg-primary/10 border border-primary/30 px-2 py-1 rounded font-mono text-primary font-bold break-all">
                              cc-verify={apexDomain.verification_token}
                            </code>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0"
                              onClick={() => handleCopy(`cc-verify=${apexDomain.verification_token}`, setCopiedToken)}>
                              {copiedToken ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* WWW TXT */}
                      <div className="bg-muted p-3 rounded space-y-2 text-sm">
                        <p className="font-medium text-primary">
                          📋 TXT para <code className="bg-background px-1 rounded">{wwwDomain.domain}</code> (com www)
                        </p>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Tipo:</span>
                          <code className="bg-background px-2 py-0.5 rounded font-mono">TXT</code>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-muted-foreground">Nome/Host:</span>
                          <div className="flex items-center gap-1">
                            <code className="bg-background px-2 py-1 rounded font-mono text-primary font-bold">
                              {getTxtRecordName(wwwDomain.domain)}
                            </code>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                              onClick={() => handleCopy(getTxtRecordName(wwwDomain.domain), setCopiedCompanionToken)}>
                              {copiedCompanionToken ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-muted-foreground">Valor:</span>
                          <div className="flex items-center gap-1">
                            <code className="bg-primary/10 border border-primary/30 px-2 py-1 rounded font-mono text-primary font-bold break-all">
                              cc-verify={wwwDomain.verification_token}
                            </code>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0"
                              onClick={() => handleCopy(`cc-verify=${wwwDomain.verification_token}`, setCopiedCompanionToken)}>
                              {copiedCompanionToken ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-sm px-1">
                        <span className="text-muted-foreground">TTL:</span>
                        <code className="bg-muted px-2 py-0.5 rounded font-mono">Auto ou 300</code>
                      </div>
                    </div>
                  ) : (
                    /* Simple subdomain - single TXT */
                    <div className="space-y-2 text-sm bg-muted p-3 rounded">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Tipo:</span>
                        <code className="bg-background px-2 py-0.5 rounded font-mono">TXT</code>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground">Nome/Host:</span>
                        <div className="flex items-center gap-1">
                          <code className="bg-background px-2 py-1 rounded font-mono text-primary font-bold">
                            {getTxtRecordName(createdDomain!.domain)}
                          </code>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                            onClick={() => handleCopy(getTxtRecordName(createdDomain!.domain), setCopiedToken)}>
                            {copiedToken ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground">Valor (copie exatamente):</span>
                        <div className="flex items-center gap-1">
                          <code className="bg-primary/10 border border-primary/30 px-2 py-1 rounded font-mono text-primary font-bold break-all">
                            cc-verify={createdDomain?.verification_token}
                          </code>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0"
                            onClick={() => handleCopy(`cc-verify=${createdDomain?.verification_token}`, setCopiedToken)}>
                            {copiedToken ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">TTL:</span>
                        <code className="bg-background px-2 py-0.5 rounded font-mono">Auto ou 300</code>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-destructive font-medium mt-2">
                    ⚠️ O valor de cada TXT deve ser EXATAMENTE o mostrado acima. Cada domínio tem seu próprio token.
                  </p>
                </AlertDescription>
              </Alert>

              {/* ===== STEP 2: CNAME/DNS Pointing ===== */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>
                  Passo 2: Configure o apontamento DNS
                </AlertTitle>
                <AlertDescription>
                  {isApexWithWww && apexDomain ? (
                    <>
                      <p className="mb-3 mt-2">Configure o <strong>www</strong> como domínio principal da loja:</p>
                     <div className="space-y-3">
                        {/* WWW CNAME - PRIMARY */}
                        <div className="bg-muted p-3 rounded space-y-1 text-sm border-l-4 border-primary">
                          <p className="font-medium text-primary mb-2">
                            📋 CNAME para <code className="bg-background px-1 rounded">{wwwDomain?.domain}</code> (domínio principal)
                          </p>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Tipo:</span>
                            <code className="bg-background px-2 py-0.5 rounded font-mono">CNAME</code>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Nome:</span>
                            <code className="bg-background px-2 py-0.5 rounded font-mono">www</code>
                          </div>
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-muted-foreground">Destino:</span>
                            <div className="flex items-center gap-1">
                              <code className="bg-background px-2 py-0.5 rounded font-mono">{DEFAULT_TARGET_HOSTNAME}</code>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                                onClick={() => handleCopy(DEFAULT_TARGET_HOSTNAME, setCopiedCnameWww)}>
                                {copiedCnameWww ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Se usar Cloudflare, mantenha o proxy <strong>desativado</strong> (nuvem cinza / DNS-only).
                          </p>
                        </div>

                        {/* Apex REDIRECT instruction */}
                        <div className="bg-muted p-3 rounded space-y-1 text-sm">
                          <p className="font-medium text-primary mb-2">
                            🔀 Redirecionamento para <code className="bg-background px-1 rounded">{apexDomain.domain}</code> (raiz)
                          </p>
                          <p className="text-sm text-muted-foreground">
                            O domínio raiz (<code>{apexDomain.domain}</code>) deve <strong>redirecionar</strong> para{' '}
                            <code>{wwwDomain?.domain}</code>. Ele não será servido diretamente pelo Comando Central.
                          </p>
                          <div className="mt-2 space-y-1">
                            <p className="text-xs font-medium">Como configurar:</p>
                            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                              <li><strong>Registro.br:</strong> Use a opção "Redirecionamento Web" nas configurações da zona DNS.</li>
                              <li><strong>Cloudflare:</strong> Use uma regra de redirecionamento (Page Rules ou Redirect Rules).</li>
                              <li><strong>Outros provedores:</strong> Procure a opção de "URL redirect" ou "Forwarding" no painel de DNS.</li>
                            </ul>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Redirecione: <code>{apexDomain.domain}</code> → <code>https://{wwwDomain?.domain}</code>
                          </p>
                        </div>
                      </div>
                    </>
                  ) : isSimpleSubdomain ? (
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
                            {getSubdomainName(createdDomain!.domain)}
                          </code>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-muted-foreground">Destino:</span>
                          <div className="flex items-center gap-1">
                            <code className="bg-background px-2 py-0.5 rounded font-mono">{DEFAULT_TARGET_HOSTNAME}</code>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                              onClick={() => handleCopy(DEFAULT_TARGET_HOSTNAME, setCopiedCname)}>
                              {copiedCname ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}
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
                    Após a verificação e configuração do DNS, clique em{' '}
                    <strong>"Ativar SSL"</strong> em cada domínio na lista para habilitar HTTPS automático.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    O certificado SSL é gratuito e renovado automaticamente.
                  </p>
                </AlertDescription>
              </Alert>

              {/* Info about both domains */}
              {isApexWithWww && (
                <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-800">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-green-800 dark:text-green-200 space-y-1">
                    <p>
                      ✅ <strong>{wwwDomain?.domain}</strong> será o domínio principal da sua loja, servido 
                      diretamente pelo Comando Central (CNAME + SSL).
                    </p>
                    <p>
                      🔀 <strong>{apexDomain?.domain}</strong> deve apenas redirecionar para o www no seu 
                      provedor de DNS. Não é necessário CNAME nem SSL para o domínio raiz.
                    </p>
                  </div>
                </div>
              )}

              {/* Cloudflare warning - only for CNAME records */}
              <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 rounded border border-orange-300 dark:border-orange-800">
                <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-orange-800 dark:text-orange-200 space-y-1">
                  <p className="font-semibold">⚠️ Usa Cloudflare como DNS do seu domínio?</p>
                  <p>
                    Se o seu domínio está configurado no Cloudflare (nameservers apontando para o Cloudflare), 
                    certifique-se de que o proxy esteja <strong>desativado</strong> (nuvem cinza / DNS-only) 
                    no registro CNAME do <code>www</code> apontado para <code>{DEFAULT_TARGET_HOSTNAME}</code>.
                  </p>
                  <p className="text-[10px] text-orange-600 dark:text-orange-400 mt-1">
                    Outros provedores de DNS (Registro.br, GoDaddy, Namecheap, Route53, etc.) não precisam desta configuração.
                  </p>
                </div>
              </div>

              {/* Footer note */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-800">
                <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  A propagação DNS pode levar de alguns minutos até 48 horas. 
                  Após criar os registros, clique em "Verificar agora" na lista de domínios.
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
