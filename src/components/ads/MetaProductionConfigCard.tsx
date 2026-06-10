// =============================================================================
// MetaProductionConfigCard — Onda D
//
// Bloco "Configuração de Criação Meta", exibido em Gestor de Tráfego IA →
// Configurações Gerais → Meta Ads. Fonte de verdade real usada pelo Strategist
// para preencher propostas v2 de campanhas Meta.
//
// Mostra:
//  - dados configurados (verde),
//  - dados pendentes obrigatórios (vermelho),
//  - dados opcionais (cinza).
//
// Não publica. Não cria campanha. Não chama Meta.
// =============================================================================

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Settings2 } from "lucide-react";
import {
  useAdsMetaProductionConfig,
  isProductionConfigReadyForStrategy,
  isProductionConfigReadyForPublish,
  type MetaProductionConfig,
} from "@/hooks/useAdsMetaProductionConfig";

interface Props {
  adAccountId: string;
  adAccountLabel?: string;
}

const CTA_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "SHOP_NOW", label: "Comprar agora" },
  { value: "LEARN_MORE", label: "Saiba mais" },
  { value: "SIGN_UP", label: "Cadastre-se" },
  { value: "GET_OFFER", label: "Pegar oferta" },
  { value: "ORDER_NOW", label: "Pedir agora" },
  { value: "SEND_MESSAGE", label: "Enviar mensagem" },
];

const OBJECTIVE_OPTIONS = [
  { value: "sales", label: "Vendas" },
  { value: "leads", label: "Geração de leads" },
  { value: "traffic", label: "Tráfego" },
  { value: "awareness", label: "Reconhecimento de marca" },
  { value: "engagement", label: "Engajamento" },
];

const STATUS_OPTIONS = [
  { value: "PAUSED", label: "Pausada" },
  { value: "ACTIVE", label: "Ativa" },
];

const FORMAT_OPTIONS = [
  { value: "1x1", label: "Quadrado 1:1" },
  { value: "9x16", label: "Vertical 9:16" },
  { value: "4x5", label: "Retrato 4:5" },
  { value: "16x9", label: "Horizontal 16:9" },
];

const GENDER_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "male", label: "Masculino" },
  { value: "female", label: "Feminino" },
];

const PLACEMENT_PRESETS = [
  { value: "advantage_plus", label: "Advantage+ (automático, recomendado)" },
  { value: "feed_only", label: "Apenas Feeds" },
  { value: "stories_reels", label: "Stories e Reels" },
];

export function MetaProductionConfigCard({ adAccountId, adAccountLabel }: Props) {
  const { data: config, isLoading, save } = useAdsMetaProductionConfig(adAccountId);

  // Defaults seguros do briefing
  const [form, setForm] = useState<Partial<MetaProductionConfig>>({
    default_objective: "sales",
    default_buying_type: "AUCTION",
    default_budget_type: "daily",
    default_planned_status: "PAUSED",
    default_country: "BR",
    default_language: "pt_BR",
    default_age_min: 18,
    default_age_max: 65,
    default_gender: "all",
    default_placements: ["advantage_plus"],
    default_audience_type: "broad",
    default_funnel_stage: "tof",
    exclude_customers: true,
    default_cta: "SHOP_NOW",
    default_creative_format: "1x1",
    reference_image_strategy: "product_main_image",
  });

  useEffect(() => {
    if (config) setForm(config);
  }, [config]);

  const update = <K extends keyof MetaProductionConfig>(key: K, value: MetaProductionConfig[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const placementPreset = (() => {
    const p = form.default_placements || [];
    if (p.length === 1 && p[0] === "advantage_plus") return "advantage_plus";
    if (p.length === 2 && p.includes("facebook_feed") && p.includes("instagram_feed")) return "feed_only";
    if (p.length === 2 && p.includes("instagram_stories") && p.includes("instagram_reels")) return "stories_reels";
    return "advantage_plus";
  })();

  const setPlacementPreset = (preset: string) => {
    if (preset === "feed_only") update("default_placements", ["facebook_feed", "instagram_feed"]);
    else if (preset === "stories_reels") update("default_placements", ["instagram_stories", "instagram_reels"]);
    else update("default_placements", ["advantage_plus"]);
  };

  const budgetReais = form.default_daily_budget_cents != null
    ? (form.default_daily_budget_cents / 100).toString()
    : "";

  const readyForStrategy = isProductionConfigReadyForStrategy(config);
  const readyForPublish = isProductionConfigReadyForPublish(config);

  const pending = {
    page: !form.facebook_page_id,
    pixel: !form.pixel_id,
    event: !form.default_conversion_event,
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="h-4 w-4 text-primary" />
          Configuração de Criação Meta
          {adAccountLabel && <Badge variant="outline" className="ml-1 text-[10px]">{adAccountLabel}</Badge>}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Esses valores são usados pela IA para preencher campanhas Meta novas e revisões de proposta. É a fonte de verdade da conta — não é teste.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <StatusBadge ok={readyForStrategy} label="Pronto para gerar estratégia" />
          <StatusBadge ok={readyForPublish} label="Pronto para publicar (futuro)" />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Identidade */}
        <Section title="Identidade da conta">
          <Field label="Página do Facebook" pending={pending.page} required>
            <Input
              placeholder="ID ou nome da página"
              value={form.facebook_page_id || ""}
              onChange={(e) => update("facebook_page_id", e.target.value || null)}
            />
          </Field>
          <Field label="Conta do Instagram (opcional)">
            <Input
              placeholder="ID da conta Instagram vinculada"
              value={form.instagram_actor_id || ""}
              onChange={(e) => update("instagram_actor_id", e.target.value || null)}
            />
          </Field>
        </Section>

        {/* Mensuração */}
        <Section title="Mensuração">
          <Field label="Pixel / Conjunto de dados" pending={pending.pixel} required>
            <Input
              placeholder="ID do Pixel Meta"
              value={form.pixel_id || ""}
              onChange={(e) => update("pixel_id", e.target.value || null)}
            />
          </Field>
          <Field label="Evento de conversão padrão" pending={pending.event} required>
            <Select
              value={form.default_conversion_event || ""}
              onValueChange={(v) => update("default_conversion_event", v)}
            >
              <SelectTrigger><SelectValue placeholder="Escolha o evento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PURCHASE">Compra</SelectItem>
                <SelectItem value="ADD_TO_CART">Adicionar ao carrinho</SelectItem>
                <SelectItem value="INITIATE_CHECKOUT">Iniciar checkout</SelectItem>
                <SelectItem value="LEAD">Lead</SelectItem>
                <SelectItem value="COMPLETE_REGISTRATION">Cadastro</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </Section>

        {/* Campanha */}
        <Section title="Padrões de campanha">
          <Field label="Objetivo padrão">
            <Select value={form.default_objective || "sales"} onValueChange={(v) => update("default_objective", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OBJECTIVE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status inicial">
            <Select value={form.default_planned_status || "PAUSED"} onValueChange={(v) => update("default_planned_status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Orçamento diário padrão (R$)">
            <Input
              type="number" min={0} step="0.01"
              value={budgetReais}
              onChange={(e) => update("default_daily_budget_cents", e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null)}
            />
          </Field>
        </Section>

        {/* Conjunto */}
        <Section title="Padrões de conjunto de anúncios">
          <Field label="País">
            <Input value={form.default_country || "BR"} onChange={(e) => update("default_country", e.target.value || "BR")} />
          </Field>
          <Field label="Idioma">
            <Input value={form.default_language || "pt_BR"} onChange={(e) => update("default_language", e.target.value || "pt_BR")} />
          </Field>
          <Field label="Idade mínima">
            <Input type="number" min={13} max={65} value={form.default_age_min ?? 18}
              onChange={(e) => update("default_age_min", parseInt(e.target.value) || 18)} />
          </Field>
          <Field label="Idade máxima">
            <Input type="number" min={13} max={65} value={form.default_age_max ?? 65}
              onChange={(e) => update("default_age_max", parseInt(e.target.value) || 65)} />
          </Field>
          <Field label="Gênero">
            <Select value={form.default_gender || "all"} onValueChange={(v) => update("default_gender", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GENDER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Posicionamentos">
            <Select value={placementPreset} onValueChange={setPlacementPreset}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLACEMENT_PRESETS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Excluir clientes/compradores do público frio" fullWidth>
            <div className="flex items-center gap-2">
              <Switch
                checked={!!form.exclude_customers}
                onCheckedChange={(v) => update("exclude_customers", v)}
              />
              <span className="text-xs text-muted-foreground">
                Quando ligado, lista de compradores entra automaticamente como exclusão.
              </span>
            </div>
          </Field>
        </Section>

        {/* Criativo */}
        <Section title="Padrões de anúncio e criativo">
          <Field label="Botão de ação padrão">
            <Select value={form.default_cta || "SHOP_NOW"} onValueChange={(v) => update("default_cta", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CTA_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Formato padrão">
            <Select value={form.default_creative_format || "1x1"} onValueChange={(v) => update("default_creative_format", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORMAT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Estratégia de imagem de referência">
            <Select
              value={form.reference_image_strategy || "product_main_image"}
              onValueChange={(v) => update("reference_image_strategy", v)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="product_main_image">Imagem principal do produto</SelectItem>
                <SelectItem value="product_lifestyle">Imagem lifestyle, quando houver</SelectItem>
                <SelectItem value="ai_generated">Apenas gerada por IA, sem referência</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </Section>

        <div className="flex flex-col gap-2 pt-2">
          {(pending.page || pending.pixel || pending.event) && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                A configuração pode ser salva mesmo parcial. Dados pendentes (Página, Pixel, Evento) só são exigidos quando a campanha for publicada de fato.
              </span>
            </div>
          )}
          <Button onClick={() => save.mutate(form)} disabled={save.isPending || isLoading} className="w-full md:w-auto">
            {save.isPending ? "Salvando…" : "Salvar configuração"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- átomos ---------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Field({
  label, children, pending, required, fullWidth,
}: { label: string; children: React.ReactNode; pending?: boolean; required?: boolean; fullWidth?: boolean }) {
  return (
    <div className={fullWidth ? "md:col-span-2" : undefined}>
      <Label className="text-xs flex items-center gap-2 mb-1">
        {label}
        {required && pending && (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30 px-1.5 py-0.5 text-[10px] font-medium">
            Pendente · Obrigatório p/ publicar
          </span>
        )}
      </Label>
      {children}
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] ${
      ok
        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
        : "bg-muted/50 border-border/40 text-muted-foreground"
    }`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}
