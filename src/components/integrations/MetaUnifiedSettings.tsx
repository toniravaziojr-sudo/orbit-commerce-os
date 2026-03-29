import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePlatformOperator } from "@/hooks/usePlatformOperator";
import { META_PACK_AVAILABILITY, isPackAvailable, type MetaPackConfig } from "@/config/metaPackAvailability";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { 
  Loader2, 
  Link2, 
  Unlink, 
  Facebook, 
  Instagram, 
  MessageCircle,
  Megaphone,
  Users,
  ShoppingBag,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Lock,
  Send,
  Phone,
  AtSign,
  Video,
  Plus,
  BarChart3,
  Crosshair,
  Globe,
  Server,
  ExternalLink,
  Copy,
  Rss,
  Chrome,
} from "lucide-react";
import { useMetaConnection, MetaScopePack } from "@/hooks/useMetaConnection";
import { useMarketingIntegrations, MarketingIntegration } from "@/hooks/useMarketingIntegrations";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeError } from "@/lib/error-sanitizer";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { showErrorToast } from '@/lib/error-toast';

// Build SCOPE_PACK_INFO from central config + platform operator context
// Icons are defined here since they are React elements (not serializable in config)
const PACK_ICONS: Record<string, React.ReactNode> = {
  whatsapp: <MessageCircle className="h-4 w-4" />,
  atendimento: <MessageCircle className="h-4 w-4" />,
  publicacao: <Megaphone className="h-4 w-4" />,
  ads: <Megaphone className="h-4 w-4" />,
  leads: <Users className="h-4 w-4" />,
  catalogo: <ShoppingBag className="h-4 w-4" />,
  threads: <AtSign className="h-4 w-4" />,
  live_video: <Video className="h-4 w-4" />,
  pixel: <Crosshair className="h-4 w-4" />,
  insights: <BarChart3 className="h-4 w-4" />,
};

interface ScopePackInfo {
  label: string;
  description: string;
  icon: React.ReactNode;
  available: boolean;
  blockedReason?: string;
}

function buildScopePackInfo(isPlatformOp: boolean): Record<MetaScopePack, ScopePackInfo> {
  const result: Partial<Record<MetaScopePack, ScopePackInfo>> = {};
  for (const pack of META_PACK_AVAILABILITY) {
    result[pack.id] = {
      label: pack.label,
      description: pack.description,
      icon: PACK_ICONS[pack.id] || <Globe className="h-4 w-4" />,
      available: isPackAvailable(pack.id, isPlatformOp),
      blockedReason: pack.blockedReason,
    };
  }
  return result as Record<MetaScopePack, ScopePackInfo>;
}

export function MetaUnifiedSettings() {
  const { currentTenant } = useAuth();
  const { isPlatformOperator } = usePlatformOperator();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();
  const SCOPE_PACK_INFO = buildScopePackInfo(isPlatformOperator);
  
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

  const [selectedPacks, setSelectedPacks] = useState<MetaScopePack[]>(["whatsapp"]);
  const [testPhone, setTestPhone] = useState("");
  const [registerPin, setRegisterPin] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [registrationStep, setRegistrationStep] = useState<"idle" | "code_sent" | "code_verified">("idle");
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Fetch existing WhatsApp config to pre-populate test mode fields
  const { data: whatsappConfig } = useQuery({
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
      return data;
    },
    enabled: !!tenantId,
  });

  // URL params for OAuth callback

  // Check URL params for OAuth callback (both meta_connected and whatsapp_connected for backwards compatibility)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const metaConnected = params.get("meta_connected");
    const metaError = params.get("meta_error");
    const whatsappConnected = params.get("whatsapp_connected");
    const whatsappError = params.get("whatsapp_error");
    
    if (metaConnected === "true" || whatsappConnected === "true") {
      toast.success("Conta Meta conectada com sucesso!");
      refetch();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (metaError) {
      toast.error(`Erro ao conectar: ${decodeURIComponent(metaError)}`);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (whatsappError) {
      toast.error(`Erro ao conectar: ${decodeURIComponent(whatsappError)}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [refetch]);

  // Only allow toggling available packs
  const togglePack = (pack: MetaScopePack) => {
    if (!SCOPE_PACK_INFO[pack].available) return;
    
    setSelectedPacks(prev => 
      prev.includes(pack) 
        ? prev.filter(p => p !== pack)
        : [...prev, pack]
    );
  };

  const handleConnect = () => {
    if (selectedPacks.length === 0) {
      return;
    }
    connect(selectedPacks);
  };

  // Test message mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      if (!testPhone.trim()) throw new Error("Informe um número de telefone");
      
      const { data, error } = await supabase.functions.invoke("meta-whatsapp-send", {
        body: {
          tenant_id: tenantId,
          phone: testPhone,
          message: "Mensagem de teste via WhatsApp Oficial!",
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
    onError: (err) => showErrorToast(err, { module: 'integrações', action: 'enviar' }),
  });

  // Step 1: Request SMS/Voice verification code
  const requestCodeMutation = useMutation({
    mutationFn: async (codeMethod: "SMS" | "VOICE") => {
      const { data, error } = await supabase.functions.invoke("meta-whatsapp-request-code", {
        body: { tenant_id: tenantId, code_method: codeMethod },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Código enviado!");
      if (data.already_verified) {
        setRegistrationStep("code_verified");
      } else {
        setRegistrationStep("code_sent");
      }
      queryClient.invalidateQueries({ queryKey: ["whatsapp-meta-config", tenantId] });
    },
    onError: (err) => showErrorToast(err, { module: 'integrações', action: 'processar' }),
  });

  // Step 2: Verify SMS/Voice code
  const verifyCodeMutation = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.functions.invoke("meta-whatsapp-verify-code", {
        body: { tenant_id: tenantId, code },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Código verificado!");
      setVerificationCode("");
      setRegistrationStep("code_verified");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-meta-config", tenantId] });
    },
    onError: (err) => showErrorToast(err, { module: 'integrações', action: 'verificar' }),
  });

  // Step 3: Register phone number on Cloud API
  const registerPhoneMutation = useMutation({
    mutationFn: async (pin: string) => {
      if (!pin || pin.length !== 6) throw new Error("PIN de 6 dígitos é obrigatório");
      const { data, error } = await supabase.functions.invoke("meta-whatsapp-register-phone", {
        body: { tenant_id: tenantId, pin },
      });
      if (error) throw error;
      // Log raw Meta diagnostic for debugging
      if (data?.meta_diagnostic) {
        console.log("[register-phone] Meta diagnostic:", JSON.stringify(data.meta_diagnostic, null, 2));
      }
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Número registrado com sucesso!");
      setRegisterPin("");
      setRegistrationStep("idle");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-meta-config", tenantId] });
    },
    onError: (err) => showErrorToast(err, { module: 'integrações', action: 'registrar' }),
  });

  // O isLoading fica true durante refetches/invalidações de query
  // Uma vez que carregamos os dados, marcamos para NUNCA mais bloquear a UI
  useEffect(() => {
    if (!isLoading && !initialLoadComplete) {
      setInitialLoadComplete(true);
    }
  }, [isLoading, initialLoadComplete]);
  
  // Só mostra loader na primeiríssima carga, antes de ter qualquer dado
  // APÓS isso, NUNCA mais bloqueia a tela - isso é regra do sistema
  if (isLoading && !initialLoadComplete && !isConnecting) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
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
                {connection.scopePacks.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Permissões</span>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {connection.scopePacks.map((pack) => (
                        <Badge key={pack} variant="secondary" className="text-xs">
                          {SCOPE_PACK_INFO[pack]?.label || pack}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Assets descobertos */}
              {(connection.assets || whatsappConfig) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Ativos conectados</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {connection.assets?.pages && connection.assets.pages.length > 0 && (
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
                    {connection.assets?.instagram_accounts && connection.assets.instagram_accounts.length > 0 && (
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
                    {/* WhatsApp - mostrar número conectado do whatsapp_configs */}
                    {whatsappConfig?.phone_number && whatsappConfig.provider === "meta" && (
                      <div className={`rounded-lg border p-3 ${
                        whatsappConfig.connection_status !== "connected" 
                          ? "border-amber-300 dark:border-amber-700" 
                          : ""
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <MessageCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium">WhatsApp</span>
                          {whatsappConfig.connection_status === "connected" ? (
                            <Badge variant="outline" className="ml-auto bg-green-50 text-green-700 border-green-200">
                              <Phone className="h-3 w-3 mr-1" />
                              Ativo
                            </Badge>
                          ) : whatsappConfig.connection_status === "awaiting_verification" ? (
                            <Badge variant="outline" className="ml-auto border-amber-400 text-amber-700 dark:text-amber-400">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Aguardando código
                            </Badge>
                          ) : whatsappConfig.connection_status === "pending_registration" && registrationStep === "idle" ? (
                            <Badge variant="outline" className="ml-auto border-blue-400 text-blue-700 dark:text-blue-400">
                              <Loader2 className="h-3 w-3 mr-1" />
                              Em Análise
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="ml-auto border-amber-400 text-amber-700 dark:text-amber-400">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Registro Pendente
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          +{whatsappConfig.display_phone_number || whatsappConfig.phone_number}
                        </p>

                        {/* Registration flow for non-connected status */}
                        {whatsappConfig.connection_status !== "connected" && (
                          <div className="mt-3 space-y-3">
                            
                            {/* Case A: pending_registration + idle = Meta is reviewing, no action needed */}
                            {whatsappConfig.connection_status === "pending_registration" && registrationStep === "idle" && (
                              <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-2.5">
                                <p className="text-xs text-blue-700 dark:text-blue-400">
                                  ✅ Seu número está em análise pela Meta. Esse processo é automático e pode levar até 48h. Não é necessária nenhuma ação.
                                </p>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="mt-2 text-xs h-7 text-muted-foreground"
                                  onClick={() => setRegistrationStep("code_sent")}
                                >
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                  Tentar novamente manualmente
                                </Button>
                              </div>
                            )}

                            {/* Case B: Active registration flow (user is going through steps) */}
                            {!(whatsappConfig.connection_status === "pending_registration" && registrationStep === "idle") && (
                              <>
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  Ação necessária — Ative seu número
                                </div>

                                {/* Step 1: Request verification code — only when idle and NOT awaiting_verification */}
                                {registrationStep === "idle" && whatsappConfig.connection_status !== "awaiting_verification" && (
                                  <div className="space-y-2 rounded-md bg-muted/50 p-2.5">
                                    <p className="text-xs font-medium">Passo 1: Solicitar código de verificação</p>
                                    <p className="text-xs text-muted-foreground">
                                      Enviaremos um código por SMS para o número acima.
                                    </p>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 text-xs h-8 border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950"
                                        onClick={() => requestCodeMutation.mutate("SMS")}
                                        disabled={requestCodeMutation.isPending}
                                      >
                                        {requestCodeMutation.isPending ? (
                                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                        ) : (
                                          <Send className="h-3 w-3 mr-1" />
                                        )}
                                        Enviar por SMS
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-xs h-8"
                                        onClick={() => requestCodeMutation.mutate("VOICE")}
                                        disabled={requestCodeMutation.isPending}
                                      >
                                        <Phone className="h-3 w-3 mr-1" />
                                        Voz
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {/* Step 2: Enter verification code */}
                                {(registrationStep === "code_sent" || whatsappConfig.connection_status === "awaiting_verification") && (
                                  <div className="space-y-2 rounded-md bg-muted/50 p-2.5">
                                    <p className="text-xs font-medium">Passo 2: Inserir código recebido</p>
                                    <p className="text-xs text-muted-foreground">
                                      Digite o código de 6 dígitos que você recebeu no telefone.
                                    </p>
                                    <Input
                                      placeholder="Código de 6 dígitos"
                                      value={verificationCode}
                                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                      maxLength={6}
                                      className="text-xs h-8"
                                    />
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 text-xs h-8 border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950"
                                        onClick={() => verifyCodeMutation.mutate(verificationCode)}
                                        disabled={verifyCodeMutation.isPending || verificationCode.length !== 6}
                                      >
                                        {verifyCodeMutation.isPending ? (
                                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                        ) : (
                                          <CheckCircle className="h-3 w-3 mr-1" />
                                        )}
                                        Verificar código
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-xs h-8"
                                        onClick={() => requestCodeMutation.mutate("SMS")}
                                        disabled={requestCodeMutation.isPending}
                                      >
                                        <RefreshCw className="h-3 w-3 mr-1" />
                                        Reenviar
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {/* Step 3: Register with PIN */}
                                {registrationStep === "code_verified" && (
                                  <div className="space-y-2 rounded-md bg-muted/50 p-2.5">
                                    <p className="text-xs font-medium">Passo 3: Definir PIN de segurança</p>
                                    <p className="text-xs text-muted-foreground">
                                      Se a verificação em duas etapas já está ativa no WhatsApp Manager, use o PIN existente. Se NÃO está ativa, crie qualquer PIN de 6 dígitos — ele será definido automaticamente como seu PIN de segurança.
                                    </p>
                                    <Input
                                      placeholder="PIN de 6 dígitos"
                                      value={registerPin}
                                      onChange={(e) => setRegisterPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                      maxLength={6}
                                      type="password"
                                      className="text-xs h-8"
                                    />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="w-full text-xs h-8 border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950"
                                      onClick={() => registerPhoneMutation.mutate(registerPin)}
                                      disabled={registerPhoneMutation.isPending || registerPin.length !== 6}
                                    >
                                      {registerPhoneMutation.isPending ? (
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      ) : (
                                        <Zap className="h-3 w-3 mr-1" />
                                      )}
                                      Finalizar registro
                                    </Button>
                                  </div>
                                )}

                                {whatsappConfig.last_error && (
                                  <p className="text-xs text-destructive">
                                    {sanitizeError(new Error(whatsappConfig.last_error)).userMessage}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {/* Re-register option for connected status */}
                        {whatsappConfig.connection_status === "connected" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="mt-2 w-full text-xs text-muted-foreground"
                            onClick={() => setRegistrationStep("idle")}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Re-registrar número
                          </Button>
                        )}
                      </div>
                    )}
                    {connection.assets?.whatsapp_business_accounts && connection.assets.whatsapp_business_accounts.length > 0 && (
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
                    {connection.assets?.ad_accounts && connection.assets.ad_accounts.length > 0 && (
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
                    {connection.assets?.catalogs && connection.assets.catalogs.length > 0 && (
                      <div className="rounded-lg border p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <ShoppingBag className="h-4 w-4 text-orange-600" />
                          <span className="text-sm font-medium">Catálogos</span>
                          <Badge variant="outline" className="ml-auto">{connection.assets.catalogs.length}</Badge>
                        </div>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {connection.assets.catalogs.map((cat) => (
                            <li key={cat.id}>{cat.name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {connection.assets?.threads_profile && (
                      <div className="rounded-lg border p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <AtSign className="h-4 w-4 text-foreground" />
                          <span className="text-sm font-medium">Threads</span>
                          <Badge variant="outline" className="ml-auto bg-green-50 text-green-700 border-green-200">
                            Ativo
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          @{connection.assets.threads_profile.username}
                        </p>
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

              {/* Pixel & CAPI Configuration */}
              <MetaPixelCapiSection />

              {/* Product Feeds / Catalogs */}
              <MetaProductFeedsSection />

              <Separator />

              {/* Consentimento incremental — adicionar permissões */}
              <IncrementalConsentSection
                currentPacks={connection.scopePacks}
                allPacks={SCOPE_PACK_INFO}
                onAddPacks={(newPacks) => {
                  // Unir packs atuais + novos e disparar re-auth
                  const allPacks = [...new Set([...connection.scopePacks, ...newPacks])];
                  connect(allPacks);
                }}
                isConnecting={isConnecting}
              />

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
              {/* Seleção de pacotes de escopos */}
              <div className="space-y-3">
                <Label>Selecione as permissões que deseja conectar:</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(Object.keys(SCOPE_PACK_INFO) as MetaScopePack[]).map((pack) => {
                    const info = SCOPE_PACK_INFO[pack];
                    const isAvailable = info.available;
                    
                    return (
                      <div
                        key={pack}
                        className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                          !isAvailable 
                            ? "opacity-60 cursor-not-allowed bg-muted/30"
                            : selectedPacks.includes(pack) 
                              ? "border-primary bg-primary/5 cursor-pointer" 
                              : "hover:border-muted-foreground/50 cursor-pointer"
                        }`}
                        onClick={() => togglePack(pack)}
                      >
                        {isAvailable ? (
                          <Checkbox
                            id={`pack-${pack}`}
                            checked={selectedPacks.includes(pack)}
                            onCheckedChange={() => togglePack(pack)}
                          />
                        ) : (
                          <Lock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {info.icon}
                            <Label 
                              htmlFor={`pack-${pack}`} 
                              className={`font-medium ${!isAvailable ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              {info.label}
                            </Label>
                            {!isAvailable && (
                              <Badge variant="outline" className="text-xs">
                                {info.blockedReason || "Em breve"}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {info.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {isExpired && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Sua conexão expirou. Reconecte para continuar usando as integrações Meta.
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleConnect}
                disabled={isConnecting || selectedPacks.length === 0}
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

      {/* Test mode removed - Meta approved WhatsApp scopes */}
    </div>
  );
}

// Componente para consentimento incremental
function IncrementalConsentSection({
  currentPacks,
  allPacks,
  onAddPacks,
  isConnecting,
}: {
  currentPacks: MetaScopePack[];
  allPacks: Record<MetaScopePack, ScopePackInfo>;
  onAddPacks: (packs: MetaScopePack[]) => void;
  isConnecting: boolean;
}) {
  const [showSelector, setShowSelector] = useState(false);
  const [newPacks, setNewPacks] = useState<MetaScopePack[]>([]);

  const missingPacks = (Object.keys(allPacks) as MetaScopePack[]).filter(
    (pack) => !currentPacks.includes(pack) && allPacks[pack].available
  );

  if (missingPacks.length === 0) return null;

  const toggleNewPack = (pack: MetaScopePack) => {
    setNewPacks((prev) =>
      prev.includes(pack) ? prev.filter((p) => p !== pack) : [...prev, pack]
    );
  };

  if (!showSelector) {
    return (
      <Button
        variant="outline"
        onClick={() => setShowSelector(true)}
        className="gap-2"
      >
        <Plus className="h-4 w-4" />
        Adicionar permissões
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <Label className="text-sm font-medium">Selecione permissões adicionais:</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {missingPacks.map((pack) => {
          const info = allPacks[pack];
          return (
            <div
              key={pack}
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                newPacks.includes(pack)
                  ? "border-primary bg-primary/5"
                  : "hover:border-muted-foreground/50"
              }`}
              onClick={() => toggleNewPack(pack)}
            >
              <Checkbox
                checked={newPacks.includes(pack)}
                onCheckedChange={() => toggleNewPack(pack)}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {info.icon}
                  <span className="text-sm font-medium">{info.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{info.description}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            onAddPacks(newPacks);
            setShowSelector(false);
            setNewPacks([]);
          }}
          disabled={newPacks.length === 0 || isConnecting}
          className="gap-2"
        >
          {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Autorizar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setShowSelector(false);
            setNewPacks([]);
          }}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}

// Seção de Pixel & CAPI integrada ao Hub Meta
function MetaPixelCapiSection() {
  const { config, isLoading, upsertConfig } = useMarketingIntegrations();
  const { isConnected, connection } = useMetaConnection();
  
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [metaTokenConfigured, setMetaTokenConfigured] = useState(false);
  const [additionalPixels, setAdditionalPixels] = useState<string[]>([]);
  const [newPixelId, setNewPixelId] = useState('');
  const [showManualCapi, setShowManualCapi] = useState(false);

  // Primary pixel from OAuth connection
  const primaryPixelId = config?.meta_pixel_id || '';
  const primaryPixelName = connection?.assets?.pixels?.find(p => p.id === primaryPixelId)?.name || '';
  
  // CAPI is auto-configured if connected + pixel exists + token configured
  const isCapiAutoConfigured = isConnected && primaryPixelId && metaTokenConfigured;

  useEffect(() => {
    if (config) {
      setMetaTokenConfigured(!!(config as any).meta_access_token);
      setAdditionalPixels(config.meta_additional_pixel_ids || []);
    }
  }, [config]);

  const handleAddPixel = () => {
    const trimmed = newPixelId.trim();
    if (!trimmed || additionalPixels.includes(trimmed) || trimmed === primaryPixelId) return;
    setAdditionalPixels([...additionalPixels, trimmed]);
    setNewPixelId('');
  };

  const handleRemovePixel = (pixelId: string) => {
    setAdditionalPixels(additionalPixels.filter(p => p !== pixelId));
  };

  const handleSave = async () => {
    const updates: Partial<MarketingIntegration> = {
      meta_additional_pixel_ids: additionalPixels.length > 0 ? additionalPixels : null,
    };
    if (metaAccessToken) {
      (updates as any).meta_access_token = metaAccessToken;
      updates.meta_capi_enabled = true;
    }
    await upsertConfig.mutateAsync(updates);
    setMetaAccessToken('');
    setShowManualCapi(false);
  };

  if (isLoading) return null;

  const isActive = config?.meta_enabled && primaryPixelId;

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Crosshair className="h-4 w-4" />
        Pixel & Conversions API
        {isActive && (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
            <CheckCircle className="h-3 w-3 mr-1" /> Ativo
          </Badge>
        )}
      </h4>
      
      <div className="rounded-lg border p-4 space-y-4">
        {/* Primary Pixel (auto-synced) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Globe className="h-3.5 w-3.5" />
            Client-side (Pixel)
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-sm">Pixel Principal</Label>
            {primaryPixelId ? (
              <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
                <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono">{primaryPixelId}</p>
                  {primaryPixelName && (
                    <p className="text-xs text-muted-foreground">{primaryPixelName}</p>
                  )}
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">Automático</Badge>
              </div>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Nenhum pixel conectado. Conecte sua conta Meta acima e selecione um Pixel nos ativos.
                </AlertDescription>
              </Alert>
            )}
            <p className="text-xs text-muted-foreground">
              Instalado automaticamente na loja via conexão Meta.
            </p>
          </div>

          {/* Additional Pixels */}
          <div className="space-y-2 pt-1">
            <Label className="text-sm">Pixels Adicionais (opcional)</Label>
            <p className="text-xs text-muted-foreground">
              Adicione outros Pixel IDs para disparar eventos em múltiplos pixels simultaneamente.
            </p>
            
            {additionalPixels.length > 0 && (
              <div className="space-y-1.5">
                {additionalPixels.map((pixelId) => (
                  <div key={pixelId} className="flex items-center gap-2 rounded-md border px-3 py-1.5">
                    <span className="text-sm font-mono flex-1">{pixelId}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemovePixel(pixelId)}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input 
                placeholder="ID do pixel adicional" 
                value={newPixelId} 
                onChange={(e) => setNewPixelId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddPixel()}
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={handleAddPixel} disabled={!newPixelId.trim()}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        {/* Server-side (CAPI) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Server className="h-3.5 w-3.5" />
            Server-side (Conversions API)
          </div>
          
          {isCapiAutoConfigured ? (
            <>
              <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
                <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Conversions API ativa</p>
                  <p className="text-xs text-muted-foreground">
                    Token sincronizado automaticamente da conexão Meta (long-lived, ~60 dias).
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">Automático</Badge>
              </div>
              
              <button 
                className="text-xs text-muted-foreground hover:text-foreground underline"
                onClick={() => setShowManualCapi(!showManualCapi)}
              >
                {showManualCapi ? 'Ocultar opção manual' : 'Usar token manual (avançado)'}
              </button>

              {showManualCapi && (
                <div className="space-y-2 pl-2 border-l-2 border-muted">
                  <p className="text-xs text-muted-foreground">
                    Use um token manual apenas se precisar de um token de sistema (System User Token) permanente, 
                    que não expira. O token automático da conexão dura ~60 dias.
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="meta-access-token" className="text-sm flex items-center gap-2">
                      <Lock className="h-3 w-3" />
                      Token Manual (substitui o automático)
                    </Label>
                    <Input 
                      id="meta-access-token" 
                      type="password" 
                      placeholder="Cole o System User Token aqui"
                      value={metaAccessToken} 
                      onChange={(e) => setMetaAccessToken(e.target.value)} 
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Conversions API</Label>
                  <p className="text-xs text-muted-foreground">Melhora atribuição e reduz perda por bloqueadores de anúncios</p>
                </div>
                {metaTokenConfigured ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" /> Configurado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">Não configurado</Badge>
                )}
              </div>
              
              {isConnected && primaryPixelId && !metaTokenConfigured ? (
                <Alert className="bg-amber-50/50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs text-amber-800">
                    Reconecte sua conta Meta para ativar a CAPI automaticamente. 
                    Ou insira um token manual abaixo.
                  </AlertDescription>
                </Alert>
              ) : !isConnected ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Conecte sua conta Meta acima para ativar Pixel e CAPI automaticamente.
                  </AlertDescription>
                </Alert>
              ) : null}

              <Alert className="bg-blue-50/50 border-blue-200">
                <AlertDescription className="text-xs space-y-2">
                  <p className="font-medium text-blue-900">Como gerar um Access Token manual:</p>
                  <ol className="list-decimal list-inside space-y-1 text-blue-800">
                    <li>Acesse o <a href="https://business.facebook.com/events_manager" target="_blank" rel="noopener noreferrer" className="underline font-medium">Gerenciador de Eventos</a></li>
                    <li>Selecione seu Pixel → aba <strong>Configurações</strong></li>
                    <li>Role até <strong>"Conversions API"</strong></li>
                    <li>Clique em <strong>"Gerar token de acesso"</strong></li>
                    <li>Copie o token e cole abaixo</li>
                  </ol>
                  <p className="text-blue-700 italic">Este token é permanente e específico do Pixel.</p>
                </AlertDescription>
              </Alert>

              <div className="space-y-1.5">
                <Label htmlFor="meta-access-token-fallback" className="text-sm flex items-center gap-2">
                  <Lock className="h-3 w-3" />
                  Access Token
                </Label>
                <Input 
                  id="meta-access-token-fallback" 
                  type="password" 
                  placeholder={metaTokenConfigured ? '••••••••••••' : 'Cole seu access token aqui'} 
                  value={metaAccessToken} 
                  onChange={(e) => setMetaAccessToken(e.target.value)} 
                />
                <p className="text-xs text-muted-foreground">Token nunca é exibido após salvo.</p>
              </div>
            </>
          )}
        </div>

        <Button size="sm" onClick={handleSave} disabled={upsertConfig.isPending}>
          {upsertConfig.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}

// Seção de Product Feeds / Catálogos
function MetaProductFeedsSection() {
  const { currentTenant } = useAuth();

  const getFeedUrl = (format: 'google' | 'meta') => {
    if (!currentTenant?.slug) return '';
    const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-feed`;
    return `${baseUrl}?tenant=${currentTenant.slug}&format=${format}`;
  };

  const copyUrl = (format: 'google' | 'meta') => {
    navigator.clipboard.writeText(getFeedUrl(format));
    toast.success('URL copiada!');
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Rss className="h-4 w-4" />
        Catálogos de Produtos
      </h4>
      
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Facebook className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium">Meta Catalog (CSV)</span>
          </div>
          <div className="flex gap-1.5">
            <Input value={getFeedUrl('meta')} readOnly className="font-mono text-xs h-8" />
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyUrl('meta')}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Chrome className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium">Google Merchant (XML)</span>
          </div>
          <div className="flex gap-1.5">
            <Input value={getFeedUrl('google')} readOnly className="font-mono text-xs h-8" />
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyUrl('google')}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Feeds atualizados automaticamente. Use essas URLs nas plataformas de anúncios.
      </p>
    </div>
  );
}