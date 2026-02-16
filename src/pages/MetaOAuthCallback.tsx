import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, CheckCircle, XCircle, Facebook, Instagram, MessageCircle, 
  Megaphone, ShoppingBag, AtSign 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DiscoveredAssets {
  pages: Array<{ id: string; name: string; access_token?: string }>;
  instagram_accounts: Array<{ id: string; username: string; page_id: string }>;
  whatsapp_business_accounts: Array<{ id: string; name: string }>;
  ad_accounts: Array<{ id: string; name: string }>;
  catalogs: Array<{ id: string; name: string }>;
  threads_profile: { id: string; username: string } | null;
}

export default function MetaOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "selecting" | "saving" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [discoveredAssets, setDiscoveredAssets] = useState<DiscoveredAssets | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<DiscoveredAssets | null>(null);
  const [connectionData, setConnectionData] = useState<any>(null);
  const processedRef = useRef(false);

  // Toggle helpers for each asset type
  const togglePage = (pageId: string) => {
    if (!selectedAssets || !discoveredAssets) return;
    const exists = selectedAssets.pages.some(p => p.id === pageId);
    setSelectedAssets({
      ...selectedAssets,
      pages: exists 
        ? selectedAssets.pages.filter(p => p.id !== pageId)
        : [...selectedAssets.pages, discoveredAssets.pages.find(p => p.id === pageId)!],
    });
  };

  const toggleIg = (igId: string) => {
    if (!selectedAssets || !discoveredAssets) return;
    const exists = selectedAssets.instagram_accounts.some(a => a.id === igId);
    setSelectedAssets({
      ...selectedAssets,
      instagram_accounts: exists
        ? selectedAssets.instagram_accounts.filter(a => a.id !== igId)
        : [...selectedAssets.instagram_accounts, discoveredAssets.instagram_accounts.find(a => a.id === igId)!],
    });
  };

  const toggleWaba = (wabaId: string) => {
    if (!selectedAssets || !discoveredAssets) return;
    const exists = selectedAssets.whatsapp_business_accounts.some(w => w.id === wabaId);
    setSelectedAssets({
      ...selectedAssets,
      whatsapp_business_accounts: exists
        ? selectedAssets.whatsapp_business_accounts.filter(w => w.id !== wabaId)
        : [...selectedAssets.whatsapp_business_accounts, discoveredAssets.whatsapp_business_accounts.find(w => w.id === wabaId)!],
    });
  };

  const toggleAdAccount = (accId: string) => {
    if (!selectedAssets || !discoveredAssets) return;
    const exists = selectedAssets.ad_accounts.some(a => a.id === accId);
    setSelectedAssets({
      ...selectedAssets,
      ad_accounts: exists
        ? selectedAssets.ad_accounts.filter(a => a.id !== accId)
        : [...selectedAssets.ad_accounts, discoveredAssets.ad_accounts.find(a => a.id === accId)!],
    });
  };

  const toggleCatalog = (catId: string) => {
    if (!selectedAssets || !discoveredAssets) return;
    const exists = selectedAssets.catalogs.some(c => c.id === catId);
    setSelectedAssets({
      ...selectedAssets,
      catalogs: exists
        ? selectedAssets.catalogs.filter(c => c.id !== catId)
        : [...selectedAssets.catalogs, discoveredAssets.catalogs.find(c => c.id === catId)!],
    });
  };

  const toggleThreads = () => {
    if (!selectedAssets || !discoveredAssets) return;
    setSelectedAssets({
      ...selectedAssets,
      threads_profile: selectedAssets.threads_profile ? null : discoveredAssets.threads_profile,
    });
  };

  const notifyParentAndClose = (success: boolean, error?: string) => {
    sessionStorage.removeItem('oauth_in_progress');
    const baseUrl = window.location.origin;
    const redirectUrl = success
      ? `${baseUrl}/integrations?meta_connected=true&t=${Date.now()}`
      : `${baseUrl}/integrations?meta_error=${encodeURIComponent(error || 'Erro')}&t=${Date.now()}`;

    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: "meta:connected", success, error }, "*");
      }
    } catch (e) {
      // Expected with Google Translate
    }

    setTimeout(() => {
      try { if (window.opener && !window.opener.closed) window.close(); } catch {}
      setTimeout(() => { window.location.href = redirectUrl; }, 300);
    }, 1200);
  };

  useEffect(() => {
    if (processedRef.current) return;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    const successParam = searchParams.get("success");

    if (successParam === "true") {
      setStatus("success");
      notifyParentAndClose(true);
      return;
    }

    if (error) {
      processedRef.current = true;
      const errMsg = getErrorMessage(error, errorDescription || "");
      setStatus("error");
      setErrorMessage(errMsg);
      notifyParentAndClose(false, errMsg);
      return;
    }

    if (code && state) {
      processedRef.current = true;
      processOAuthCallback(code, state);
      return;
    }

    processedRef.current = true;
    setStatus("error");
    setErrorMessage("Acesso inválido.");
    notifyParentAndClose(false, "Acesso inválido.");
  }, [searchParams]);

  async function processOAuthCallback(code: string, state: string) {
    try {
      const { data, error } = await supabase.functions.invoke("meta-oauth-callback", {
        body: { code, state },
      });

      if (error || !data?.success) {
        const errMsg = data?.error || error?.message || "Erro ao processar autorização";
        setStatus("error");
        setErrorMessage(errMsg);
        notifyParentAndClose(false, errMsg);
        return;
      }

      // Se requer seleção de ativos, mostrar tela de seleção
      if (data.requiresAssetSelection && data.connection?.assets) {
        const assets = data.connection.assets as DiscoveredAssets;
        setDiscoveredAssets(assets);
        // Iniciar com tudo selecionado
        setSelectedAssets({ ...assets });
        setConnectionData(data.connection);
        setStatus("selecting");
        return;
      }

      // Fluxo antigo sem seleção
      setStatus("success");
      notifyParentAndClose(true);

    } catch (err) {
      setStatus("error");
      setErrorMessage("Erro inesperado. Tente novamente.");
      notifyParentAndClose(false, "Erro inesperado.");
    }
  }

  async function handleConfirmSelection() {
    if (!selectedAssets) return;
    setStatus("saving");

    try {
      // Buscar tenant_id do usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("current_tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.current_tenant_id) throw new Error("Tenant não encontrado");

      const { data, error } = await supabase.functions.invoke("meta-save-selected-assets", {
        body: {
          tenantId: profile.current_tenant_id,
          selectedAssets,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || "Erro ao salvar seleção");
      }

      setStatus("success");
      notifyParentAndClose(true);
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || "Erro ao salvar seleção");
      notifyParentAndClose(false, err.message);
    }
  }

  const handleClose = () => {
    if (window.opener && !window.opener.closed) window.close();
    else navigate("/integrations", { replace: true });
  };

  const totalAssets = discoveredAssets 
    ? discoveredAssets.pages.length + discoveredAssets.instagram_accounts.length + 
      discoveredAssets.whatsapp_business_accounts.length + discoveredAssets.ad_accounts.length + 
      discoveredAssets.catalogs.length + (discoveredAssets.threads_profile ? 1 : 0)
    : 0;

  const selectedCount = selectedAssets
    ? selectedAssets.pages.length + selectedAssets.instagram_accounts.length +
      selectedAssets.whatsapp_business_accounts.length + selectedAssets.ad_accounts.length +
      selectedAssets.catalogs.length + (selectedAssets.threads_profile ? 1 : 0)
    : 0;

  // Asset selection screen
  if (status === "selecting" && discoveredAssets && selectedAssets) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <CardTitle className="text-lg">Conta conectada!</CardTitle>
            <CardDescription>
              Selecione quais ativos deseja conectar ({selectedCount} de {totalAssets} selecionados)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Pages */}
            {discoveredAssets.pages.length > 0 && (
              <AssetGroup
                icon={<Facebook className="h-4 w-4 text-blue-600" />}
                title="Páginas"
                count={selectedAssets.pages.length}
                total={discoveredAssets.pages.length}
              >
                {discoveredAssets.pages.map(page => (
                  <AssetItem
                    key={page.id}
                    label={page.name}
                    checked={selectedAssets.pages.some(p => p.id === page.id)}
                    onToggle={() => togglePage(page.id)}
                  />
                ))}
              </AssetGroup>
            )}

            {/* Instagram */}
            {discoveredAssets.instagram_accounts.length > 0 && (
              <AssetGroup
                icon={<Instagram className="h-4 w-4 text-pink-600" />}
                title="Instagram"
                count={selectedAssets.instagram_accounts.length}
                total={discoveredAssets.instagram_accounts.length}
              >
                {discoveredAssets.instagram_accounts.map(ig => (
                  <AssetItem
                    key={ig.id}
                    label={`@${ig.username}`}
                    checked={selectedAssets.instagram_accounts.some(a => a.id === ig.id)}
                    onToggle={() => toggleIg(ig.id)}
                  />
                ))}
              </AssetGroup>
            )}

            {/* WhatsApp */}
            {discoveredAssets.whatsapp_business_accounts.length > 0 && (
              <AssetGroup
                icon={<MessageCircle className="h-4 w-4 text-green-600" />}
                title="WhatsApp Business"
                count={selectedAssets.whatsapp_business_accounts.length}
                total={discoveredAssets.whatsapp_business_accounts.length}
              >
                {discoveredAssets.whatsapp_business_accounts.map(waba => (
                  <AssetItem
                    key={waba.id}
                    label={waba.name}
                    checked={selectedAssets.whatsapp_business_accounts.some(w => w.id === waba.id)}
                    onToggle={() => toggleWaba(waba.id)}
                  />
                ))}
              </AssetGroup>
            )}

            {/* Ad Accounts */}
            {discoveredAssets.ad_accounts.length > 0 && (
              <AssetGroup
                icon={<Megaphone className="h-4 w-4 text-blue-600" />}
                title="Contas de Anúncio"
                count={selectedAssets.ad_accounts.length}
                total={discoveredAssets.ad_accounts.length}
              >
                {discoveredAssets.ad_accounts.map(acc => (
                  <AssetItem
                    key={acc.id}
                    label={acc.name}
                    checked={selectedAssets.ad_accounts.some(a => a.id === acc.id)}
                    onToggle={() => toggleAdAccount(acc.id)}
                  />
                ))}
              </AssetGroup>
            )}

            {/* Catalogs */}
            {discoveredAssets.catalogs.length > 0 && (
              <AssetGroup
                icon={<ShoppingBag className="h-4 w-4 text-orange-600" />}
                title="Catálogos"
                count={selectedAssets.catalogs.length}
                total={discoveredAssets.catalogs.length}
              >
                {discoveredAssets.catalogs.map(cat => (
                  <AssetItem
                    key={cat.id}
                    label={cat.name}
                    checked={selectedAssets.catalogs.some(c => c.id === cat.id)}
                    onToggle={() => toggleCatalog(cat.id)}
                  />
                ))}
              </AssetGroup>
            )}

            {/* Threads */}
            {discoveredAssets.threads_profile && (
              <AssetGroup
                icon={<AtSign className="h-4 w-4" />}
                title="Threads"
                count={selectedAssets.threads_profile ? 1 : 0}
                total={1}
              >
                <AssetItem
                  label={`@${discoveredAssets.threads_profile.username}`}
                  checked={!!selectedAssets.threads_profile}
                  onToggle={toggleThreads}
                />
              </AssetGroup>
            )}

            <Separator />

            <div className="flex gap-3 pt-2">
              <Button 
                onClick={handleConfirmSelection} 
                disabled={selectedCount === 0}
                className="flex-1"
              >
                Confirmar seleção ({selectedCount})
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Saving state
  if (status === "saving") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Salvando ativos selecionados...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {status === "loading" && <Loader2 className="h-12 w-12 text-primary animate-spin" />}
            {status === "success" && <CheckCircle className="h-12 w-12 text-green-500" />}
            {status === "error" && <XCircle className="h-12 w-12 text-destructive" />}
          </div>
          <CardTitle>
            {status === "loading" && "Conectando..."}
            {status === "success" && "Conectado com sucesso!"}
            {status === "error" && "Erro na conexão"}
          </CardTitle>
          <CardDescription>
            {status === "loading" && "Finalizando a conexão com o Meta..."}
            {status === "success" && "Sua conta Meta foi conectada. Fechando..."}
            {status === "error" && errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {status === "error" && (
            <Button onClick={handleClose} className="mt-4">
              {window.opener ? "Fechar" : "Voltar para Integrações"}
            </Button>
          )}
          {status === "success" && (
            <p className="text-sm text-muted-foreground mt-2">
              Esta janela será fechada automaticamente...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Sub-components
function AssetGroup({ icon, title, count, total, children }: {
  icon: React.ReactNode;
  title: string;
  count: number;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{title}</span>
        <Badge variant="outline" className="ml-auto text-xs">{count}/{total}</Badge>
      </div>
      <div className="space-y-1 pl-6">
        {children}
      </div>
    </div>
  );
}

function AssetItem({ label, checked, onToggle }: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div 
      className="flex items-center gap-2 py-1 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2"
      onClick={onToggle}
    >
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function getErrorMessage(error: string, description: string): string {
  const errorMessages: Record<string, string> = {
    access_denied: "Você cancelou a autorização.",
    missing_params: "Parâmetros de autorização ausentes.",
    invalid_state: "Sessão expirada. Tente novamente.",
    token_exchange_failed: "Erro ao obter tokens. Tente novamente.",
    save_failed: "Erro ao salvar a conexão.",
    not_configured: "Integração Meta não configurada.",
    internal_error: "Erro interno.",
  };
  return description || errorMessages[error] || `Erro: ${error}`;
}
