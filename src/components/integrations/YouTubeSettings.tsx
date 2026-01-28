// ============================================
// YOUTUBE SETTINGS - Integration UI Component
// ============================================

import { useState } from "react";
import { Youtube, Loader2, ExternalLink, RefreshCw, Unlink, Users, Video, Settings2 } from "lucide-react";
import { useYouTubeConnection } from "@/hooks/useYouTubeConnection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function YouTubeSettings() {
  const {
    connection,
    isConnected,
    isExpired,
    isLoading,
    isConnecting,
    isDisconnecting,
    connect,
    disconnect,
    refetch,
  } = useYouTubeConnection();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <Youtube className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                YouTube
                {isConnected && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Conectado
                  </Badge>
                )}
                {isExpired && (
                  <Badge variant="destructive">Token Expirado</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Publique e agende vídeos diretamente no seu canal
              </CardDescription>
            </div>
          </div>
          {isConnected && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              title="Atualizar status"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isConnected ? (
          <>
            <Alert>
              <Settings2 className="h-4 w-4" />
              <AlertDescription>
                Conecte seu canal do YouTube para publicar vídeos, agendar publicações,
                gerenciar comentários e acompanhar métricas diretamente do painel.
              </AlertDescription>
            </Alert>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Funcionalidades disponíveis:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Upload e agendamento de vídeos</li>
                <li>Edição de títulos, descrições e tags</li>
                <li>Upload de thumbnails personalizadas</li>
                <li>Gerenciamento de legendas</li>
                <li>Moderação de comentários</li>
                <li>Dashboard de analytics</li>
              </ul>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                <p>Custo por upload: <span className="font-medium text-foreground">~16 créditos</span></p>
                <p className="text-xs">(baseado em quota da API do Google)</p>
              </div>
              <Button
                onClick={connect}
                disabled={isConnecting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <Youtube className="mr-2 h-4 w-4" />
                    Conectar YouTube
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Connected Channel Info */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <Avatar className="h-14 w-14">
                <AvatarImage src={connection?.channel_thumbnail_url || undefined} />
                <AvatarFallback className="bg-red-100 text-red-600">
                  <Youtube className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{connection?.channel_title || "Seu Canal"}</p>
                {connection?.channel_custom_url && (
                  <a
                    href={`https://youtube.com/${connection.channel_custom_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                  >
                    {connection.channel_custom_url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-lg font-semibold">
                    {connection?.subscriber_count?.toLocaleString("pt-BR") || "0"}
                  </p>
                  <p className="text-xs text-muted-foreground">Inscritos</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <Video className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-lg font-semibold">
                    {connection?.video_count?.toLocaleString("pt-BR") || "0"}
                  </p>
                  <p className="text-xs text-muted-foreground">Vídeos</p>
                </div>
              </div>
            </div>

            {/* Token Status */}
            {isExpired && (
              <Alert variant="destructive">
                <AlertDescription className="flex items-center justify-between">
                  <span>Token expirado. Reconecte para continuar usando.</span>
                  <Button size="sm" onClick={connect} disabled={isConnecting}>
                    {isConnecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Reconectar"
                    )}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Last sync */}
            {connection?.last_sync_at && (
              <p className="text-xs text-muted-foreground">
                Última sincronização:{" "}
                {formatDistanceToNow(new Date(connection.last_sync_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </p>
            )}

            <Separator />

            {/* Disconnect */}
            <div className="flex justify-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive hover:text-destructive">
                    <Unlink className="mr-2 h-4 w-4" />
                    Desconectar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Desconectar YouTube?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Você não poderá mais publicar ou agendar vídeos neste canal.
                      Os vídeos já publicados não serão afetados.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => disconnect()}
                      disabled={isDisconnecting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDisconnecting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Desconectar"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
