import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ExternalLink, RefreshCw, Unlink, Facebook, Instagram, Calendar, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

interface LateConnection {
  id: string;
  tenant_id: string;
  status: string;
  late_profile_id: string | null;
  late_profile_name: string | null;
  connected_accounts: any[] | null;
  connected_at: string | null;
  last_error: string | null;
  updated_at: string | null;
}

export function LateConnectionSettings() {
  const { currentTenant } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [connection, setConnection] = useState<LateConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Ref para popup window
  const popupRef = useRef<Window | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const tenantId = currentTenant?.id;

  // Check for callback params
  useEffect(() => {
    const lateConnected = searchParams.get("late_connected");
    const lateError = searchParams.get("late_error");

    if (lateConnected === "true") {
      toast.success("Canais conectados com sucesso!");
      searchParams.delete("late_connected");
      setSearchParams(searchParams);
      loadConnection();
    } else if (lateError) {
      toast.error(`Erro ao conectar: ${lateError}`);
      searchParams.delete("late_error");
      setSearchParams(searchParams);
      loadConnection();
    }
  }, [searchParams, setSearchParams]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

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
        
        // Reset connecting state if connection is done
        if (data.status !== "connecting") {
          setIsConnecting(false);
        }
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

  /**
   * CRITICAL: Open popup FIRST in click handler, THEN fetch URL
   * This prevents browser popup blockers from blocking the window
   */
  const handleConnect = async () => {
    if (!tenantId) return;

    setIsConnecting(true);

    // STEP 1: Open popup immediately in click handler (before any async)
    // This is critical to avoid popup blockers
    const popup = window.open(
      "about:blank",
      "late_oauth",
      "width=600,height=700,scrollbars=yes,resizable=yes"
    );

    if (!popup) {
      toast.error("Popup bloqueado. Por favor, permita popups para este site.");
      setIsConnecting(false);
      return;
    }

    popupRef.current = popup;

    // Show loading in popup
    popup.document.write(`
      <html>
        <head>
          <title>Conectando...</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container { text-align: center; }
            .spinner {
              width: 50px;
              height: 50px;
              border: 4px solid rgba(255,255,255,0.3);
              border-top-color: white;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin: 0 auto 20px;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="spinner"></div>
            <h2>Conectando...</h2>
            <p>Aguarde enquanto preparamos a conexão</p>
          </div>
        </body>
      </html>
    `);

    try {
      // STEP 2: Call edge function to get OAuth URL
      const { data, error } = await supabase.functions.invoke("late-auth-start", {
        body: {
          tenant_id: tenantId,
          redirect_url: "/integrations",
        },
      });

      if (error) {
        console.error("Late auth start error:", error);
        popup.close();
        toast.error("Erro ao iniciar conexão. Tente novamente.");
        setIsConnecting(false);
        return;
      }

      if (!data?.success) {
        popup.close();
        toast.error(data?.error || "Erro ao iniciar conexão");
        setIsConnecting(false);
        return;
      }

      // STEP 3: Redirect popup to OAuth URL
      const connectUrl = data.connect_url || data.oauth_url;
      if (connectUrl) {
        popup.location.href = connectUrl;

        // Poll for popup close or connection complete
        pollIntervalRef.current = setInterval(() => {
          if (popup.closed) {
            clearInterval(pollIntervalRef.current!);
            pollIntervalRef.current = null;
            // Reload connection status
            setTimeout(() => {
              loadConnection();
              setIsConnecting(false);
            }, 1000);
          }
        }, 500);

        // Timeout after 5 minutes
        setTimeout(() => {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          if (!popup.closed) {
            popup.close();
          }
          loadConnection();
          setIsConnecting(false);
        }, 5 * 60 * 1000);

      } else {
        popup.close();
        toast.error("URL de autorização não recebida");
        setIsConnecting(false);
      }

    } catch (e: any) {
      console.error("Late connect error:", e);
      if (popup && !popup.closed) {
        popup.close();
      }
      toast.error(e.message || "Erro ao conectar");
      setIsConnecting(false);
    }
  };

  const handleCancelConnecting = async () => {
    if (!tenantId) return;

    // Close popup if open
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }

    // Clear interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // Reset status in DB
    try {
      await supabase
        .from("late_connections")
        .update({ 
          status: "disconnected", 
          last_error: "Conexão cancelada pelo usuário",
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId);
    } catch (e) {
      console.error("Error resetting connection:", e);
    }

    setIsConnecting(false);
    loadConnection();
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

      toast.success("Contas desconectadas");
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
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Conectado</Badge>;
      case "connecting":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Conectando...</Badge>;
      case "error":
        return <Badge variant="destructive">Erro</Badge>;
      case "expired":
        return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">Expirado</Badge>;
      default:
        return <Badge variant="secondary">Desconectado</Badge>;
    }
  };

  const connectedAccounts = connection?.connected_accounts || [];
  const fbAccount = connectedAccounts.find((a: any) => 
    a.platform === "facebook" || a.type === "facebook"
  );
  const igAccount = connectedAccounts.find((a: any) => 
    a.platform === "instagram" || a.type === "instagram"
  );

  // Check if connecting is stale (> 10 minutes)
  const isStaleConnecting = connection?.status === "connecting" && connection.updated_at 
    && new Date(connection.updated_at) < new Date(Date.now() - 10 * 60 * 1000);

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
  const isConnectingState = connection?.status === "connecting" || isConnecting;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Publicação Social</CardTitle>
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
                  Abrindo janela...
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
                  Abrindo janela...
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
        ) : isConnectingState ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">
                {isStaleConnecting 
                  ? "A conexão parece estar travada." 
                  : "Processando conexão..."}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {isStaleConnecting 
                ? "A janela de autorização pode ter sido fechada ou ocorreu um erro."
                : "Complete a autorização na janela que foi aberta."}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleConnect} disabled={isConnecting && !isStaleConnecting}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Tentar novamente
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleCancelConnecting}
                className="text-muted-foreground"
              >
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Processando...</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
