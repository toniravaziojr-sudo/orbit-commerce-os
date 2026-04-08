import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Mail, Inbox, Send, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import { useGoogleConnection } from "@/hooks/useGoogleConnection";
import { useGoogleGmail, type GmailMessage } from "@/hooks/useGoogleGmail";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

export function GmailTab() {
  const { isConnected, connection } = useGoogleConnection();
  const hasGmailScope = connection?.scopePacks?.includes("gmail");
  const { profileQuery, inboxQuery, syncMutation } = useGoogleGmail();

  if (!isConnected) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>
            Conecte sua conta Google com o escopo <strong>Gmail</strong> para acessar sua caixa de entrada.
          </span>
          <Link
            to="/integrations?tab=google"
            className="flex items-center gap-1 text-primary hover:underline ml-4"
          >
            Ir para Integrações <ExternalLink className="h-3 w-3" />
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  if (!hasGmailScope) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>
            O escopo <strong>Gmail</strong> não está ativo. Reconecte sua conta Google incluindo o escopo Gmail.
          </span>
          <Link
            to="/integrations?tab=google"
            className="flex items-center gap-1 text-primary hover:underline ml-4"
          >
            Reconectar <ExternalLink className="h-3 w-3" />
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  const profile = profileQuery.data as { emailAddress?: string; messagesTotal?: number; threadsTotal?: number } | null;
  const messages = (inboxQuery.data as GmailMessage[]) || [];

  return (
    <div className="space-y-6">
      {/* Profile Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Conta Gmail</CardDescription>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              {profileQuery.isLoading ? (
                <Skeleton className="h-5 w-40" />
              ) : (
                profile?.emailAddress || "—"
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de Mensagens</CardDescription>
            <CardTitle className="text-lg flex items-center gap-2">
              <Inbox className="h-4 w-4 text-muted-foreground" />
              {profileQuery.isLoading ? (
                <Skeleton className="h-5 w-20" />
              ) : (
                (profile?.messagesTotal || 0).toLocaleString("pt-BR")
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Threads</CardDescription>
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="h-4 w-4 text-muted-foreground" />
              {profileQuery.isLoading ? (
                <Skeleton className="h-5 w-20" />
              ) : (
                (profile?.threadsTotal || 0).toLocaleString("pt-BR")
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Inbox Messages */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Caixa de Entrada</CardTitle>
            <CardDescription>Mensagens recentes do Gmail</CardDescription>
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
        </CardHeader>
        <CardContent>
          {inboxQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Inbox className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma mensagem encontrada</p>
              <p className="text-sm mt-1">Clique em Sincronizar para buscar mensagens do Gmail</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">De</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead className="w-[140px] text-right">Data</TableHead>
                    <TableHead className="w-[80px] text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((msg) => (
                    <TableRow key={msg.id} className={!msg.isRead ? "font-medium bg-muted/30" : ""}>
                      <TableCell className="truncate max-w-[200px]">{msg.from}</TableCell>
                      <TableCell>
                        <div>
                          <span className="truncate block max-w-[400px]">{msg.subject}</span>
                          <span className="text-xs text-muted-foreground truncate block max-w-[400px]">
                            {msg.snippet}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(msg.date), { addSuffix: true, locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-center">
                        {msg.isRead ? (
                          <Badge variant="secondary" className="text-xs">Lida</Badge>
                        ) : (
                          <Badge className="text-xs">Nova</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
