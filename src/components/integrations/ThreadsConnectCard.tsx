import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AtSign, Link2, Unlink, CheckCircle, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useThreadsConnection } from "@/hooks/useThreadsConnection";
import { useMetaConnection } from "@/hooks/useMetaConnection";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * ThreadsConnectCard
 * 
 * Card separado para conectar o Threads (OAuth independente via threads.net).
 * Exibido apenas quando a Meta já está conectada (pré-requisito: app registrado).
 */
export function ThreadsConnectCard() {
  const { isConnected: metaConnected } = useMetaConnection();
  const {
    isConnected,
    isExpired,
    connection,
    isLoading,
    connect,
    disconnect,
    isConnecting,
    isDisconnecting,
    refetch,
  } = useThreadsConnection();

  // Só exibir se a Meta estiver conectada
  if (!metaConnected) return null;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/5">
            <AtSign className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              Threads
              {isConnected && (
                <Badge variant="default" className="bg-green-500 text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Conectado
                </Badge>
              )}
              {isExpired && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Expirado
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs">
              Publicar e gerenciar conteúdo no Threads (autenticação separada)
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isConnected && connection ? (
          <>
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Perfil</span>
                <span className="font-medium text-sm">
                  {connection.username ? `@${connection.username}` : connection.displayName || connection.threadsUserId}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Conectado há</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(connection.connectedAt), { locale: ptBR, addSuffix: true })}
                </span>
              </div>
              {connection.tokenExpiresAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Expira em</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(connection.tokenExpiresAt), { locale: ptBR, addSuffix: true })}
                  </span>
                </div>
              )}
            </div>

            {connection.lastError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {connection.lastError}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => connect()} disabled={isConnecting} className="gap-1.5">
                {isConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Reconectar
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Atualizar
              </Button>
              <Button variant="destructive" size="sm" onClick={() => disconnect()} disabled={isDisconnecting} className="gap-1.5">
                {isDisconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                Desconectar
              </Button>
            </div>
          </>
        ) : (
          <>
            {isExpired && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Sua conexão com o Threads expirou. Reconecte para continuar publicando.
                </AlertDescription>
              </Alert>
            )}

            <p className="text-sm text-muted-foreground">
              O Threads utiliza autenticação separada do Facebook/Instagram.
              Clique abaixo para autorizar o acesso ao seu perfil do Threads.
            </p>

            <Button onClick={() => connect()} disabled={isConnecting} variant="outline" className="gap-2">
              {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Conectar Threads
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
