import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Loader2, CheckCircle, XCircle, Facebook, Instagram, MessageCircle, 
  Megaphone, ShoppingBag, AtSign, Crosshair, Phone, Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating?: string;
}

interface DiscoveredAssets {
  pages: Array<{ id: string; name: string; access_token?: string }>;
  instagram_accounts: Array<{ id: string; username: string; page_id: string }>;
  whatsapp_business_accounts: Array<{ id: string; name: string; phone_numbers: PhoneNumber[] }>;
  ad_accounts: Array<{ id: string; name: string }>;
  pixels: Array<{ id: string; name: string; ad_account_id: string }>;
  catalogs: Array<{ id: string; name: string }>;
  threads_profile: { id: string; username: string } | null;
}

interface SelectedAssets {
  pages: Array<{ id: string; name: string; access_token?: string }>;
  instagram_accounts: Array<{ id: string; username: string; page_id: string }>;
  whatsapp_business_accounts: Array<{ id: string; name: string }>;
  ad_accounts: Array<{ id: string; name: string }>;
  pixels: Array<{ id: string; name: string; ad_account_id: string }>;
  catalogs: Array<{ id: string; name: string }>;
  threads_profile: { id: string; username: string } | null;
  selected_phone_number: { id: string; display_phone_number: string; verified_name: string; waba_id: string } | null;
}

export default function MetaOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "selecting" | "saving" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [discoveredAssets, setDiscoveredAssets] = useState<DiscoveredAssets | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<SelectedAssets | null>(null);
  const [connectionData, setConnectionData] = useState<any>(null);
  const processedRef = useRef(false);

  // Single-select handlers (radio button behavior)
  const selectPage = (pageId: string) => {
    if (!selectedAssets || !discoveredAssets) return;
    const page = discoveredAssets.pages.find(p => p.id === pageId);
    if (!page) return;
    setSelectedAssets({ ...selectedAssets, pages: [page] });
  };

  const selectIg = (igId: string) => {
    if (!selectedAssets || !discoveredAssets) return;
    const ig = discoveredAssets.instagram_accounts.find(a => a.id === igId);
    if (!ig) return;
    setSelectedAssets({ ...selectedAssets, instagram_accounts: [ig] });
  };

  const selectWaba = (wabaId: string) => {
    if (!selectedAssets || !discoveredAssets) return;
    const waba = discoveredAssets.whatsapp_business_accounts.find(w => w.id === wabaId);
    if (!waba) return;
    // Reset phone selection when WABA changes
    const firstPhone = waba.phone_numbers[0];
    setSelectedAssets({
      ...selectedAssets,
      whatsapp_business_accounts: [{ id: waba.id, name: waba.name }],
      selected_phone_number: firstPhone ? {
        id: firstPhone.id,
        display_phone_number: firstPhone.display_phone_number,
        verified_name: firstPhone.verified_name,
        waba_id: waba.id,
      } : null,
    });
  };

  const selectPhone = (phoneId: string, wabaId: string) => {
    if (!selectedAssets || !discoveredAssets) return;
    const waba = discoveredAssets.whatsapp_business_accounts.find(w => w.id === wabaId);
    const phone = waba?.phone_numbers.find(p => p.id === phoneId);
    if (!phone) return;
    setSelectedAssets({
      ...selectedAssets,
      selected_phone_number: {
        id: phone.id,
        display_phone_number: phone.display_phone_number,
        verified_name: phone.verified_name,
        waba_id: wabaId,
      },
    });
  };

  const selectPixel = (pixelId: string) => {
    if (!selectedAssets || !discoveredAssets) return;
    const pixel = discoveredAssets.pixels.find(p => p.id === pixelId);
    if (!pixel) return;
    setSelectedAssets({ ...selectedAssets, pixels: [pixel] });
  };

  // Ad accounts: multi-select (toggle)
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

      if (data.requiresAssetSelection && data.connection?.assets) {
        const assets = data.connection.assets as DiscoveredAssets;
        setDiscoveredAssets(assets);
        
        // Initialize with first item selected for single-select fields
        const firstWaba = assets.whatsapp_business_accounts[0];
        const firstPhone = firstWaba?.phone_numbers?.[0];
        
        setSelectedAssets({
          pages: assets.pages.length > 0 ? [assets.pages[0]] : [],
          instagram_accounts: assets.instagram_accounts.length > 0 ? [assets.instagram_accounts[0]] : [],
          whatsapp_business_accounts: firstWaba ? [{ id: firstWaba.id, name: firstWaba.name }] : [],
          ad_accounts: [...assets.ad_accounts], // All selected by default
          pixels: assets.pixels.length > 0 ? [assets.pixels[0]] : [],
          catalogs: [], // Will be created automatically
          threads_profile: assets.threads_profile,
          selected_phone_number: firstPhone && firstWaba ? {
            id: firstPhone.id,
            display_phone_number: firstPhone.display_phone_number,
            verified_name: firstPhone.verified_name,
            waba_id: firstWaba.id,
          } : null,
        });
        setConnectionData(data.connection);
        setStatus("selecting");
        return;
      }

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

  // Asset selection screen
  if (status === "selecting" && discoveredAssets && selectedAssets) {
    const selectedWabaId = selectedAssets.whatsapp_business_accounts[0]?.id;
    const selectedWaba = discoveredAssets.whatsapp_business_accounts.find(w => w.id === selectedWabaId);

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <CardTitle className="text-lg">Conta conectada!</CardTitle>
            <CardDescription>
              Selecione os ativos que deseja integrar ao sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Um novo catálogo será criado automaticamente na Meta com os produtos da sua loja.
              </AlertDescription>
            </Alert>

            {/* Pages - single select */}
            {discoveredAssets.pages.length > 0 && (
              <AssetGroupSingle
                icon={<Facebook className="h-4 w-4 text-blue-600" />}
                title="Página do Facebook"
                subtitle="Selecione 1 página"
              >
                <RadioGroup 
                  value={selectedAssets.pages[0]?.id || ""} 
                  onValueChange={selectPage}
                >
                  {discoveredAssets.pages.map(page => (
                    <div key={page.id} className="flex items-center gap-2 py-1">
                      <RadioGroupItem value={page.id} id={`page-${page.id}`} />
                      <Label htmlFor={`page-${page.id}`} className="text-sm cursor-pointer">{page.name}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </AssetGroupSingle>
            )}

            {/* Instagram - single select */}
            {discoveredAssets.instagram_accounts.length > 0 && (
              <AssetGroupSingle
                icon={<Instagram className="h-4 w-4 text-pink-600" />}
                title="Perfil do Instagram"
                subtitle="Selecione 1 perfil"
              >
                <RadioGroup 
                  value={selectedAssets.instagram_accounts[0]?.id || ""} 
                  onValueChange={selectIg}
                >
                  {discoveredAssets.instagram_accounts.map(ig => (
                    <div key={ig.id} className="flex items-center gap-2 py-1">
                      <RadioGroupItem value={ig.id} id={`ig-${ig.id}`} />
                      <Label htmlFor={`ig-${ig.id}`} className="text-sm cursor-pointer">@{ig.username}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </AssetGroupSingle>
            )}

            {/* WhatsApp - single select WABA + single select phone */}
            {discoveredAssets.whatsapp_business_accounts.length > 0 && (
              <AssetGroupSingle
                icon={<MessageCircle className="h-4 w-4 text-green-600" />}
                title="WhatsApp Business"
                subtitle="Selecione 1 conta e 1 número"
              >
                <RadioGroup 
                  value={selectedWabaId || ""} 
                  onValueChange={selectWaba}
                >
                  {discoveredAssets.whatsapp_business_accounts.map(waba => (
                    <div key={waba.id} className="space-y-2">
                      <div className="flex items-center gap-2 py-1">
                        <RadioGroupItem value={waba.id} id={`waba-${waba.id}`} />
                        <Label htmlFor={`waba-${waba.id}`} className="text-sm cursor-pointer">{waba.name}</Label>
                      </div>
                      {/* Show phone numbers when this WABA is selected */}
                      {selectedWabaId === waba.id && waba.phone_numbers.length > 0 && (
                        <div className="ml-6 pl-3 border-l-2 border-green-200 space-y-1">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> Número de telefone:
                          </p>
                          <RadioGroup
                            value={selectedAssets.selected_phone_number?.id || ""}
                            onValueChange={(phoneId) => selectPhone(phoneId, waba.id)}
                          >
                            {waba.phone_numbers.map(phone => (
                              <div key={phone.id} className="flex items-center gap-2 py-0.5">
                                <RadioGroupItem value={phone.id} id={`phone-${phone.id}`} />
                                <Label htmlFor={`phone-${phone.id}`} className="text-xs cursor-pointer">
                                  {phone.display_phone_number}
                                  {phone.verified_name && (
                                    <span className="text-muted-foreground ml-1">({phone.verified_name})</span>
                                  )}
                                </Label>
                              </div>
                            ))}
                          </RadioGroup>
                        </div>
                      )}
                    </div>
                  ))}
                </RadioGroup>
              </AssetGroupSingle>
            )}

            {/* Ad Accounts - multi select */}
            {discoveredAssets.ad_accounts.length > 0 && (
              <AssetGroupSingle
                icon={<Megaphone className="h-4 w-4 text-blue-600" />}
                title="Contas de Anúncio"
                subtitle={`${selectedAssets.ad_accounts.length} de ${discoveredAssets.ad_accounts.length} selecionadas`}
              >
                {discoveredAssets.ad_accounts.map(acc => (
                  <div key={acc.id} className="flex items-center gap-2 py-1">
                    <Checkbox
                      id={`ad-${acc.id}`}
                      checked={selectedAssets.ad_accounts.some(a => a.id === acc.id)}
                      onCheckedChange={() => toggleAdAccount(acc.id)}
                    />
                    <Label htmlFor={`ad-${acc.id}`} className="text-sm cursor-pointer">{acc.name}</Label>
                  </div>
                ))}
              </AssetGroupSingle>
            )}

            {/* Pixels - single select */}
            {discoveredAssets.pixels.length > 0 && (
              <AssetGroupSingle
                icon={<Crosshair className="h-4 w-4 text-purple-600" />}
                title="Pixel"
                subtitle="Selecione 1 pixel"
              >
                <RadioGroup 
                  value={selectedAssets.pixels[0]?.id || ""} 
                  onValueChange={selectPixel}
                >
                  {discoveredAssets.pixels.map(pixel => (
                    <div key={pixel.id} className="flex items-center gap-2 py-1">
                      <RadioGroupItem value={pixel.id} id={`pixel-${pixel.id}`} />
                      <Label htmlFor={`pixel-${pixel.id}`} className="text-sm cursor-pointer">
                        {pixel.name} <span className="text-xs text-muted-foreground">({pixel.id})</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </AssetGroupSingle>
            )}

            {/* Catálogo - info only, created automatically */}
            <AssetGroupSingle
              icon={<ShoppingBag className="h-4 w-4 text-orange-600" />}
              title="Catálogo"
              subtitle="Será criado automaticamente"
            >
              <p className="text-xs text-muted-foreground py-1">
                Um novo catálogo será criado no Gerenciador de Comércio da Meta com todos os seus produtos ativos.
              </p>
            </AssetGroupSingle>

            {/* Threads */}
            {discoveredAssets.threads_profile && (
              <AssetGroupSingle
                icon={<AtSign className="h-4 w-4" />}
                title="Threads"
                subtitle="Perfil vinculado"
              >
                <div className="flex items-center gap-2 py-1">
                  <Checkbox
                    id="threads"
                    checked={!!selectedAssets.threads_profile}
                    onCheckedChange={toggleThreads}
                  />
                  <Label htmlFor="threads" className="text-sm cursor-pointer">
                    @{discoveredAssets.threads_profile.username}
                  </Label>
                </div>
              </AssetGroupSingle>
            )}

            <Separator />

            <div className="flex gap-3 pt-2">
              <Button 
                onClick={handleConfirmSelection} 
                className="flex-1"
              >
                Confirmar e ativar integrações
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
          <CardContent className="pt-8 pb-8 space-y-2">
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Ativando integrações...</p>
            <p className="text-xs text-muted-foreground">Configurando WhatsApp, Pixel, CAPI e Catálogo</p>
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
            {status === "success" && "Tudo configurado!"}
            {status === "error" && "Erro na conexão"}
          </CardTitle>
          <CardDescription>
            {status === "loading" && "Finalizando a conexão com o Meta..."}
            {status === "success" && "Todas as integrações foram ativadas automaticamente. Fechando..."}
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

// Helper components

function AssetGroupSingle({ icon, title, subtitle, children }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{title}</span>
        </div>
        <Badge variant="outline" className="text-xs">{subtitle}</Badge>
      </div>
      <div className="pl-6">{children}</div>
    </div>
  );
}

function getErrorMessage(error: string, description: string): string {
  if (error === "access_denied") return "Acesso negado. Você cancelou a autorização.";
  if (description) return description;
  return `Erro: ${error}`;
}
