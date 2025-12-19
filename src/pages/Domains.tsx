import { useState } from 'react';
import { Globe, Plus, RefreshCw, Trash2, Star, Copy, CheckCircle, Clock, XCircle, ExternalLink, Info, Shield, ShieldCheck, ShieldAlert, ShieldOff } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTenantDomains, TenantDomain, DEFAULT_TARGET_HOSTNAME, getPlatformSubdomainUrl } from '@/hooks/useTenantDomains';
import { useAuth } from '@/hooks/useAuth';
import { getDomainType } from '@/lib/normalizeDomain';
import { toast } from 'sonner';
import { AddDomainDialog } from '@/components/settings/AddDomainDialog';
import { DomainInstructionsDialog } from '@/components/settings/DomainInstructionsDialog';
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

export default function Domains() {
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
    removeDomain 
  } = useTenantDomains();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [instructionsDialog, setInstructionsDialog] = useState<TenantDomain | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TenantDomain | null>(null);

  // URL padrão da plataforma (grátis) - formato: tenantSlug.shops.domain
  const platformStorefrontUrl = currentTenant?.slug 
    ? getPlatformSubdomainUrl(currentTenant.slug)
    : null;

  // URL legada no app (para compatibilidade)
  const legacyStorefrontUrl = currentTenant?.slug 
    ? `${window.location.origin}/store/${currentTenant.slug}` 
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

  // Canonical URL (custom domain if active, otherwise platform subdomain)
  const canonicalUrl = customDomainUrl || platformStorefrontUrl;

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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
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
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Domínios da Loja"
        description="Gerencie o domínio padrão e domínios personalizados da sua loja"
      />

      {/* Storefront URL Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5" />
            URL do Storefront
          </CardTitle>
          <CardDescription>
            URLs públicas da sua loja
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* URL padrão (grátis) */}
          {platformStorefrontUrl ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">URL padrão (grátis)</p>
              <div className="flex items-center gap-3 flex-wrap">
                <code className="bg-muted px-3 py-1.5 rounded text-sm font-mono break-all">
                  {platformStorefrontUrl}
                </code>
                <Badge variant="outline">{customDomainUrl ? 'Ativo' : 'Principal'}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(platformStorefrontUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Abrir
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyUrl(platformStorefrontUrl)}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copiar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Formato: {currentTenant?.slug}.shops.comandocentral.com.br
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Nenhum tenant selecionado</p>
          )}

          {/* URL do domínio personalizado */}
          {customDomainUrl && (
            <div className="space-y-1 pt-3 border-t">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                URL no domínio personalizado
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <code className="bg-green-50 border border-green-200 px-3 py-1.5 rounded text-sm font-mono break-all text-green-800">
                  {customDomainUrl}
                </code>
                <Badge variant="default" className="bg-green-600">Principal</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(customDomainUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Abrir
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyUrl(customDomainUrl)}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copiar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Quando acessarem a URL padrão, serão redirecionados automaticamente para o domínio personalizado.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Domains Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Domínios Personalizados</CardTitle>
            <CardDescription>
              Adicione domínios próprios para sua loja (ex: minhaloja.com.br)
            </CardDescription>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Domínio
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : domains.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum domínio personalizado cadastrado.</p>
              <p className="text-sm mt-1">Clique em "Adicionar Domínio" para começar.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domínio</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Verificação</TableHead>
                  <TableHead>SSL</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map((domain) => {
                  const statusConfig = STATUS_CONFIG[domain.status];
                  const StatusIcon = statusConfig.icon;
                  const sslConfig = SSL_STATUS_CONFIG[domain.ssl_status || 'none'];
                  const SslIcon = sslConfig.icon;
                  const domainType = getDomainType(domain.domain);
                  const nextAction = getNextAction(domain);

                  return (
                    <TableRow key={domain.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-sm">{domain.domain}</code>
                          {domain.is_primary && (
                            <Badge variant="default" className="gap-1">
                              <Star className="h-3 w-3" />
                              Principal
                            </Badge>
                          )}
                        </div>
                        {domain.last_error && (
                          <p className="text-xs text-destructive mt-1 max-w-[250px]">
                            {domain.last_error}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {domainType === 'apex' ? 'Raiz' : 'Subdomínio'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sslConfig.variant} className="gap-1">
                          <SslIcon className="h-3 w-3" />
                          {sslConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setInstructionsDialog(domain)}
                            title="Ver instruções"
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyToken(domain)}
                            title="Copiar token"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {domain.status === 'verified' && domain.ssl_status === 'active' && !domain.is_primary && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPrimaryDomain(domain.id)}
                              title="Definir como principal"
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          )}
                          {!domain.is_primary && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteConfirm(domain)}
                              title="Remover"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* DNS Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Instruções de Configuração DNS</CardTitle>
          <CardDescription>
            Siga estas instruções para apontar seu domínio para a loja. Funciona com qualquer provedor DNS (Cloudflare, Registro.br, GoDaddy, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                  <code className="bg-muted px-1 rounded">_cc-verify.SUBDOMINIO</code> para subdomínios (ex: <code className="bg-muted px-1 rounded">_cc-verify.loja</code>)
                </li>
                <li><strong>Valor:</strong> <code className="bg-muted px-1 rounded">cc-verify=SEU_TOKEN</code></li>
                <li><strong>TTL:</strong> Auto ou 300 (5 minutos)</li>
              </ul>
            </AlertDescription>
          </Alert>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Passo 2: Apontamento via CNAME (recomendado)</AlertTitle>
            <AlertDescription>
              <p className="mb-2">Para subdomínios como <code className="bg-muted px-1 rounded">www</code> ou <code className="bg-muted px-1 rounded">loja</code>:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li><strong>Tipo:</strong> CNAME</li>
                <li><strong>Nome:</strong> seu subdomínio (ex: <code className="bg-muted px-1 rounded">www</code> ou <code className="bg-muted px-1 rounded">loja</code>)</li>
                <li>
                  <strong>Destino:</strong>{' '}
                  <code className="bg-muted px-1 rounded">{STOREFRONT_CNAME_TARGET}</code>
                  <Button variant="ghost" size="sm" className="h-6 ml-1" onClick={handleCopyTarget}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </li>
              </ul>
            </AlertDescription>
          </Alert>

          <Alert variant="default">
            <Info className="h-4 w-4" />
            <AlertTitle>Passo 2 (alternativa): Domínio raiz (apex)</AlertTitle>
            <AlertDescription>
              <p className="mb-2">Para domínio raiz (ex: <code className="bg-muted px-1 rounded">minhaloja.com.br</code>):</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Se seu provedor suportar <strong>ALIAS</strong>, <strong>ANAME</strong> ou <strong>CNAME flattening</strong>: use para apontar <code className="bg-muted px-1 rounded">@</code> → <code className="bg-muted px-1 rounded">{STOREFRONT_CNAME_TARGET}</code></li>
                <li>Se não suportar: use <code className="bg-muted px-1 rounded">www</code> como principal e configure redirecionamento do apex para www no seu provedor</li>
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                💡 <strong>Dica:</strong> Usar www (CNAME) é mais simples e funciona em todos os provedores. Apex (ALIAS/ANAME) é avançado.
              </p>
            </AlertDescription>
          </Alert>

          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Passo 3: Ativar SSL</AlertTitle>
            <AlertDescription>
              Após a verificação, clique em "Ativar SSL" para habilitar HTTPS automático. O processo pode levar alguns minutos.
              <p className="mt-2 text-xs text-muted-foreground">
                ⚠️ A propagação DNS pode levar de alguns minutos até 48 horas. Tente verificar novamente se não funcionar de imediato.
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Add Domain Dialog */}
      <AddDomainDialog 
        open={addDialogOpen} 
        onOpenChange={setAddDialogOpen} 
      />

      {/* Instructions Dialog */}
      {instructionsDialog && (
        <DomainInstructionsDialog
          domain={instructionsDialog}
          open={!!instructionsDialog}
          onOpenChange={() => setInstructionsDialog(null)}
          cnameTarget={STOREFRONT_CNAME_TARGET}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover domínio?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o domínio <strong>{deleteConfirm?.domain}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm) {
                  removeDomain(deleteConfirm.id);
                  setDeleteConfirm(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
