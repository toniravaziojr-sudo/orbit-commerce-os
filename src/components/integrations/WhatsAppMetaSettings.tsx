import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MessageCircle, CheckCircle, XCircle, AlertCircle, ExternalLink, Send, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface MetaWhatsAppConfig {
  id: string;
  connection_status: string;
  phone_number: string | null;
  display_phone_number: string | null;
  verified_name: string | null;
  waba_id: string | null;
  phone_number_id: string | null;
  last_connected_at: string | null;
  last_error: string | null;
  token_expires_at: string | null;
}

export function WhatsAppMetaSettings() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();
  
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Mensagem de teste via WhatsApp Oficial!");

  // Fetch config
  const { data: config, isLoading, refetch } = useQuery({
    queryKey: ["whatsapp-meta-config", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const { data, error } = await supabase
        .from("whatsapp_configs")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("provider", "meta")
        .maybeSingle();
      
      if (error) throw error;
      return data as MetaWhatsAppConfig | null;
    },
    enabled: !!tenantId,
  });

  // Check for URL params (redirect from OAuth)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("whatsapp_connected");
    const error = params.get("whatsapp_error");
    
    if (connected === "true") {
      toast.success("WhatsApp conectado com sucesso!");
      refetch();
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    } else if (error) {
      toast.error(`Erro ao conectar: ${decodeURIComponent(error)}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [refetch]);

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-whatsapp-onboarding-start", {
        body: { tenant_id: tenantId },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: (data) => {
      // Open Meta Embedded Signup in new window
      if (data.embedded_signup_url) {
        const width = 700;
        const height = 700;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        
        window.open(
          data.embedded_signup_url,
          "MetaWhatsAppSignup",
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
        );
        
        toast.info("Complete a conexão na janela do Facebook/Meta");
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao iniciar conexão");
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!config?.id) throw new Error("Configuração não encontrada");
      
      const { error } = await supabase
        .from("whatsapp_configs")
        .update({
          connection_status: "disconnected",
          access_token: null,
          last_error: null,
        })
        .eq("id", config.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("WhatsApp desconectado");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-meta-config", tenantId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao desconectar");
    },
  });

  // Send test message mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      if (!testPhone.trim()) throw new Error("Informe um número de telefone");
      
      const { data, error } = await supabase.functions.invoke("meta-whatsapp-send", {
        body: {
          tenant_id: tenantId,
          phone: testPhone,
          message: testMessage,
        },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Mensagem de teste enviada!");
      setTestPhone("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao enviar mensagem");
    },
  });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "connected":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Conectado</Badge>;
      case "connecting":
        return <Badge className="bg-yellow-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Conectando</Badge>;
      case "token_expired":
        return <Badge className="bg-orange-500"><AlertCircle className="h-3 w-3 mr-1" /> Token Expirado</Badge>;
      case "error":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Erro</Badge>;
      default:
        return <Badge variant="secondary">Desconectado</Badge>;
    }
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return "—";
    return phone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, "+$1 ($2) $3-$4");
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isConnected = config?.connection_status === "connected";
  const isExpired = config?.connection_status === "token_expired";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            <CardTitle className="text-base">WhatsApp Cloud API (Meta Oficial)</CardTitle>
          </div>
          {getStatusBadge(config?.connection_status || null)}
        </div>
        <CardDescription>
          Conexão oficial via Meta Business Platform. Não requer aprovação individual de número.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Info */}
        {isConnected && config && (
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Número:</span>
                <p className="font-medium">{formatPhone(config.display_phone_number || config.phone_number)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Nome Verificado:</span>
                <p className="font-medium">{config.verified_name || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">WABA ID:</span>
                <p className="font-mono text-xs">{config.waba_id || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Phone Number ID:</span>
                <p className="font-mono text-xs">{config.phone_number_id || "—"}</p>
              </div>
            </div>
            
            {config.token_expires_at && (
              <p className="text-xs text-muted-foreground">
                Token expira em: {new Date(config.token_expires_at).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        )}

        {/* Token Expired Warning */}
        {isExpired && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              O token de acesso expirou. Reconecte sua conta para continuar enviando mensagens.
            </AlertDescription>
          </Alert>
        )}

        {/* Error Message */}
        {config?.last_error && !isConnected && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{config.last_error}</AlertDescription>
          </Alert>
        )}

        {/* Not Connected Info */}
        {!isConnected && !isExpired && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Conecte seu WhatsApp Business usando a API oficial da Meta. 
              Você precisará de uma conta Meta Business configurada.
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {!isConnected ? (
            <Button 
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {connectMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <MessageCircle className="h-4 w-4 mr-2" />
              )}
              Conectar WhatsApp
            </Button>
          ) : (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => refetch()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar Status
              </Button>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => {
                  if (confirm("Tem certeza que deseja desconectar o WhatsApp?")) {
                    disconnectMutation.mutate();
                  }
                }}
                disabled={disconnectMutation.isPending}
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Unplug className="h-4 w-4 mr-2" />
                )}
                Desconectar
              </Button>
            </>
          )}
        </div>

        {/* Test Message Section */}
        {isConnected && (
          <div className="border-t pt-4 mt-4 space-y-3">
            <h4 className="font-medium text-sm">Enviar Mensagem de Teste</h4>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="test-phone" className="sr-only">Número</Label>
                <Input
                  id="test-phone"
                  placeholder="(11) 99999-9999"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                />
              </div>
              <Button 
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending || !testPhone.trim()}
                size="sm"
              >
                {testMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Nota: Mensagens de texto só podem ser enviadas dentro da janela de 24h. 
              Fora dela, use templates aprovados.
            </p>
          </div>
        )}

        {/* Documentation Link */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          <a 
            href="https://developers.facebook.com/docs/whatsapp/cloud-api" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-primary"
          >
            <ExternalLink className="h-3 w-3" />
            Documentação Meta WhatsApp Cloud API
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
