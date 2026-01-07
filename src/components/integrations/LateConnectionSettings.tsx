import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ExternalLink, RefreshCw, Unlink, Facebook, Instagram, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSearchParams, useNavigate } from "react-router-dom";

interface LateConnection {
  id: string;
  tenant_id: string;
  status: string;
  late_profile_id: string | null;
  late_profile_name: string | null;
  connected_accounts: any[] | null;
  connected_at: string | null;
  last_error: string | null;
}

export function LateConnectionSettings() {
  const { currentTenant } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [connection, setConnection] = useState<LateConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const tenantId = currentTenant?.id;

  // Check for callback params
  useEffect(() => {
    const lateConnected = searchParams.get("late_connected");
    const lateError = searchParams.get("late_error");

    if (lateConnected === "true") {
      toast.success("Late conectado com sucesso!");
      // Clean up URL
      searchParams.delete("late_connected");
      setSearchParams(searchParams);
      loadConnection();
    } else if (lateError) {
      toast.error(`Erro ao conectar Late: ${lateError}`);
      searchParams.delete("late_error");
      setSearchParams(searchParams);
      loadConnection();
    }
  }, [searchParams]);

  const loadConnection = async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("late_connections")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Error loading Late connection:", error);
      }

      if (data) {
        setConnection({
          ...data,
          connected_accounts: Array.isArray(data.connected_accounts) ? data.connected_accounts : [],
        });
      } else {
        setConnection(null);
      }
    } catch (e) {
      console.error("Error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConnection();
  }, [tenantId]);

  const handleConnect = async () => {
    if (!tenantId) return;

    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("late-auth-start", {
        body: {
          tenant_id: tenantId,
          redirect_url: "/integrations",
        },
      });

      if (error || !data?.success) {
        toast.error(data?.error || "Erro ao iniciar conexão");
        return;
      }

      // Redirect to Late OAuth
      if (data.oauth_url) {
        window.location.href = data.oauth_url;
      } else {
        toast.error("URL de autorização não recebida");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao conectar");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!tenantId || !connection) return;

    setIsDisconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("late-disconnect", {
        body: { tenant_id: tenantId },
      });

      if (error || !data?.success) {
        toast.error(data?.error || "Erro ao desconectar");
        return;
      }

      toast.success("Late desconectado");
      loadConnection();
    } catch (e: any) {
      toast.error(e.message || "Erro ao desconectar");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge className="bg-green-100 text-green-800">Conectado</Badge>;
      case "connecting":
        return <Badge className="bg-yellow-100 text-yellow-800">Conectando...</Badge>;
      case "error":
        return <Badge variant="destructive">Erro</Badge>;
      case "expired":
        return <Badge className="bg-orange-100 text-orange-800">Expirado</Badge>;
      default:
        return <Badge variant="secondary">Desconectado</Badge>;
    }
  };

  const connectedAccounts = connection?.connected_accounts || [];
  const fbAccount = connectedAccounts.find((a: any) => a.platform === "facebook" || a.type === "facebook");
  const igAccount = connectedAccounts.find((a: any) => a.platform === "instagram" || a.type === "instagram");

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isConnected = connection?.status === "connected";
  const hasError = connection?.status === "error" || connection?.status === "expired";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Publicação Social (Late)</CardTitle>
              <CardDescription>Agende posts para Facebook e Instagram</CardDescription>
            </div>
          </div>
          {connection && getStatusBadge(connection.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connection || connection.status === "disconnected" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Conecte suas redes sociais para agendar publicações diretamente do calendário de mídias.
            </p>
            <Button onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Conectar Facebook / Instagram
                </>
              )}
            </Button>
          </>
        ) : hasError ? (
          <>
            <Alert variant="destructive">
              <AlertDescription>
                {connection.last_error || "Erro na conexão. Por favor, reconecte."}
              </AlertDescription>
            </Alert>
            <Button onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reconectando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reconectar
                </>
              )}
            </Button>
          </>
        ) : isConnected ? (
          <>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Contas conectadas:</p>
              
              <div className="flex flex-wrap gap-2">
                {fbAccount && (
                  <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 px-3 py-2">
                    <Facebook className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">
                      {fbAccount.name || fbAccount.username || "Facebook"}
                    </span>
                  </div>
                )}
                {igAccount && (
                  <div className="flex items-center gap-2 rounded-lg bg-pink-50 dark:bg-pink-900/20 px-3 py-2">
                    <Instagram className="h-4 w-4 text-pink-600" />
                    <span className="text-sm font-medium">
                      {igAccount.name || igAccount.username || "Instagram"}
                    </span>
                  </div>
                )}
                {connectedAccounts.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma conta detectada. Tente reconectar.
                  </p>
                )}
              </div>

              {connection.connected_at && (
                <p className="text-xs text-muted-foreground">
                  Conectado em: {new Date(connection.connected_at).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={handleConnect} disabled={isConnecting}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reconectar
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleDisconnect} 
                disabled={isDisconnecting}
                className="text-destructive hover:text-destructive"
              >
                {isDisconnecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="mr-2 h-4 w-4" />
                )}
                Desconectar
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Processando conexão...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
