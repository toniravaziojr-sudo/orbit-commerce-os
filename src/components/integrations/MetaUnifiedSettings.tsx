import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  ChevronDown,
  FlaskConical,
  Send,
  Save,
  Phone,
  AlertCircle,
} from "lucide-react";
import { useMetaConnection, MetaScopePack } from "@/hooks/useMetaConnection";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface ScopePackInfo {
  label: string;
  description: string;
  icon: React.ReactNode;
  available: boolean;
}

const SCOPE_PACK_INFO: Record<MetaScopePack, ScopePackInfo> = {
  whatsapp: {
    label: "WhatsApp",
    description: "WABA / Cloud API",
    icon: <MessageCircle className="h-4 w-4" />,
    available: true, // Only WhatsApp is available now
  },
  atendimento: {
    label: "Atendimento",
    description: "Messenger + Instagram DM",
    icon: <MessageCircle className="h-4 w-4" />,
    available: false,
  },
  publicacao: {
    label: "Publicação",
    description: "Facebook + Instagram Posts",
    icon: <Megaphone className="h-4 w-4" />,
    available: false,
  },
  ads: {
    label: "Anúncios",
    description: "Campanhas e métricas",
    icon: <Megaphone className="h-4 w-4" />,
    available: false,
  },
  leads: {
    label: "Leads",
    description: "Lead Ads",
    icon: <Users className="h-4 w-4" />,
    available: false,
  },
  catalogo: {
    label: "Catálogo",
    description: "Produtos e Pixels",
    icon: <ShoppingBag className="h-4 w-4" />,
    available: false,
  },
};

export function MetaUnifiedSettings() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();
  
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
  const [showTestConfig, setShowTestConfig] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  // Test mode temporary credentials
  const [testCredentials, setTestCredentials] = useState({
    phoneNumberId: "",
    accessToken: "",
    wabaId: "",
    displayPhoneNumber: "",
  });

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

  // Pre-populate test credentials when config exists and section is expanded
  useEffect(() => {
    if (whatsappConfig && showTestConfig) {
      setTestCredentials({
        phoneNumberId: whatsappConfig.phone_number_id || "",
        accessToken: whatsappConfig.access_token || "",
        wabaId: whatsappConfig.waba_id || "",
        displayPhoneNumber: whatsappConfig.display_phone_number || whatsappConfig.phone_number || "",
      });
    }
  }, [whatsappConfig, showTestConfig]);

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

  // Save test credentials mutation
  const saveTestConfigMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("Tenant não identificado");
      if (!testCredentials.phoneNumberId.trim()) throw new Error("Phone Number ID é obrigatório");
      if (!testCredentials.accessToken.trim()) throw new Error("Access Token é obrigatório");

      const { data, error } = await supabase
        .from("whatsapp_configs")
        .upsert({
          tenant_id: tenantId,
          provider: "meta",
          phone_number_id: testCredentials.phoneNumberId.trim(),
          access_token: testCredentials.accessToken.trim(),
          waba_id: testCredentials.wabaId.trim() || null,
          display_phone_number: testCredentials.displayPhoneNumber.trim() || null,
          phone_number: testCredentials.displayPhoneNumber.trim() || null,
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
      toast.success("Credenciais de teste salvas!");
      // Keep the section open and don't clear fields - just refresh the data
      queryClient.invalidateQueries({ queryKey: ["whatsapp-meta-config", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["meta-connection-status"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao salvar credenciais");
    },
  });

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
    onError: (error: any) => {
      toast.error(error.message || "Erro ao enviar mensagem");
    },
  });

  // REGRA CRÍTICA: NUNCA mostrar loader de tela cheia após carga inicial
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
                Meta (Facebook/Instagram/WhatsApp)
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
              {connection.assets && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Ativos conectados</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {connection.assets.pages.length > 0 && (
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
                    {connection.assets.instagram_accounts.length > 0 && (
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
                    {connection.assets.whatsapp_business_accounts.length > 0 && (
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
                    {connection.assets.ad_accounts.length > 0 && (
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

              {/* Test Message Section */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Enviar Mensagem de Teste (WhatsApp)
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
              </div>

              <Separator />

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
                                Em breve
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

      {/* Test Mode Card (Temporary for Meta Approval) */}
      <Collapsible open={showTestConfig} onOpenChange={setShowTestConfig}>
        <Card className="border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50">
                    <FlaskConical className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      Modo de Teste (WhatsApp)
                      {whatsappConfig?.connection_status === "connected" ? (
                        <Badge className="bg-green-600 text-white">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Configurado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400">
                          Temporário
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Para validação do app na Meta (será removido após aprovação)
                    </CardDescription>
                  </div>
                </div>
                <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${showTestConfig ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  Use esta seção apenas para testes de aprovação do Meta App. 
                  O fluxo real do lojista é conectar via OAuth (botão "Conectar Meta" acima).
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="test-phone-number-id">Phone Number ID *</Label>
                  <Input
                    id="test-phone-number-id"
                    value={testCredentials.phoneNumberId}
                    onChange={(e) => setTestCredentials(prev => ({ ...prev, phoneNumberId: e.target.value }))}
                    placeholder="Ex: 123456789012345"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="test-waba-id">WABA ID</Label>
                  <Input
                    id="test-waba-id"
                    value={testCredentials.wabaId}
                    onChange={(e) => setTestCredentials(prev => ({ ...prev, wabaId: e.target.value }))}
                    placeholder="Ex: 123456789012345"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="test-access-token">Access Token *</Label>
                  <Input
                    id="test-access-token"
                    type="password"
                    value={testCredentials.accessToken}
                    onChange={(e) => setTestCredentials(prev => ({ ...prev, accessToken: e.target.value }))}
                    placeholder="Token temporário do Meta for Developers"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="test-display-phone">Número do WhatsApp</Label>
                  <Input
                    id="test-display-phone"
                    value={testCredentials.displayPhoneNumber}
                    onChange={(e) => setTestCredentials(prev => ({ ...prev, displayPhoneNumber: e.target.value }))}
                    placeholder="Ex: 5511999999999"
                  />
                </div>
              </div>

              <Button 
                onClick={() => saveTestConfigMutation.mutate()}
                disabled={saveTestConfigMutation.isPending || !testCredentials.phoneNumberId || !testCredentials.accessToken}
                className="w-full"
                variant="outline"
              >
                {saveTestConfigMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar para Teste
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
