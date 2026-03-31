import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Loader2, 
  Link2, 
  Unlink, 
  Facebook, 
  Instagram, 
  MessageCircle,
  Megaphone,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Lock,
  ChevronDown,
  ChevronRight,
  Bell,
  Image,
  Send,
  MessageSquare,
  FileText,
  MessagesSquare,
  Video,
  Crosshair,
  Users,
  ShoppingBag,
  BarChart3,
  AtSign,
  Info,
  Crown,
  ShieldAlert,
} from "lucide-react";
import { useMetaConnection } from "@/hooks/useMetaConnection";
import { useMetaIntegrations, type MetaIntegrationState, type ActiveGrantInfo } from "@/hooks/useMetaIntegrations";
import { META_INTEGRATION_GROUPS, type MetaIntegrationGroup } from "@/config/metaIntegrationCatalog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// Import config sections
import { MetaPixelSection } from "./meta/MetaPixelSection";
import { MetaConversionsApiSection } from "./meta/MetaConversionsApiSection";
import { MetaProductFeedsSection } from "./meta/MetaProductFeedsSection";
import { MetaWhatsAppRegistrationSection } from "./meta/MetaWhatsAppRegistrationSection";

// Icon map for catalog integration icons
const ICON_MAP: Record<string, React.ReactNode> = {
  Bell: <Bell className="h-4 w-4" />,
  MessageCircle: <MessageCircle className="h-4 w-4" />,
  Image: <Image className="h-4 w-4" />,
  Send: <Send className="h-4 w-4" />,
  MessageSquare: <MessageSquare className="h-4 w-4" />,
  FileText: <FileText className="h-4 w-4" />,
  MessagesSquare: <MessagesSquare className="h-4 w-4" />,
  Video: <Video className="h-4 w-4" />,
  Crosshair: <Crosshair className="h-4 w-4" />,
  Server: <Loader2 className="h-4 w-4" />,
  Users: <Users className="h-4 w-4" />,
  Megaphone: <Megaphone className="h-4 w-4" />,
  ShoppingBag: <ShoppingBag className="h-4 w-4" />,
  BarChart3: <BarChart3 className="h-4 w-4" />,
  AtSign: <AtSign className="h-4 w-4" />,
};

const GROUP_ICONS: Record<MetaIntegrationGroup, React.ReactNode> = {
  whatsapp: <MessageCircle className="h-5 w-5 text-green-600" />,
  instagram: <Instagram className="h-5 w-5 text-pink-600" />,
  facebook: <Facebook className="h-5 w-5 text-blue-600" />,
  marketing: <Crosshair className="h-5 w-5 text-orange-600" />,
  commerce: <ShoppingBag className="h-5 w-5 text-purple-600" />,
  outros: <AtSign className="h-5 w-5 text-foreground" />,
};

export function MetaUnifiedSettings() {
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const { 
    isConnected, 
    isExpired,
    connection,
    isLoading: connectionLoading, 
    connect, 
    disconnect,
    isConnecting,
    isDisconnecting,
    refetch: refetchConnection,
  } = useMetaConnection();

  const {
    integrationStates,
    grant,
    isLoading: integrationsLoading,
    toggle,
    isToggling,
    togglingId,
  } = useMetaIntegrations();

  // URL params for OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const metaConnected = params.get("meta_connected");
    const metaError = params.get("meta_error");
    const whatsappConnected = params.get("whatsapp_connected");
    const whatsappError = params.get("whatsapp_error");
    
    if (metaConnected === "true" || whatsappConnected === "true") {
      import("sonner").then(({ toast }) => toast.success("Conta Meta conectada com sucesso!"));
      refetchConnection();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (metaError || whatsappError) {
      const error = metaError || whatsappError;
      import("sonner").then(({ toast }) => toast.error(`Erro ao conectar: ${decodeURIComponent(error!)}`));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [refetchConnection]);

  const isLoading = connectionLoading || integrationsLoading;

  useEffect(() => {
    if (!isLoading && !initialLoadComplete) {
      setInitialLoadComplete(true);
    }
  }, [isLoading, initialLoadComplete]);
  
  if (isLoading && !initialLoadComplete && !isConnecting) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Group integration states by group
  const groupedStates: Record<MetaIntegrationGroup, MetaIntegrationState[]> = {
    whatsapp: [], instagram: [], facebook: [], marketing: [], commerce: [], outros: [],
  };
  for (const state of integrationStates) {
    groupedStates[state.def.group].push(state);
  }

  return (
    <div className="space-y-4">
      {/* Header Card — Connection Status */}
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
        <CardContent className="space-y-4">
          {isConnected && connection ? (
            <>
              {/* Connection info */}
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Conta</span>
                  <span className="font-medium text-sm">{grant?.metaUserName || connection.externalUsername || connection.externalUserId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Perfil</span>
                  <Badge variant="outline" className="text-xs">
                    {grant?.authProfile === "meta_auth_full" ? "Acesso completo" : "Escopos aprovados"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Conectado há</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(connection.connectedAt), { locale: ptBR, addSuffix: true })}
                  </span>
                </div>
                {connection.expiresAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Expira em</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(connection.expiresAt), { locale: ptBR, addSuffix: true })}
                    </span>
                  </div>
                )}
              </div>

              {connection.lastError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Último erro: {connection.lastError}
                  </AlertDescription>
                </Alert>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => connect()} disabled={isConnecting} className="gap-1.5">
                  {isConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Reconectar
                </Button>
                <Button variant="outline" size="sm" onClick={() => refetchConnection()} className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Atualizar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => disconnect()} disabled={isDisconnecting} className="gap-1.5">
                  {isDisconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                  Desconectar
                </Button>
              </div>
            </>
          ) : (
            <>
              {isExpired && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Sua conexão expirou. Reconecte para continuar usando as integrações Meta.
                  </AlertDescription>
                </Alert>
              )}

              <p className="text-sm text-muted-foreground">
                Ao conectar, o sistema solicitará as permissões adequadas para o seu tipo de conta automaticamente.
                Após a conexão, ative as funcionalidades que deseja usar nos painéis abaixo.
              </p>

              <Button onClick={() => connect()} disabled={isConnecting} className="gap-2">
                {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Conectar Meta
              </Button>

              <p className="text-xs text-muted-foreground">
                Você será redirecionado para o Facebook para autorizar o acesso.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Integration Groups — Toggles */}
      {META_INTEGRATION_GROUPS.map((group) => {
        const states = groupedStates[group.id];
        if (!states || states.length === 0) return null;

        const activeCount = states.filter((s) => s.isActive).length;

        return (
          <MetaIntegrationGroupCard
            key={group.id}
            groupId={group.id}
            label={group.label}
            description={group.description}
            icon={GROUP_ICONS[group.id]}
            states={states}
            activeCount={activeCount}
            onToggle={toggle}
            isToggling={isToggling}
            togglingId={togglingId}
            isConnected={isConnected}
            grant={grant}
          />
        );
      })}
    </div>
  );
}

// === Group Card ===

interface MetaIntegrationGroupCardProps {
  groupId: MetaIntegrationGroup;
  label: string;
  description: string;
  icon: React.ReactNode;
  states: MetaIntegrationState[];
  activeCount: number;
  onToggle: (args: { integrationId: string; action: "activate" | "deactivate" }) => void;
  isToggling: boolean;
  togglingId: string | null;
  isConnected: boolean;
  grant: ActiveGrantInfo | null;
}

function MetaIntegrationGroupCard({
  groupId,
  label,
  description,
  icon,
  states,
  activeCount,
  onToggle,
  isToggling,
  togglingId,
  isConnected,
  grant,
}: MetaIntegrationGroupCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
            {icon}
          </div>
          <div className="flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              {label}
              {activeCount > 0 && (
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
                  {activeCount} ativo{activeCount > 1 ? "s" : ""}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {states.map((state, idx) => (
          <MetaIntegrationToggleRow
            key={state.def.id}
            state={state}
            onToggle={onToggle}
            isToggling={isToggling && togglingId === state.def.id}
            isConnected={isConnected}
            grant={grant}
            isLast={idx === states.length - 1}
          />
        ))}
      </CardContent>
    </Card>
  );
}

// === Toggle Row ===

interface MetaIntegrationToggleRowProps {
  state: MetaIntegrationState;
  onToggle: (args: { integrationId: string; action: "activate" | "deactivate" }) => void;
  isToggling: boolean;
  isConnected: boolean;
  grant: ActiveGrantInfo | null;
  isLast: boolean;
}

function MetaIntegrationToggleRow({
  state,
  onToggle,
  isToggling,
  isConnected,
  grant,
  isLast,
}: MetaIntegrationToggleRowProps) {
  const [configOpen, setConfigOpen] = useState(false);
  const { def, isActive, canActivate, blockReason, layerStatus } = state;

  const handleToggle = () => {
    if (isToggling) return;
    if (def.separateAuth) {
      // Threads has separate auth — for now just show info
      return;
    }
    onToggle({
      integrationId: def.id,
      action: isActive ? "deactivate" : "activate",
    });
  };

  const icon = ICON_MAP[def.icon] || <Info className="h-4 w-4" />;

  const statusBadge = (() => {
    if (def.separateAuth) {
      return (
        <Badge variant="outline" className="text-[10px] gap-1">
          <Lock className="h-2.5 w-2.5" />
          Auth separado
        </Badge>
      );
    }
    if (!isConnected) {
      return (
        <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1">
          <ShieldAlert className="h-2.5 w-2.5" />
          Sem conexão
        </Badge>
      );
    }
    if (layerStatus === "blocked_auth") {
      return (
        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 gap-1">
          <Lock className="h-2.5 w-2.5" />
          Sem permissão
        </Badge>
      );
    }
    if (layerStatus === "blocked_plan") {
      return (
        <Badge variant="outline" className="text-[10px] text-purple-600 border-purple-300 gap-1">
          <Crown className="h-2.5 w-2.5" />
          Plano superior
        </Badge>
      );
    }
    return null;
  })();

  const hasConfig = def.hasConfigSection && isActive;

  return (
    <div className={cn("py-2", !isLast && "border-b border-border/50")}>
      <div className="flex items-center gap-3">
        <div className="text-muted-foreground">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{def.label}</span>
            {statusBadge}
          </div>
          <p className="text-xs text-muted-foreground truncate">{def.description}</p>
          {blockReason && !isActive && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">{blockReason}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isToggling ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              checked={isActive}
              onCheckedChange={handleToggle}
              disabled={!canActivate && !isActive}
              aria-label={`${isActive ? "Desativar" : "Ativar"} ${def.label}`}
            />
          )}
          {hasConfig && (
            <button
              onClick={() => setConfigOpen(!configOpen)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              {configOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Expandable config section */}
      {hasConfig && configOpen && (
        <div className="mt-3 ml-7 pl-3 border-l-2 border-muted">
          <IntegrationConfigSection configKey={def.configSectionKey!} />
        </div>
      )}
    </div>
  );
}

// === Config Sections (absorb legacy) ===

function IntegrationConfigSection({ configKey }: { configKey: string }) {
  switch (configKey) {
    case "whatsapp_registration":
      return <MetaWhatsAppRegistrationSection />;
    case "pixel_capi":
      return <MetaPixelCapiSection />;
    case "product_feeds":
      return <MetaProductFeedsSection />;
    default:
      return (
        <p className="text-xs text-muted-foreground py-2">
          Configuração em breve.
        </p>
      );
  }
}
