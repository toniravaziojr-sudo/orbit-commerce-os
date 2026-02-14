import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Link2,
  Unlink,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Lock,
  Plus,
  Youtube,
  BarChart3,
  ShoppingBag,
  Search,
  MapPin,
  Tag,
  Megaphone,
} from "lucide-react";
import { useGoogleConnection, GoogleScopePack } from "@/hooks/useGoogleConnection";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ScopePackInfo {
  label: string;
  description: string;
  icon: React.ReactNode;
  available: boolean;
  sensitive: boolean;
  module: string;
}

const SCOPE_PACK_INFO: Record<GoogleScopePack, ScopePackInfo> = {
  youtube: {
    label: "YouTube",
    description: "Upload, agendamento e analytics de vídeos",
    icon: <Youtube className="h-4 w-4" />,
    available: true,
    sensitive: true,
    module: "Gestor de Mídias",
  },
  ads: {
    label: "Google Ads",
    description: "Campanhas, métricas e públicos-alvo",
    icon: <Megaphone className="h-4 w-4" />,
    available: true,
    sensitive: true,
    module: "Gestor de Tráfego",
  },
  merchant: {
    label: "Merchant Center",
    description: "Catálogo de produtos no Google Shopping",
    icon: <ShoppingBag className="h-4 w-4" />,
    available: true,
    sensitive: false,
    module: "Catálogos",
  },
  analytics: {
    label: "Analytics (GA4)",
    description: "Relatórios e atribuição de vendas",
    icon: <BarChart3 className="h-4 w-4" />,
    available: true,
    sensitive: false,
    module: "Relatórios",
  },
  search_console: {
    label: "Search Console",
    description: "SEO, queries de busca e indexação",
    icon: <Search className="h-4 w-4" />,
    available: true,
    sensitive: false,
    module: "SEO",
  },
  business: {
    label: "Meu Negócio",
    description: "Avaliações e perfil do Google",
    icon: <MapPin className="h-4 w-4" />,
    available: true,
    sensitive: true,
    module: "CRM / Avaliações",
  },
  tag_manager: {
    label: "Tag Manager",
    description: "Gerenciar scripts e tags",
    icon: <Tag className="h-4 w-4" />,
    available: true,
    sensitive: false,
    module: "Utilidades",
  },
};

export function GoogleUnifiedSettings() {
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
  } = useGoogleConnection();

  const [selectedPacks, setSelectedPacks] = useState<GoogleScopePack[]>(["youtube"]);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    if (!isLoading && !initialLoadComplete) {
      setInitialLoadComplete(true);
    }
  }, [isLoading, initialLoadComplete]);

  // URL params check
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_connected") === "true") {
      refetch();
      window.history.replaceState({}, "", window.location.pathname);
    }
    const googleError = params.get("google_error");
    if (googleError) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [refetch]);

  const togglePack = (pack: GoogleScopePack) => {
    setSelectedPacks(prev =>
      prev.includes(pack) ? prev.filter(p => p !== pack) : [...prev, pack]
    );
  };

  const handleConnect = () => {
    if (selectedPacks.length === 0) return;
    connect(selectedPacks);
  };

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
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                Google
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
                Conecte sua conta Google para YouTube, Ads, Analytics, SEO e mais
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {isConnected && connection ? (
            <>
              {/* Connection status */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Conta conectada</span>
                  <div className="flex items-center gap-2">
                    {connection.avatarUrl && (
                      <img src={connection.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
                    )}
                    <span className="font-medium">{connection.displayName || connection.googleEmail}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <span className="text-sm">{connection.googleEmail}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Conectado há</span>
                  <span className="text-sm">
                    {formatDistanceToNow(new Date(connection.connectedAt), { locale: ptBR, addSuffix: true })}
                  </span>
                </div>
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

              {/* Discovered assets */}
              <AssetsGrid assets={connection.assets} />

              {connection.lastError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>Último erro: {connection.lastError}</AlertDescription>
                </Alert>
              )}

              <Separator />

              {/* Incremental consent */}
              <IncrementalConsent
                currentPacks={connection.scopePacks}
                onAddPacks={(newPacks) => {
                  const allPacks = [...new Set([...connection.scopePacks, ...newPacks])] as GoogleScopePack[];
                  connect(allPacks);
                }}
                isConnecting={isConnecting}
              />

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => refetch()} size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => disconnect()}
                  disabled={isDisconnecting}
                  size="sm"
                >
                  {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Unlink className="h-4 w-4 mr-2" />}
                  Desconectar
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Pack selection */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Selecione os módulos que deseja conectar</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(Object.entries(SCOPE_PACK_INFO) as [GoogleScopePack, ScopePackInfo][]).map(([key, info]) => (
                    <label
                      key={key}
                      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        selectedPacks.includes(key) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      } ${!info.available ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <Checkbox
                        checked={selectedPacks.includes(key)}
                        onCheckedChange={() => info.available && togglePack(key)}
                        disabled={!info.available}
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          {info.icon}
                          <span className="text-sm font-medium">{info.label}</span>
                          {info.sensitive && (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{info.description}</p>
                        <p className="text-xs text-muted-foreground/70">→ {info.module}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleConnect}
                disabled={isConnecting || selectedPacks.length === 0}
                className="w-full"
              >
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                Conectar com Google
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Assets grid component
function AssetsGrid({ assets }: { assets: Record<string, any> }) {
  const hasAny = Object.values(assets).some(v =>
    Array.isArray(v) ? v.length > 0 : !!v
  );
  if (!hasAny) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Ativos descobertos</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        {assets.youtube_channels?.length > 0 && (
          <AssetCard
            icon={<Youtube className="h-4 w-4 text-red-600" />}
            title="Canais YouTube"
            count={assets.youtube_channels.length}
            items={assets.youtube_channels.map((c: any) => c.title)}
          />
        )}
        {assets.ad_accounts?.length > 0 && (
          <AssetCard
            icon={<Megaphone className="h-4 w-4 text-blue-600" />}
            title="Contas Ads"
            count={assets.ad_accounts.length}
            items={assets.ad_accounts.map((a: any) => a.id)}
          />
        )}
        {assets.merchant_accounts?.length > 0 && (
          <AssetCard
            icon={<ShoppingBag className="h-4 w-4 text-orange-600" />}
            title="Merchant Center"
            count={assets.merchant_accounts.length}
            items={assets.merchant_accounts.map((m: any) => m.name)}
          />
        )}
        {assets.analytics_properties?.length > 0 && (
          <AssetCard
            icon={<BarChart3 className="h-4 w-4 text-yellow-600" />}
            title="Propriedades GA4"
            count={assets.analytics_properties.length}
            items={assets.analytics_properties.map((p: any) => p.name)}
          />
        )}
        {assets.search_console_sites?.length > 0 && (
          <AssetCard
            icon={<Search className="h-4 w-4 text-green-600" />}
            title="Sites Search Console"
            count={assets.search_console_sites.length}
            items={assets.search_console_sites.map((s: any) => s.url)}
          />
        )}
        {assets.business_locations?.length > 0 && (
          <AssetCard
            icon={<MapPin className="h-4 w-4 text-blue-600" />}
            title="Meu Negócio"
            count={assets.business_locations.length}
            items={assets.business_locations.map((l: any) => l.name)}
          />
        )}
        {assets.tag_manager_accounts?.length > 0 && (
          <AssetCard
            icon={<Tag className="h-4 w-4 text-purple-600" />}
            title="Tag Manager"
            count={assets.tag_manager_accounts.length}
            items={assets.tag_manager_accounts.map((a: any) => a.name)}
          />
        )}
      </div>
    </div>
  );
}

function AssetCard({ icon, title, count, items }: { icon: React.ReactNode; title: string; count: number; items: string[] }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium">{title}</span>
        <Badge variant="outline" className="ml-auto">{count}</Badge>
      </div>
      <ul className="text-xs text-muted-foreground space-y-1">
        {items.slice(0, 3).map((item, i) => <li key={i}>{item}</li>)}
        {items.length > 3 && <li>+{items.length - 3} mais</li>}
      </ul>
    </div>
  );
}

// Incremental consent section
function IncrementalConsent({
  currentPacks,
  onAddPacks,
  isConnecting,
}: {
  currentPacks: GoogleScopePack[];
  onAddPacks: (packs: GoogleScopePack[]) => void;
  isConnecting: boolean;
}) {
  const [newPacks, setNewPacks] = useState<GoogleScopePack[]>([]);
  const missingPacks = (Object.keys(SCOPE_PACK_INFO) as GoogleScopePack[]).filter(
    p => !currentPacks.includes(p)
  );

  if (missingPacks.length === 0) return null;

  const toggleNewPack = (pack: GoogleScopePack) => {
    setNewPacks(prev => prev.includes(pack) ? prev.filter(p => p !== pack) : [...prev, pack]);
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Plus className="h-4 w-4" />
        Adicionar permissões
      </h4>
      <div className="grid gap-2 sm:grid-cols-2">
        {missingPacks.map(pack => {
          const info = SCOPE_PACK_INFO[pack];
          return (
            <label
              key={pack}
              className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer text-sm transition-colors ${
                newPacks.includes(pack) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
            >
              <Checkbox
                checked={newPacks.includes(pack)}
                onCheckedChange={() => toggleNewPack(pack)}
              />
              {info.icon}
              <span>{info.label}</span>
              {info.sensitive && <Lock className="h-3 w-3 text-muted-foreground ml-auto" />}
            </label>
          );
        })}
      </div>
      {newPacks.length > 0 && (
        <Button
          size="sm"
          onClick={() => onAddPacks(newPacks)}
          disabled={isConnecting}
        >
          {isConnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          Autorizar {newPacks.length} {newPacks.length === 1 ? "módulo" : "módulos"}
        </Button>
      )}
    </div>
  );
}
