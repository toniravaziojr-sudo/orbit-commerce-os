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
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedCname, setCopiedCname] = useState(false);

  const handleClose = () => {
    const hadDomain = !!createdDomain;
    setStep('input');
    setDomain('');
    setError(null);
    setCreatedDomain(null);
    setCopiedToken(false);
    setCopiedCname(false);
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

  // Extrai o subdomínio do domínio completo (considerando TLDs de duas partes)
  const getSubdomainName = (d: string) => {
    const normalized = normalizeDomain(d, false);
    const parts = normalized.split('.');
    const twoPartTLDs = ['com.br', 'org.br', 'net.br', 'co.uk', 'com.au', 'co.nz'];
    const lastTwoParts = parts.slice(-2).join('.');
    
    if (twoPartTLDs.includes(lastTwoParts)) {
      return parts.length > 3 ? parts[0] : '';
    }
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

  // Check if domain is apex
  const isApexDomain = (d: string): boolean => {
    const normalized = normalizeDomain(d, false);
    const parts = normalized.split('.');
    const twoPartTLDs = ['com.br', 'org.br', 'net.br', 'co.uk', 'com.au', 'co.nz'];
    const lastTwoParts = parts.slice(-2).join('.');
    if (twoPartTLDs.includes(lastTwoParts)) {
      return parts.length <= 3;
    }
    return parts.length <= 2;
  };

  // Get the CNAME name for the domain
  const getCnameName = (d: string): string => {
    const sub = getSubdomainName(d);
    if (sub) return sub;
    return '@';
  };

  const isApex = createdDomain ? isApexDomain(createdDomain.domain) : false;
  const isWww = createdDomain ? createdDomain.domain.toLowerCase().startsWith('www.') : false;

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
                  placeholder="meusite.com.br, www.meusite.com.br ou loja.meusite.com.br"
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
                  Cadastre apenas o domínio que será servido pela loja.
                  Se quiser que a versão com e sem <code className="bg-muted px-1 rounded">www</code> funcione,
                  você pode configurar um redirecionamento no seu gerenciador de DNS (ex: Cloudflare).
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
                Siga as instruções abaixo para configurar{' '}
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

              {/* ===== STEP 1: TXT Verification ===== */}
              <Alert className="border-primary/50">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>
                  Passo 1: Crie o registro TXT de verificação
                </AlertTitle>
                <AlertDescription>
                  <p className="mb-3 mt-2 text-sm text-muted-foreground">
                    Acesse o painel de DNS do seu domínio e crie o registro abaixo:
                  </p>

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
                </AlertDescription>
              </Alert>

              {/* ===== STEP 2: CNAME/DNS Pointing ===== */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>
                  Passo 2: Configure o apontamento DNS
                </AlertTitle>
                <AlertDescription>
                  <p className="mb-3 mt-2">
                    Crie um registro <strong>CNAME</strong> apontando para nossa infraestrutura:
                  </p>
                  <div className="space-y-2 text-sm bg-muted p-3 rounded border-l-4 border-primary">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Tipo:</span>
                      <code className="bg-background px-2 py-0.5 rounded font-mono">CNAME</code>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Nome/Host:</span>
                      <code className="bg-background px-2 py-0.5 rounded font-mono">
                        {getCnameName(createdDomain!.domain)}
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

                  {isApex && (
                    <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-800">
                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        <strong>⚠️ Domínio raiz (sem www):</strong> Alguns provedores de DNS tradicionais (como Registro.br)
                        não suportam CNAME no domínio raiz. Se for o caso, você precisa usar um gerenciador de DNS 
                        como o <strong>Cloudflare</strong> (gratuito) que suporta <strong>CNAME Flattening</strong>,
                        ou cadastrar a versão <code className="bg-background px-1 rounded">www</code> do domínio no lugar.
                      </p>
                    </div>
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
                    Após a verificação e configuração do DNS, clique em{' '}
                    <strong>"Ativar SSL"</strong> na lista de domínios para habilitar HTTPS automático.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    O certificado SSL é gratuito e renovado automaticamente.
                  </p>
                </AlertDescription>
              </Alert>

              {/* Tip: www + apex redirect */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                  <p className="font-semibold">💡 Quer que com www e sem www funcionem?</p>
                  <p>
                    Cadastre aqui apenas <strong>um</strong> deles (o que será servido pela loja).
                    Para que o outro redirecione, siga os passos abaixo no Cloudflare:
                  </p>
                  {isWww ? (
                    <div className="mt-2 space-y-2 p-2 bg-blue-100/50 dark:bg-blue-900/30 rounded">
                      <p className="font-semibold text-[11px]">Para redirecionar o domínio raiz → www:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>
                          Crie um registro <strong>A</strong> no DNS:{' '}
                          <code className="bg-background px-1 rounded">@</code> →{' '}
                          <code className="bg-background px-1 rounded">192.0.2.1</code>{' '}
                          com <strong>proxy ativado</strong> (nuvem laranja)
                        </li>
                        <li>
                          Vá em <strong>Rules → Redirect Rules</strong> e crie uma regra:
                        </li>
                      </ol>
                      <div className="ml-4 space-y-1">
                        <p>• <strong>When:</strong> Hostname equals <code className="bg-background px-1 rounded">{createdDomain?.domain.replace(/^www\./, '')}</code></p>
                        <p>• <strong>Then:</strong> Dynamic redirect → <code className="bg-background px-1 rounded text-[10px]">concat("https://{createdDomain?.domain}", http.request.uri.path)</code></p>
                        <p>• <strong>Status:</strong> 301 (Permanente)</p>
                        <p>• <strong>Preserve query string:</strong> ✅</p>
                      </div>
                    </div>
                  ) : isApex ? (
                    <div className="mt-2 space-y-2 p-2 bg-blue-100/50 dark:bg-blue-900/30 rounded">
                      <p className="font-semibold text-[11px]">Para redirecionar www → domínio raiz:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>
                          Crie um registro <strong>CNAME</strong> no DNS:{' '}
                          <code className="bg-background px-1 rounded">www</code> →{' '}
                          <code className="bg-background px-1 rounded">{createdDomain?.domain}</code>{' '}
                          com <strong>proxy ativado</strong> (nuvem laranja)
                        </li>
                        <li>
                          Vá em <strong>Rules → Redirect Rules</strong> e crie uma regra:
                        </li>
                      </ol>
                      <div className="ml-4 space-y-1">
                        <p>• <strong>When:</strong> Hostname equals <code className="bg-background px-1 rounded">www.{createdDomain?.domain}</code></p>
                        <p>• <strong>Then:</strong> Dynamic redirect → <code className="bg-background px-1 rounded text-[10px]">concat("https://{createdDomain?.domain}", http.request.uri.path)</code></p>
                        <p>• <strong>Status:</strong> 301 (Permanente)</p>
                        <p>• <strong>Preserve query string:</strong> ✅</p>
                      </div>
                    </div>
                  ) : (
                    <p>
                      Exemplo: configure um redirect no Cloudflare (Rules → Redirect Rules) da versão alternativa do domínio.
                    </p>
                  )}
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
                    ⚠️ O registro A ou CNAME de redirect <strong>precisa do proxy ativado</strong> (nuvem laranja) para que o Redirect Rule funcione.
                  </p>
                </div>
              </div>

              {/* Cloudflare warning */}
              <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 rounded border border-orange-300 dark:border-orange-800">
                <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-orange-800 dark:text-orange-200 space-y-1">
                  <p className="font-semibold">⚠️ Usa Cloudflare como DNS?</p>
                  <p>
                    Certifique-se de que o proxy esteja <strong>desativado</strong> (nuvem cinza / DNS-only) 
                    no registro CNAME apontado para <code>{DEFAULT_TARGET_HOSTNAME}</code>.
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
