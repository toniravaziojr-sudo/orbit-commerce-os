import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ExternalLink, 
  Send, 
  RefreshCw, 
  Unplug, 
  Settings, 
  Save,
  Shield,
  Zap,
  Globe,
  Building2,
  Phone
} from "lucide-react";
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
  const [showManualConfig, setShowManualConfig] = useState(false);
  const [manualConfig, setManualConfig] = useState({
    phoneNumberId: "",
    accessToken: "",
    wabaId: "",
    displayPhoneNumber: "",
  });

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
      window.history.replaceState({}, "", window.location.pathname);
    } else if (error) {
      toast.error(`Erro ao conectar: ${decodeURIComponent(error)}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [refetch]);

  // Connect mutation (OAuth flow)
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

  // Manual config save mutation
  const saveManualConfigMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("Tenant não identificado");
      if (!manualConfig.phoneNumberId.trim()) throw new Error("Phone Number ID é obrigatório");
      if (!manualConfig.accessToken.trim()) throw new Error("Access Token é obrigatório");

      const { data, error } = await supabase
        .from("whatsapp_configs")
        .upsert({
          tenant_id: tenantId,
          provider: "meta",
          phone_number_id: manualConfig.phoneNumberId.trim(),
          access_token: manualConfig.accessToken.trim(),
          waba_id: manualConfig.wabaId.trim() || null,
          display_phone_number: manualConfig.displayPhoneNumber.trim() || null,
          phone_number: manualConfig.displayPhoneNumber.trim() || null,
          connection_status: "connected",
          is_enabled: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "tenant_id,provider",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("WhatsApp Cloud API conectado com sucesso!");
      setShowManualConfig(false);
      setManualConfig({ phoneNumberId: "", accessToken: "", wabaId: "", displayPhoneNumber: "" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-meta-config", tenantId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao salvar credenciais");
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

  const formatPhone = (phone: string | null) => {
    if (!phone) return "—";
    // Try to format Brazilian numbers
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return phone.startsWith('+') ? phone : `+${phone}`;
  };

  if (isLoading) {
    return (
      <Card className="border-2">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isConnected = config?.connection_status === "connected";
  const isExpired = config?.connection_status === "token_expired";

  // CONNECTED STATE - Show connection details
  if (isConnected && config) {
    return (
      <Card className="border-2 border-green-200 dark:border-green-900">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
                <svg viewBox="0 0 24 24" className="h-7 w-7 text-green-600" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  WhatsApp Cloud API
                  <Badge className="bg-green-600 text-white">
                    <CheckCircle className="h-3 w-3 mr-1" /> Conectado
                  </Badge>
                </CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  API Oficial Meta • Criptografia Ponta-a-Ponta
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Connection Details */}
          <div className="grid gap-4 sm:grid-cols-2 p-4 rounded-lg bg-muted/50">
            <div className="flex items-start gap-3">
              <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Número Conectado</p>
                <p className="font-medium">{formatPhone(config.display_phone_number || config.phone_number)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Nome Verificado</p>
                <p className="font-medium">{config.verified_name || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Globe className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">WABA ID</p>
                <p className="font-mono text-xs">{config.waba_id || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Zap className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Phone Number ID</p>
                <p className="font-mono text-xs">{config.phone_number_id || "—"}</p>
              </div>
            </div>
          </div>

          {config.token_expires_at && (
            <p className="text-xs text-muted-foreground text-center">
              Token expira em: {new Date(config.token_expires_at).toLocaleDateString("pt-BR", { 
                day: '2-digit', month: 'long', year: 'numeric' 
              })}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar Status
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowManualConfig(!showManualConfig)}>
              <Settings className="h-4 w-4 mr-2" />
              Atualizar Credenciais
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              className="text-destructive hover:text-destructive"
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
          </div>

          {/* Manual Config Collapsible */}
          <Collapsible open={showManualConfig} onOpenChange={setShowManualConfig}>
            <CollapsibleContent>
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30 mt-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Settings className="h-4 w-4" />
                  Atualizar Credenciais
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone-number-id-edit">Phone Number ID *</Label>
                    <Input
                      id="phone-number-id-edit"
                      value={manualConfig.phoneNumberId}
                      onChange={(e) => setManualConfig(prev => ({ ...prev, phoneNumberId: e.target.value }))}
                      placeholder={config.phone_number_id || "Ex: 123456789012345"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="waba-id-edit">WABA ID</Label>
                    <Input
                      id="waba-id-edit"
                      value={manualConfig.wabaId}
                      onChange={(e) => setManualConfig(prev => ({ ...prev, wabaId: e.target.value }))}
                      placeholder={config.waba_id || "Ex: 123456789012345"}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="access-token-edit">Novo Access Token *</Label>
                    <Input
                      id="access-token-edit"
                      type="password"
                      value={manualConfig.accessToken}
                      onChange={(e) => setManualConfig(prev => ({ ...prev, accessToken: e.target.value }))}
                      placeholder="Cole o novo token aqui"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={() => saveManualConfigMutation.mutate()}
                    disabled={saveManualConfigMutation.isPending || !manualConfig.phoneNumberId || !manualConfig.accessToken}
                    size="sm"
                  >
                    {saveManualConfigMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Atualizar
                  </Button>
                  <Button 
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowManualConfig(false);
                      setManualConfig({ phoneNumberId: "", accessToken: "", wabaId: "", displayPhoneNumber: "" });
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Test Message Section */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Send className="h-4 w-4" />
              Enviar Mensagem de Teste
            </h4>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="(11) 99999-9999"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                />
              </div>
              <Button 
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending || !testPhone.trim()}
              >
                {testMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Mensagens de texto só podem ser enviadas dentro da janela de 24h. Fora dela, use templates aprovados.
            </p>
          </div>

          {/* Documentation Link */}
          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
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

  // DISCONNECTED/EXPIRED STATE - Show connection options
  return (
    <Card className="border-2">
      <CardHeader className="text-center pb-2">
        <div className="flex justify-center mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg">
            <svg viewBox="0 0 24 24" className="h-9 w-9 text-white" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
        </div>
        <CardTitle className="text-xl">WhatsApp Cloud API</CardTitle>
        <CardDescription className="text-base">
          Integração Oficial Meta Business Platform
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Benefits */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col items-center text-center p-3 rounded-lg bg-muted/50">
            <Shield className="h-6 w-6 text-green-600 mb-2" />
            <p className="text-xs font-medium">API Oficial</p>
            <p className="text-xs text-muted-foreground">Suporte Meta garantido</p>
          </div>
          <div className="flex flex-col items-center text-center p-3 rounded-lg bg-muted/50">
            <Zap className="h-6 w-6 text-green-600 mb-2" />
            <p className="text-xs font-medium">Alta Performance</p>
            <p className="text-xs text-muted-foreground">Sem limites de mensagens</p>
          </div>
          <div className="flex flex-col items-center text-center p-3 rounded-lg bg-muted/50">
            <Globe className="h-6 w-6 text-green-600 mb-2" />
            <p className="text-xs font-medium">Templates HSM</p>
            <p className="text-xs text-muted-foreground">Notificações aprovadas</p>
          </div>
        </div>

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
        {config?.last_error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{config.last_error}</AlertDescription>
          </Alert>
        )}

        <Separator />

        {/* Connection Method */}
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="font-medium mb-1">Conectar sua Conta</h3>
            <p className="text-sm text-muted-foreground">
              Vincule seu WhatsApp Business usando suas credenciais do Meta for Developers
            </p>
          </div>

          {/* Manual Config Form (Primary for production) */}
          <div className="border rounded-lg p-4 space-y-4 bg-card">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone-number-id">Phone Number ID *</Label>
                <Input
                  id="phone-number-id"
                  value={manualConfig.phoneNumberId}
                  onChange={(e) => setManualConfig(prev => ({ ...prev, phoneNumberId: e.target.value }))}
                  placeholder="Ex: 123456789012345"
                />
                <p className="text-xs text-muted-foreground">
                  Encontre em: Meta for Developers → WhatsApp → Configuração da API
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="waba-id">WABA ID (opcional)</Label>
                <Input
                  id="waba-id"
                  value={manualConfig.wabaId}
                  onChange={(e) => setManualConfig(prev => ({ ...prev, wabaId: e.target.value }))}
                  placeholder="Ex: 123456789012345"
                />
                <p className="text-xs text-muted-foreground">
                  WhatsApp Business Account ID
                </p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="access-token">Access Token *</Label>
                <Input
                  id="access-token"
                  type="password"
                  value={manualConfig.accessToken}
                  onChange={(e) => setManualConfig(prev => ({ ...prev, accessToken: e.target.value }))}
                  placeholder="Token de acesso permanente ou temporário"
                />
                <p className="text-xs text-muted-foreground">
                  Use um token permanente do System User para produção
                </p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="display-phone">Número do WhatsApp</Label>
                <Input
                  id="display-phone"
                  value={manualConfig.displayPhoneNumber}
                  onChange={(e) => setManualConfig(prev => ({ ...prev, displayPhoneNumber: e.target.value }))}
                  placeholder="Ex: 5511999999999"
                />
                <p className="text-xs text-muted-foreground">
                  Número conectado (para exibição)
                </p>
              </div>
            </div>

            <Button 
              onClick={() => saveManualConfigMutation.mutate()}
              disabled={saveManualConfigMutation.isPending || !manualConfig.phoneNumberId || !manualConfig.accessToken}
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
            >
              {saveManualConfigMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Conectar WhatsApp
            </Button>
          </div>

          {/* OAuth Alternative (Secondary) */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-2">ou conecte via</p>
            <Button 
              variant="outline"
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              size="sm"
            >
              {connectMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Login com Meta Business
            </Button>
          </div>
        </div>

        {/* Documentation Link */}
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          <a 
            href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-primary"
          >
            <ExternalLink className="h-3 w-3" />
            Como obter suas credenciais Meta
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
