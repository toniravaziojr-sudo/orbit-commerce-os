import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tag, RefreshCw, Code, Globe, CheckCircle2, AlertCircle, Info, Loader2, ExternalLink, Copy } from "lucide-react";
import { useGoogleTagManager } from "@/hooks/useGoogleTagManager";
import { useGoogleConnection } from "@/hooks/useGoogleConnection";
import { toast } from "sonner";

export function GoogleTagManagerTab() {
  const { isConnected, connection } = useGoogleConnection();
  const { containersQuery, syncMutation, scriptsMutation } = useGoogleTagManager();
  const [scriptsDialogOpen, setScriptsDialogOpen] = useState(false);
  const [selectedScripts, setSelectedScripts] = useState<{ headSnippet: string; bodySnippet: string; publicId: string } | null>(null);

  const hasTagManagerScope = connection?.scopePacks?.includes("tag_manager");
  const containers = containersQuery.data || [];
  const activeContainers = containers.filter(c => c.is_active);

  const handleViewScripts = async (accountId: string, containerId: string) => {
    try {
      const data = await scriptsMutation.mutateAsync({ accountId, containerId });
      setSelectedScripts(data);
      setScriptsDialogOpen(true);
    } catch {
      // error handled by mutation
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  if (!isConnected || !hasTagManagerScope) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Conecte sua conta Google com o escopo <strong>Tag Manager</strong> na{" "}
          <a href="/integrations?tab=google" className="underline font-medium">página de integrações</a>{" "}
          para gerenciar seus containers GTM.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with sync */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Tag className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Google Tag Manager</h3>
            <p className="text-sm text-muted-foreground">
              {activeContainers.length} container{activeContainers.length !== 1 ? "s" : ""} ativo{activeContainers.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          Sincronizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de Containers</CardDescription>
            <CardTitle className="text-2xl">{containers.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ativos</CardDescription>
            <CardTitle className="text-2xl text-green-600">{activeContainers.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Última Sincronização</CardDescription>
            <CardTitle className="text-sm font-medium">
              {containers[0]?.last_sync_at
                ? new Date(containers[0].last_sync_at).toLocaleString("pt-BR")
                : "Nunca"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Containers table */}
      {containersQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : containers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Tag className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">Nenhum container encontrado</p>
            <p className="text-sm mt-1">Clique em Sincronizar para buscar seus containers GTM.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Containers</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Public ID</TableHead>
                  <TableHead>Domínios</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {containers.map((container) => (
                  <TableRow key={container.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{container.container_name}</span>
                        {container.account_name && (
                          <p className="text-xs text-muted-foreground">{container.account_name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {container.container_public_id || "—"}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(container.domain_name || []).map((d) => (
                          <Badge key={d} variant="outline" className="text-xs">
                            <Globe className="h-3 w-3 mr-1" />
                            {d}
                          </Badge>
                        ))}
                        {(!container.domain_name || container.domain_name.length === 0) && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {container.is_active ? (
                        <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Inativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewScripts(container.account_id, container.container_id)}
                          disabled={scriptsMutation.isPending}
                        >
                          <Code className="h-4 w-4 mr-1" />
                          Scripts
                        </Button>
                        {container.tag_manager_url && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={container.tag_manager_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Scripts Dialog */}
      <Dialog open={scriptsDialogOpen} onOpenChange={setScriptsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Scripts de Instalação
            </DialogTitle>
            <DialogDescription>
              {selectedScripts?.publicId && (
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{selectedScripts.publicId}</code>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedScripts && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Código para o &lt;head&gt;</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(selectedScripts.headSnippet, "Código head")}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copiar
                  </Button>
                </div>
                <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                  {selectedScripts.headSnippet}
                </pre>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Código para o &lt;body&gt;</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(selectedScripts.bodySnippet, "Código body")}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copiar
                  </Button>
                </div>
                <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                  {selectedScripts.bodySnippet}
                </pre>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Cole o primeiro código o mais alto possível no <code>&lt;head&gt;</code> e o segundo
                  imediatamente após a tag de abertura <code>&lt;body&gt;</code> do seu site.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
