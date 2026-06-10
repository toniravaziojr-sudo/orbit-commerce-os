// =============================================
// ACTION APPROVAL CARD — v5.14.0
// Grouped campaign view: creatives gallery + nested adsets
// =============================================

import { useState } from "react";
import { formatDayMonthTimeBR } from "@/lib/date-format";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, MessageSquare, ChevronDown, ChevronRight, Megaphone, ImageIcon, DollarSign, Target, Sparkles, ZoomIn, Bot, AlertTriangle, TrendingUp, ListChecks, Clock, Eye, Layers, Users, Loader2, Link2, MousePointerClick, Globe, BarChart3, Settings2 } from "lucide-react";
import type { PendingAction } from "@/hooks/useAdsPendingActions";
import { useAdsPendingActions, isTwoStepAction, getTwoStepStage } from "@/hooks/useAdsPendingActions";
import { CreativeGenerationStepDialog } from "./CreativeGenerationStepDialog";
import { cn } from "@/lib/utils";
import { StrategicPlanContent } from "./StrategicPlanContent";
import { getFunnelLabel, getCustomerExclusionLine } from "@/lib/ads/audienceLabels";
import { useProductCommercialFit, type ProductFitData } from "@/hooks/useProductCommercialFit";
import { fitLevelLabel, commercialClassLabel } from "../../../supabase/functions/_shared/ads-autopilot/productFunnelFitGate";
import { ProposalStructuredEditor } from "./ProposalStructuredEditor";
import { StructuredProposalModal } from "./StructuredProposalModal";
import { normalizeCampaignStructure } from "@/lib/ads/normalizeCampaignStructure";

import { formatDateBR, formatDateTimeBR } from "@/lib/date-format";

export type RejectMode = "dismiss" | "regenerate";

export interface ActionApprovalCardProps {
  action: PendingAction;
  childActions?: PendingAction[];
  onApprove: (actionId: string) => void;
  onReject: (actionId: string, reason: string, mode: RejectMode) => void;
  onAdjust: (actionId: string, suggestion: string) => void;
  approvingId?: string | null;
  rejectingId?: string | null;
  adjustingId?: string | null;
}

export interface OrphanAdsetGroupCardProps {
  parentCampaignName: string;
  adsets: PendingAction[];
  onApprove: (actionId: string) => void;
  onReject: (actionId: string, reason: string, mode: RejectMode) => void;
  onAdjust: (actionId: string, suggestion: string) => void;
  approvingId?: string | null;
  rejectingId?: string | null;
  adjustingId?: string | null;
}

// Funnel labels live in @/lib/ads/audienceLabels (Frente 2 — Labels amigáveis).
// Keep this comment as a pointer so future edits don't reintroduce a local map.

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
  const isTwoStepStrategy = isTwoStepAction(action) && getTwoStepStage(action) === "strategy";
  const directUrl = preview.creative_url || (data as any).asset_url || (data as any).creative_url || null;
  const productId = (data as any).product_id || preview.product_id || null;
  const rawFunnelStage = preview.funnel_stage || (data as any).funnel_stage || null;
  // Normalize funnel stage: actions use "hot"/"cold" but creative assets use "bof"/"tof"
  const FUNNEL_STAGE_MAP: Record<string, string> = { hot: "bof", cold: "tof", warm: "mof" };
  const funnelStage = rawFunnelStage ? (FUNNEL_STAGE_MAP[rawFunnelStage] || rawFunnelStage) : null;
  const sessionId = action.session_id;
  const tenantId = action.tenant_id;

  const { data: allUrls } = useQuery({
    queryKey: ["all-creatives", action.id, productId, funnelStage, sessionId, tenantId],
    queryFn: async () => {
      if (isTwoStepStrategy) {
        const referenceUrls: string[] = [];
        if (productId) {
          const { data: imgs } = await supabase
            .from("product_images")
            .select("url")
            .eq("product_id", productId)
            .order("sort_order", { ascending: true })
            .limit(5);
          if (imgs) {
            for (const img of imgs) {
              if (img.url && !referenceUrls.includes(img.url)) referenceUrls.push(img.url);
            }
          }
        }

        if (referenceUrls.length === 0 && directUrl) {
          referenceUrls.push(directUrl);
        }

        return referenceUrls;
      }

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

      // 3. If still empty and we have funnel_stage (multi-product campaigns like BOF),
      //    search creative assets by funnel_stage + session_id or just funnel_stage
      if (urls.length === 0 && funnelStage) {
        let query = supabase
          .from("ads_creative_assets" as any)
          .select("asset_url")
          .eq("tenant_id", tenantId)
          .eq("funnel_stage", funnelStage)
          .not("asset_url", "is", null)
          .eq("status", "ready")
          .order("created_at", { ascending: false })
          .limit(10);

        if (sessionId) {
          query = query.eq("session_id", sessionId);
        }

        const { data: funnelAssets } = await query;
        if (funnelAssets) {
          for (const a of funnelAssets as any[]) {
            if (a.asset_url && !urls.includes(a.asset_url)) urls.push(a.asset_url);
          }
        }

        // If session-scoped query returned nothing, try without session filter
        if (urls.length === 0 && sessionId) {
          const { data: broadAssets } = await supabase
            .from("ads_creative_assets" as any)
            .select("asset_url")
            .eq("tenant_id", tenantId)
            .eq("funnel_stage", funnelStage)
            .not("asset_url", "is", null)
            .eq("status", "ready")
            .order("created_at", { ascending: false })
            .limit(10);
          if (broadAssets) {
            for (const a of broadAssets as any[]) {
              if (a.asset_url && !urls.includes(a.asset_url)) urls.push(a.asset_url);
            }
          }
        }
      }

      // 4. If still empty, fallback to product catalog images
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

export function shouldShowCreativeCountBadge(action: PendingAction, creativeUrlsLength: number): boolean {
  if (creativeUrlsLength <= 1) return false;
  return !(isTwoStepAction(action) && getTwoStepStage(action) === "strategy");
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
   COMPREHENSIVE TRANSLATION MAP
   Translates all Meta Ads technical terms to PT-BR
   ======================================== */
const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_SALES: "Vendas",
  OUTCOME_LEADS: "Geração de Leads",
  OUTCOME_ENGAGEMENT: "Engajamento",
  OUTCOME_AWARENESS: "Reconhecimento",
  OUTCOME_TRAFFIC: "Tráfego",
  OUTCOME_APP_PROMOTION: "Promoção de App",
  CONVERSIONS: "Conversões",
  LINK_CLICKS: "Cliques no Link",
  REACH: "Alcance",
  BRAND_AWARENESS: "Reconhecimento de Marca",
  VIDEO_VIEWS: "Visualizações de Vídeo",
  POST_ENGAGEMENT: "Engajamento com Publicação",
  LEAD_GENERATION: "Geração de Leads",
  MESSAGES: "Mensagens",
  CATALOG_SALES: "Vendas de Catálogo",
  STORE_VISITS: "Visitas à Loja",
  PRODUCT_CATALOG_SALES: "Vendas de Catálogo",
  sales: "Vendas",
  conversions: "Conversões",
  traffic: "Tráfego",
  awareness: "Reconhecimento",
  engagement: "Engajamento",
  leads: "Leads",
  reach: "Alcance",
  catalog_sales: "Vendas de Catálogo",
  video_views: "Visualizações de Vídeo",
};

const OPTIMIZATION_LABELS: Record<string, string> = {
  CONVERSIONS: "Conversões",
  OFFSITE_CONVERSIONS: "Conversões no Site",
  LINK_CLICKS: "Cliques no Link",
  LANDING_PAGE_VIEWS: "Visualizações da Página de Destino",
  IMPRESSIONS: "Impressões",
  REACH: "Alcance",
  VALUE: "Valor (ROAS)",
  APP_INSTALLS: "Instalações do App",
  QUALITY_LEAD: "Lead Qualificado",
  LEAD_GENERATION: "Geração de Leads",
  THRUPLAY: "ThruPlay (Visualização Completa)",
  TWO_SECOND_CONTINUOUS_VIDEO_VIEWS: "2s de Vídeo Contínuo",
  ENGAGED_USERS: "Usuários Engajados",
};

const BILLING_LABELS: Record<string, string> = {
  IMPRESSIONS: "Impressões (CPM)",
  LINK_CLICKS: "Cliques no Link (CPC)",
  APP_INSTALLS: "Instalações",
  PAGE_LIKES: "Curtidas na Página",
  THRUPLAY: "ThruPlay",
  POST_ENGAGEMENT: "Engajamento",
};

const BID_LABELS: Record<string, string> = {
  LOWEST_COST_WITHOUT_CAP: "Menor Custo (Automático)",
  LOWEST_COST_WITH_BID_CAP: "Menor Custo com Limite de Lance",
  COST_CAP: "Custo Alvo (Cost Cap)",
  BID_CAP: "Limite de Lance (Bid Cap)",
  MINIMUM_ROAS: "ROAS Mínimo",
  TARGET_COST: "Custo Alvo",
};

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  audience_network: "Audience Network",
  messenger: "Messenger",
  whatsapp: "WhatsApp",
};

const POSITION_LABELS: Record<string, string> = {
  feed: "Feed",
  story: "Stories",
  stories: "Stories",
  reels: "Reels",
  reels_overlay: "Overlay de Reels",
  right_hand_column: "Coluna Direita",
  marketplace: "Marketplace",
  video_feeds: "Feeds de Vídeo",
  search: "Busca",
  explore: "Explorar",
  explore_home: "Página Inicial do Explorar",
  an_classic: "Audience Network (Clássico)",
  instream_video: "Vídeo In-Stream",
  rewarded_video: "Vídeo Premiado",
  instant_article: "Artigo Instantâneo",
  messenger_inbox: "Caixa de Entrada do Messenger",
  sponsored_messages: "Mensagens Patrocinadas",
  profile_feed: "Feed do Perfil",
};

const CONVERSION_EVENT_LABELS: Record<string, string> = {
  PURCHASE: "Compra",
  ADD_TO_CART: "Adicionou ao Carrinho",
  INITIATE_CHECKOUT: "Iniciou Checkout",
  COMPLETE_REGISTRATION: "Cadastro Completo",
  LEAD: "Lead",
  VIEW_CONTENT: "Visualizou Conteúdo",
  SEARCH: "Buscou",
  ADD_PAYMENT_INFO: "Adicionou Info de Pagamento",
  ADD_TO_WISHLIST: "Adicionou à Lista de Desejos",
  CONTACT: "Contato",
  CUSTOMIZE_PRODUCT: "Personalizou Produto",
  DONATE: "Doação",
  FIND_LOCATION: "Encontrou Localização",
  SCHEDULE: "Agendamento",
  START_TRIAL: "Iniciou Teste",
  SUBMIT_APPLICATION: "Enviou Aplicação",
  SUBSCRIBE: "Assinou",
  CONTENT_VIEW: "Visualização de Conteúdo",
  PAGE_VIEW: "Visualização de Página",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  DELETED: "Removido",
  ARCHIVED: "Arquivado",
  active: "Ativo",
  paused: "Pausado",
};

const AD_FORMAT_LABELS: Record<string, string> = {
  SINGLE_IMAGE: "Imagem Única",
  SINGLE_VIDEO: "Vídeo Único",
  CAROUSEL: "Carrossel",
  COLLECTION: "Coleção",
  single_image: "Imagem Única",
  single_video: "Vídeo Único",
  carousel: "Carrossel",
  collection: "Coleção",
};

/** Translate any technical value using all label maps */
function translateTechnical(value: string): string {
  if (!value || typeof value !== "string") return value;
  return OBJECTIVE_LABELS[value] 
    || OPTIMIZATION_LABELS[value] 
    || BILLING_LABELS[value] 
    || BID_LABELS[value] 
    || PLATFORM_LABELS[value] 
    || POSITION_LABELS[value] 
    || CONVERSION_EVENT_LABELS[value]
    || STATUS_LABELS[value]
    || CTA_LABELS[value]
    || AD_FORMAT_LABELS[value]
    || value;
}

function formatPlacementsDisplay(p: any): string {
  if (!p) return "";
  if (typeof p === "string") return translateTechnical(p);
  if (Array.isArray(p)) return p.map(v => translateTechnical(String(v))).join(", ");
  if (typeof p === "object") {
    return Object.entries(p)
      .filter(([_, v]) => v)
      .map(([k]) => translateTechnical(k))
      .join(", ");
  }
  return String(p);
}

function formatAttributionDisplay(a: any): string {
  if (!a) return "";
  if (typeof a === "string") return a;
  if (Array.isArray(a)) {
    return a.map((spec: any) => {
      if (typeof spec === "string") return spec;
      const parts: string[] = [];
      if (spec.event_type) parts.push(translateTechnical(spec.event_type));
      if (spec.window_days) parts.push(`${spec.window_days}d clique`);
      if (spec.view_window_days) parts.push(`${spec.view_window_days}d visualização`);
      return parts.join(" — ") || JSON.stringify(spec);
    }).join("; ");
  }
  if (typeof a === "object") {
    const parts: string[] = [];
    if (a.click_days || a.window_days) parts.push(`${a.click_days || a.window_days} dias (clique)`);
    if (a.view_days || a.view_window_days) parts.push(`${a.view_days || a.view_window_days} dias (visualização)`);
    return parts.join(" + ") || JSON.stringify(a);
  }
  return String(a);
}

/** Format any value for display, handling objects/arrays/primitives */
function formatFieldValue(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return translateTechnical(value);
  if (Array.isArray(value)) return value.map(v => typeof v === "string" ? translateTechnical(v) : typeof v === "object" && v?.name ? v.name : JSON.stringify(v)).join(", ");
  if (typeof value === "object") {
    // Check if it's a named object
    if (value.name) return value.name;
    return Object.entries(value)
      .filter(([_, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${k}: ${typeof v === "string" ? translateTechnical(v) : v}`)
      .join(" | ");
  }
  return String(value);
}

/* ========================================
   CAMPAIGN DETAILS INFO GRID
   Shows ALL campaign configuration details with PT-BR translations
   ======================================== */
function CampaignDetailsTab({ data, preview, action, childActions }: { data: Record<string, any>; preview: Record<string, any>; action: PendingAction; childActions?: PendingAction[] }) {
  const campaignTypeInfo = inferCampaignType(data);
  const funnel = preview.funnel_stage || data.funnel_stage || null;
  const funnelInfo = funnel ? getFunnelLabel(funnel) : null;

  // Merge all child adset data for fallback lookups
  const childDataList = (childActions || []).map(c => {
    const cd = c.action_data || {};
    return { ...cd, ...(cd.preview || {}) };
  });

  // Helper to get field from preview, data, or first matching childAction
  const f = (key: string) => {
    const val = preview[key] || data[key];
    if (val !== null && val !== undefined && val !== "") return val;
    for (const cd of childDataList) {
      if (cd[key] !== null && cd[key] !== undefined && cd[key] !== "") return cd[key];
    }
    return null;
  };

  type DetailItem = { label: string; value: string; icon: React.ReactNode; section?: string };
  const details: DetailItem[] = [];

  // --- CAMPAIGN SECTION ---
  const campaignName = f("campaign_name");
  if (campaignName) details.push({ label: "Nome da Campanha", value: campaignName, icon: <Megaphone className="h-3.5 w-3.5" />, section: "Campanha" });
  if (campaignTypeInfo) details.push({ label: "Tipo de Campanha", value: campaignTypeInfo.label, icon: <Settings2 className="h-3.5 w-3.5" />, section: "Campanha" });
  
  const objective = f("objective") || f("campaign_type");
  if (objective) details.push({ label: "Objetivo", value: translateTechnical(objective), icon: <Target className="h-3.5 w-3.5" />, section: "Campanha" });
  if (funnelInfo) details.push({ label: "Etapa do Funil", value: funnelInfo.label, icon: <BarChart3 className="h-3.5 w-3.5" />, section: "Campanha" });
  
  const specialAdCategory = f("special_ad_categories") || f("special_ad_category");
  if (specialAdCategory) details.push({ label: "Categorias Especiais", value: formatFieldValue(specialAdCategory), icon: <AlertTriangle className="h-3.5 w-3.5" />, section: "Campanha" });

  const buyingType = f("buying_type");
  if (buyingType) details.push({ label: "Tipo de Compra", value: translateTechnical(buyingType), icon: <Settings2 className="h-3.5 w-3.5" />, section: "Campanha" });

  const campaignStatus = f("status") || f("campaign_status");
  if (campaignStatus) details.push({ label: "Status", value: translateTechnical(campaignStatus), icon: <Settings2 className="h-3.5 w-3.5" />, section: "Campanha" });

  // --- PRODUCT ---
  const productName = f("product_name");
  const productPrice = preview.product_price_display || (preview.product_price ? `R$ ${Number(preview.product_price).toFixed(2)}` : null);
  if (productName) details.push({ label: "Produto", value: `${productName}${productPrice ? ` — ${productPrice}` : ""}`, icon: <Sparkles className="h-3.5 w-3.5" />, section: "Produto" });

  // --- BUDGET ---
  const budgetDisplay = preview.daily_budget_display || (data.daily_budget_cents ? `R$ ${(data.daily_budget_cents / 100).toFixed(2)}/dia` : null);
  if (budgetDisplay) details.push({ label: "Orçamento Diário", value: budgetDisplay, icon: <DollarSign className="h-3.5 w-3.5" />, section: "Orçamento" });
  
  const lifetimeBudget = f("lifetime_budget_cents");
  if (lifetimeBudget) details.push({ label: "Orçamento Vitalício", value: `R$ ${(Number(lifetimeBudget) / 100).toFixed(2)}`, icon: <DollarSign className="h-3.5 w-3.5" />, section: "Orçamento" });

  const budgetType = f("budget_type") || (campaignName?.includes("CBO") ? "CBO (Orçamento na Campanha)" : f("budget_optimization") ? "CBO (Orçamento na Campanha)" : null);
  if (budgetType) details.push({ label: "Tipo de Orçamento", value: budgetType === "CBO" || budgetType === "CAMPAIGN_BUDGET_OPTIMIZATION" ? "CBO (Orçamento na Campanha)" : budgetType === "ABO" ? "ABO (Orçamento no Conjunto)" : budgetType, icon: <DollarSign className="h-3.5 w-3.5" />, section: "Orçamento" });

  const bidStrategy = f("bid_strategy") || f("bidding_strategy") || f("bid_strategy_type");
  if (bidStrategy) details.push({ label: "Estratégia de Lance", value: BID_LABELS[bidStrategy] || translateTechnical(bidStrategy), icon: <DollarSign className="h-3.5 w-3.5" />, section: "Orçamento" });

  const bidAmount = f("bid_amount") || f("bid_amount_cents");
  if (bidAmount) details.push({ label: "Valor do Lance", value: `R$ ${(Number(bidAmount) / 100).toFixed(2)}`, icon: <DollarSign className="h-3.5 w-3.5" />, section: "Orçamento" });

  // --- OPTIMIZATION ---
  const optimizationGoal = f("optimization_goal") || f("optimization_sub_event");
  if (optimizationGoal) details.push({ label: "Otimização para", value: OPTIMIZATION_LABELS[optimizationGoal] || translateTechnical(optimizationGoal), icon: <TrendingUp className="h-3.5 w-3.5" />, section: "Otimização" });
  
  const billingEvent = f("billing_event");
  if (billingEvent) details.push({ label: "Cobrança por", value: BILLING_LABELS[billingEvent] || translateTechnical(billingEvent), icon: <DollarSign className="h-3.5 w-3.5" />, section: "Otimização" });

  const conversionEvent = f("conversion_event") || f("custom_event_type") || f("promoted_object_custom_event_type");
  if (conversionEvent) details.push({ label: "Evento de Conversão", value: CONVERSION_EVENT_LABELS[conversionEvent] || translateTechnical(conversionEvent), icon: <Target className="h-3.5 w-3.5" />, section: "Otimização" });

  const pixelId = f("pixel_id");
  if (pixelId) details.push({ label: "Pixel ID", value: pixelId, icon: <Target className="h-3.5 w-3.5" />, section: "Otimização" });

  const attributionWindow = f("attribution_window") || f("attribution_spec");
  const attrStr = formatAttributionDisplay(attributionWindow);
  if (attrStr) details.push({ label: "Janela de Atribuição", value: attrStr, icon: <Clock className="h-3.5 w-3.5" />, section: "Otimização" });

  // --- PLACEMENTS ---
  const placements = f("placements") || f("publisher_platforms");
  const placementsStr = formatPlacementsDisplay(placements);
  if (placementsStr) details.push({ label: "Plataformas", value: placementsStr, icon: <Globe className="h-3.5 w-3.5" />, section: "Posicionamentos" });

  const positions = f("position_types") || f("facebook_positions") || f("instagram_positions");
  if (positions) {
    const fbPos = f("facebook_positions");
    const igPos = f("instagram_positions");
    const anPos = f("audience_network_positions");
    const msgPos = f("messenger_positions");
    if (fbPos) details.push({ label: "Facebook", value: formatPlacementsDisplay(fbPos), icon: <Globe className="h-3.5 w-3.5" />, section: "Posicionamentos" });
    if (igPos) details.push({ label: "Instagram", value: formatPlacementsDisplay(igPos), icon: <Globe className="h-3.5 w-3.5" />, section: "Posicionamentos" });
    if (anPos) details.push({ label: "Audience Network", value: formatPlacementsDisplay(anPos), icon: <Globe className="h-3.5 w-3.5" />, section: "Posicionamentos" });
    if (msgPos) details.push({ label: "Messenger", value: formatPlacementsDisplay(msgPos), icon: <Globe className="h-3.5 w-3.5" />, section: "Posicionamentos" });
    if (!fbPos && !igPos && !anPos && !msgPos) {
      details.push({ label: "Posições", value: formatPlacementsDisplay(positions), icon: <Globe className="h-3.5 w-3.5" />, section: "Posicionamentos" });
    }
  }

  const devicePlatforms = f("device_platforms");
  if (devicePlatforms) details.push({ label: "Dispositivos", value: formatPlacementsDisplay(devicePlatforms), icon: <Globe className="h-3.5 w-3.5" />, section: "Posicionamentos" });

  const placementType = f("placement_type");
  if (placementType) details.push({ label: "Tipo de Posicionamento", value: placementType === "automatic" ? "Automático (Advantage+)" : placementType === "manual" ? "Manual" : placementType, icon: <Globe className="h-3.5 w-3.5" />, section: "Posicionamentos" });

  // If no placement info was found at all, default to Automatic
  const hasAnyPlacement = placementsStr || positions || devicePlatforms || placementType;
  if (!hasAnyPlacement) {
    details.push({ label: "Posicionamentos", value: "Automático (Advantage+)", icon: <Globe className="h-3.5 w-3.5" />, section: "Posicionamentos" });
  }

  // --- LINK & CTA ---
  const destinationUrl = f("destination_url") || f("website_url") || f("link") || f("object_url");
  if (destinationUrl) details.push({ label: "Link de Destino", value: destinationUrl, icon: <Link2 className="h-3.5 w-3.5" />, section: "Link & CTA" });

  const displayLink = f("display_link");
  if (displayLink) details.push({ label: "Link Exibido", value: displayLink, icon: <Link2 className="h-3.5 w-3.5" />, section: "Link & CTA" });

  const ctaType = f("cta") || f("cta_type") || f("call_to_action_type");
  if (ctaType) details.push({ label: "Botão (CTA)", value: CTA_LABELS[ctaType] || translateTechnical(ctaType), icon: <MousePointerClick className="h-3.5 w-3.5" />, section: "Link & CTA" });

  const urlParameters = f("url_parameters") || f("url_tags") || f("tracking_specs");
  if (urlParameters) details.push({ label: "Parâmetros UTM / Tracking", value: typeof urlParameters === "string" ? urlParameters : JSON.stringify(urlParameters, null, 0), icon: <Link2 className="h-3.5 w-3.5" />, section: "Link & CTA" });

  // --- SCHEDULE ---
  const startDate = f("start_time") || f("start_date");
  if (startDate) details.push({ label: "Início", value: formatDateBR(new Date(startDate)), icon: <Clock className="h-3.5 w-3.5" />, section: "Agendamento" });

  const endDate = f("end_time") || f("end_date");
  if (endDate) details.push({ label: "Término", value: formatDateBR(new Date(endDate)), icon: <Clock className="h-3.5 w-3.5" />, section: "Agendamento" });

  const adSchedule = f("ad_schedule") || f("dayparting");
  if (adSchedule) details.push({ label: "Programação de Horários", value: formatFieldValue(adSchedule), icon: <Clock className="h-3.5 w-3.5" />, section: "Agendamento" });

  // --- TARGETING (from campaign-level or first adset) ---
  const targeting = f("targeting_summary") || f("targeting");
  const ageRange = f("age_range") || f("age_min") ? `${f("age_min") || 18}–${f("age_max") || 65}+` : null;
  const geoLocations = f("geo_locations") || f("countries") || f("regions") || f("cities");
  const gender = f("gender") || f("genders");
  const interests = f("interests") || f("detailed_targeting");
  const customAudiences = f("custom_audiences");
  const excludedAudiences = f("excluded_custom_audiences") || f("exclusions");
  const lookalikeSpec = f("lookalike_spec") || f("lookalike");

  if (targeting) details.push({ label: "Público-Alvo", value: typeof targeting === "string" ? sanitizeDisplayText(targeting) : formatFieldValue(targeting), icon: <Users className="h-3.5 w-3.5" />, section: "Público" });
  if (ageRange && f("age_min")) details.push({ label: "Faixa Etária", value: `${ageRange} anos`, icon: <Users className="h-3.5 w-3.5" />, section: "Público" });
  if (gender) {
    const genderLabel = Array.isArray(gender) ? gender.map((g: number) => g === 1 ? "Masculino" : g === 2 ? "Feminino" : "Todos").join(", ") : gender === 1 ? "Masculino" : gender === 2 ? "Feminino" : formatFieldValue(gender);
    details.push({ label: "Gênero", value: genderLabel, icon: <Users className="h-3.5 w-3.5" />, section: "Público" });
  }
  if (geoLocations) details.push({ label: "Localização", value: formatFieldValue(geoLocations), icon: <Globe className="h-3.5 w-3.5" />, section: "Público" });
  if (interests) details.push({ label: "Interesses", value: formatFieldValue(interests), icon: <Users className="h-3.5 w-3.5" />, section: "Público" });
  if (customAudiences) details.push({ label: "Públicos Personalizados", value: formatFieldValue(customAudiences), icon: <Users className="h-3.5 w-3.5" />, section: "Público" });
  if (excludedAudiences) details.push({ label: "Públicos Excluídos", value: formatFieldValue(excludedAudiences), icon: <Users className="h-3.5 w-3.5" />, section: "Público" });
  if (lookalikeSpec) details.push({ label: "Lookalike / Semelhante", value: formatFieldValue(lookalikeSpec), icon: <Users className="h-3.5 w-3.5" />, section: "Público" });

  // --- CONJUNTOS DE ANÚNCIOS (from childActions) ---
  if (childDataList.length > 0) {
    for (let idx = 0; idx < childDataList.length; idx++) {
      const cd = childDataList[idx];
      const adsetName = cd.adset_name || cd.name;
      if (adsetName) {
        details.push({ label: `Conjunto ${idx + 1}`, value: adsetName, icon: <Layers className="h-3.5 w-3.5" />, section: "Conjuntos" });
      }
      // Adset-specific budget
      const adsetBudget = cd.daily_budget_cents || cd.daily_budget_display;
      if (adsetBudget) {
        const budgetVal = typeof adsetBudget === "number" ? `R$ ${(adsetBudget / 100).toFixed(2)}/dia` : adsetBudget;
        details.push({ label: `Orçamento (Conj. ${idx + 1})`, value: budgetVal, icon: <DollarSign className="h-3.5 w-3.5" />, section: "Conjuntos" });
      }
    }
  }

  // --- CRIATIVOS / ANÚNCIOS (names from data) ---
  const adName = f("ad_name") || f("creative_name");
  if (adName) details.push({ label: "Nome do Anúncio", value: adName, icon: <ImageIcon className="h-3.5 w-3.5" />, section: "Criativos" });
  
  const adFormat = f("ad_format") || f("creative_format") || f("");
  if (adFormat) details.push({ label: "Formato do Anúncio", value: translateTechnical(adFormat), icon: <ImageIcon className="h-3.5 w-3.5" />, section: "Criativos" });

  // --- Scan remaining action_data keys not yet covered ---
  const KNOWN_KEYS = new Set([
    "campaign_name", "campaign_type", "objective", "funnel_stage", "status", "campaign_status",
    "special_ad_categories", "special_ad_category", "buying_type", "product_name", "product_id",
    "product_price", "product_price_display", "daily_budget_cents", "daily_budget_display",
    "lifetime_budget_cents", "budget_type", "budget_optimization", "bid_strategy", "bidding_strategy",
    "bid_strategy_type", "bid_amount", "bid_amount_cents", "optimization_goal", "optimization_sub_event",
    "billing_event", "conversion_event", "custom_event_type", "promoted_object_custom_event_type",
    "pixel_id", "attribution_window", "attribution_spec", "placements", "publisher_platforms",
    "position_types", "facebook_positions", "instagram_positions", "audience_network_positions",
    "messenger_positions", "device_platforms", "placement_type", "destination_url", "website_url",
    "link", "object_url", "display_link", "cta", "cta_type", "call_to_action_type",
    "url_parameters", "url_tags", "tracking_specs", "start_time", "start_date", "end_time", "end_date",
    "ad_schedule", "dayparting", "targeting_summary", "targeting", "age_range", "age_min", "age_max",
    "geo_locations", "countries", "regions", "cities", "gender", "genders", "interests", "detailed_targeting",
    "custom_audiences", "excluded_custom_audiences", "exclusions", "lookalike_spec", "lookalike",
    "preview", "headline", "headlines", "copy_text", "primary_texts", "descriptions", "creative_url",
    "asset_url", "adset_name", "parent_campaign_name", "diagnosis", "planned_actions", "expected_results",
    "risk_assessment", "timeline", "budget_snapshot", "session_id", "strategy_run_id", "ad_account_id",
    "creative_assets", "creatives", "adsets", "ad_name", "creative_name", "ad_format", "creative_format",
    "", "name", "reasoning", "confidence", "metric_trigger", "action_hash",
  ]);

  const FIELD_LABELS: Record<string, string> = {
    campaign_budget_optimization: "Otimização de Orçamento",
    is_cbo: "Orçamento na Campanha (CBO)",
    daily_spend_cap: "Limite Diário de Gasto",
    spend_cap: "Limite de Gasto",
    pacing_type: "Tipo de Ritmo",
    promoted_object: "Objeto Promovido",
    frequency_cap: "Limite de Frequência",
    frequency_cap_reset_period: "Reset de Frequência",
    min_spend_target: "Meta Mínima de Gasto",
    ad_format: "Formato do Anúncio",
    creative_format: "Formato do Criativo",
    creative_name: "Nome do Criativo",
    ad_name: "Nome do Anúncio",
    targeting_description: "Descrição do Público",
    audience_name: "Nome do Público",
    audience_type: "Tipo de Público",
    daily_budget_display: "Orçamento Diário",
  };

  // Scan data for unlisted fields
  for (const [key, value] of Object.entries(data)) {
    if (KNOWN_KEYS.has(key) || value === null || value === undefined || value === "") continue;
    if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) continue;
    const formattedVal = formatFieldValue(value);
    if (!formattedVal) continue;
    const label = FIELD_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    details.push({ label, value: formattedVal, icon: <Settings2 className="h-3.5 w-3.5" />, section: "Outros" });
  }

  if (details.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Settings2 className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm">Nenhum detalhe adicional disponível</p>
        <p className="text-xs mt-1">A IA não incluiu informações extras nesta proposta.</p>
      </div>
    );
  }

  // Group by section
  const sections = new Map<string, DetailItem[]>();
  for (const d of details) {
    const sec = d.section || "Geral";
    if (!sections.has(sec)) sections.set(sec, []);
    sections.get(sec)!.push(d);
  }

  return (
    <div className="space-y-4">
      {Array.from(sections.entries()).map(([section, items]) => (
        <div key={section}>
          <p className="text-[11px] font-bold text-primary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <span className="h-px flex-1 bg-border/40" />
            {section}
            <span className="h-px flex-1 bg-border/40" />
          </p>
          <div className="space-y-0">
            {items.map((d, i) => (
              <div key={i} className="flex items-start gap-2.5 py-2 border-b border-border/20 last:border-0">
                <div className="mt-0.5 text-muted-foreground shrink-0">{d.icon}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{d.label}</p>
                  <p className="text-sm font-medium mt-0.5 break-words">{d.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ========================================
   FULL CONTENT DIALOG — Tabbed
   ======================================== */
function FullContentDialog({ action, childActions, open, onOpenChange, fitData }: { action: PendingAction; childActions?: PendingAction[]; open: boolean; onOpenChange: (o: boolean) => void; fitData?: ProductFitData | null }) {
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

  // Frente 4 — detectar Etapa 1 do fluxo two_step_v1 (estratégia ainda não aprovada)
  const isTwoStepStrategyStage = isTwoStepAction(action) && getTwoStepStage(action) === "strategy";
  const creativeBriefData = (action.action_data as any)?.creative_brief || null;
  const creativePromptText = creativeBriefData?.prompt || (action.action_data as any)?.creative_prompt || null;
  const creativeFormatText = creativeBriefData?.format || (action.action_data as any)?.creative_format_suggested || null;
  const productReferenceUrl = isTwoStepStrategyStage ? (creativeUrls[0] || null) : null;

  const hasCreativesContent = !isStrategicPlan && !isAdSet && (
    isTwoStepStrategyStage
      ? !!(creativePromptText || headlinesList.length > 0 || primaryTexts.length > 0 || productReferenceUrl)
      : (creativeUrls.length > 0 || headlinesList.length > 0 || primaryTexts.length > 0)
  );
  const hasAdSets = adsets.length > 0 || isAdSet;

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
              {formatDateTimeBR(new Date(action.created_at))}
              {action.confidence && (
                <> · Confiança: {action.confidence === "high" ? "Alta" : action.confidence === "medium" ? "Média" : "Baixa"}</>
              )}
            </DialogDescription>
          </DialogHeader>

          {isStrategicPlan ? (
            /* Strategic plan — no tabs needed */
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
              <div className="space-y-4">
                <StrategicPlanContent
                  diagnosis={diagnosis}
                  plannedActions={plannedActions}
                  expectedResults={expectedResults}
                  riskAssessment={riskAssessment}
                  timeline={timeline}
                  reasoning={action.reasoning}
                  budgetAllocation={action.action_data?.budget_allocation}
                />
                {action.expected_impact && (
                  <div>
                    <SectionLabel icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-500" />} label="Impacto Esperado" />
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-lg p-3 border border-border/30 mt-1.5">
                      {sanitizeDisplayText(action.expected_impact)}
                    </div>
                  </div>
                )}
                {budgetSnapshot && <BudgetBar snapshot={budgetSnapshot} />}
              </div>
            </div>
          ) : isTwoStepStrategyStage ? (
            /* Frente 4 — Etapa 1: blocos verticais (sem abas) */
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
              {/* Cabeçalho de adequação */}
              {fitData && (() => {
                const lvl = fitLevelLabel(fitData.fit.fit_level);
                const toneCls = lvl.tone === "success" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200"
                  : lvl.tone === "destructive" ? "border-rose-500/30 bg-rose-500/5 text-rose-900 dark:text-rose-200"
                  : lvl.tone === "warning" ? "border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200"
                  : "border-sky-500/30 bg-sky-500/5 text-sky-900 dark:text-sky-200";
                return (
                  <div className={cn("rounded-md border px-3 py-2 text-xs", toneCls)}>
                    <div className="flex items-center gap-1.5 font-semibold mb-0.5">
                      <Target className="h-3.5 w-3.5" />
                      Adequação produto × público: {lvl.label}
                    </div>
                    <p className="leading-relaxed opacity-90">{fitData.fit.user_message}</p>
                  </div>
                );
              })()}

              {/* Bloco 1 — Resumo */}
              {(action.reasoning || preview.copy_text || data.copy_text) && (
                <div>
                  <SectionLabel icon={<Bot className="h-3.5 w-3.5 text-primary" />} label="Resumo da recomendação" />
                  <p className="text-sm text-muted-foreground leading-relaxed mt-1.5">{sanitizeDisplayText(action.reasoning || preview.copy_text || data.copy_text || "")}</p>
                </div>
              )}

              {/* Bloco 1.5 — Campanha (Frente 4.2) */}
              {(() => {
                const campaignName = preview.campaign_name || data.campaign_name || null;
                const objective = preview.objective || data.objective || data.campaign_type || null;
                const destinationUrl = preview.destination_url || data.destination_url || data.website_url || null;
                const ctaCode = preview.cta || preview.cta_type || data.cta_type || null;
                const channelLabel = action.channel ? (action.channel.charAt(0).toUpperCase() + action.channel.slice(1)) : null;
                const anyCampaign = campaignName || objective || destinationUrl || ctaCode || channelLabel || budgetDisplay;
                if (!anyCampaign) return null;
                return (
                  <div>
                    <SectionLabel icon={<Megaphone className="h-3.5 w-3.5 text-primary" />} label="Campanha" />
                    <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {campaignName && <p><span className="text-foreground font-medium">Nome:</span> {campaignName}</p>}
                      {objective && <p><span className="text-foreground font-medium">Objetivo:</span> {translateTechnical(objective)}</p>}
                      {channelLabel && <p><span className="text-foreground font-medium">Canal:</span> {channelLabel}</p>}
                      {budgetDisplay && <p><span className="text-foreground font-medium">Orçamento diário:</span> {budgetDisplay}</p>}
                      {ctaCode && <p><span className="text-foreground font-medium">Botão (CTA):</span> {CTA_LABELS[ctaCode] || ctaCode}</p>}
                      {destinationUrl && (
                        <p className="sm:col-span-2 break-all">
                          <span className="text-foreground font-medium">Link de destino:</span>{" "}
                          <a href={destinationUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{destinationUrl}</a>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Bloco 2 — Produto e oferta */}
              {(productName || fitData) && (
                <div>
                  <SectionLabel icon={<ImageIcon className="h-3.5 w-3.5 text-primary" />} label="Produto e oferta" />
                  <div className="mt-1.5 space-y-1 text-sm">
                    {productName && <p className="font-semibold">{productName}</p>}
                    {fitData?.classification && (
                      <p className="text-xs text-muted-foreground">
                        Tipo comercial: <span className="font-medium text-foreground">{commercialClassLabel(fitData.classification.commercial_class)}</span>
                      </p>
                    )}
                    {fitData?.components_summary && fitData.components_summary.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Composição: {fitData.components_summary.map(c => `${c.quantity}x ${c.name}`).join(" + ")}
                      </p>
                    )}
                    {productPrice && <p className="text-xs text-muted-foreground">Preço: <span className="font-medium text-foreground">{productPrice}</span></p>}
                  </div>
                </div>
              )}

              {/* Bloco 3 — Público e exclusões */}
              {(targeting || (() => { const ex = getCustomerExclusionLine(data, preview); return ex; })()) && (
                <div>
                  <SectionLabel icon={<Users className="h-3.5 w-3.5 text-primary" />} label="Público e exclusões" />
                  <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                    {targeting && <p>{sanitizeDisplayText(targeting)}{ageRange && ` (${ageRange} anos)`}</p>}
                    {(() => { const ex = getCustomerExclusionLine(data, preview); return ex ? (
                      <p className={cn(ex.applied ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300")}>
                        {ex.label}{ex.hint ? ` — ${ex.hint}` : ""}
                      </p>
                    ) : null; })()}
                  </div>
                </div>
              )}

              {/* Bloco 4 — Prompt & Copy (reaproveita TabsContent existente como bloco) */}
              <div>
                <SectionLabel icon={<Sparkles className="h-3.5 w-3.5 text-primary" />} label="Prompt & Copy" />
                <div className="mt-1.5 space-y-4">
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                    Nenhum criativo final foi gerado ainda. A geração acontece apenas após aprovar a estratégia.
                  </div>
                  {(creativePromptText || creativeFormatText) && (
                    <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                        <Sparkles className="h-3.5 w-3.5" />
                        Prompt do criativo
                        {creativeFormatText && <Badge variant="outline" className="text-[10px] ml-1">Formato sugerido: {creativeFormatText}</Badge>}
                      </div>
                      {creativePromptText && <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{creativePromptText}</p>}
                    </div>
                  )}
                  {headlinesList.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold">Headlines sugeridas</p>
                      {headlinesList.map((h, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-0.5 shrink-0">{i + 1}</Badge>
                          <span>{h}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {primaryTexts.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold">Textos principais</p>
                      {primaryTexts.map((t, i) => (
                        <div key={i} className="bg-muted/20 rounded-md p-2.5 border border-border/30 text-sm text-muted-foreground whitespace-pre-wrap">{t}</div>
                      ))}
                    </div>
                  )}
                  {productReferenceUrl && (
                    <div>
                      <SectionLabel icon={<ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />} label="Referência visual do produto" />
                      <div className="mt-1.5 flex items-start gap-2">
                        <button type="button" onClick={() => setZoomUrl(productReferenceUrl)} className="relative h-20 w-20 rounded-md border border-border/40 overflow-hidden bg-muted/30 shrink-0">
                          <img src={productReferenceUrl} alt="Referência do produto" className="h-full w-full object-cover" />
                        </button>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">Imagem usada apenas como referência. Não é o criativo final.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bloco 5 — Riscos e validações */}
              {fitData && (
                <div>
                  <SectionLabel icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-600" />} label="Riscos e validações" />
                  <ul className="mt-1.5 text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Quality Gate: aprovado (a proposta só chega aqui depois de passar).</li>
                    <li>Adequação produto×público: <span className="font-medium text-foreground">{fitLevelLabel(fitData.fit.fit_level).label}</span></li>
                    {fitData.fit.suggested_actions.map((s, i) => <li key={i}>Ajuste sugerido: {s}</li>)}
                  </ul>
                </div>
              )}

              {/* Bloco 6 — Detalhes técnicos (recolhido) */}
              <details className="rounded-md border border-border/30">
                <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                  Detalhes técnicos
                </summary>
                <div className="px-3 pb-3 pt-1 text-[11px] text-muted-foreground space-y-1 font-mono break-all">
                  {(data as any).flow_version && <div>flow_version: {(data as any).flow_version}</div>}
                  {(data as any).product_id && <div>product_id: {(data as any).product_id}</div>}
                  {fitData?.fit.reason_codes && <div>fit_reason_codes: {fitData.fit.reason_codes.join(", ")}</div>}
                  {fitData?.classification.signals && <div>classification_signals: {fitData.classification.signals.join(", ")}</div>}
                  {creativeBriefData && (
                    <div>
                      creative_brief: <pre className="whitespace-pre-wrap">{JSON.stringify(creativeBriefData, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </details>
            </div>
          ) : (
            /* Campaign / AdSet — tabbed view (legacy + two_step generating/final) */
            <Tabs defaultValue="criativos" className="flex-1 min-h-0 flex flex-col">
              <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-5 h-auto py-0 shrink-0">
                {hasCreativesContent && (
                  <TabsTrigger value="criativos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-2.5 px-3">
                    <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
                    {isTwoStepStrategyStage ? "Prompt & Copy" : "Criativos & Copys"}
                  </TabsTrigger>
                )}
                <TabsTrigger value="detalhes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-2.5 px-3">
                  <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                  Detalhes da Campanha
                </TabsTrigger>
                {hasAdSets && (
                  <TabsTrigger value="conjuntos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-2.5 px-3">
                    <Layers className="h-3.5 w-3.5 mr-1.5" />
                    Conjuntos & Público
                  </TabsTrigger>
                )}
              </TabsList>

              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
                {/* Tab: Criativos & Copys */}
                {hasCreativesContent && (
                  <TabsContent value="criativos" className="mt-0 space-y-4">
                    {isTwoStepStrategyStage ? (
                      <>
                        {/* Aviso explícito: nenhum criativo final ainda */}
                        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                          Nenhum criativo final foi gerado ainda. A geração acontece apenas após aprovar a estratégia.
                        </div>

                        {/* Prompt do criativo em destaque */}
                        {(creativePromptText || creativeFormatText) && (
                          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                              <Sparkles className="h-3.5 w-3.5" />
                              Prompt do criativo
                              {creativeFormatText && (
                                <Badge variant="outline" className="text-[10px] ml-1">Formato {creativeFormatText}</Badge>
                              )}
                            </div>
                            {creativePromptText && (
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{creativePromptText}</p>
                            )}
                          </div>
                        )}

                        {/* Referência visual do produto — pequena, claramente rotulada */}
                        {productReferenceUrl && (
                          <div>
                            <SectionLabel icon={<ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />} label="Referência visual do produto" />
                            <div className="mt-1.5 flex items-start gap-2">
                              <button
                                type="button"
                                onClick={() => setZoomUrl(productReferenceUrl)}
                                className="relative h-20 w-20 rounded-md border border-border/40 overflow-hidden bg-muted/30 shrink-0"
                              >
                                <img src={productReferenceUrl} alt="Referência do produto" className="h-full w-full object-cover" />
                              </button>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Imagem usada apenas como referência do produto. Não é o criativo final.
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      creativeUrls.length > 0 && (
                        <CreativesGallery urls={creativeUrls} onZoom={setZoomUrl} />
                      )
                    )}

                    {headlinesList.length > 0 && (
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

                    {primaryTexts.length > 0 && (
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

                    {descriptionsList.length > 0 && (
                      <div>
                        <SectionLabel icon={<ListChecks className="h-3.5 w-3.5 text-muted-foreground" />} label={`Descrições (${descriptionsList.length})`} />
                        <div className="space-y-1 mt-1.5">
                          {descriptionsList.map((d, i) => (
                            <p key={i} className="text-xs text-muted-foreground">{d}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {ctaType && (
                      <div>
                        <SectionLabel icon={<MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />} label="Botão (CTA)" />
                        <Badge variant="secondary" className="text-xs mt-1">{CTA_LABELS[ctaType] || ctaType}</Badge>
                      </div>
                    )}
                  </TabsContent>
                )}

                {/* Tab: Detalhes da Campanha */}
                <TabsContent value="detalhes" className="mt-0">
                  <CampaignDetailsTab data={data} preview={preview} action={action} childActions={childActions} />

                  {/* Reasoning & Impact */}
                  {action.reasoning && (
                    <div className="mt-4">
                      <SectionLabel icon={<Bot className="h-3.5 w-3.5 text-muted-foreground" />} label="Raciocínio da IA" />
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-lg p-3 border border-border/30 mt-1.5">
                        {sanitizeDisplayText(action.reasoning)}
                      </div>
                    </div>
                  )}
                  {action.expected_impact && (
                    <div className="mt-4">
                      <SectionLabel icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-500" />} label="Impacto Esperado" />
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-lg p-3 border border-border/30 mt-1.5">
                        {sanitizeDisplayText(action.expected_impact)}
                      </div>
                    </div>
                  )}

                  {budgetSnapshot && <div className="mt-4"><BudgetBar snapshot={budgetSnapshot} /></div>}
                </TabsContent>

                {/* Tab: Conjuntos & Público */}
                {hasAdSets && (
                  <TabsContent value="conjuntos" className="mt-0 space-y-4">
                    {/* AdSet standalone info */}
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
                        {targeting && (
                          <div className="bg-muted/30 rounded-lg p-2.5 border border-border/30 text-xs">
                            <span className="text-muted-foreground">Público</span>
                            <p className="font-medium mt-0.5">{sanitizeDisplayText(targeting)}{ageRange && ` (${ageRange} anos)`}</p>
                          </div>
                        )}
                        {customAudiences && Array.isArray(customAudiences) && customAudiences.length > 0 && (
                          <div>
                            <SectionLabel icon={<Users className="h-3.5 w-3.5 text-muted-foreground" />} label="Públicos Personalizados" />
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {customAudiences.map((aud: any, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs px-2 py-0.5">
                                  {typeof aud === "string" ? aud : aud.name || aud.id}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Nested AdSets */}
                    {adsets.length > 0 && (
                      <div>
                        <SectionLabel icon={<Layers className="h-3.5 w-3.5 text-muted-foreground" />} label={`Conjuntos de Anúncios (${adsets.length})`} />
                        <div className="mt-1.5 space-y-2">
                          {adsets.map((adset) => {
                            const ad = adset.action_data || {};
                            const prev = ad.preview || {};
                            const t = prev.targeting_summary || ad.targeting_summary || null;
                            const ca = ad.custom_audiences || prev.custom_audiences || null;
                            const aName = ad.adset_name || prev.adset_name || "Conjunto";
                            const budget = prev.daily_budget_display || (ad.daily_budget_cents ? `R$ ${(ad.daily_budget_cents / 100).toFixed(2)}/dia` : null);
                            const age = prev.age_range || ad.age_range || null;
                            return (
                              <div key={adset.id} className="bg-muted/20 rounded-lg p-3 border border-border/30 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Target className="h-3.5 w-3.5 text-primary" />
                                  <span className="text-sm font-semibold">{aName}</span>
                                  {budget && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 ml-auto">
                                      <DollarSign className="h-2.5 w-2.5" />
                                      {budget}
                                    </Badge>
                                  )}
                                </div>
                                {t && (
                                  <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                    <Users className="h-3 w-3 mt-0.5 shrink-0" />
                                    <span>{sanitizeDisplayText(t)}{age && ` (${age} anos)`}</span>
                                  </div>
                                )}
                                {ca && Array.isArray(ca) && ca.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {ca.map((aud: any, i: number) => (
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
                      </div>
                    )}

                    {/* General targeting info for campaign level */}
                    {!isAdSet && targeting && (
                      <div className="bg-muted/30 rounded-lg p-2.5 border border-border/30 text-xs">
                        <span className="text-muted-foreground">Público Geral</span>
                        <p className="font-medium mt-0.5">{sanitizeDisplayText(targeting)}{ageRange && ` (${ageRange} anos)`}</p>
                      </div>
                    )}
                  </TabsContent>
                )}
              </div>
            </Tabs>
          )}
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
  const [structuredOpen, setStructuredOpen] = useState(false);
  const [creativeDialogOpen, setCreativeDialogOpen] = useState(false);
  const [adjustSuggestion, setAdjustSuggestion] = useState("");
  const { approveStrategy } = useAdsPendingActions();

  // Frente 4 — Fluxo de duas etapas
  const isTwoStep = isTwoStepAction(action);
  const twoStepStage = getTwoStepStage(action);
  const creativeBrief = (action.action_data as any)?.creative_brief || null;

  const data = action.action_data || {};
  const preview = data.preview || {};
  const Icon = ACTION_TYPE_ICONS[action.action_type] || Target;
  const isStrategicPlan = action.action_type === "strategic_plan";

  const creativeUrls = useAllCreativeUrls(action);
  const primaryCreativeUrl = creativeUrls[0] || null;
  const headline = preview.headline || data.headline || null;
  const copyText = preview.copy_text || data.copy_text || null;
  const funnel = preview.funnel_stage || data.funnel_stage || null;
  const funnelInfo = funnel ? getFunnelLabel(funnel) : null;
  const exclusionInfo = getCustomerExclusionLine(data, preview);
  const budgetDisplay = preview.daily_budget_display || (data.daily_budget_cents ? `R$ ${(data.daily_budget_cents / 100).toFixed(2)}/dia` : null);
  const campaignName = preview.campaign_name || data.campaign_name || null;
  const campaignTypeInfo = !isStrategicPlan ? inferCampaignType(data) : null;

  // Frente 4 — Inteligência produto×funil (apenas para Etapa 1 do two_step_v1)
  const productIdForFit = (data as any).product_id || preview.product_id || null;
  const enableFit = isTwoStep && twoStepStage === "strategy";
  const { data: fitData } = useProductCommercialFit(
    enableFit ? productIdForFit : null,
    enableFit ? (funnel as any) : null,
    enableFit ? action.tenant_id : null,
  );
  const fitBadge = enableFit && fitData ? fitLevelLabel(fitData.fit.fit_level) : null;
  const approveBlockedByFit = enableFit && fitData?.fit.soft_block === true;

  const adsets = (childActions || []).filter(a => a.action_type === "create_adset");

  // Classificação: proposta estruturada (Campanha → Conjuntos → Anúncios) vs ação operacional legacy
  const structuredCheck = normalizeCampaignStructure(data, {
    actionType: action.action_type,
    flowVersion: (data as any)?.flow_version,
  });
  const isStructuredCampaign =
    action.action_type === "create_campaign" || structuredCheck.is_structured_campaign;

  const diagnosis = data.diagnosis || null;
  const summaryText = isStrategicPlan
    ? sanitizeDisplayText(diagnosis || preview.copy_text || "")
    : sanitizeDisplayText(copyText || action.reasoning || "");

  const label = ACTION_TYPE_LABELS[action.action_type] || action.action_type;

  const handleRejectDismiss = () => {
    onReject(action.id, "Usuário descartou esta proposta", "dismiss");
    setRejectOpen(false);
  };

  const handleRejectRegenerate = () => {
    onReject(action.id, "Usuário solicitou nova proposta", "regenerate");
    setRejectOpen(false);
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
                  {shouldShowCreativeCountBadge(action, creativeUrls.length) && (
                    <Badge variant="secondary" className="absolute bottom-1 right-1 text-[9px] px-1 py-0">
                      +{creativeUrls.length - 1}
                    </Badge>
                  )}
                  {isTwoStep && twoStepStage === "strategy" && (
                    <Badge variant="secondary" className="absolute bottom-1 right-1 text-[9px] px-1 py-0">
                      Referência
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
                {formatDayMonthTimeBR(action.created_at)}
              </span>
              {funnelInfo && (
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 ml-auto", funnelInfo.color)}>
                  {funnelInfo.label}
                </Badge>
              )}
              {fitBadge && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 py-0",
                    fitBadge.tone === "success" && "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
                    fitBadge.tone === "info" && "bg-sky-500/10 text-sky-700 border-sky-500/20",
                    fitBadge.tone === "warning" && "bg-amber-500/10 text-amber-700 border-amber-500/20",
                    fitBadge.tone === "destructive" && "bg-rose-500/10 text-rose-700 border-rose-500/20",
                  )}
                  title={fitData?.fit.user_message || ""}
                >
                  {fitBadge.label}
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
              {shouldShowCreativeCountBadge(action, creativeUrls.length) && (
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

            {/* Frente 1 — Linha de exclusão de Clientes (Públicos Frios) */}
            {exclusionInfo && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {exclusionInfo.applied ? (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                    <Users className="h-2.5 w-2.5" />
                    {exclusionInfo.label}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 bg-amber-500/10 text-amber-700 border-amber-500/20" title={exclusionInfo.hint || ""}>
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {exclusionInfo.label}
                  </Badge>
                )}
              </div>
            )}

            {/* Botão de visualização — único CTA quando proposta estruturada (Campanha → Conjuntos → Anúncios). */}
            {isStructuredCampaign ? (
              <Button
                variant="default"
                size="sm"
                onClick={() => setStructuredOpen(true)}
                className="h-8 mt-1 text-xs gap-1.5"
              >
                <Eye className="h-3.5 w-3.5" />
                Visualizar proposta
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFullOpen(true)}
                className="h-7 text-xs gap-1 text-primary hover:text-primary px-2 -ml-2"
              >
                <Eye className="h-3 w-3" />
                Ver conteúdo completo
              </Button>
            )}
          </div>
        </div>

        {/* Frente 4 — Bloco do Brief (Etapa 1) */}
        {isTwoStep && twoStepStage === "strategy" && creativeBrief && (
          <div className="mx-3 mb-2 p-2.5 rounded-md border border-primary/20 bg-primary/5 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-primary">
              <Sparkles className="h-3 w-3" />
              Prompt do criativo
              {creativeBrief.format && <Badge variant="outline" className="text-[10px] ml-1">Formato {creativeBrief.format}</Badge>}
            </div>
            {creativeBrief.prompt && (
              <p className="text-muted-foreground whitespace-pre-wrap line-clamp-3">{creativeBrief.prompt}</p>
            )}
            <p className="text-[10px] text-muted-foreground italic">
              Nenhum crédito será consumido até você aprovar a geração dos criativos.
            </p>
          </div>
        )}

        {/* Frente 4 — Alerta de adequação produto×funil (soft-block) */}
        {approveBlockedByFit && fitData && (
          <div className="mx-3 mb-2 p-2.5 rounded-md border border-rose-500/30 bg-rose-500/5 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-rose-900 dark:text-rose-200">
              <AlertTriangle className="h-3.5 w-3.5" />
              Adequação produto × público
            </div>
            <p className="text-rose-900/90 dark:text-rose-200/90 leading-relaxed">{fitData.fit.user_message}</p>
            {fitData.fit.suggested_actions.length > 0 && (
              <ul className="list-disc list-inside text-rose-900/80 dark:text-rose-200/80">
                {fitData.fit.suggested_actions.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            )}
          </div>
        )}

        {/* Frente 4 — Etapa 2 em andamento / aguardando aprovação final */}
        {isTwoStep && (twoStepStage === "generating" || twoStepStage === "final") && (
          <div className="mx-3 mb-2 p-2.5 rounded-md border border-amber-500/30 bg-amber-500/5 text-xs flex items-center gap-2">
            {twoStepStage === "generating" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-700" />
                <span className="text-amber-800">Gerando criativos…</span>
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-700" />
                <span className="text-emerald-800">Criativos prontos — aguardando aprovação final</span>
              </>
            )}
          </div>
        )}

        {/* Action buttons */}
        {!isStructuredCampaign && (
        <CardFooter className="px-3 pb-3 pt-0 gap-2 border-t border-border/30">
          {isTwoStep && twoStepStage === "strategy" ? (
            <Button
              size="sm"
              onClick={() => {
                approveStrategy.mutate(action.id, {
                  onSuccess: () => setCreativeDialogOpen(true),
                });
              }}
              disabled={approveStrategy.isPending || !!rejectingId || approveBlockedByFit}
              className="flex-1 h-8 text-xs gap-1.5"
              title={approveBlockedByFit ? (fitData?.fit.user_message || "") : "Aprova a estratégia e autoriza a geração dos criativos. Ainda não publica a campanha."}
            >
              {approveStrategy.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {approveStrategy.isPending ? "Aprovando estratégia…" : approveBlockedByFit ? "Ajuste necessário antes de aprovar" : "Aprovar e gerar criativos"}
            </Button>
          ) : isTwoStep && (twoStepStage === "generating" || twoStepStage === "final") ? (
            <Button
              size="sm"
              onClick={() => setCreativeDialogOpen(true)}
              className="flex-1 h-8 text-xs gap-1.5"
              variant={twoStepStage === "final" ? "default" : "outline"}
            >
              <Eye className="h-3.5 w-3.5" />
              {twoStepStage === "final" ? "Revisar e aprovar campanha" : "Acompanhar geração"}
            </Button>
          ) : (
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
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdjustOpen(true)}
            disabled={!!approvingId || !!rejectingId || !!adjustingId || twoStepStage === "generating"}
            className="flex-1 h-8 text-xs gap-1.5"
            title={
              isTwoStep && twoStepStage === "strategy"
                ? "Abre o editor estruturado da proposta. Editar campos e salvar rascunho não chama a IA."
                : "Sugerir ajuste por texto (modo clássico)."
            }
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

      {/* Frente 4 — Dialog da Etapa 2 */}
      {isTwoStep && (
        <CreativeGenerationStepDialog
          action={action}
          open={creativeDialogOpen}
          onOpenChange={setCreativeDialogOpen}
        />
      )}

      {/* Full Content Dialog */}
      <FullContentDialog action={action} childActions={childActions} open={fullOpen} onOpenChange={setFullOpen} fitData={fitData} />

      {/* Reject Dialog — Two Options */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>O que deseja fazer?</DialogTitle>
            <DialogDescription>
              Escolha como a IA deve proceder após rejeitar esta proposta.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Button
              variant="outline"
              className="h-auto w-full py-3 px-4 justify-start text-left flex-col items-start gap-1 whitespace-normal"
              onClick={handleRejectDismiss}
              disabled={!!rejectingId}
            >
              <span className="font-semibold text-sm">Não quero esta proposta</span>
              <span className="text-xs text-muted-foreground font-normal whitespace-normal break-words">
                A proposta será descartada. A IA continuará apenas com os controles automáticos (diários, semanais e mensais).
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-auto w-full py-3 px-4 justify-start text-left flex-col items-start gap-1 whitespace-normal border-primary/30 hover:border-primary/50"
              onClick={handleRejectRegenerate}
              disabled={!!rejectingId}
            >
              <span className="font-semibold text-sm flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Quero outra proposta
              </span>
              <span className="text-xs text-muted-foreground font-normal whitespace-normal break-words">
                A IA gerará um novo plano/campanha para substituir este e apresentará novamente para aprovação.
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Adjust — Frente 4.3: drawer estruturado para two_step_v1 strategy; fallback texto livre para legacy */}
      {isTwoStep && twoStepStage === "strategy" ? (
        <ProposalStructuredEditor action={action} open={adjustOpen} onOpenChange={setAdjustOpen} />
      ) : (
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
      )}

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

  const handleRejectAllDismiss = () => {
    for (const adset of adsets) {
      onReject(adset.id, "Usuário descartou esta proposta", "dismiss");
    }
    setRejectOpen(false);
  };

  const handleRejectAllRegenerate = () => {
    for (const adset of adsets) {
      onReject(adset.id, "Usuário solicitou nova proposta", "regenerate");
    }
    setRejectOpen(false);
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

      {/* Reject Dialog — Two Options */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>O que deseja fazer?</DialogTitle>
            <DialogDescription>
              Rejeitar {adsets.length} conjunto{adsets.length !== 1 ? "s" : ""} para "{parentCampaignName}".
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Button
              variant="outline"
              className="h-auto w-full py-3 px-4 justify-start text-left flex-col items-start gap-1 whitespace-normal"
              onClick={handleRejectAllDismiss}
              disabled={!!rejectingId}
            >
              <span className="font-semibold text-sm">Não quero esta proposta</span>
              <span className="text-xs text-muted-foreground font-normal whitespace-normal break-words">
                A proposta será descartada. A IA continuará apenas com os controles automáticos.
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-auto w-full py-3 px-4 justify-start text-left flex-col items-start gap-1 whitespace-normal border-primary/30 hover:border-primary/50"
              onClick={handleRejectAllRegenerate}
              disabled={!!rejectingId}
            >
              <span className="font-semibold text-sm flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Quero outra proposta
              </span>
              <span className="text-xs text-muted-foreground font-normal whitespace-normal break-words">
                A IA gerará novas propostas para substituir estas.
              </span>
            </Button>
          </div>
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