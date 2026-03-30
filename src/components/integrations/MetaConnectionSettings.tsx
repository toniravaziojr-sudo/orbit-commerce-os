import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, 
  Link2, 
  Unlink, 
  Facebook, 
  Instagram, 
  MessageCircle,
  Megaphone,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
import { useMetaConnection } from "@/hooks/useMetaConnection";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function MetaConnectionSettings() {
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
  } = useMetaConnection();

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
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Facebook className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              Meta
              {isConnected && (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Conectado
                </Badge>
              )}
              {isExpired && (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Expirado
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Conecte suas contas para atendimento, publicações e anúncios
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isConnected && connection ? (
          <>
            {/* Status da conexão */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Conta conectada</span>
                <span className="font-medium">{connection.externalUsername || connection.externalUserId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Conectado há</span>
                <span className="text-sm">
                  {formatDistanceToNow(new Date(connection.connectedAt), { locale: ptBR, addSuffix: true })}
                </span>
              </div>
              {connection.expiresAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Expira em</span>
                  <span className="text-sm">
                    {formatDistanceToNow(new Date(connection.expiresAt), { locale: ptBR, addSuffix: true })}
                  </span>
                </div>
              )}
            </div>

            {/* Assets descobertos */}
            {connection.assets && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Ativos conectados</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {connection.assets.pages.length > 0 && (
                    <div className="rounded-lg border p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Facebook className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">Páginas</span>
                        <Badge variant="outline" className="ml-auto">{connection.assets.pages.length}</Badge>
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {connection.assets.pages.slice(0, 3).map((page) => (
                          <li key={page.id}>{page.name}</li>
                        ))}
                        {connection.assets.pages.length > 3 && (
                          <li>+{connection.assets.pages.length - 3} mais</li>
                        )}
                      </ul>
                    </div>
                  )}
                  {connection.assets.instagram_accounts.length > 0 && (
                    <div className="rounded-lg border p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Instagram className="h-4 w-4 text-pink-600" />
                        <span className="text-sm font-medium">Instagram</span>
                        <Badge variant="outline" className="ml-auto">{connection.assets.instagram_accounts.length}</Badge>
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {connection.assets.instagram_accounts.map((ig) => (
                          <li key={ig.id}>@{ig.username}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {connection.assets.whatsapp_business_accounts.length > 0 && (
                    <div className="rounded-lg border p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">WhatsApp Business</span>
                        <Badge variant="outline" className="ml-auto">{connection.assets.whatsapp_business_accounts.length}</Badge>
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {connection.assets.whatsapp_business_accounts.map((waba) => (
                          <li key={waba.id}>{waba.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {connection.assets.ad_accounts.length > 0 && (
                    <div className="rounded-lg border p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Megaphone className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">Contas de Anúncio</span>
                        <Badge variant="outline" className="ml-auto">{connection.assets.ad_accounts.length}</Badge>
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {connection.assets.ad_accounts.map((acc) => (
                          <li key={acc.id}>{acc.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {connection.lastError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Último erro: {connection.lastError}
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => refetch()}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </Button>
              <Button
                variant="destructive"
                onClick={() => disconnect()}
                disabled={isDisconnecting}
                className="gap-2"
              >
                {isDisconnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4" />
                )}
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
                  Sua conexão expirou. Reconecte para continuar usando as integrações Meta.
                </AlertDescription>
              </Alert>
            )}

            <p className="text-sm text-muted-foreground">
              Ao conectar, o sistema solicitará as permissões adequadas para o seu tipo de conta automaticamente.
              Após a conexão, você poderá ativar funcionalidades individuais (WhatsApp, Instagram, Anúncios, etc.) nos painéis específicos.
            </p>

            <Button
              onClick={() => connect()}
              disabled={isConnecting}
              className="gap-2"
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Conectar Meta
            </Button>

            <p className="text-xs text-muted-foreground">
              Você será redirecionado para o Facebook para autorizar o acesso. 
              Seus dados são armazenados de forma segura e isolada.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
