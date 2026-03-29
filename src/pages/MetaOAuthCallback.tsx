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
  Megaphone, ShoppingBag, AtSign, Crosshair, Phone, Info, Building2, ArrowRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating?: string;
}

interface BusinessPortfolio {
  id: string;
  name: string;
  pages: Array<{ id: string; name: string; access_token?: string }>;
  instagram_accounts: Array<{ id: string; username: string; page_id: string }>;
  whatsapp_business_accounts: Array<{ id: string; name: string; phone_numbers: PhoneNumber[] }>;
  ad_accounts: Array<{ id: string; name: string }>;
  pixels: Array<{ id: string; name: string; ad_account_id: string }>;
}

interface SelectedAssets {
  business_id: string;
  business_name: string;
  pages: Array<{ id: string; name: string; access_token?: string }>;
  instagram_accounts: Array<{ id: string; username: string; page_id: string }>;
  whatsapp_business_accounts: Array<{ id: string; name: string }>;
  ad_accounts: Array<{ id: string; name: string }>;
  pixels: Array<{ id: string; name: string; ad_account_id: string }>;
  catalogs: Array<{ id: string; name: string }>;
  threads_profile: { id: string; username: string } | null;
  selected_phone_number: { id: string; display_phone_number: string; verified_name: string; waba_id: string } | null;
}

type FlowStep = "loading" | "select_portfolio" | "select_assets" | "saving" | "success" | "error";

export default function MetaOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState<FlowStep>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [businesses, setBusinesses] = useState<BusinessPortfolio[]>([]);
  const [threadsProfile, setThreadsProfile] = useState<{ id: string; username: string } | null>(null);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<SelectedAssets | null>(null);
  const [connectionData, setConnectionData] = useState<any>(null);
  const [activeScopePacks, setActiveScopePacks] = useState<string[]>([]);
  const processedRef = useRef(false);

  const selectedPortfolio = businesses.find(b => b.id === selectedPortfolioId) || null;

  // Helpers para filtrar seções por scope packs selecionados
  const showPages = activeScopePacks.some(p => ["atendimento", "publicacao", "leads", "live_video", "insights"].includes(p));
  const showInstagram = activeScopePacks.some(p => ["atendimento", "publicacao", "insights"].includes(p));
  const showWhatsApp = activeScopePacks.includes("whatsapp");
  const showAdAccounts = activeScopePacks.includes("ads");
  const showPixels = activeScopePacks.some(p => ["ads", "pixel"].includes(p));
  const showCatalog = activeScopePacks.includes("catalogo");
  const showThreads = activeScopePacks.includes("threads") && !!threadsProfile;

  // === Single-select handlers ===
  const selectPage = (pageId: string) => {
    if (!selectedAssets || !selectedPortfolio) return;
    const page = selectedPortfolio.pages.find(p => p.id === pageId);
    if (!page) return;
    setSelectedAssets({ ...selectedAssets, pages: [page] });
  };

  const selectIg = (igId: string) => {
    if (!selectedAssets || !selectedPortfolio) return;
    const ig = selectedPortfolio.instagram_accounts.find(a => a.id === igId);
    if (!ig) return;
    setSelectedAssets({ ...selectedAssets, instagram_accounts: [ig] });
  };

  const selectWaba = (wabaId: string) => {
    if (!selectedAssets || !selectedPortfolio) return;
    const waba = selectedPortfolio.whatsapp_business_accounts.find(w => w.id === wabaId);
    if (!waba) return;
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
    if (!selectedAssets || !selectedPortfolio) return;
    const waba = selectedPortfolio.whatsapp_business_accounts.find(w => w.id === wabaId);
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
    if (!selectedAssets || !selectedPortfolio) return;
    const pixel = selectedPortfolio.pixels.find(p => p.id === pixelId);
    if (!pixel) return;
    setSelectedAssets({ ...selectedAssets, pixels: [pixel] });
  };

  // Ad accounts: multi-select
  const toggleAdAccount = (accId: string) => {
    if (!selectedAssets || !selectedPortfolio) return;
    const exists = selectedAssets.ad_accounts.some(a => a.id === accId);
    setSelectedAssets({
      ...selectedAssets,
      ad_accounts: exists
        ? selectedAssets.ad_accounts.filter(a => a.id !== accId)
        : [...selectedAssets.ad_accounts, selectedPortfolio.ad_accounts.find(a => a.id === accId)!],
    });
  };

  const toggleThreads = () => {
    if (!selectedAssets) return;
    setSelectedAssets({
      ...selectedAssets,
      threads_profile: selectedAssets.threads_profile ? null : threadsProfile,
    });
  };

  // === Portfolio selection → advance to asset selection ===
  const handleSelectPortfolio = (portfolioId: string) => {
    setSelectedPortfolioId(portfolioId);
    const portfolio = businesses.find(b => b.id === portfolioId);
    if (!portfolio) return;

    const firstWaba = portfolio.whatsapp_business_accounts[0];
    const firstPhone = firstWaba?.phone_numbers?.[0];

    setSelectedAssets({
      business_id: portfolio.id,
      business_name: portfolio.name,
      pages: portfolio.pages.length > 0 ? [portfolio.pages[0]] : [],
      instagram_accounts: portfolio.instagram_accounts.length > 0 ? [portfolio.instagram_accounts[0]] : [],
      whatsapp_business_accounts: firstWaba ? [{ id: firstWaba.id, name: firstWaba.name }] : [],
      ad_accounts: [...portfolio.ad_accounts],
      pixels: portfolio.pixels.length > 0 ? [portfolio.pixels[0]] : [],
      catalogs: [],
      threads_profile: threadsProfile,
      selected_phone_number: firstPhone && firstWaba ? {
        id: firstPhone.id,
        display_phone_number: firstPhone.display_phone_number,
        verified_name: firstPhone.verified_name,
        waba_id: firstWaba.id,
      } : null,
    });

    setStep("select_assets");
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
    } catch (e) {}

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
      setStep("success");
      notifyParentAndClose(true);
      return;
    }

    if (error) {
      processedRef.current = true;
      const errMsg = getErrorMessage(error, errorDescription || "");
      setStep("error");
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
    setStep("error");
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
        setStep("error");
        setErrorMessage(errMsg);
        notifyParentAndClose(false, errMsg);
        return;
      }

      if (data.requiresAssetSelection && data.connection?.businesses) {
        const bizList = data.connection.businesses as BusinessPortfolio[];
        setBusinesses(bizList);
        setThreadsProfile(data.connection.threads_profile || null);
        setActiveScopePacks(data.connection.scopePacks || []);
        setConnectionData(data.connection);

        // Se só tem 1 portfólio, pular direto para seleção de ativos
        if (bizList.length === 1) {
          handleSelectPortfolio(bizList[0].id);
        } else {
          setStep("select_portfolio");
        }
        return;
      }

      setStep("success");
      notifyParentAndClose(true);

    } catch (err) {
      setStep("error");
      setErrorMessage("Erro inesperado. Tente novamente.");
      notifyParentAndClose(false, "Erro inesperado.");
    }
  }

  async function handleConfirmSelection() {
    if (!selectedAssets) return;
    setStep("saving");

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

      setStep("success");
      notifyParentAndClose(true);
    } catch (err: any) {
      setStep("error");
      setErrorMessage(err.message || "Erro ao salvar seleção");
      notifyParentAndClose(false, err.message);
    }
  }

  const handleClose = () => {
    if (window.opener && !window.opener.closed) window.close();
    else navigate("/integrations", { replace: true });
  };

  // ==========================================
  // STEP 1: Seleção de Portfólio Empresarial
  // ==========================================
  if (step === "select_portfolio" && businesses.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2">
              <Building2 className="h-10 w-10 text-blue-500" />
            </div>
            <CardTitle className="text-lg">Selecione o Portfólio Empresarial</CardTitle>
            <CardDescription>
              Escolha o portfólio cujos ativos você deseja integrar ao sistema. Os ativos exibidos serão apenas os deste portfólio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {businesses.map(biz => {
              const assetCount = biz.pages.length + biz.instagram_accounts.length + biz.whatsapp_business_accounts.length + biz.ad_accounts.length;
              return (
                <button
                  key={biz.id}
                  onClick={() => handleSelectPortfolio(biz.id)}
                  className="w-full flex items-center justify-between p-4 rounded-lg border hover:border-primary hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                      {biz.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{biz.name}</p>
                      <p className="text-xs text-muted-foreground">{assetCount} ativo(s) de negócios</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              );
            })}

            <Separator />
            <Button variant="outline" onClick={handleClose} className="w-full">
              Cancelar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ==========================================
  // STEP 2: Seleção de Ativos (do portfólio escolhido)
  // ==========================================
  if (step === "select_assets" && selectedPortfolio && selectedAssets) {
    const selectedWabaId = selectedAssets.whatsapp_business_accounts[0]?.id;
    const selectedWaba = selectedPortfolio.whatsapp_business_accounts.find(w => w.id === selectedWabaId);

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <CardTitle className="text-lg">Conta conectada!</CardTitle>
            <CardDescription>
              Portfólio: <span className="font-semibold">{selectedPortfolio.name}</span>
              {businesses.length > 1 && (
                <Button variant="link" size="sm" className="ml-1 p-0 h-auto text-xs" onClick={() => setStep("select_portfolio")}>
                  (trocar)
                </Button>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Selecione <strong>1 ativo de cada tipo</strong>. Um catálogo será criado automaticamente na Meta com os produtos da sua loja.
              </AlertDescription>
            </Alert>

            {/* Pages - single select */}
            {showPages && selectedPortfolio.pages.length > 0 && (
              <AssetGroup
                icon={<Facebook className="h-4 w-4 text-blue-600" />}
                title="Página do Facebook"
                subtitle="Selecione 1 página"
              >
                <RadioGroup value={selectedAssets.pages[0]?.id || ""} onValueChange={selectPage}>
                  {selectedPortfolio.pages.map(page => (
                    <div key={page.id} className="flex items-center gap-2 py-1">
                      <RadioGroupItem value={page.id} id={`page-${page.id}`} />
                      <Label htmlFor={`page-${page.id}`} className="text-sm cursor-pointer">{page.name}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </AssetGroup>
            )}

            {/* Instagram - single select */}
            {showInstagram && selectedPortfolio.instagram_accounts.length > 0 && (
              <AssetGroup
                icon={<Instagram className="h-4 w-4 text-pink-600" />}
                title="Perfil do Instagram"
                subtitle="Selecione 1 perfil"
              >
                <RadioGroup value={selectedAssets.instagram_accounts[0]?.id || ""} onValueChange={selectIg}>
                  {selectedPortfolio.instagram_accounts.map(ig => (
                    <div key={ig.id} className="flex items-center gap-2 py-1">
                      <RadioGroupItem value={ig.id} id={`ig-${ig.id}`} />
                      <Label htmlFor={`ig-${ig.id}`} className="text-sm cursor-pointer">@{ig.username}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </AssetGroup>
            )}

            {/* WhatsApp - single select WABA + single select phone */}
            {showWhatsApp && selectedPortfolio.whatsapp_business_accounts.length > 0 && (
              <AssetGroup
                icon={<MessageCircle className="h-4 w-4 text-green-600" />}
                title="WhatsApp Business"
                subtitle="Selecione 1 conta e 1 número"
              >
                <RadioGroup value={selectedWabaId || ""} onValueChange={selectWaba}>
                  {selectedPortfolio.whatsapp_business_accounts.map(waba => (
                    <div key={waba.id} className="space-y-2">
                      <div className="flex items-center gap-2 py-1">
                        <RadioGroupItem value={waba.id} id={`waba-${waba.id}`} />
                        <Label htmlFor={`waba-${waba.id}`} className="text-sm cursor-pointer">{waba.name}</Label>
                      </div>
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
              </AssetGroup>
            )}

            {/* Ad Accounts - multi select */}
            {showAdAccounts && selectedPortfolio.ad_accounts.length > 0 && (
              <AssetGroup
                icon={<Megaphone className="h-4 w-4 text-blue-600" />}
                title="Contas de Anúncio"
                subtitle={`${selectedAssets.ad_accounts.length} de ${selectedPortfolio.ad_accounts.length}`}
              >
                {selectedPortfolio.ad_accounts.map(acc => (
                  <div key={acc.id} className="flex items-center gap-2 py-1">
                    <Checkbox
                      id={`ad-${acc.id}`}
                      checked={selectedAssets.ad_accounts.some(a => a.id === acc.id)}
                      onCheckedChange={() => toggleAdAccount(acc.id)}
                    />
                    <Label htmlFor={`ad-${acc.id}`} className="text-sm cursor-pointer">{acc.name}</Label>
                  </div>
                ))}
              </AssetGroup>
            )}

            {/* Pixels - single select */}
            {showPixels && selectedPortfolio.pixels.length > 0 && (
              <AssetGroup
                icon={<Crosshair className="h-4 w-4 text-purple-600" />}
                title="Pixel"
                subtitle="Selecione 1 pixel"
              >
                <RadioGroup value={selectedAssets.pixels[0]?.id || ""} onValueChange={selectPixel}>
                  {selectedPortfolio.pixels.map(pixel => (
                    <div key={pixel.id} className="flex items-center gap-2 py-1">
                      <RadioGroupItem value={pixel.id} id={`pixel-${pixel.id}`} />
                      <Label htmlFor={`pixel-${pixel.id}`} className="text-sm cursor-pointer">
                        {pixel.name} <span className="text-xs text-muted-foreground">({pixel.id})</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </AssetGroup>
            )}

            {/* Catálogo - info */}
            {showCatalog && (
              <AssetGroup
                icon={<ShoppingBag className="h-4 w-4 text-orange-600" />}
                title="Catálogo"
                subtitle="Criação automática"
              >
                <p className="text-xs text-muted-foreground py-1">
                  Um novo catálogo será criado no Gerenciador de Comércio da Meta com todos os seus produtos ativos.
                </p>
              </AssetGroup>
            )}

            {/* Threads */}
            {showThreads && (
              <AssetGroup
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
                    @{threadsProfile!.username}
                  </Label>
                </div>
              </AssetGroup>
            )}

            <Separator />

            <div className="flex gap-3 pt-2">
              <Button onClick={handleConfirmSelection} className="flex-1">
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
  if (step === "saving") {
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

  // Loading / Success / Error
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {step === "loading" && <Loader2 className="h-12 w-12 text-primary animate-spin" />}
            {step === "success" && <CheckCircle className="h-12 w-12 text-green-500" />}
            {step === "error" && <XCircle className="h-12 w-12 text-destructive" />}
          </div>
          <CardTitle>
            {step === "loading" && "Conectando..."}
            {step === "success" && "Tudo configurado!"}
            {step === "error" && "Erro na conexão"}
          </CardTitle>
          <CardDescription>
            {step === "loading" && "Finalizando a conexão com o Meta..."}
            {step === "success" && "Todas as integrações foram ativadas automaticamente. Fechando..."}
            {step === "error" && errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {step === "error" && (
            <Button onClick={handleClose} className="mt-4">
              {window.opener ? "Fechar" : "Voltar para Integrações"}
            </Button>
          )}
          {step === "success" && (
            <p className="text-sm text-muted-foreground mt-2">
              Esta janela será fechada automaticamente...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// === Helper components ===

function AssetGroup({ icon, title, subtitle, children }: {
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