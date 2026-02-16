import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    available: true,
  },
  atendimento: {
    label: "Atendimento",
    description: "Messenger + Instagram DM + Comentários",
    icon: <MessageCircle className="h-4 w-4" />,
    available: true,
  },
  publicacao: {
    label: "Publicação",
    description: "Facebook + Instagram Posts, Stories, Reels",
    icon: <Megaphone className="h-4 w-4" />,
    available: true,
  },
  ads: {
    label: "Anúncios",
    description: "Campanhas e métricas",
    icon: <Megaphone className="h-4 w-4" />,
    available: true,
  },
  leads: {
    label: "Leads",
    description: "Lead Ads",
    icon: <Users className="h-4 w-4" />,
    available: true,
  },
  catalogo: {
    label: "Catálogo",
    description: "Produtos e Commerce Manager",
    icon: <ShoppingBag className="h-4 w-4" />,
    available: true,
  },
  threads: {
    label: "Threads",
    description: "Publicação e gestão no Threads",
    icon: <AtSign className="h-4 w-4" />,
    available: true,
  },
  live_video: {
    label: "Lives",
    description: "Transmissões ao vivo",
    icon: <Video className="h-4 w-4" />,
    available: true,
  },
  pixel: {
    label: "Pixel + CAPI",
    description: "Rastreamento e Conversions API",
    icon: <Crosshair className="h-4 w-4" />,
    available: true,
  },
  insights: {
    label: "Insights",
    description: "Métricas de páginas e perfis",
    icon: <BarChart3 className="h-4 w-4" />,
    available: true,
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
  const [testPhone, setTestPhone] = useState("");
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
                      <div className="rounded-lg border p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium">WhatsApp</span>
                          <Badge variant="outline" className="ml-auto bg-green-50 text-green-700 border-green-200">
                            <Phone className="h-3 w-3 mr-1" />
                            Ativo
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          +{whatsappConfig.display_phone_number || whatsappConfig.phone_number}
                        </p>
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
  
  const [metaCapiEnabled, setMetaCapiEnabled] = useState(false);
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [metaTokenConfigured, setMetaTokenConfigured] = useState(false);
  const [additionalPixels, setAdditionalPixels] = useState<string[]>([]);
  const [newPixelId, setNewPixelId] = useState('');

  // Primary pixel from OAuth connection
  const primaryPixelId = config?.meta_pixel_id || '';
  const primaryPixelName = connection?.assets?.pixels?.find(p => p.id === primaryPixelId)?.name || '';

  useEffect(() => {
    if (config) {
      setMetaCapiEnabled(config.meta_capi_enabled);
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
      meta_capi_enabled: metaCapiEnabled,
      meta_additional_pixel_ids: additionalPixels.length > 0 ? additionalPixels : null,
    };
    if (metaAccessToken) {
      (updates as any).meta_access_token = metaAccessToken;
    }
    await upsertConfig.mutateAsync(updates);
    setMetaAccessToken('');
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
                <Badge variant="secondary" className="text-xs shrink-0">Auto-sync</Badge>
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
              Sincronizado automaticamente da conexão Meta. Para alterar, edite os ativos conectados acima.
            </p>
          </div>

          {/* Additional Pixels */}
          <div className="space-y-2 pt-1">
            <Label className="text-sm">Pixels Adicionais</Label>
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
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="meta-capi-enabled" className="text-sm">Ativar Conversions API</Label>
              <p className="text-xs text-muted-foreground">Melhora atribuição e reduz perda por bloqueadores de anúncios</p>
            </div>
            <Switch id="meta-capi-enabled" checked={metaCapiEnabled} onCheckedChange={setMetaCapiEnabled} />
          </div>

          <Alert className="bg-blue-50/50 border-blue-200">
            <AlertDescription className="text-xs space-y-2">
              <p className="font-medium text-blue-900">Como gerar o Access Token:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-800">
                <li>Acesse o <a href="https://business.facebook.com/events_manager" target="_blank" rel="noopener noreferrer" className="underline font-medium">Gerenciador de Eventos</a></li>
                <li>Selecione seu Pixel → aba <strong>Configurações</strong></li>
                <li>Role até <strong>"Conversions API"</strong></li>
                <li>Clique em <strong>"Gerar token de acesso"</strong></li>
                <li>Copie o token e cole abaixo</li>
              </ol>
              <p className="text-blue-700 italic">O token é permanente e específico do Pixel. Nunca compartilhe.</p>
            </AlertDescription>
          </Alert>

          <div className="space-y-1.5">
            <Label htmlFor="meta-access-token" className="text-sm flex items-center gap-2">
              <Lock className="h-3 w-3" />
              Access Token
              {metaTokenConfigured && <Badge variant="secondary" className="text-xs">Configurado</Badge>}
            </Label>
            <Input 
              id="meta-access-token" 
              type="password" 
              placeholder={metaTokenConfigured ? '••••••••••••' : 'Cole seu access token aqui'} 
              value={metaAccessToken} 
              onChange={(e) => setMetaAccessToken(e.target.value)} 
            />
            <p className="text-xs text-muted-foreground">Token nunca é exibido após salvo. Deixe em branco para manter o atual.</p>
          </div>
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