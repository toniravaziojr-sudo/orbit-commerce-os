import { useState } from "react";
import { useShopeeConnection } from "@/hooks/useShopeeConnection";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Link2,
  Unlink,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShoppingCart,
  MessageSquare,
  Package,
  Loader2,
  Settings,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// Logo da Shopee (SVG inline)
export const ShopeeLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={className || "w-12 h-12"}>
    <rect width="48" height="48" rx="8" fill="#EE4D2D" />
    <path
      d="M24 10c-2.8 0-5.1 2.1-5.4 4.8h-2.1c-1.6 0-2.9 1.3-2.9 2.9v15.4c0 1.6 1.3 2.9 2.9 2.9h15c1.6 0 2.9-1.3 2.9-2.9V17.7c0-1.6-1.3-2.9-2.9-2.9h-2.1c-.3-2.7-2.6-4.8-5.4-4.8zm0 2.5c1.5 0 2.8 1.2 2.9 2.7h-5.8c.1-1.5 1.4-2.7 2.9-2.7zm0 8.3c2.2 0 4 1.8 4 4s-1.8 4-4 4-4-1.8-4-4 1.8-4 4-4z"
      fill="white"
    />
  </svg>
);

export function ShopeeConnectionCard() {
  const {
    status,
    isLoading,
    isConnected,
    isExpired,
    platformConfigured,
    connection,
    connect,
    disconnect,
    isConnecting,
    isDisconnecting,
    refetch,
  } = useShopeeConnection();

  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Plataforma não configurou as credenciais
  if (!platformConfigured) {
    return (
      <Card className="border-amber-500/30">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30">
              <ShopeeLogo />
            </div>
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                Shopee
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                  Configuração Pendente
                </Badge>
              </CardTitle>
              <CardDescription>
                Integração com a Shopee Brasil
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="border-amber-500/30 bg-amber-50 dark:bg-amber-900/10">
            <Settings className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-200">Integração não configurada</AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              O administrador da plataforma ainda não configurou as credenciais da Shopee. 
              Entre em contato com o suporte para solicitar a ativação.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={isConnected ? "border-green-500/30" : ""}>
      <CardHeader>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30">
            <ShopeeLogo />
          </div>
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              Shopee
              {isConnected && !isExpired && (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Conectado
                </Badge>
              )}
              {isConnected && isExpired && (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Token Expirado
                </Badge>
              )}
              {!isConnected && (
                <Badge variant="secondary">
                  Não conectado
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Sincronize pedidos, responda mensagens e gerencie anúncios
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Features disponíveis */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShoppingCart className="h-4 w-4 text-orange-500" />
            <span>Importar Pedidos</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageSquare className="h-4 w-4 text-green-500" />
            <span>Responder Mensagens</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Package className="h-4 w-4 text-purple-500" />
            <span>Gerenciar Anúncios</span>
          </div>
        </div>

        <Separator />

        {isConnected && connection && (
          <>
            {/* Informações da conta conectada */}
            <div className="rounded-lg bg-muted/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Loja conectada</span>
                <a
                  href="https://seller.shopee.com.br/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  {connection.externalUsername || `Shop ID: ${connection.externalUserId}`}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {connection.connectedAt && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Conectado há</span>
                  <span>
                    {formatDistanceToNow(new Date(connection.connectedAt), {
                      locale: ptBR,
                      addSuffix: false,
                    })}
                  </span>
                </div>
              )}

              {connection.lastSyncAt && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Última sincronização</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(connection.lastSyncAt), {
                      locale: ptBR,
                      addSuffix: true,
                    })}
                  </span>
                </div>
              )}

              {isExpired && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    O token de acesso expirou. Reconecte sua conta para continuar sincronizando.
                  </AlertDescription>
                </Alert>
              )}

              {connection.lastError && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {connection.lastError}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Botões de ação */}
            <div className="flex gap-2">
              {isExpired ? (
                <Button 
                  onClick={() => connect()} 
                  disabled={isConnecting}
                  className="flex-1"
                >
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Reconectar
                </Button>
              ) : (
                <Button variant="outline" className="flex-1" disabled>
                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                  Conta Ativa
                </Button>
              )}

              <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Unlink className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Desconectar Shopee?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso irá remover a conexão com sua conta da Shopee.
                      Os pedidos já importados permanecerão no sistema, mas você não receberá
                      novos pedidos ou mensagens até reconectar.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => disconnect()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDisconnecting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Unlink className="h-4 w-4 mr-2" />
                      )}
                      Desconectar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}

        {!isConnected && (
          <Button 
            onClick={() => connect()} 
            disabled={isConnecting}
            className="w-full bg-[#EE4D2D] text-white hover:bg-[#EE4D2D]/90"
          >
            {isConnecting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4 mr-2" />
            )}
            Conectar Shopee
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
