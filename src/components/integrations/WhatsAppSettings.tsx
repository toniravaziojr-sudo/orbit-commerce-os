import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePlatformOperator } from "@/hooks/usePlatformOperator";
import { useTenantType } from "@/hooks/useTenantType";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
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
  connection_status: "disconnected" | "connecting" | "connected" | "qr_pending";
  qr_code: string | null;
  phone_number: string | null;
  last_connected_at: string | null;
  hasCredentials: boolean;
}

export function WhatsAppSettings() {
  const { currentTenant, profile, hasRole } = useAuth();
  const { toast } = useToast();
  const { isPlatformOperator } = usePlatformOperator();
  const { isPlatformTenant } = useTenantType();
  const tenantId = currentTenant?.id || profile?.current_tenant_id;
  
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isRefreshingQr, setIsRefreshingQr] = useState(false);
  const [isEnablingChannel, setIsEnablingChannel] = useState(false);
  const [showTestInput, setShowTestInput] = useState(false);
  const [testPhoneInput, setTestPhoneInput] = useState("");
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      // SECURITY: Use RPC function that only returns non-sensitive fields
      // This function enforces tenant access control server-side
      const { data, error } = await supabase
        .rpc("get_whatsapp_config_for_tenant", { p_tenant_id: tenantId });

      if (error) throw error;

      // RPC returns array, get first item
      const configData = Array.isArray(data) && data.length > 0 ? data[0] : null;

      if (configData) {
        setConfig({
          id: configData.id,
          connection_status: (configData.connection_status as WhatsAppConfig["connection_status"]) || "disconnected",
          qr_code: configData.qr_code,
          phone_number: configData.phone_number,
          last_connected_at: configData.last_connected_at,
          // hasCredentials requires both is_enabled AND instance_id (credentials provisioned)
          hasCredentials: configData.is_enabled === true && !!configData.instance_id,
        });
      } else {
        setConfig(null);
      }
    } catch (error) {
      console.error("Error fetching WhatsApp config:", error);
      setConfig(null);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) fetchConfig();
  }, [tenantId, fetchConfig]);

  // Polling de status - NÃO limpa o QR enquanto estiver em qr_pending
  useEffect(() => {
    if (config?.connection_status !== "qr_pending" && config?.connection_status !== "connecting") return;

    const interval = setInterval(async () => {
      if (!tenantId) return;
      try {
        const { data, error } = await supabase.functions.invoke("whatsapp-status", { body: { tenant_id: tenantId } });
        if (!error && data?.status) {
          // IMPORTANTE: Manter o QR code existente enquanto polling
          // Só limpar se conectou com sucesso
          if (data.status === "connected") {
            toast({ title: "Conectado!", description: `WhatsApp conectado: ${data.phone_number}` });
            clearInterval(interval);
            await fetchConfig();
          } else {
            // Atualiza status mas PRESERVA o qr_code atual
            setConfig(prev => prev ? { 
              ...prev, 
              connection_status: data.status === "connected" ? "connected" : prev.connection_status,
              phone_number: data.phone_number || prev.phone_number,
              // NÃO sobrescreve qr_code aqui - mantém o existente
            } : prev);
          }
        }
      } catch (err) {
        console.error("Error polling status:", err);
      }
    }, 5000); // Aumenta para 5 segundos para dar mais tempo

    return () => clearInterval(interval);
  }, [config?.connection_status, tenantId, toast, fetchConfig]);

  const handleConnect = async () => {
    if (!tenantId) return;
    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-connect", { body: { tenant_id: tenantId } });
      
      if (error) {
        console.error("WhatsApp connect error:", error);
        // Handle 412 specifically - credentials not configured
        const errorMessage = error.message || "Erro ao conectar. Tente novamente.";
        const is412 = errorMessage.includes("412") || errorMessage.includes("credenciais");
        
        toast({ 
          title: is412 ? "Credenciais não configuradas" : "Erro de conexão", 
          description: is412 
            ? "As credenciais Z-API não foram configuradas. Configure em Integrações da Plataforma." 
            : errorMessage, 
          variant: "destructive" 
        });
        return;
      }
      
      if (data?.success === false) {
        // Handle 412 from backend response
        const is412 = data.error?.includes("412") || data.error?.includes("credenciais") || data.error?.includes("Precondition");
        
        toast({ 
          title: is412 ? "Credenciais não configuradas" : "Erro", 
          description: is412 
            ? "As credenciais Z-API não foram configuradas. Configure em Integrações da Plataforma."
            : (data.error || "Erro ao conectar WhatsApp"), 
          variant: "destructive" 
        });
        if (data.trace_id) {
          console.log("Trace ID:", data.trace_id);
        }
        return;
      }
      
      if (data?.qr_code) {
        setConfig(prev => prev ? { ...prev, qr_code: data.qr_code, connection_status: "qr_pending" } : prev);
        toast({ title: "QR Code gerado", description: "Escaneie o QR Code com seu WhatsApp" });
      } else if (data?.status === "connected") {
        toast({ title: "Já conectado!", description: `WhatsApp: ${data.phone_number}` });
        await fetchConfig();
      }
    } catch (error: any) {
      console.error("WhatsApp connect exception:", error);
      toast({ 
        title: "Erro", 
        description: "Erro de comunicação com o servidor. Verifique sua conexão.", 
        variant: "destructive" 
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!tenantId || !confirm("Deseja realmente desconectar o WhatsApp?")) return;
    setIsDisconnecting(true);
    try {
      await supabase.functions.invoke("whatsapp-disconnect", { body: { tenant_id: tenantId } });
      toast({ title: "Desconectado", description: "WhatsApp desconectado" });
      await fetchConfig();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleTest = async () => {
    if (!tenantId || !testPhoneInput.trim()) {
      toast({ title: "Erro", description: "Informe o número de telefone", variant: "destructive" });
      return;
    }
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: { tenant_id: tenantId, phone: testPhoneInput.trim(), message: "🚀 Teste WhatsApp - Comando Central" },
      });
      if (error) throw error;
      toast({ title: data?.success ? "Enviado!" : "Falha", description: data?.error || "Mensagem enviada", variant: data?.success ? "default" : "destructive" });
      if (data?.success) { setShowTestInput(false); setTestPhoneInput(""); }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleEnableWhatsApp = async () => {
    if (!tenantId) return;
    setIsEnablingChannel(true);
    try {
      // Create whatsapp_configs entry for this tenant via edge function
      const { data, error } = await supabase.functions.invoke("whatsapp-enable", {
        body: { tenant_id: tenantId },
      });
      
      if (error) throw error;
      
      if (data?.success) {
        toast({ title: "WhatsApp habilitado", description: "Agora você pode conectar seu WhatsApp" });
        await fetchConfig();
      } else {
        throw new Error(data?.error || "Erro ao habilitar canal");
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsEnablingChannel(false);
    }
  };

  if (isLoading) {
    return <Card><CardContent className="pt-6 flex items-center justify-center min-h-[200px]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  const isConnected = config?.connection_status === "connected";
  const isQrPending = config?.connection_status === "qr_pending";

  if (!config?.hasCredentials) {
    const isOwnerOrAdmin = hasRole('owner') || hasRole('admin');
    
    // Platform tenant + platform operator: redirect to /platform/integrations
    if (isPlatformTenant && isPlatformOperator) {
      return (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <CardTitle>WhatsApp</CardTitle>
                <CardDescription>Credenciais Z-API não configuradas</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  As credenciais Z-API (Instance ID, Instance Token e Client Token) ainda não foram provisionadas para este tenant.
                </AlertDescription>
              </Alert>
              <Button asChild>
                <Link to="/platform/integrations">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Configurar em Integrações da Plataforma
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }
    
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <MessageCircle className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle>WhatsApp</CardTitle>
              <CardDescription>Envie notificações via WhatsApp</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isOwnerOrAdmin ? (
            <div className="space-y-4">
              <Alert>
                <MessageCircle className="h-4 w-4" />
                <AlertDescription>
                  O canal WhatsApp ainda não foi habilitado para esta loja.
                </AlertDescription>
              </Alert>
              <Button onClick={handleEnableWhatsApp} disabled={isEnablingChannel}>
                {isEnablingChannel ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <MessageCircle className="h-4 w-4 mr-2" />
                )}
                Habilitar WhatsApp
              </Button>
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                O canal WhatsApp ainda não foi habilitado para sua loja. Entre em contato com o suporte.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  // Format phone number for display
  const formatPhone = (phone: string | null) => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 13) {
      return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    if (digits.length === 12) {
      return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
    }
    return phone;
  };

  if (isConnected) {
    const formattedPhone = formatPhone(config?.phone_number);
    
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <MessageCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                WhatsApp
                <StatusBadge variant="success">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Conectado
                </StatusBadge>
              </CardTitle>
              <CardDescription>Notificações ativas - IA pronta para atender</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Número conectado:</span>
              <span className="font-medium flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-green-600" />
                {formattedPhone || <span className="text-muted-foreground italic">Número não disponível</span>}
                {formattedPhone && <CheckCircle className="h-4 w-4 text-green-600" />}
              </span>
            </div>
            {config?.last_connected_at && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Conectado desde:</span>
                <span>{new Date(config.last_connected_at).toLocaleString('pt-BR')}</span>
              </div>
            )}
          </div>
          
          {showTestInput && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <Label>Enviar teste para:</Label>
              <div className="flex gap-2">
                <Input 
                  type="tel" 
                  placeholder="5511999999999" 
                  value={testPhoneInput} 
                  onChange={(e) => setTestPhoneInput(e.target.value)} 
                  className="flex-1" 
                />
                <Button onClick={handleTest} disabled={isTesting}>
                  {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" onClick={() => setShowTestInput(false)}>Cancelar</Button>
              </div>
            </div>
          )}
          
          <div className="flex gap-2">
            {!showTestInput && (
              <Button variant="outline" onClick={() => setShowTestInput(true)}>
                <Send className="h-4 w-4 mr-2" />
                Enviar teste
              </Button>
            )}
            <Button 
              variant="ghost" 
              className="text-destructive" 
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

  if (isQrPending && config?.qr_code) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30"><QrCode className="h-5 w-5 text-amber-600" /></div>
            <div><CardTitle className="flex items-center gap-2">WhatsApp<StatusBadge variant="warning"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Aguardando</StatusBadge></CardTitle><CardDescription>Escaneie o QR Code</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20"><Smartphone className="h-4 w-4 text-amber-600" /><AlertDescription>WhatsApp Business → Menu ⋮ → Dispositivos conectados → Conectar</AlertDescription></Alert>
          <div className="flex justify-center py-4"><div className="bg-white p-4 rounded-lg shadow-sm"><img src={config.qr_code} alt="QR Code" className="w-64 h-64" /></div></div>
          <div className="flex justify-center"><Button variant="outline" onClick={() => { setIsRefreshingQr(true); handleConnect().finally(() => setIsRefreshingQr(false)); }} disabled={isRefreshingQr}>{isRefreshingQr ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}Atualizar QR</Button></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted"><MessageCircle className="h-5 w-5 text-muted-foreground" /></div>
          <div><CardTitle className="flex items-center gap-2">WhatsApp<StatusBadge variant="outline"><XCircle className="h-3 w-3 mr-1" />Desconectado</StatusBadge></CardTitle><CardDescription>Conecte seu WhatsApp</CardDescription></div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert><MessageCircle className="h-4 w-4" /><AlertDescription>Clique abaixo e escaneie o QR Code com seu celular.</AlertDescription></Alert>
        <Button onClick={handleConnect} disabled={isConnecting} className="w-full">{isConnecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <QrCode className="h-4 w-4 mr-2" />}Conectar WhatsApp</Button>
      </CardContent>
    </Card>
  );
}
