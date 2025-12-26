import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { 
  MessageCircle, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Send, 
  RefreshCw, 
  QrCode,
  Unplug,
  AlertCircle,
  Smartphone,
  ExternalLink
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WhatsAppConfig {
  id?: string;
  instance_id: string;
  instance_token: string;
  connection_status: "disconnected" | "connecting" | "connected" | "qr_pending";
  qr_code: string | null;
  phone_number: string | null;
  last_connected_at: string | null;
  provider: string;
}

export function WhatsAppSettings() {
  const { currentTenant, profile } = useAuth();
  const { toast } = useToast();
  const tenantId = currentTenant?.id || profile?.current_tenant_id;
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isRefreshingQr, setIsRefreshingQr] = useState(false);
  const [showTestInput, setShowTestInput] = useState(false);
  const [testPhoneInput, setTestPhoneInput] = useState("");
  
  const [instanceId, setInstanceId] = useState("");
  const [instanceToken, setInstanceToken] = useState("");
  
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_configs")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig({
          id: data.id,
          instance_id: data.instance_id || "",
          instance_token: data.instance_token || "",
          connection_status: (data.connection_status as WhatsAppConfig["connection_status"]) || "disconnected",
          qr_code: data.qr_code,
          phone_number: data.phone_number,
          last_connected_at: data.last_connected_at,
          provider: data.provider || "z-api",
        });
        setInstanceId(data.instance_id || "");
        setInstanceToken(data.instance_token || "");
      }
    } catch (error) {
      console.error("Error fetching WhatsApp config:", error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) {
      fetchConfig();
    }
  }, [tenantId, fetchConfig]);

  // Poll for connection status when QR is pending
  useEffect(() => {
    if (config?.connection_status !== "qr_pending" && config?.connection_status !== "connecting") {
      return;
    }

    const interval = setInterval(async () => {
      if (!tenantId) return;
      
      try {
        const { data, error } = await supabase.functions.invoke("whatsapp-status", {
          body: { tenant_id: tenantId },
        });

        if (!error && data?.status) {
          setConfig(prev => prev ? { ...prev, connection_status: data.status, phone_number: data.phone_number } : prev);
          
          if (data.status === "connected") {
            toast({ title: "Conectado!", description: `WhatsApp conectado: ${data.phone_number}` });
            clearInterval(interval);
            await fetchConfig();
          }
        }
      } catch (err) {
        console.error("Error polling status:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [config?.connection_status, tenantId, toast, fetchConfig]);

  const handleSaveCredentials = async () => {
    if (!tenantId || !instanceId.trim() || !instanceToken.trim()) {
      toast({ title: "Erro", description: "Preencha o Instance ID e Token", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        tenant_id: tenantId,
        instance_id: instanceId.trim(),
        instance_token: instanceToken.trim(),
        provider: "z-api",
        connection_status: "disconnected",
        updated_at: new Date().toISOString(),
      };

      if (config?.id) {
        const { error } = await supabase
          .from("whatsapp_configs")
          .update(payload)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("whatsapp_configs")
          .insert(payload);
        if (error) throw error;
      }

      toast({ title: "Salvo", description: "Credenciais do WhatsApp salvas" });
      await fetchConfig();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnect = async () => {
    if (!tenantId) return;

    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-connect", {
        body: { tenant_id: tenantId },
      });

      if (error) throw error;

      if (data?.qr_code) {
        setConfig(prev => prev ? { ...prev, qr_code: data.qr_code, connection_status: "qr_pending" } : prev);
        toast({ title: "QR Code gerado", description: "Escaneie o QR Code com seu WhatsApp" });
      } else if (data?.status === "connected") {
        toast({ title: "Já conectado!", description: `WhatsApp já está conectado: ${data.phone_number}` });
        await fetchConfig();
      } else {
        toast({ title: "Erro", description: data?.error || "Erro ao gerar QR Code", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRefreshQr = async () => {
    setIsRefreshingQr(true);
    await handleConnect();
    setIsRefreshingQr(false);
  };

  const handleDisconnect = async () => {
    if (!tenantId) return;
    
    if (!confirm("Deseja realmente desconectar o WhatsApp?")) return;

    setIsDisconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-disconnect", {
        body: { tenant_id: tenantId },
      });

      if (error) throw error;

      toast({ title: "Desconectado", description: "WhatsApp desconectado" });
      await fetchConfig();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleTest = async () => {
    if (!tenantId) return;
    
    const targetPhone = testPhoneInput.trim();
    if (!targetPhone) {
      toast({ title: "Erro", description: "Informe o número de telefone", variant: "destructive" });
      return;
    }

    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: { 
          tenant_id: tenantId, 
          phone: targetPhone,
          message: "🚀 Teste de integração WhatsApp - Comando Central\n\nSe você recebeu esta mensagem, a integração está funcionando!"
        },
      });

      if (error) throw error;

      toast({
        title: data?.success ? "Mensagem enviada!" : "Falha no envio",
        description: data?.message || data?.error,
        variant: data?.success ? "default" : "destructive",
      });
      
      if (data?.success) {
        setShowTestInput(false);
        setTestPhoneInput("");
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isConnected = config?.connection_status === "connected";
  const isQrPending = config?.connection_status === "qr_pending" || config?.connection_status === "connecting";
  const hasCredentials = !!(config?.instance_id && config?.instance_token);

  // Estado conectado - modo compacto
  if (isConnected && config) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                WhatsApp
                <StatusBadge variant="success" className="ml-2">
                  <CheckCircle className="h-3 w-3 mr-1" />Conectado
                </StatusBadge>
              </CardTitle>
              <CardDescription>Notificações via WhatsApp ativas</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Número conectado:</span>
              <span className="font-medium flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                {config.phone_number || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Provedor:</span>
              <span className="font-medium uppercase">{config.provider}</span>
            </div>
            {config.last_connected_at && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Conectado desde:</span>
                <span className="font-medium">
                  {new Date(config.last_connected_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
            )}
          </div>

          <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200 text-sm">
              <strong>Ativo!</strong> Notificações com canal WhatsApp serão enviadas para este número.
            </AlertDescription>
          </Alert>

          {showTestInput && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <Label className="text-sm font-medium">Enviar mensagem de teste para:</Label>
              <div className="flex gap-2">
                <Input
                  type="tel"
                  placeholder="5511999999999"
                  value={testPhoneInput}
                  onChange={(e) => setTestPhoneInput(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleTest} disabled={isTesting}>
                  {isTesting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Enviar
                </Button>
                <Button variant="ghost" onClick={() => { setShowTestInput(false); setTestPhoneInput(""); }}>
                  Cancelar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Informe o número com código do país (ex: 5511999999999)
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {!showTestInput && (
              <Button variant="outline" onClick={() => setShowTestInput(true)}>
                <Send className="h-4 w-4 mr-2" />
                Enviar teste
              </Button>
            )}
            <Button 
              variant="ghost" 
              className="text-destructive hover:text-destructive" 
              onClick={handleDisconnect} 
              disabled={isDisconnecting}
            >
              {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4 mr-2" />}
              Desconectar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Estado: QR Code pendente
  if (isQrPending && config?.qr_code) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <QrCode className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                WhatsApp
                <StatusBadge variant="warning" className="ml-2">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />Aguardando conexão
                </StatusBadge>
              </CardTitle>
              <CardDescription>Escaneie o QR Code para conectar</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <Smartphone className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
              Abra o WhatsApp no celular → Menu ⋮ → <strong>Dispositivos conectados</strong> → Conectar dispositivo
            </AlertDescription>
          </Alert>

          <div className="flex justify-center py-4">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <img 
                src={config.qr_code} 
                alt="QR Code WhatsApp" 
                className="w-64 h-64"
              />
            </div>
          </div>

          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={handleRefreshQr} disabled={isRefreshingQr}>
              {isRefreshingQr ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Atualizar QR Code
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Estado: configuração inicial
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <MessageCircle className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              WhatsApp
              <StatusBadge variant="outline" className="ml-2">
                <XCircle className="h-3 w-3 mr-1" />Não configurado
              </StatusBadge>
            </CardTitle>
            <CardDescription>Envie notificações via WhatsApp</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Para usar o WhatsApp, você precisa de uma conta no <strong>Z-API</strong> (ou similar). 
            Crie sua conta e instância, depois insira as credenciais abaixo.
            <a 
              href="https://z-api.io" 
              target="_blank" 
              rel="noopener noreferrer"
              className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
            >
              Criar conta Z-API <ExternalLink className="h-3 w-3" />
            </a>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instance_id">Instance ID</Label>
            <Input
              id="instance_id"
              placeholder="Ex: 3CEC7A5C2A10..."
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instance_token">Instance Token</Label>
            <Input
              id="instance_token"
              type="password"
              placeholder="Seu token da instância"
              value={instanceToken}
              onChange={(e) => setInstanceToken(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSaveCredentials} disabled={isSaving || !instanceId.trim() || !instanceToken.trim()}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Salvar credenciais
          </Button>

          {hasCredentials && (
            <Button variant="outline" onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <QrCode className="h-4 w-4 mr-2" />}
              Gerar QR Code
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
