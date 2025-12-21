import { useState, useEffect } from "react";
import { Bell, Plus, Zap, Mail, MessageSquare, Clock, TestTube, Loader2, CheckCircle, AlertCircle, Play } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// Check if user has admin/owner role for current tenant
function useIsAdminOrOwner(tenantId: string | null | undefined) {
  const [isAdminOrOwner, setIsAdminOrOwner] = useState<boolean | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id || !tenantId) {
      setIsAdminOrOwner(false);
      return;
    }

    const checkRole = async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .in('role', ['owner', 'admin'])
        .maybeSingle();

      if (error) {
        console.error('[useIsAdminOrOwner] Error checking role:', error);
        setIsAdminOrOwner(false);
        return;
      }

      setIsAdminOrOwner(!!data);
    };

    checkRole();
  }, [user?.id, tenantId]);

  return isAdminOrOwner;
}

interface ProcessEventsStats {
  events_fetched: number;
  events_processed: number;
  events_ignored: number;
  rules_matched: number;
  notifications_created: number;
  ledger_conflicts: number;
}

export default function Notifications() {
  const { profile } = useAuth();
  const isAdminOrOwner = useIsAdminOrOwner(profile?.current_tenant_id);
  const [isEmitting, setIsEmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    duplicate: boolean;
    event_id?: string;
    message?: string;
    error?: string;
  } | null>(null);
  const [processResult, setProcessResult] = useState<{
    success: boolean;
    stats?: ProcessEventsStats;
    error?: string;
  } | null>(null);

  const handleEmitTestEvent = async () => {
    if (!profile?.current_tenant_id) {
      toast.error("Tenant não encontrado");
      return;
    }

    setIsEmitting(true);
    setLastResult(null);

    try {
      // Use a fixed idempotency key to demonstrate dedupe
      const testIdempotencyKey = `test-event-${profile.current_tenant_id}-demo-001`;
      
      const { data, error } = await supabase.functions.invoke('emit-internal-event', {
        body: {
          tenant_id: profile.current_tenant_id,
          event_type: 'order.paid',
          subject: {
            type: 'order',
            id: 'test-order-12345',
          },
          payload_normalized: {
            order_number: 'PED-25-000001',
            customer_name: 'Cliente Teste',
            total: 199.90,
            test: true,
          },
          idempotency_key: testIdempotencyKey,
        },
      });

      if (error) {
        console.error('[Notifications] Error emitting test event:', error);
        setLastResult({ success: false, duplicate: false, error: error.message });
        toast.error("Erro ao emitir evento: " + error.message);
        return;
      }

      console.log('[Notifications] Test event result:', data);
      setLastResult(data);

      if (data.duplicate) {
        toast.info("Evento já existe (idempotência funcionando!)");
      } else {
        toast.success("Evento emitido com sucesso!");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('[Notifications] Unexpected error:', err);
      setLastResult({ success: false, duplicate: false, error: errorMessage });
      toast.error("Erro inesperado: " + errorMessage);
    } finally {
      setIsEmitting(false);
    }
  };

  const handleProcessEvents = async () => {
    if (!profile?.current_tenant_id) {
      toast.error("Tenant não encontrado");
      return;
    }

    setIsProcessing(true);
    setProcessResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('process-events', {
        body: {
          tenant_id: profile.current_tenant_id,
          limit: 50,
        },
      });

      if (error) {
        console.error('[Notifications] Error processing events:', error);
        setProcessResult({ success: false, error: error.message });
        toast.error("Erro ao processar eventos: " + error.message);
        return;
      }

      console.log('[Notifications] Process events result:', data);
      setProcessResult(data);

      if (data.stats?.notifications_created > 0) {
        toast.success(`${data.stats.notifications_created} notificação(ões) criada(s)!`);
      } else if (data.stats?.events_fetched === 0) {
        toast.info("Nenhum evento pendente para processar");
      } else {
        toast.info("Processamento concluído");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('[Notifications] Unexpected error:', err);
      setProcessResult({ success: false, error: errorMessage });
      toast.error("Erro inesperado: " + errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Notificações & Automações"
        description="Configure regras, automações e notificações por WhatsApp e Email"
        actions={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Regra
          </Button>
        }
      />

      <Tabs defaultValue="rules" className="space-y-6">
        <TabsList>
          <TabsTrigger value="rules" className="gap-2">
            <Zap className="h-4 w-4" />
            Regras
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <Mail className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Clock className="h-4 w-4" />
            Histórico
          </TabsTrigger>
          {isAdminOrOwner && (
            <TabsTrigger value="dev" className="gap-2">
              <TestTube className="h-4 w-4" />
              Dev/Teste
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Regras de Automação</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={Zap}
                title="Nenhuma regra configurada"
                description="Crie regras para automatizar notificações baseadas em eventos como: pagamento confirmado, pedido enviado, carrinho abandonado, etc."
                action={{
                  label: "Criar Primeira Regra",
                  onClick: () => {},
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Templates de Mensagem</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={MessageSquare}
                title="Nenhum template criado"
                description="Crie templates reutilizáveis para WhatsApp e Email. Use variáveis dinâmicas como nome do cliente, número do pedido, etc."
                action={{
                  label: "Criar Template",
                  onClick: () => {},
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Histórico de Envios</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={Bell}
                title="Nenhuma notificação enviada"
                description="O histórico completo de todas as notificações enviadas aparecerá aqui com status, timestamps e logs de erro."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dev">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Emit Internal Event Test */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <TestTube className="h-5 w-5" />
                  Emitir Evento Interno (Teste)
                </CardTitle>
                <CardDescription>
                  Emite um evento de teste (order.paid) com idempotency_key fixa para validar dedupe.
                  Clique 2x para ver a idempotência funcionando.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted p-3 text-sm font-mono">
                  <div><span className="text-muted-foreground">event_type:</span> order.paid</div>
                  <div><span className="text-muted-foreground">subject:</span> order/test-order-12345</div>
                  <div><span className="text-muted-foreground">idempotency_key:</span> test-event-...-demo-001</div>
                </div>

                <Button 
                  onClick={handleEmitTestEvent} 
                  disabled={isEmitting}
                  className="w-full gap-2"
                >
                  {isEmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Emitindo...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Emitir Evento de Teste
                    </>
                  )}
                </Button>

                {lastResult && (
                  <div className={`rounded-lg p-3 text-sm ${
                    lastResult.success 
                      ? lastResult.duplicate 
                        ? 'bg-warning/10 border border-warning/20' 
                        : 'bg-success/10 border border-success/20'
                      : 'bg-destructive/10 border border-destructive/20'
                  }`}>
                    <div className="flex items-center gap-2 font-medium mb-2">
                      {lastResult.success ? (
                        lastResult.duplicate ? (
                          <>
                            <AlertCircle className="h-4 w-4 text-warning" />
                            <span className="text-warning">Duplicado (idempotência)</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 text-success" />
                            <span className="text-success">Evento Criado</span>
                          </>
                        )
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-destructive" />
                          <span className="text-destructive">Erro</span>
                        </>
                      )}
                    </div>
                    <div className="font-mono text-xs">
                      {lastResult.event_id && (
                        <div><span className="text-muted-foreground">event_id:</span> {lastResult.event_id}</div>
                      )}
                      {lastResult.message && (
                        <div><span className="text-muted-foreground">message:</span> {lastResult.message}</div>
                      )}
                      {lastResult.error && (
                        <div><span className="text-muted-foreground">error:</span> {lastResult.error}</div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Process Events */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  Processar Eventos Pendentes
                </CardTitle>
                <CardDescription>
                  Executa o motor de regras nos eventos com status 'new' e cria notificações conforme regras habilitadas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={handleProcessEvents} 
                  disabled={isProcessing}
                  variant="secondary"
                  className="w-full gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Processar Eventos
                    </>
                  )}
                </Button>

                {processResult && (
                  <div className={`rounded-lg p-3 text-sm ${
                    processResult.success 
                      ? 'bg-success/10 border border-success/20'
                      : 'bg-destructive/10 border border-destructive/20'
                  }`}>
                    <div className="flex items-center gap-2 font-medium mb-2">
                      {processResult.success ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-success" />
                          <span className="text-success">Processamento Concluído</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-destructive" />
                          <span className="text-destructive">Erro</span>
                        </>
                      )}
                    </div>
                    {processResult.stats && (
                      <div className="font-mono text-xs space-y-1">
                        <div><span className="text-muted-foreground">events_fetched:</span> {processResult.stats.events_fetched}</div>
                        <div><span className="text-muted-foreground">events_processed:</span> {processResult.stats.events_processed}</div>
                        <div><span className="text-muted-foreground">events_ignored:</span> {processResult.stats.events_ignored}</div>
                        <div><span className="text-muted-foreground">rules_matched:</span> {processResult.stats.rules_matched}</div>
                        <div><span className="text-muted-foreground">notifications_created:</span> {processResult.stats.notifications_created}</div>
                        <div><span className="text-muted-foreground">ledger_conflicts:</span> {processResult.stats.ledger_conflicts}</div>
                      </div>
                    )}
                    {processResult.error && (
                      <div className="font-mono text-xs">
                        <span className="text-muted-foreground">error:</span> {processResult.error}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Webhook Info */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Endpoint de Webhook Externo</CardTitle>
                <CardDescription>
                  URL para receber webhooks de provedores externos (pagamento, frete, etc.)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted p-3 text-sm font-mono break-all">
                  POST /functions/v1/webhooks-external/:provider
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="text-sm space-y-2">
                    <p className="font-medium">Headers obrigatórios:</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1">
                      <li><code className="text-xs bg-muted px-1 rounded">x-tenant-id</code>: ID do tenant</li>
                      <li><code className="text-xs bg-muted px-1 rounded">x-webhook-secret</code>: Secret configurado</li>
                    </ul>
                  </div>

                  <div className="text-sm space-y-2">
                    <p className="font-medium">Para configurar um webhook:</p>
                    <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                      <li>Cadastre um secret na tabela <code className="text-xs bg-muted px-1 rounded">webhook_secrets</code></li>
                      <li>Configure a URL no provedor externo</li>
                      <li>Inclua os headers de autenticação</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Channel Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-success/10 p-3">
                <MessageSquare className="h-6 w-6 text-success" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">WhatsApp</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Conecte sua conta do WhatsApp Business para enviar notificações automáticas.
                </p>
                <Button variant="outline" size="sm" className="mt-4">
                  Configurar WhatsApp
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-info/10 p-3">
                <Mail className="h-6 w-6 text-info" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Email</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Configure o envio de emails transacionais e marketing para seus clientes.
                </p>
                <Button variant="outline" size="sm" className="mt-4">
                  Configurar Email
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
