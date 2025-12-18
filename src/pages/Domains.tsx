import { useState } from 'react';
import { Globe, Plus, RefreshCw, Trash2, Star, Copy, CheckCircle, Clock, XCircle, ExternalLink, Info } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTenantDomains, TenantDomain } from '@/hooks/useTenantDomains';
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

// Canonical hostname for CNAME (phase 2 - informational)
const STOREFRONT_CNAME_TARGET = 'stores.lovable.app';
const STOREFRONT_A_RECORD = '185.158.133.1';

export default function Domains() {
  const { currentTenant } = useAuth();
  const { domains, isLoading, isVerifying, verifyDomain, setPrimaryDomain, removeDomain } = useTenantDomains();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [instructionsDialog, setInstructionsDialog] = useState<TenantDomain | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TenantDomain | null>(null);

  const previewDomain = currentTenant?.slug ? `${currentTenant.slug}.lovable.app` : null;

  const handleCopyToken = (domain: TenantDomain) => {
    navigator.clipboard.writeText(`cc-verify=${domain.verification_token}`);
    toast.success('Token copiado!');
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Domínios da Loja"
        description="Gerencie o domínio padrão e domínios personalizados da sua loja"
      />

      {/* Preview Domain Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Domínio de Preview
          </CardTitle>
          <CardDescription>
            Este é o domínio temporário da sua loja, disponível automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {previewDomain ? (
            <div className="flex items-center gap-3">
              <code className="bg-muted px-3 py-1.5 rounded text-sm font-mono">
                {previewDomain}
              </code>
              <Badge variant="outline">Preview</Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(`https://${previewDomain}`, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Abrir
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Nenhum tenant selecionado</p>
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
                  <TableHead>Status</TableHead>
                  <TableHead>Última verificação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map((domain) => {
                  const statusConfig = STATUS_CONFIG[domain.status];
                  const StatusIcon = statusConfig.icon;
                  const domainType = getDomainType(domain.domain);

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
                        {domain.last_error && domain.status !== 'verified' && (
                          <p className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">
                            {domain.last_error}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(domain.last_checked_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => verifyDomain(domain.id)}
                            disabled={isVerifying === domain.id}
                            title="Verificar agora"
                          >
                            <RefreshCw className={`h-4 w-4 ${isVerifying === domain.id ? 'animate-spin' : ''}`} />
                          </Button>
                          {domain.status === 'verified' && !domain.is_primary && (
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
            Siga estas instruções para apontar seu domínio para a loja
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Passo 1: Verificação de propriedade</AlertTitle>
            <AlertDescription>
              Após adicionar o domínio, crie um registro TXT no seu DNS:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li><strong>Tipo:</strong> TXT</li>
                <li><strong>Nome/Host:</strong> <code className="bg-muted px-1 rounded">_cc-verify</code> (ou <code className="bg-muted px-1 rounded">_cc-verify.seusubdominio</code> para subdomínios)</li>
                <li><strong>Valor:</strong> <code className="bg-muted px-1 rounded">cc-verify=SEU_TOKEN</code></li>
                <li><strong>TTL:</strong> 300 (5 minutos)</li>
              </ul>
            </AlertDescription>
          </Alert>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Passo 2: Apontamento (após verificação)</AlertTitle>
            <AlertDescription>
              <p className="mb-2">Para subdomínios (www, loja, etc.):</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li><strong>Tipo:</strong> CNAME</li>
                <li><strong>Nome:</strong> seu subdomínio (ex: <code className="bg-muted px-1 rounded">www</code>)</li>
                <li><strong>Destino:</strong> <code className="bg-muted px-1 rounded">{STOREFRONT_CNAME_TARGET}</code></li>
              </ul>
              
              <p className="mt-4 mb-2">Para domínio raiz (apex):</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li><strong>Tipo:</strong> A</li>
                <li><strong>Nome:</strong> <code className="bg-muted px-1 rounded">@</code></li>
                <li><strong>IP:</strong> <code className="bg-muted px-1 rounded">{STOREFRONT_A_RECORD}</code></li>
              </ul>
              
              <p className="mt-4 text-xs text-muted-foreground">
                ⚠️ A propagação DNS pode levar de alguns minutos até 48 horas.
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
          aRecord={STOREFRONT_A_RECORD}
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
