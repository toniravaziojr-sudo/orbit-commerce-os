// =============================================
// ACTION APPROVAL CARD — v5.14.0
// Grouped campaign view: creatives gallery + nested adsets
// =============================================

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, MessageSquare, ChevronDown, ChevronRight, Megaphone, ImageIcon, DollarSign, Target, Sparkles, ZoomIn, Bot, AlertTriangle, TrendingUp, ListChecks, Clock, Eye, Layers, Users, Loader2 } from "lucide-react";
import type { PendingAction } from "@/hooks/useAdsPendingActions";
import { cn } from "@/lib/utils";
import { StrategicPlanContent } from "./StrategicPlanContent";

export interface ActionApprovalCardProps {
  action: PendingAction;
  childActions?: PendingAction[];
  onApprove: (actionId: string) => void;
  onReject: (actionId: string, reason: string) => void;
  onAdjust: (actionId: string, suggestion: string) => void;
  approvingId?: string | null;
  rejectingId?: string | null;
  adjustingId?: string | null;
}

export interface OrphanAdsetGroupCardProps {
  parentCampaignName: string;
  adsets: PendingAction[];
  onApprove: (actionId: string) => void;
  onReject: (actionId: string, reason: string) => void;
  onAdjust: (actionId: string, suggestion: string) => void;
  approvingId?: string | null;
  rejectingId?: string | null;
  adjustingId?: string | null;
}

const FUNNEL_LABELS: Record<string, { label: string; color: string }> = {
  tof: { label: "Público Frio", color: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
  cold: { label: "Público Frio", color: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
  bof: { label: "Remarketing", color: "bg-orange-500/10 text-orange-700 border-orange-500/20" },
  remarketing: { label: "Remarketing", color: "bg-orange-500/10 text-orange-700 border-orange-500/20" },
  mof: { label: "Público Morno", color: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20" },
  test: { label: "Teste", color: "bg-purple-500/10 text-purple-700 border-purple-500/20" },
  leads: { label: "Captação", color: "bg-green-500/10 text-green-700 border-green-500/20" },
};

const CAMPAIGN_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  sales: { label: "Venda Direta", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  conversions: { label: "Venda Direta", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  remarketing: { label: "Remarketing", color: "bg-orange-500/10 text-orange-700 border-orange-500/20" },
  retargeting: { label: "Remarketing", color: "bg-orange-500/10 text-orange-700 border-orange-500/20" },
  test: { label: "Teste", color: "bg-purple-500/10 text-purple-700 border-purple-500/20" },
  testing: { label: "Teste", color: "bg-purple-500/10 text-purple-700 border-purple-500/20" },
  traffic: { label: "Tráfego", color: "bg-sky-500/10 text-sky-700 border-sky-500/20" },
  link_clicks: { label: "Tráfego", color: "bg-sky-500/10 text-sky-700 border-sky-500/20" },
  catalog: { label: "Catálogo", color: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  catalog_sales: { label: "Catálogo", color: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  product_catalog_sales: { label: "Catálogo", color: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  awareness: { label: "Reconhecimento", color: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20" },
  brand_awareness: { label: "Reconhecimento", color: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20" },
  reach: { label: "Alcance", color: "bg-teal-500/10 text-teal-700 border-teal-500/20" },
  engagement: { label: "Engajamento", color: "bg-pink-500/10 text-pink-700 border-pink-500/20" },
  leads: { label: "Geração de Leads", color: "bg-green-500/10 text-green-700 border-green-500/20" },
  lead_generation: { label: "Geração de Leads", color: "bg-green-500/10 text-green-700 border-green-500/20" },
  video_views: { label: "Visualização de Vídeo", color: "bg-rose-500/10 text-rose-700 border-rose-500/20" },
};

/** Infer campaign type from action_data fields or campaign name */
function inferCampaignType(data: Record<string, any>): { label: string; color: string } | null {
  const preview = data.preview || {};
  // Explicit campaign_type or objective
  const raw = (data.campaign_type || preview.campaign_type || data.objective || preview.objective || "").toLowerCase().trim();
  if (raw && CAMPAIGN_TYPE_LABELS[raw]) return CAMPAIGN_TYPE_LABELS[raw];

  // Infer from campaign name patterns
  const name = (data.campaign_name || preview.campaign_name || "").toLowerCase();
  if (/teste|test/i.test(name)) return CAMPAIGN_TYPE_LABELS.test;
  if (/remarketing|retarget|bof/i.test(name)) return CAMPAIGN_TYPE_LABELS.remarketing;
  if (/cat[aá]logo/i.test(name)) return CAMPAIGN_TYPE_LABELS.catalog;
  if (/tr[aá]fego|traffic/i.test(name)) return CAMPAIGN_TYPE_LABELS.traffic;
  if (/leads?[\s|]/i.test(name)) return CAMPAIGN_TYPE_LABELS.leads;
  if (/vendas?|sales|convers/i.test(name)) return CAMPAIGN_TYPE_LABELS.sales;

  // Fallback from funnel_stage
  const funnel = (data.funnel_stage || preview.funnel_stage || "").toLowerCase();
  if (funnel === "bof" || funnel === "remarketing") return CAMPAIGN_TYPE_LABELS.remarketing;
  if (funnel === "test") return CAMPAIGN_TYPE_LABELS.test;
  if (funnel === "tof" || funnel === "cold") return CAMPAIGN_TYPE_LABELS.sales;

  return null;
}

const ACTION_TYPE_ICONS: Record<string, typeof Target> = {
  create_campaign: Megaphone,
  create_adset: Target,
  generate_creative: ImageIcon,
  adjust_budget: DollarSign,
  pause_campaign: Target,
  activate_campaign: Sparkles,
  strategic_plan: Bot,
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  create_campaign: "Nova Campanha",
  create_adset: "Novo Conjunto de Anúncios",
  generate_creative: "Criativo Gerado",
  adjust_budget: "Ajuste de Orçamento",
  pause_campaign: "Pausar Campanha",
  activate_campaign: "Ativar Campanha",
  strategic_plan: "Plano Estratégico",
};

/** Action types that should be hidden from user approval view (internal/technical) */
const HIDDEN_ACTION_TYPES = new Set(["activate_campaign"]);

/**
 * Resolves ALL creative URLs for a product (not just one).
 * Fallback chain per creative: action_data -> creative_assets -> product_images
 */
function useAllCreativeUrls(action: PendingAction): string[] {
  const data = action.action_data || {};
  const preview = (data as any).preview || {};
  const directUrl = preview.creative_url || (data as any).asset_url || (data as any).creative_url || null;
  const productId = (data as any).product_id || preview.product_id || null;
  const tenantId = action.tenant_id;

  const { data: allUrls } = useQuery({
    queryKey: ["all-creatives", action.id, productId, tenantId],
    queryFn: async () => {
      const urls: string[] = [];

      // 1. Get all creative assets for this product
      if (productId) {
        const { data: assets } = await supabase
          .from("ads_creative_assets" as any)
          .select("asset_url")
          .eq("tenant_id", tenantId)
          .eq("product_id", productId)
          .not("asset_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(10);
        if (assets) {
          for (const a of assets as any[]) {
            if (a.asset_url && !urls.includes(a.asset_url)) urls.push(a.asset_url);
          }
        }
      }

      // 2. Add direct URL if not already included
      if (directUrl && !urls.includes(directUrl)) urls.unshift(directUrl);

      // 3. If still empty, fallback to product catalog images
      if (urls.length === 0 && productId) {
        const { data: imgs } = await supabase
          .from("product_images")
          .select("url")
          .eq("product_id", productId)
          .order("sort_order", { ascending: true })
          .limit(5);
        if (imgs) {
          for (const img of imgs) {
            if (img.url && !urls.includes(img.url)) urls.push(img.url);
          }
        }
      }

      return urls;
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  // If query hasn't resolved yet, use directUrl as fallback
  if (!allUrls || allUrls.length === 0) {
    return directUrl ? [directUrl] : [];
  }
  return allUrls;
}

function formatCents(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2)}`;
}

function sanitizeDisplayText(text: string): string {
  if (!text) return text;
  return text
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "")
    .replace(/\bact_\d{10,}\b/g, "")
    .replace(/\b(asset ready|asset pending)\s+[0-9a-f-]{20,}/gi, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function truncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}

function BudgetBar({ snapshot }: { snapshot: any }) {
  if (!snapshot || !snapshot.limit_cents) return null;
  const limit = snapshot.limit_cents;
  const active = snapshot.active_cents || 0;
  const reserved = snapshot.pending_reserved_cents || 0;
  const activePct = Math.min((active / limit) * 100, 100);
  const reservedPct = Math.min((reserved / limit) * 100, 100 - activePct);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Orçamento da conta</span>
        <span className="font-medium">{formatCents(limit)}/dia</span>
      </div>
      <div className="h-2 rounded-full bg-muted/40 overflow-hidden flex">
        {activePct > 0 && (
          <div className="h-full bg-emerald-500 rounded-l-full" style={{ width: `${activePct}%` }} />
        )}
        {reservedPct > 0 && (
          <div className="h-full bg-amber-400" style={{ width: `${reservedPct}%` }} />
        )}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
          Ativo {formatCents(active)}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
          Reservado {formatCents(reserved)}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-muted inline-block" />
          Restante {formatCents(Math.max(0, limit - active - reserved))}
        </span>
      </div>
    </div>
  );
}

const CTA_LABELS: Record<string, string> = {
  SHOP_NOW: "Comprar Agora",
  BUY_NOW: "Comprar",
  LEARN_MORE: "Saiba Mais",
  SIGN_UP: "Cadastre-se",
  SUBSCRIBE: "Assinar",
  CONTACT_US: "Fale Conosco",
  GET_OFFER: "Ver Oferta",
};

/* ========================================
   CREATIVES GALLERY
   Shows all creatives in a horizontal scroll
   ======================================== */
function CreativesGallery({ urls, onZoom }: { urls: string[]; onZoom: (url: string) => void }) {
  if (urls.length === 0) return null;

  if (urls.length === 1) {
    return (
      <div className="rounded-lg overflow-hidden border border-border/40 bg-muted/10 relative group cursor-pointer" onClick={() => onZoom(urls[0])}>
        <img src={urls[0]} alt="Criativo" className="w-full max-h-[300px] object-contain" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <ZoomIn className="h-5 w-5 text-white" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionLabel icon={<ImageIcon className="h-3.5 w-3.5 text-primary" />} label={`Criativos (${urls.length})`} />
      <div className="flex gap-2 mt-1.5 overflow-x-auto pb-2">
        {urls.map((url, i) => (
          <div
            key={i}
            className="w-[140px] h-[140px] flex-shrink-0 rounded-lg overflow-hidden border border-border/40 bg-muted/10 relative group cursor-pointer"
            onClick={() => onZoom(url)}
          >
            <img src={url} alt={`Criativo ${i + 1}`} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <ZoomIn className="h-4 w-4 text-white" />
            </div>
            <Badge variant="secondary" className="absolute bottom-1 right-1 text-[9px] px-1 py-0">{i + 1}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========================================
   ADSETS SECTION (nested inside campaign)
   ======================================== */
function AdSetsSection({ adsets }: { adsets: PendingAction[] }) {
  const [expanded, setExpanded] = useState(false);

  if (adsets.length === 0) return null;

  return (
    <div className="border border-border/40 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-2.5 text-xs font-medium hover:bg-muted/30 transition-colors"
      >
        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{adsets.length} Conjunto{adsets.length !== 1 ? "s" : ""} de Anúncios</span>
        {expanded ? <ChevronDown className="h-3 w-3 ml-auto text-muted-foreground" /> : <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="border-t border-border/30 divide-y divide-border/20">
          {adsets.map((adset) => {
            const ad = adset.action_data || {};
            const prev = ad.preview || {};
            const targeting = prev.targeting_summary || ad.targeting_summary || null;
            const customAudiences = ad.custom_audiences || prev.custom_audiences || null;
            return (
              <div key={adset.id} className="p-2.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Target className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-semibold">{ad.adset_name || prev.adset_name || "Conjunto"}</span>
                </div>
                {targeting && (
                  <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                    <Users className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{sanitizeDisplayText(targeting)}</span>
                  </div>
                )}
                {customAudiences && Array.isArray(customAudiences) && customAudiences.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {customAudiences.map((aud: any, i: number) => (
                      <Badge key={i} variant="outline" className="text-[9px] px-1 py-0">
                        {typeof aud === "string" ? aud : aud.name || aud.id}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ========================================
   FULL CONTENT DIALOG
   ======================================== */
function FullContentDialog({ action, childActions, open, onOpenChange }: { action: PendingAction; childActions?: PendingAction[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const data = action.action_data || {};
  const preview = data.preview || {};
  const isStrategicPlan = action.action_type === "strategic_plan";
  const isAdSet = action.action_type === "create_adset";
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  const creativeUrls = useAllCreativeUrls(action);

  // Support both single values and arrays of variations
  const primaryTexts: string[] = preview.primary_texts || (preview.copy_text ? [preview.copy_text] : data.copy_text ? [data.copy_text] : []);
  const headlinesList: string[] = preview.headlines || (preview.headline ? [preview.headline] : data.headline ? [data.headline] : []);
  const descriptionsList: string[] = preview.descriptions || [];
  const ctaType = preview.cta || preview.cta_type || data.cta_type || null;

  const productName = preview.product_name || data.product_name || null;
  const productPrice = preview.product_price_display || (preview.product_price ? `R$ ${Number(preview.product_price).toFixed(2)}` : null);
  const targeting = preview.targeting_summary || data.targeting_summary || null;
  const ageRange = preview.age_range || null;
  const budgetDisplay = preview.daily_budget_display || (data.daily_budget_cents ? `R$ ${(data.daily_budget_cents / 100).toFixed(2)}/dia` : null);
  const budgetSnapshot = preview.budget_snapshot || null;

  const adsetName = data.adset_name || preview.adset_name || null;
  const parentCampaign = data.campaign_name || data.parent_campaign_name || null;
  const customAudiences = data.custom_audiences || preview.custom_audiences || null;

  const diagnosis = data.diagnosis || preview.copy_text || null;
  const plannedActions = data.planned_actions || null;
  const expectedResults = data.expected_results || null;
  const riskAssessment = data.risk_assessment || null;
  const timeline = data.timeline || null;

  const adsets = (childActions || []).filter(a => a.action_type === "create_adset");
  const label = ACTION_TYPE_LABELS[action.action_type] || action.action_type;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/30 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              {isStrategicPlan ? <Bot className="h-4 w-4 text-primary" /> : <Megaphone className="h-4 w-4 text-primary" />}
              {label}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {new Date(action.created_at).toLocaleString("pt-BR")}
              {action.confidence && (
                <> · Confiança: {action.confidence === "high" ? "Alta" : action.confidence === "medium" ? "Média" : "Baixa"}</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
            <div className="space-y-4">
              {/* Creatives Gallery */}
              {!isStrategicPlan && !isAdSet && (
                <CreativesGallery urls={creativeUrls} onZoom={setZoomUrl} />
              )}

              {/* AdSet info (standalone) */}
              {isAdSet && (
                <div className="space-y-3">
                  {adsetName && (
                    <div>
                      <SectionLabel icon={<Target className="h-3.5 w-3.5 text-primary" />} label="Conjunto de Anúncios" />
                      <p className="text-sm font-semibold mt-1">{adsetName}</p>
                    </div>
                  )}
                  {parentCampaign && (
                    <div className="bg-muted/30 rounded-lg p-2.5 border border-border/30 text-xs">
                      <span className="text-muted-foreground">Campanha pai</span>
                      <p className="font-medium mt-0.5">{parentCampaign}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Headlines — show ALL variations */}
              {headlinesList.length > 0 && !isStrategicPlan && !isAdSet && (
                <div>
                  <SectionLabel icon={<Sparkles className="h-3.5 w-3.5 text-primary" />} label={`Headlines (${headlinesList.length} variações)`} />
                  <div className="space-y-1.5 mt-1.5">
                    {headlinesList.map((h, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-0.5 shrink-0">{i + 1}</Badge>
                        <span className="font-semibold">{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Primary Texts (Copys) — show ALL variations */}
              {primaryTexts.length > 0 && !isStrategicPlan && !isAdSet && (
                <div>
                  <SectionLabel icon={<MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />} label={`Textos Principais (${primaryTexts.length} variações)`} />
                  <div className="space-y-2 mt-1.5">
                    {primaryTexts.map((t, i) => (
                      <div key={i} className="bg-muted/20 rounded-lg p-2.5 border border-border/30">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">Versão {i + 1}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{t}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Descriptions */}
              {descriptionsList.length > 0 && !isStrategicPlan && !isAdSet && (
                <div>
                  <SectionLabel icon={<ListChecks className="h-3.5 w-3.5 text-muted-foreground" />} label={`Descrições (${descriptionsList.length})`} />
                  <div className="space-y-1 mt-1.5">
                    {descriptionsList.map((d, i) => (
                      <p key={i} className="text-xs text-muted-foreground">{d}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              {ctaType && !isStrategicPlan && !isAdSet && (
                <Badge variant="secondary" className="text-xs">{CTA_LABELS[ctaType] || ctaType}</Badge>
              )}

              {/* Product & Budget */}
              {(productName || budgetDisplay || targeting) && !isStrategicPlan && !isAdSet && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {productName && (
                    <div className="bg-muted/30 rounded-lg p-2.5 border border-border/30">
                      <span className="text-muted-foreground">Produto</span>
                      <p className="font-medium mt-0.5">{productName}{productPrice && ` — ${productPrice}`}</p>
                    </div>
                  )}
                  {budgetDisplay && (
                    <div className="bg-muted/30 rounded-lg p-2.5 border border-border/30">
                      <span className="text-muted-foreground">Orçamento</span>
                      <p className="font-semibold mt-0.5">{budgetDisplay}</p>
                    </div>
                  )}
                  {targeting && (
                    <div className="col-span-2 bg-muted/30 rounded-lg p-2.5 border border-border/30">
                      <span className="text-muted-foreground">Público</span>
                      <p className="font-medium mt-0.5">{sanitizeDisplayText(targeting)}{ageRange && ` (${ageRange} anos)`}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Nested AdSets */}
              {adsets.length > 0 && (
                <div>
                  <SectionLabel icon={<Layers className="h-3.5 w-3.5 text-muted-foreground" />} label={`Conjuntos de Anúncios (${adsets.length})`} />
                  <div className="mt-1.5">
                    <AdSetsSection adsets={adsets} />
                  </div>
                </div>
              )}

              {/* Strategic Plan */}
              {isStrategicPlan && (
                <StrategicPlanContent
                  diagnosis={diagnosis}
                  plannedActions={plannedActions}
                  expectedResults={expectedResults}
                  riskAssessment={riskAssessment}
                  timeline={timeline}
                  reasoning={action.reasoning}
                />
              )}

              {/* Reasoning & Impact */}
              {!isStrategicPlan && action.reasoning && (
                <div>
                  <SectionLabel icon={<Bot className="h-3.5 w-3.5 text-muted-foreground" />} label="Raciocínio da IA" />
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-lg p-3 border border-border/30 mt-1.5">
                    {sanitizeDisplayText(action.reasoning)}
                  </div>
                </div>
              )}
              {action.expected_impact && (
                <div>
                  <SectionLabel icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-500" />} label="Impacto Esperado" />
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-lg p-3 border border-border/30 mt-1.5">
                    {sanitizeDisplayText(action.expected_impact)}
                  </div>
                </div>
              )}

              {/* Budget Bar */}
              {budgetSnapshot && <BudgetBar snapshot={budgetSnapshot} />}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Zoom Dialog */}
      {zoomUrl && (
        <Dialog open={!!zoomUrl} onOpenChange={() => setZoomUrl(null)}>
          <DialogContent className="sm:max-w-2xl p-2">
            <img src={zoomUrl} alt="Criativo ampliado" className="w-full h-auto max-h-[80vh] object-contain rounded-lg" />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
      {icon}
      {label}
    </div>
  );
}

/* ========================================
   MAIN CARD COMPONENT
   Shows compact preview + "Ver completo"
   ======================================== */
export function ActionApprovalCard({ action, childActions, onApprove, onReject, onAdjust, approvingId, rejectingId, adjustingId }: ActionApprovalCardProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [adjustSuggestion, setAdjustSuggestion] = useState("");

  const data = action.action_data || {};
  const preview = data.preview || {};
  const Icon = ACTION_TYPE_ICONS[action.action_type] || Target;
  const isStrategicPlan = action.action_type === "strategic_plan";

  const creativeUrls = useAllCreativeUrls(action);
  const primaryCreativeUrl = creativeUrls[0] || null;
  const headline = preview.headline || data.headline || null;
  const copyText = preview.copy_text || data.copy_text || null;
  const funnel = preview.funnel_stage || data.funnel_stage || null;
  const funnelInfo = funnel ? FUNNEL_LABELS[funnel] || { label: funnel, color: "bg-muted text-muted-foreground" } : null;
  const budgetDisplay = preview.daily_budget_display || (data.daily_budget_cents ? `R$ ${(data.daily_budget_cents / 100).toFixed(2)}/dia` : null);
  const campaignName = preview.campaign_name || data.campaign_name || null;
  const campaignTypeInfo = !isStrategicPlan ? inferCampaignType(data) : null;

  const adsets = (childActions || []).filter(a => a.action_type === "create_adset");

  const diagnosis = data.diagnosis || null;
  const summaryText = isStrategicPlan
    ? sanitizeDisplayText(diagnosis || preview.copy_text || "")
    : sanitizeDisplayText(copyText || action.reasoning || "");

  const label = ACTION_TYPE_LABELS[action.action_type] || action.action_type;

  const handleRejectSubmit = () => {
    if (!rejectReason.trim()) return;
    onReject(action.id, rejectReason);
    setRejectOpen(false);
    setRejectReason("");
  };

  const isAdjusting = adjustingId === action.id;

  const handleAdjustSubmit = () => {
    if (!adjustSuggestion.trim()) return;
    onAdjust(action.id, adjustSuggestion);
  };

  return (
    <>
      <Card className="border-border/60 hover:border-primary/20 transition-colors overflow-hidden min-w-0">
        <div className="flex gap-0">
          {/* Thumbnail (shows first creative or gallery indicator) */}
          {!isStrategicPlan && (
            <div className="w-[100px] min-h-[100px] flex-shrink-0 bg-muted/20 border-r border-border/40 relative group cursor-pointer" onClick={() => primaryCreativeUrl && setZoomOpen(true)}>
              {primaryCreativeUrl ? (
                <>
                  <img src={primaryCreativeUrl} alt="Criativo" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ZoomIn className="h-5 w-5 text-white" />
                  </div>
                  {creativeUrls.length > 1 && (
                    <Badge variant="secondary" className="absolute bottom-1 right-1 text-[9px] px-1 py-0">
                      +{creativeUrls.length - 1}
                    </Badge>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                </div>
              )}
            </div>
          )}

          {/* Main Info — Compact */}
          <div className="flex-1 p-3 space-y-1.5 min-w-0 overflow-hidden">
            {/* Header row */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className={cn("p-1.5 rounded-md", isStrategicPlan ? "bg-primary/10" : "bg-muted/50")}>
                <Icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs font-semibold">{label}</span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(action.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
              {funnelInfo && (
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 ml-auto", funnelInfo.color)}>
                  {funnelInfo.label}
                </Badge>
              )}
            </div>

            {/* Headline */}
            {headline && !isStrategicPlan && (
              <p className="text-sm font-semibold leading-tight truncate">{headline}</p>
            )}

            {/* Compact summary */}
            {summaryText && (
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                {truncate(summaryText, 200)}
              </p>
            )}

            {/* Quick info chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {budgetDisplay && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                  <DollarSign className="h-2.5 w-2.5" />
                  {budgetDisplay}
                </Badge>
              )}
              {creativeUrls.length > 1 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                  <ImageIcon className="h-2.5 w-2.5" />
                  {creativeUrls.length} criativos
                </Badge>
              )}
              {adsets.length > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                  <Layers className="h-2.5 w-2.5" />
                  {adsets.length} conjunto{adsets.length !== 1 ? "s" : ""}
                </Badge>
              )}
              {campaignTypeInfo && (
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 gap-1", campaignTypeInfo.color)}>
                  <Megaphone className="h-2.5 w-2.5" />
                  {campaignTypeInfo.label}
                </Badge>
              )}
              {campaignName && !isStrategicPlan && (
                <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{campaignName}</span>
              )}
            </div>

            {/* "Ver completo" button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFullOpen(true)}
              className="h-7 text-xs gap-1 text-primary hover:text-primary px-2 -ml-2"
            >
              <Eye className="h-3 w-3" />
              Ver conteúdo completo
            </Button>
          </div>
        </div>

        {/* Action buttons */}
        <CardFooter className="px-3 pb-3 pt-0 gap-2 border-t border-border/30">
          <Button
            size="sm"
            onClick={() => onApprove(action.id)}
            disabled={!!approvingId || !!rejectingId}
            className="flex-1 h-8 text-xs gap-1.5"
          >
            {approvingId === action.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {approvingId === action.id ? "Aprovando..." : "Aprovar"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdjustOpen(true)}
            disabled={!!approvingId || !!rejectingId || !!adjustingId}
            className="flex-1 h-8 text-xs gap-1.5"
          >
            {isAdjusting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <MessageSquare className="h-3.5 w-3.5" />
            )}
            {isAdjusting ? "Reprocessando..." : "Ajustar"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRejectOpen(true)}
            disabled={!!approvingId || !!rejectingId}
            className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <X className="h-3.5 w-3.5" />
            Rejeitar
          </Button>
        </CardFooter>
      </Card>

      {/* Full Content Dialog */}
      <FullContentDialog action={action} childActions={childActions} open={fullOpen} onOpenChange={setFullOpen} />

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar Ação</DialogTitle>
            <DialogDescription>
              Explique por que esta ação não deve ser executada. A IA usará seu feedback para melhorar futuras sugestões.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Ex: Não quero anunciar este produto agora, focar em outro..."
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRejectSubmit} disabled={!rejectReason.trim()}>
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sugerir Ajuste</DialogTitle>
            <DialogDescription>
              Descreva o que deve ser alterado. A IA fará o ajuste e gerará uma nova proposta para aprovação.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={adjustSuggestion}
            onChange={(e) => setAdjustSuggestion(e.target.value)}
            placeholder="Ex: Alterar a copy para focar mais no benefício X, mudar o orçamento para R$50/dia..."
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdjustOpen(false)} disabled={isAdjusting}>Cancelar</Button>
            <Button onClick={handleAdjustSubmit} disabled={!adjustSuggestion.trim() || isAdjusting}>
              {isAdjusting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Reprocessando...
                </>
              ) : (
                "Enviar Ajuste"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Zoom Dialog */}
      {primaryCreativeUrl && (
        <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
          <DialogContent className="sm:max-w-2xl p-2">
            <img
              src={primaryCreativeUrl}
              alt="Criativo ampliado"
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/* ========================================
   ORPHAN ADSET GROUP CARD
   Groups adsets for existing campaigns
   Shows parent campaign context + all adsets + creatives
   ======================================== */
export function OrphanAdsetGroupCard({ parentCampaignName, adsets, onApprove, onReject, onAdjust, approvingId, rejectingId, adjustingId }: OrphanAdsetGroupCardProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [adjustSuggestion, setAdjustSuggestion] = useState("");

  // Use first adset for creative resolution
  const primaryAdset = adsets[0];
  const creativeUrls = useAllCreativeUrls(primaryAdset);
  const primaryCreativeUrl = creativeUrls[0] || null;
  const [zoomOpen, setZoomOpen] = useState(false);

  const handleApproveAll = () => {
    for (const adset of adsets) {
      onApprove(adset.id);
    }
  };

  const handleRejectAll = () => {
    if (!rejectReason.trim()) return;
    for (const adset of adsets) {
      onReject(adset.id, rejectReason);
    }
    setRejectOpen(false);
    setRejectReason("");
  };

  const isAdjustingGroup = adsets.some(a => adjustingId === a.id);

  const handleAdjustAll = () => {
    if (!adjustSuggestion.trim()) return;
    for (const adset of adsets) {
      onAdjust(adset.id, adjustSuggestion);
    }
  };

  return (
    <>
      <Card className="border-border/60 hover:border-primary/20 transition-colors overflow-hidden min-w-0">
        <div className="flex gap-0">
          {/* Thumbnail */}
          <div className="w-[100px] min-h-[100px] flex-shrink-0 bg-muted/20 border-r border-border/40 relative group cursor-pointer" onClick={() => primaryCreativeUrl && setZoomOpen(true)}>
            {primaryCreativeUrl ? (
              <>
                <img src={primaryCreativeUrl} alt="Criativo" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <ZoomIn className="h-5 w-5 text-white" />
                </div>
                {creativeUrls.length > 1 && (
                  <Badge variant="secondary" className="absolute bottom-1 right-1 text-[9px] px-1 py-0">
                    +{creativeUrls.length - 1}
                  </Badge>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
              </div>
            )}
          </div>

          {/* Main Info */}
          <div className="flex-1 p-3 space-y-1.5 min-w-0 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="p-1.5 rounded-md bg-amber-500/10">
                <Layers className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <span className="text-xs font-semibold">Novos Conjuntos</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/5 border-amber-500/20 text-amber-700">
                Campanha existente
              </Badge>
            </div>

            {/* Parent campaign name */}
            <p className="text-sm font-semibold leading-tight truncate">{parentCampaignName}</p>

            {/* Quick info chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                <Layers className="h-2.5 w-2.5" />
                {adsets.length} conjunto{adsets.length !== 1 ? "s" : ""}
              </Badge>
              {creativeUrls.length > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                  <ImageIcon className="h-2.5 w-2.5" />
                  {creativeUrls.length} criativo{creativeUrls.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>

            {/* Expandable adsets preview */}
            <AdSetsSection adsets={adsets} />

            {/* Ver completo */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFullOpen(true)}
              className="h-7 text-xs gap-1 text-primary hover:text-primary px-2 -ml-2"
            >
              <Eye className="h-3 w-3" />
              Ver conteúdo completo
            </Button>
          </div>
        </div>

        {/* Action buttons */}
        <CardFooter className="px-3 pb-3 pt-0 gap-2 border-t border-border/30">
          <Button
            size="sm"
            onClick={handleApproveAll}
            disabled={!!approvingId || !!rejectingId}
            className="flex-1 h-8 text-xs gap-1.5"
          >
            {approvingId ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {approvingId ? "Aprovando..." : `Aprovar ${adsets.length > 1 ? `(${adsets.length})` : ""}`}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdjustOpen(true)}
            disabled={!!approvingId || !!rejectingId}
            className="flex-1 h-8 text-xs gap-1.5"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Ajustar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRejectOpen(true)}
            disabled={!!approvingId || !!rejectingId}
            className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <X className="h-3.5 w-3.5" />
            Rejeitar
          </Button>
        </CardFooter>
      </Card>

      {/* Full Content Dialog for grouped adsets */}
      <Dialog open={fullOpen} onOpenChange={setFullOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/30 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-amber-600" />
              Novos Conjuntos — Campanha Existente
            </DialogTitle>
            <DialogDescription className="text-xs">
              {adsets.length} conjunto{adsets.length !== 1 ? "s" : ""} para a campanha "{parentCampaignName}"
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
            <div className="space-y-4">
              {/* Campaign context */}
              <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
                <span className="text-xs text-muted-foreground">Campanha</span>
                <p className="font-semibold text-sm mt-0.5">{parentCampaignName}</p>
              </div>

              {/* Creatives Gallery */}
              <CreativesGallery urls={creativeUrls} onZoom={(url) => {}} />

              {/* All AdSets detail */}
              <div>
                <SectionLabel icon={<Layers className="h-3.5 w-3.5 text-muted-foreground" />} label={`Conjuntos de Anúncios (${adsets.length})`} />
                <div className="mt-1.5 space-y-2">
                  {adsets.map((adset) => {
                    const ad = adset.action_data || {};
                    const prev = ad.preview || {};
                    const targeting = prev.targeting_summary || ad.targeting_summary || null;
                    const customAudiences = ad.custom_audiences || prev.custom_audiences || null;
                    const adsetName = ad.adset_name || prev.adset_name || "Conjunto";
                    return (
                      <div key={adset.id} className="border border-border/40 rounded-lg p-3 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Target className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-semibold">{adsetName}</span>
                        </div>
                        {targeting && (
                          <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                            <Users className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>{sanitizeDisplayText(targeting)}</span>
                          </div>
                        )}
                        {customAudiences && Array.isArray(customAudiences) && customAudiences.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {customAudiences.map((aud: any, i: number) => (
                              <Badge key={i} variant="outline" className="text-[9px] px-1 py-0">
                                {typeof aud === "string" ? aud : aud.name || aud.id}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {adset.reasoning && (
                          <p className="text-[11px] text-muted-foreground mt-1">{sanitizeDisplayText(adset.reasoning)}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar Conjuntos</DialogTitle>
            <DialogDescription>
              Rejeitar todos os {adsets.length} conjuntos para "{parentCampaignName}".
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Ex: Não quero este público alvo..."
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRejectAll} disabled={!rejectReason.trim()}>
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sugerir Ajuste</DialogTitle>
            <DialogDescription>
              Descreva o ajuste para os conjuntos de "{parentCampaignName}".
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={adjustSuggestion}
            onChange={(e) => setAdjustSuggestion(e.target.value)}
            placeholder="Ex: Alterar targeting, mudar orçamento..."
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdjustOpen(false)} disabled={isAdjustingGroup}>Cancelar</Button>
            <Button onClick={handleAdjustAll} disabled={!adjustSuggestion.trim() || isAdjustingGroup}>
              {isAdjustingGroup ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Reprocessando...
                </>
              ) : (
                "Enviar Ajuste"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Zoom Dialog */}
      {primaryCreativeUrl && (
        <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
          <DialogContent className="sm:max-w-2xl p-2">
            <img src={primaryCreativeUrl} alt="Criativo ampliado" className="w-full h-auto max-h-[80vh] object-contain rounded-lg" />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
