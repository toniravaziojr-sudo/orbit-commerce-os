import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Link2, 
  ExternalLink,
  Info,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { useOlistConnection } from "@/hooks/useOlistConnection";
import { toast } from "sonner";

// Olist Logo Component
export function OlistLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className}>
      <rect width="48" height="48" rx="8" fill="#00C853" />
      <circle cx="24" cy="24" r="12" fill="white" />
      <circle cx="24" cy="24" r="6" fill="#00C853" />
    </svg>
  );
}

export function OlistConnectionCard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { 
    isConnected, 
    isExpired,
    isTokenExpiring,
    platformConfigured,
    connection, 
    isLoading, 
    startOAuth,
    disconnect, 
    refreshToken,
    isStartingOAuth,
    isDisconnecting,
    isRefreshing,
    refetch,
  } = useOlistConnection();

  // Processar parâmetros de callback do OAuth
  useEffect(() => {
    const olistConnected = searchParams.get("olist_connected");
    const olistError = searchParams.get("olist_error");

    if (olistConnected === "true") {
      toast.success("Conta Olist conectada com sucesso!");
      refetch();
      // Limpar params
      searchParams.delete("olist_connected");
      setSearchParams(searchParams);
    }

    if (olistError) {
      const errorMessages: Record<string, string> = {
        missing_params: "Parâmetros de autenticação ausentes",
        invalid_state: "Estado de autenticação inválido",
        not_configured: "Integração Olist não configurada na plataforma",
        token_exchange_failed: "Falha ao obter tokens de acesso",
        save_failed: "Falha ao salvar conexão",
        internal_error: "Erro interno do servidor",
      };
      toast.error(errorMessages[olistError] || `Erro: ${olistError}`);
      // Limpar params
      searchParams.delete("olist_error");
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams, refetch]);

  const handleConnect = () => {
    startOAuth("production");
  };

  const handleDisconnect = () => {
    if (confirm("Tem certeza que deseja desconectar da Olist?")) {
      disconnect();
    }
  };

  const handleRefreshToken = () => {
    refreshToken();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Carregando...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Plataforma não configurada
  if (!platformConfigured) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Olist não configurada</CardTitle>
              <CardDescription>
                A integração precisa ser configurada pelo administrador
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Para habilitar a integração com Olist, o administrador da plataforma 
              precisa configurar as credenciais do app (OLIST_CLIENT_ID e OLIST_CLIENT_SECRET) 
              nas configurações da plataforma.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Connected state
  if (isConnected && connection) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Conta Conectada
                <Badge variant="default" className="bg-green-600">Ativa</Badge>
                {isExpired && (
                  <Badge variant="destructive">Token Expirado</Badge>
                )}
                {isTokenExpiring && !isExpired && (
                  <Badge variant="outline" className="border-amber-500 text-amber-600">
                    Expirando
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Olist Partners API
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Conta:</span>
              <span className="font-medium">{connection.externalUsername}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Seller ID:</span>
              <span className="font-mono text-xs">{connection.externalUserId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Conectado em:</span>
              <span>{new Date(connection.connectedAt).toLocaleDateString("pt-BR")}</span>
            </div>
            {connection.expiresAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Token expira em:</span>
                <span className={isExpired || isTokenExpiring ? "text-amber-600 font-medium" : ""}>
                  {new Date(connection.expiresAt).toLocaleString("pt-BR")}
                </span>
              </div>
            )}
            {connection.lastSyncAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Última sincronização:</span>
                <span>{new Date(connection.lastSyncAt).toLocaleString("pt-BR")}</span>
              </div>
            )}
            {connection.lastError && (
              <Alert variant="destructive" className="mt-2">
                <AlertDescription className="text-xs">
                  {connection.lastError}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Token expiring/expired warning */}
          {(isExpired || isTokenExpiring) && (
            <Alert variant={isExpired ? "destructive" : "default"} className="border-amber-500/30">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {isExpired 
                  ? "O token de acesso expirou. Renove para continuar sincronizando."
                  : "O token de acesso está próximo de expirar. Recomendamos renovar."
                }
              </AlertDescription>
            </Alert>
          )}

          <div className="pt-4 border-t flex gap-2">
            {(isExpired || isTokenExpiring) && (
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={handleRefreshToken}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Renovando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Renovar Token
                  </>
                )}
              </Button>
            )}
            <Button 
              variant="destructive" 
              className={isExpired || isTokenExpiring ? "" : "w-full"}
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Desconectando...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Desconectar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Connection form - OAuth flow
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Link2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg">Conectar com Olist</CardTitle>
            <CardDescription>
              Autorize o acesso à sua conta Olist via OAuth
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Info about OAuth */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Ao clicar em "Conectar", você será redirecionado para o Olist 
            para autorizar o acesso. Nenhuma senha será compartilhada.
          </AlertDescription>
        </Alert>

        {/* Features */}
        <div className="space-y-2 text-sm">
          <p className="font-medium">Com a integração você poderá:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Sincronizar pedidos automaticamente</li>
            <li>Emitir NF-e diretamente pelo sistema</li>
            <li>Gerenciar estoque unificado</li>
            <li>Acompanhar status de entregas</li>
          </ul>
        </div>

        {/* Help Link */}
        <div className="text-sm">
          <a 
            href="https://developers.olist.com/docs/authentication" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary underline inline-flex items-center gap-1"
          >
            Documentação da API Olist <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Connect Button */}
        <Button 
          className="w-full" 
          onClick={handleConnect}
          disabled={isStartingOAuth}
        >
          {isStartingOAuth ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Iniciando...
            </>
          ) : (
            <>
              <Link2 className="h-4 w-4 mr-2" />
              Conectar com Olist
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
