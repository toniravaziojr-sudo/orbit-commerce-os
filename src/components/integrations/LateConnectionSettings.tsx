import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ExternalLink, Unlink, Facebook, Instagram, Calendar, X, Check } from "lucide-react";
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

type Platform = "facebook" | "instagram";

export function LateConnectionSettings() {
  const { currentTenant } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [connection, setConnection] = useState<LateConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectingPlatform, setConnectingPlatform] = useState<Platform | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const popupRef = useRef<Window | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const tenantId = currentTenant?.id;

  // Handle callback messages from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "late:connected") {
        console.log("Received late:connected message:", event.data);
        
        // Clear intervals/timeouts
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        if (event.data.success) {
          toast.success(`${event.data.platform === 'instagram' ? 'Instagram' : 'Facebook'} conectado com sucesso!`);
        } else {
          toast.error(event.data.error || "Erro ao conectar");
        }

        setConnectingPlatform(null);
        loadConnection();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Check for callback params in URL
  useEffect(() => {
    const lateConnected = searchParams.get("late_connected");
    const lateError = searchParams.get("late_error");
    const platform = searchParams.get("platform");

    if (lateConnected === "true") {
      toast.success(`${platform === 'instagram' ? 'Instagram' : 'Facebook'} conectado com sucesso!`);
      searchParams.delete("late_connected");
      searchParams.delete("platform");
      setSearchParams(searchParams);
      loadConnection();
    } else if (lateError) {
      toast.error(`Erro ao conectar: ${lateError}`);
      searchParams.delete("late_error");
      searchParams.delete("platform");
      setSearchParams(searchParams);
      loadConnection();
    }
  }, [searchParams, setSearchParams]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const loadConnection = useCallback(async () => {
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
        
        if (data.status !== "connecting") {
          setConnectingPlatform(null);
        }
      } else {
        setConnection(null);
      }
    } catch (e) {
      console.error("Error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadConnection();
  }, [loadConnection]);

  /**
   * Connect to a specific platform (facebook or instagram)
   * Opens popup IMMEDIATELY in click handler to avoid blockers
   */
  const handleConnect = async (platform: Platform) => {
    if (!tenantId) return;

    setConnectingPlatform(platform);

    // CRITICAL: Open popup synchronously in click handler BEFORE any await
    const popup = window.open(
      "about:blank",
      `late_oauth_${platform}`,
      "width=600,height=700,scrollbars=yes,resizable=yes,left=200,top=100"
    );

    if (!popup) {
      toast.error("Popup bloqueado. Por favor, permita popups para este site.");
      setConnectingPlatform(null);
      return;
    }

    popupRef.current = popup;

    // Show loading state in popup immediately
    popup.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Conectando ${platform === 'instagram' ? 'Instagram' : 'Facebook'}...</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: linear-gradient(135deg, ${platform === 'instagram' ? '#833ab4, #fd1d1d, #fcb045' : '#1877f2, #42b72a'});
              color: white;
            }
            .container { text-align: center; padding: 2rem; }
            .spinner {
              width: 60px;
              height: 60px;
              border: 4px solid rgba(255,255,255,0.3);
              border-top-color: white;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin: 0 auto 24px;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
            h2 { font-size: 1.5rem; margin-bottom: 0.5rem; }
            p { opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="spinner"></div>
            <h2>Conectando ${platform === 'instagram' ? 'Instagram' : 'Facebook'}</h2>
            <p>Aguarde enquanto preparamos a autorização...</p>
          </div>
        </body>
      </html>
    `);

    try {
      // Call edge function to get OAuth URL
      const { data, error } = await supabase.functions.invoke("late-auth-start", {
        body: {
          tenant_id: tenantId,
          platform,
          redirect_url: "/integrations",
        },
      });

      if (error) {
        console.error("Late auth start error:", error);
        popup.close();
        toast.error("Erro ao iniciar conexão. Tente novamente.");
        setConnectingPlatform(null);
        return;
      }

      if (!data?.success) {
        popup.close();
        toast.error(data?.error || "Erro ao iniciar conexão");
        setConnectingPlatform(null);
        return;
      }

      const connectUrl = data.connect_url || data.oauth_url;
      if (!connectUrl) {
        popup.close();
        toast.error("URL de autorização não recebida");
        setConnectingPlatform(null);
        return;
      }

      // Redirect popup to OAuth URL
      popup.location.href = connectUrl;

      // Setup polling to detect when popup closes
      pollIntervalRef.current = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          
          // Reload connection after popup closes
          setTimeout(() => {
            loadConnection();
            setConnectingPlatform(null);
          }, 1000);
        }
      }, 500);

      // Timeout after 2 minutes
      timeoutRef.current = setTimeout(() => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        if (!popup.closed) {
          popup.close();
        }
        toast.error("Tempo limite excedido. Tente novamente.");
        loadConnection();
        setConnectingPlatform(null);
      }, 2 * 60 * 1000);

    } catch (e: any) {
      console.error("Late connect error:", e);
      if (popup && !popup.closed) popup.close();
      toast.error(e.message || "Erro ao conectar");
      setConnectingPlatform(null);
    }
  };

  const handleCancelConnecting = async () => {
    // Close popup if open
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }

    // Clear intervals
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Reset status in DB
    if (tenantId) {
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
    }

    setConnectingPlatform(null);
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

  // Helper functions
  const connectedAccounts = connection?.connected_accounts || [];
  
  const isFacebookConnected = connectedAccounts.some((a: any) => 
    a.platform === "facebook" || a.type === "facebook"
  );
  const isInstagramConnected = connectedAccounts.some((a: any) => 
    a.platform === "instagram" || a.type === "instagram"
  );

  const fbAccount = connectedAccounts.find((a: any) => 
    a.platform === "facebook" || a.type === "facebook"
  );
  const igAccount = connectedAccounts.find((a: any) => 
    a.platform === "instagram" || a.type === "instagram"
  );

  const isConnected = connection?.status === "connected";
  const hasError = connection?.status === "error" || connection?.status === "expired";
  const isConnectingState = connection?.status === "connecting" || connectingPlatform !== null;

  // Stale check (> 10 minutes)
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
          {isConnected && (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              Conectado
            </Badge>
          )}
          {hasError && <Badge variant="destructive">Erro</Badge>}
          {isConnectingState && !isConnected && (
            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
              Conectando...
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error Alert */}
        {hasError && connection?.last_error && (
          <Alert variant="destructive">
            <AlertDescription>{connection.last_error}</AlertDescription>
          </Alert>
        )}

        {/* Platform Connection Status Cards */}
        <div className="grid gap-3">
          {/* Facebook Card */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                isFacebookConnected 
                  ? 'bg-blue-100 dark:bg-blue-900/30' 
                  : 'bg-gray-100 dark:bg-gray-800'
              }`}>
                <Facebook className={`h-5 w-5 ${
                  isFacebookConnected ? 'text-blue-600' : 'text-gray-400'
                }`} />
              </div>
              <div>
                <p className="font-medium">Facebook</p>
                {isFacebookConnected && fbAccount ? (
                  <p className="text-sm text-muted-foreground">
                    {fbAccount.name || fbAccount.username || "Conectado"}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Não conectado</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isFacebookConnected ? (
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 dark:bg-green-900/20">
                  <Check className="h-3 w-3 mr-1" />
                  Conectado
                </Badge>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleConnect("facebook")}
                  disabled={connectingPlatform !== null}
                >
                  {connectingPlatform === "facebook" ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Conectar
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Instagram Card */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                isInstagramConnected 
                  ? 'bg-pink-100 dark:bg-pink-900/30' 
                  : 'bg-gray-100 dark:bg-gray-800'
              }`}>
                <Instagram className={`h-5 w-5 ${
                  isInstagramConnected ? 'text-pink-600' : 'text-gray-400'
                }`} />
              </div>
              <div>
                <p className="font-medium">Instagram</p>
                {isInstagramConnected && igAccount ? (
                  <p className="text-sm text-muted-foreground">
                    @{igAccount.username || igAccount.name || "Conectado"}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Não conectado</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isInstagramConnected ? (
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 dark:bg-green-900/20">
                  <Check className="h-3 w-3 mr-1" />
                  Conectado
                </Badge>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleConnect("instagram")}
                  disabled={connectingPlatform !== null}
                >
                  {connectingPlatform === "instagram" ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Conectar
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Connecting State Actions - only show if actively connecting a platform */}
        {connectingPlatform && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              Aguardando autorização do {connectingPlatform === 'instagram' ? 'Instagram' : 'Facebook'}...
            </p>
            <Button variant="ghost" size="sm" onClick={handleCancelConnecting}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          </div>
        )}

        {/* Connected State Actions */}
        {isConnected && (isFacebookConnected || isInstagramConnected) && (
          <div className="flex gap-2 pt-2 border-t">
            {connection?.connected_at && (
              <p className="text-xs text-muted-foreground flex-1">
                Conectado em: {new Date(connection.connected_at).toLocaleDateString("pt-BR")}
              </p>
            )}
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
              Desconectar tudo
            </Button>
          </div>
        )}

        {/* Initial state - no connection */}
        {!connection && !isConnectingState && (
          <p className="text-sm text-muted-foreground">
            Conecte suas redes sociais para agendar publicações diretamente do calendário de mídias.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
