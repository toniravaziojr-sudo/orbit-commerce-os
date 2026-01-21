import { useState } from 'react';
import { Globe, Plus, RefreshCw, Trash2, Star, Copy, CheckCircle, Clock, XCircle, ExternalLink, Info, Shield, ShieldCheck, ShieldAlert, ShieldOff, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTenantDomains, TenantDomain, DEFAULT_TARGET_HOSTNAME, getPlatformSubdomainUrl } from '@/hooks/useTenantDomains';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { AddDomainDialog } from '@/components/settings/AddDomainDialog';
import { DomainInstructionsDialog } from '@/components/settings/DomainInstructionsDialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const STATUS_CONFIG = {
  pending: {
    label: 'Pendente',
    icon: Clock,
    variant: 'secondary' as const,
  },
  verified: {
    label: 'Verificado',
    icon: CheckCircle,
    variant: 'default' as const,
  },
  failed: {
    label: 'Falhou',
    icon: XCircle,
    variant: 'destructive' as const,
  },
};

const SSL_STATUS_CONFIG = {
  none: {
    label: 'Não ativado',
    icon: ShieldOff,
    variant: 'secondary' as const,
  },
  pending: {
    label: 'Provisionando',
    icon: Shield,
    variant: 'outline' as const,
  },
  active: {
    label: 'SSL Ativo',
    icon: ShieldCheck,
    variant: 'default' as const,
  },
  failed: {
    label: 'SSL Falhou',
    icon: ShieldAlert,
    variant: 'destructive' as const,
  },
};

// SaaS hostname target for CNAME
const STOREFRONT_CNAME_TARGET = DEFAULT_TARGET_HOSTNAME;

/**
 * Domain settings content component - extracted from Domains.tsx for reuse.
 * Shows storefront URL, custom domains table, and DNS instructions.
 */
export function DomainSettingsContent() {
  const { currentTenant } = useAuth();
  const { 
    domains, 
    isLoading, 
    isVerifying, 
    isProvisioning,
    verifyDomain, 
    provisionSSL,
    checkSSLStatus,
    setPrimaryDomain, 
    removeDomain,
    provisionDefaultDomain,
  } = useTenantDomains();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [instructionsDialog, setInstructionsDialog] = useState<TenantDomain | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TenantDomain | null>(null);
  const [isProvisioningDefault, setIsProvisioningDefault] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  // Find the platform subdomain (auto-provisioned)
  const platformSubdomain = domains.find(d => d.type === 'platform_subdomain');
  
  // Check if there are any ACTIVE custom domains (verified + SSL active)
  // Only then does the "Activate" button make sense (to switch primary back to platform)
  const hasActiveCustomDomains = domains.some(
    d => d.type === 'custom' && d.status === 'verified' && d.ssl_status === 'active'
  );

  // Handler for provisioning default domain
  const handleProvisionDefault = async () => {
    if (!currentTenant?.slug) return;
    setIsProvisioningDefault(true);
    await provisionDefaultDomain(currentTenant.slug);
    setIsProvisioningDefault(false);
  };

  // URL padrão da plataforma (grátis) - formato: tenantSlug.shops.domain
  const platformStorefrontUrl = currentTenant?.slug 
    ? getPlatformSubdomainUrl(currentTenant.slug)
    : null;

  // Find the active custom domain (verified + SSL active + primary or first one)
  const activeCustomDomain = domains.find(
    d => d.status === 'verified' && d.ssl_status === 'active' && d.is_primary && d.type === 'custom'
  ) || domains.find(
    d => d.status === 'verified' && d.ssl_status === 'active' && d.type === 'custom'
  );

  // URL do storefront no domínio personalizado (na raiz)
  const customDomainUrl = activeCustomDomain
    ? `https://${activeCustomDomain.domain}`
    : null;

  const handleCopyToken = (domain: TenantDomain) => {
    navigator.clipboard.writeText(`cc-verify=${domain.verification_token}`);
    toast.success('Token copiado!');
  };

  const handleCopyTarget = () => {
    navigator.clipboard.writeText(STOREFRONT_CNAME_TARGET);
    toast.success('Hostname copiado!');
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copiada!');
  };

  const getNextAction = (domain: TenantDomain) => {
    if (domain.status !== 'verified') {
      return { label: 'Verificar DNS', action: () => verifyDomain(domain.id), disabled: isVerifying === domain.id };
    }
    if (domain.ssl_status === 'none' || domain.ssl_status === 'failed') {
      return { label: 'Ativar SSL', action: () => provisionSSL(domain.id), disabled: isProvisioning === domain.id };
    }
    if (domain.ssl_status === 'pending') {
      return { label: 'Verificar SSL', action: () => checkSSLStatus(domain.id), disabled: isProvisioning === domain.id };
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Storefront URL Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5" />
            URL do Storefront
          </CardTitle>
          <CardDescription>
            Endereço público da sua loja
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* URL padrão (grátis) */}
          {platformStorefrontUrl ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">URL gratuita da plataforma</p>
                {/* Only show "Principal" if this IS the primary (no active custom domain) */}
                {!customDomainUrl && (
                  <Badge variant="secondary" className="text-xs">
                    <Star className="h-3 w-3 mr-1" />
                    Em uso
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <code className="flex-1 text-sm font-mono break-all">
                  {platformStorefrontUrl}
                </code>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    SSL
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => window.open(platformStorefrontUrl, '_blank')}
                    title="Abrir loja"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleCopyUrl(platformStorefrontUrl)}
                    title="Copiar URL"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Este endereço é permanente e gratuito. SSL ativo automaticamente.
              </p>
              
              {/* 
                Show "Activate" button ONLY if:
                1. Platform subdomain is not provisioned in DB
                2. AND there are ACTIVE custom domains (verified + SSL active)
                
                This allows switching primary back to platform subdomain.
              */}
              {!platformSubdomain && hasActiveCustomDomains && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleProvisionDefault}
                  disabled={isProvisioningDefault}
                  className="mt-2"
                >
                  {isProvisioningDefault ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Ativando...
                    </>
                  ) : (
                    <>
                      <Star className="h-4 w-4 mr-2" />
                      Definir como Principal
                    </>
                  )}
                </Button>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Nenhum tenant selecionado</p>
          )}

          {/* URL do domínio personalizado - mostrar apenas se ativo */}
          {customDomainUrl && (
            <div className="space-y-2 pt-4 border-t">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Domínio personalizado</p>
                <Badge variant="default" className="text-xs">
                  <Star className="h-3 w-3 mr-1" />
                  Principal
                </Badge>
              </div>
              <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-900">
                <code className="flex-1 text-sm font-mono break-all text-emerald-800 dark:text-emerald-300">
                  {customDomainUrl}
                </code>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900 dark:text-emerald-400 dark:border-emerald-700">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    SSL
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => window.open(customDomainUrl, '_blank')}
                    title="Abrir loja"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleCopyUrl(customDomainUrl)}
                    title="Copiar URL"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Visitantes da URL gratuita são redirecionados automaticamente para este domínio.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Domains Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-lg">Domínios Personalizados</CardTitle>
            <CardDescription>
              Use seu próprio domínio (ex: minhaloja.com.br)
            </CardDescription>
          </div>
          <Button onClick={() => setAddDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : domains.filter(d => d.type === 'custom').length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhum domínio personalizado</p>
              <p className="text-sm mt-1">Adicione um domínio próprio para sua loja.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {domains.filter(d => d.type === 'custom').map((domain) => {
                const statusConfig = STATUS_CONFIG[domain.status];
                const StatusIcon = statusConfig.icon;
                const sslConfig = SSL_STATUS_CONFIG[domain.ssl_status || 'none'];
                const SslIcon = sslConfig.icon;
                const nextAction = getNextAction(domain);
                const isFullyActive = domain.status === 'verified' && domain.ssl_status === 'active';

                return (
                  <div 
                    key={domain.id} 
                    className={`p-4 rounded-lg border ${isFullyActive ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-border bg-muted/30'}`}
                  >
                    {/* Domain header */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <code className="font-mono text-sm truncate">{domain.domain}</code>
                        {domain.is_primary && (
                          <Badge variant="default" className="shrink-0 gap-1">
                            <Star className="h-3 w-3" />
                            Principal
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant={statusConfig.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </Badge>
                        <Badge variant={sslConfig.variant} className="gap-1">
                          <SslIcon className="h-3 w-3" />
                          {sslConfig.label}
                        </Badge>
                      </div>
                    </div>

                    {/* Error message - cleaner display */}
                    {domain.last_error && (
                      <Alert variant="destructive" className="mt-3 py-2">
                        <XCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {domain.last_error}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        {nextAction && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={nextAction.action}
                            disabled={nextAction.disabled}
                          >
                            {(isVerifying === domain.id || isProvisioning === domain.id) && (
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            )}
                            {nextAction.label}
                          </Button>
                        )}
                        {isFullyActive && !domain.is_primary && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPrimaryDomain(domain.id)}
                          >
                            <Star className="h-3 w-3 mr-1" />
                            Definir como Principal
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setInstructionsDialog(domain)}
                          title="Ver instruções DNS"
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleCopyToken(domain)}
                          title="Copiar token de verificação"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setDeleteConfirm(domain)}
                          title="Remover domínio"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* DNS Instructions - Collapsible */}
      <Collapsible open={instructionsOpen} onOpenChange={setInstructionsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Instruções de Configuração DNS</CardTitle>
                  <CardDescription>
                    Como configurar seu domínio personalizado
                  </CardDescription>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform ${instructionsOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Passo 1: Verificação de propriedade (TXT)</AlertTitle>
                <AlertDescription>
                  Após adicionar o domínio, crie um registro TXT no seu DNS:
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li><strong>Tipo:</strong> TXT</li>
                    <li>
                      <strong>Nome/Host:</strong>{' '}
                      <code className="bg-muted px-1 rounded">_cc-verify</code> para domínio raiz, ou{' '}
                      <code className="bg-muted px-1 rounded">_cc-verify.SUBDOMINIO</code> para subdomínios
                    </li>
                    <li><strong>Valor:</strong> O token fornecido (formato: cc-verify=xxxx)</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Passo 2: Apontamento (CNAME ou A)</AlertTitle>
                <AlertDescription>
                  Após verificar, aponte seu domínio para nossa infraestrutura:
                  <div className="mt-2 space-y-2 text-sm">
                    <p><strong>Para subdomínios (ex: loja.seusite.com.br):</strong></p>
                    <ul className="list-disc list-inside ml-2">
                      <li><strong>Tipo:</strong> CNAME</li>
                      <li><strong>Nome:</strong> loja (ou seu subdomínio)</li>
                      <li>
                        <strong>Valor:</strong>{' '}
                        <code className="bg-muted px-1 rounded">{STOREFRONT_CNAME_TARGET}</code>
                        <Button variant="ghost" size="sm" onClick={handleCopyTarget} className="ml-2 h-6">
                          <Copy className="h-3 w-3" />
                        </Button>
                      </li>
                    </ul>
                    <p className="mt-2"><strong>Para domínio raiz (ex: seusite.com.br):</strong></p>
                    <ul className="list-disc list-inside ml-2">
                      <li>Use CNAME flattening se disponível, ou</li>
                      <li>Configure registros A conforme instruções específicas</li>
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>

              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Passo 3: Ativação do SSL</AlertTitle>
                <AlertDescription>
                  Após o DNS propagar (pode levar até 48h), clique em "Ativar SSL" para habilitar HTTPS.
                  O certificado será provisionado automaticamente.
                </AlertDescription>
              </Alert>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Dialogs */}
      <AddDomainDialog 
        open={addDialogOpen} 
        onOpenChange={setAddDialogOpen} 
      />

      {instructionsDialog && (
        <DomainInstructionsDialog
          domain={instructionsDialog}
          open={!!instructionsDialog}
          onOpenChange={(open) => !open && setInstructionsDialog(null)}
          cnameTarget={STOREFRONT_CNAME_TARGET}
        />
      )}

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover domínio?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o domínio <strong>{deleteConfirm?.domain}</strong>?
              {deleteConfirm?.is_primary && (
                <span className="block mt-2 text-destructive font-medium">
                  Este é o domínio principal. A loja voltará a usar a URL padrão da plataforma.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteConfirm) {
                  await removeDomain(deleteConfirm.id, deleteConfirm.is_primary);
                  setDeleteConfirm(null);
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
