// =============================================================================
// MetaAdsIdentitySection
// Seleção da Página do Facebook + conta Instagram que serão usadas como
// identidade nos anúncios da conta Meta. Persistido em
// tenant_meta_integrations(integration_id='anuncios').selected_assets.
// =============================================================================
import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Globe, Instagram, Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMetaIntegrations } from "@/hooks/useMetaIntegrations";

const NONE_VALUE = "__none__";

export function MetaAdsIdentitySection() {
  const { integrationStates, grant, saveAssets, isSavingAssets } = useMetaIntegrations();

  const anuncios = integrationStates.find((s) => s.def.id === "anuncios");
  const selected = (anuncios?.selectedAssets || {}) as any;
  const adAccounts = Array.isArray(selected.ad_accounts) ? selected.ad_accounts : [];

  // Flatten pages and instagram accounts from all businesses
  const { pages, igAccounts } = useMemo(() => {
    const pagesArr: Array<{ id: string; name: string; businessId: string; businessName: string }> = [];
    const igArr: Array<{ id: string; username?: string; pageId?: string; businessId: string; businessName: string }> = [];
    for (const biz of grant?.discoveredAssets?.businesses || []) {
      for (const p of biz.pages || []) {
        pagesArr.push({ id: p.id, name: p.name, businessId: biz.id, businessName: biz.name });
      }
      for (const ig of biz.instagram_accounts || []) {
        igArr.push({ id: ig.id, username: ig.username, pageId: ig.page_id, businessId: biz.id, businessName: biz.name });
      }
    }
    return { pages: pagesArr, igAccounts: igArr };
  }, [grant?.discoveredAssets]);

  const currentPage = (Array.isArray(selected.pages) && selected.pages[0]) || selected.page || null;
  const currentIg = (Array.isArray(selected.instagram_accounts) && selected.instagram_accounts[0]) || selected.instagram || null;

  const [pageId, setPageId] = useState<string>(currentPage?.id || "");
  const [igId, setIgId] = useState<string>(currentIg?.id || NONE_VALUE);

  useEffect(() => {
    setPageId(currentPage?.id || "");
    setIgId(currentIg?.id || NONE_VALUE);
  }, [currentPage?.id, currentIg?.id]);

  const dirty = (currentPage?.id || "") !== pageId || (currentIg?.id || NONE_VALUE) !== igId;

  const handleSave = () => {
    const page = pages.find((p) => p.id === pageId);
    const ig = igAccounts.find((i) => i.id === igId);
    const payload: any = {
      // preserva contas já selecionadas
      ad_accounts: adAccounts,
    };
    if (page) {
      payload.pages = [{ id: page.id, name: page.name }];
    }
    if (ig) {
      payload.instagram_accounts = [{ id: ig.id, username: ig.username, page_id: ig.pageId }];
    }
    saveAssets({ integrationId: "anuncios", selectedAssets: payload });
  };

  if (!anuncios?.isActive) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        Ative a integração de Anúncios para vincular Página e Instagram.
      </p>
    );
  }

  if (pages.length === 0 && igAccounts.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Nenhuma Página do Facebook ou conta Instagram foi encontrada na sua conta Meta.
          Verifique se a conexão tem acesso a esses ativos e reconecte se necessário.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3 py-2">
      <p className="text-xs text-muted-foreground">
        Selecione a Página do Facebook (e opcionalmente a conta do Instagram) que serão usadas como
        identidade nos anúncios criados nesta conta Meta.
      </p>

      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5" /> Página do Facebook
        </Label>
        <Select value={pageId} onValueChange={setPageId} disabled={isSavingAssets || pages.length === 0}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder={pages.length === 0 ? "Nenhuma Página disponível" : "Selecione uma Página"} />
          </SelectTrigger>
          <SelectContent>
            {pages.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-sm">
                {p.name}
                <span className="text-xs text-muted-foreground ml-2">— {p.businessName}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1.5">
          <Instagram className="h-3.5 w-3.5" /> Conta do Instagram (opcional)
        </Label>
        <Select value={igId} onValueChange={setIgId} disabled={isSavingAssets || igAccounts.length === 0}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder={igAccounts.length === 0 ? "Nenhuma conta Instagram disponível" : "Sem Instagram vinculado"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE} className="text-sm text-muted-foreground">
              Sem Instagram vinculado
            </SelectItem>
            {igAccounts.map((i) => (
              <SelectItem key={i.id} value={i.id} className="text-sm">
                {i.username ? `@${i.username}` : `Instagram ${i.id}`}
                <span className="text-xs text-muted-foreground ml-2">— {i.businessName}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" onClick={handleSave} disabled={!dirty || !pageId || isSavingAssets}>
          {isSavingAssets && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Salvar identidade
        </Button>
        {currentPage && (
          <span className="text-[11px] text-muted-foreground">
            Atual: {currentPage.name}
            {currentIg ? ` · @${currentIg.username || currentIg.id}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
