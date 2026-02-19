import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot, Pause, DollarSign, TrendingUp, Image, Target, Users,
  Layers, Calendar, Hash, FileText, ArrowRight, Crosshair, Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AutopilotAction } from "@/hooks/useAdsAutopilot";

interface ActionDetailDialogProps {
  action: AutopilotAction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACTION_LABELS: Record<string, string> = {
  pause_campaign: "Pausar Campanha",
  adjust_budget: "Ajustar Orçamento",
  create_campaign: "Criar Campanha",
  create_adset: "Criar Conjunto de Anúncios",
  generate_creative: "Gerar Criativo",
  allocate_budget: "Alocar Orçamento",
  report_insight: "Insight da IA",
};

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Renders structured preview for campaign creation */
function CampaignPreview({ data }: { data: Record<string, any> }) {
  const preview = data.preview || {};
  const hasAdsets = data.adsets && data.adsets.length > 0;
  const hasAds = data.ads && data.ads.length > 0;
  const hasPreviewFallback = !hasAdsets && !hasAds && (preview.headline || preview.copy_text || preview.creative_url || preview.targeting_summary);

  return (
    <div className="space-y-4">
      <DetailSection icon={<TrendingUp className="h-4 w-4" />} title="Campanha">
        <DetailRow label="Nome" value={data.campaign_name} />
        <DetailRow label="Objetivo" value={data.objective} />
        <DetailRow label="Status Inicial" value={data.initial_status || data.status || "PAUSED"} />
        {data.special_ad_categories && (
          <DetailRow label="Categorias Especiais" value={data.special_ad_categories?.join(", ") || "Nenhuma"} />
        )}
        {(preview.funnel_stage || data.funnel_stage) && (
          <DetailRow label="Funil" value={preview.funnel_stage || data.funnel_stage} />
        )}
        {(preview.product_name || data.product_name) && (
          <DetailRow label="Produto" value={`${preview.product_name || data.product_name}${preview.product_price_display ? ` — ${preview.product_price_display}` : ''}`} />
        )}
      </DetailSection>

      {(data.daily_budget_cents || preview.budget_snapshot) && (
        <DetailSection icon={<DollarSign className="h-4 w-4" />} title="Orçamento">
          {data.daily_budget_cents && (
            <DetailRow label="Orçamento Diário" value={formatCurrency(data.daily_budget_cents)} highlight />
          )}
          {data.lifetime_budget_cents && (
            <DetailRow label="Orçamento Vitalício" value={formatCurrency(data.lifetime_budget_cents)} />
          )}
          {data.bid_strategy && <DetailRow label="Estratégia de Lance" value={data.bid_strategy} />}
          {preview.budget_snapshot && (
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <DetailRow label="Ativo na conta" value={formatCurrency(preview.budget_snapshot.active_cents || 0)} />
              <DetailRow label="Reservado" value={formatCurrency(preview.budget_snapshot.pending_reserved_cents || 0)} />
              <DetailRow label="Limite" value={formatCurrency(preview.budget_snapshot.limit_cents || 0)} />
            </div>
          )}
        </DetailSection>
      )}

      {/* Preview fallback: show headline, copy, creative, targeting when adsets/ads are empty */}
      {hasPreviewFallback && (
        <>
          {(preview.headline || preview.copy_text) && (
            <DetailSection icon={<FileText className="h-4 w-4" />} title="Anúncio (Preview)">
              {preview.headline && <DetailRow label="Título" value={preview.headline} />}
              {preview.copy_text && <DetailRow label="Texto" value={preview.copy_text} />}
              {preview.cta_type && <DetailRow label="CTA" value={preview.cta_type} />}
              {preview.creative_url && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">Criativo:</p>
                  <img src={preview.creative_url} alt="Criativo" className="rounded-lg border max-h-48 object-contain" />
                </div>
              )}
            </DetailSection>
          )}

          {preview.targeting_summary && (
            <DetailSection icon={<Target className="h-4 w-4" />} title="Público-Alvo">
              <p className="text-sm">{preview.targeting_summary}</p>
              {preview.age_range && <DetailRow label="Faixa etária" value={`${preview.age_range} anos`} />}
            </DetailSection>
          )}
        </>
      )}

      {hasAdsets && (
        <DetailSection icon={<Layers className="h-4 w-4" />} title={`Conjuntos de Anúncios (${data.adsets.length})`}>
          {data.adsets.map((adset: any, i: number) => (
            <div key={i} className="rounded-lg border p-3 space-y-2">
              <p className="font-medium text-sm">{adset.name || `Conjunto ${i + 1}`}</p>
              {adset.daily_budget_cents && (
                <DetailRow label="Orçamento" value={formatCurrency(adset.daily_budget_cents)} />
              )}
              {adset.targeting && <TargetingPreview targeting={adset.targeting} />}
              {adset.optimization_goal && <DetailRow label="Otimização" value={adset.optimization_goal} />}
            </div>
          ))}
        </DetailSection>
      )}

      {hasAds && (
        <DetailSection icon={<Image className="h-4 w-4" />} title={`Anúncios (${data.ads.length})`}>
          {data.ads.map((ad: any, i: number) => (
            <div key={i} className="rounded-lg border p-3 space-y-2">
              <p className="font-medium text-sm">{ad.name || `Anúncio ${i + 1}`}</p>
              {ad.headline && <DetailRow label="Título" value={ad.headline} />}
              {ad.body && <DetailRow label="Texto" value={ad.body} />}
              {ad.cta_type && <DetailRow label="CTA" value={ad.cta_type} />}
              {ad.creative_id && <DetailRow label="Criativo" value={ad.creative_id} mono />}
              {ad.url && <DetailRow label="URL" value={ad.url} mono />}
            </div>
          ))}
        </DetailSection>
      )}
    </div>
  );
}

/** Renders structured preview for adset creation */
function AdsetPreview({ data }: { data: Record<string, any> }) {
  return (
    <div className="space-y-4">
      <DetailSection icon={<Layers className="h-4 w-4" />} title="Conjunto de Anúncios">
        <DetailRow label="Nome" value={data.adset_name || data.name} />
        <DetailRow label="Campanha" value={data.campaign_name || data.campaign_id} mono={!data.campaign_name} />
        {data.daily_budget_cents && (
          <DetailRow label="Orçamento Diário" value={formatCurrency(data.daily_budget_cents)} highlight />
        )}
        {data.optimization_goal && <DetailRow label="Otimização" value={data.optimization_goal} />}
        {data.billing_event && <DetailRow label="Cobrança" value={data.billing_event} />}
        {data.status && <DetailRow label="Status" value={data.status} />}
      </DetailSection>

      {data.targeting && (
        <DetailSection icon={<Target className="h-4 w-4" />} title="Segmentação">
          <TargetingPreview targeting={data.targeting} />
        </DetailSection>
      )}

      {data.schedule && (
        <DetailSection icon={<Calendar className="h-4 w-4" />} title="Agendamento">
          {data.schedule.start_time && <DetailRow label="Início" value={new Date(data.schedule.start_time).toLocaleString("pt-BR")} />}
          {data.schedule.end_time && <DetailRow label="Fim" value={new Date(data.schedule.end_time).toLocaleString("pt-BR")} />}
        </DetailSection>
      )}
    </div>
  );
}

/** Renders structured preview for creative generation */
function CreativePreview({ data }: { data: Record<string, any> }) {
  const jobId = data.job_id || data.creative_job_id;

  // Fetch creative job output when we have a job_id but no asset_url
  const { data: jobData, isLoading: jobLoading } = useQuery({
    queryKey: ["creative-job-preview", jobId],
    queryFn: async () => {
      const { data: job } = await (supabase as any)
        .from("creative_jobs")
        .select("id, status, output_urls, error_message")
        .eq("id", jobId)
        .maybeSingle();
      return job as { id: string; status: string; output_urls: string[] | null; error_message: string | null } | null;
    },
    enabled: !!jobId && !data.asset_url,
    refetchInterval: (query) => {
      const job = query.state.data;
      return job?.status === "running" || job?.status === "pending" ? 5000 : false;
    },
  });

  const outputUrls = jobData?.output_urls || [];

  return (
    <div className="space-y-4">
      <DetailSection icon={<Image className="h-4 w-4" />} title="Criativo">
        {data.product_name && <DetailRow label="Produto" value={data.product_name} />}
        {data.headline && <DetailRow label="Título" value={data.headline} />}
        {data.copy_text && <DetailRow label="Texto" value={data.copy_text} />}
        {data.cta_type && <DetailRow label="CTA" value={data.cta_type} />}
        {data.format && <DetailRow label="Formato" value={data.format} />}
        {data.angle && <DetailRow label="Ângulo" value={data.angle} />}
        {data.generation_style && <DetailRow label="Estilo" value={data.generation_style} />}
        {data.channel && <DetailRow label="Canal" value={data.channel} />}
        {jobId && <DetailRow label="Job ID" value={jobId} mono />}
        {data.asset_url && (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground mb-1">Imagem:</p>
            <img src={data.asset_url} alt="Criativo" className="rounded-lg border max-h-48 object-contain" />
          </div>
        )}
        {/* Show fetched job images */}
        {!data.asset_url && outputUrls.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground mb-1">Imagens geradas:</p>
            <div className="grid grid-cols-2 gap-2">
              {outputUrls.map((url: string, i: number) => (
                <img key={i} src={url} alt={`Criativo ${i + 1}`} className="rounded-lg border max-h-48 object-contain w-full" />
              ))}
            </div>
          </div>
        )}
        {/* Show loading/processing state */}
        {jobId && !data.asset_url && outputUrls.length === 0 && (
          <div className="mt-2 p-3 rounded-lg bg-muted/50">
            {jobLoading || jobData?.status === "running" || jobData?.status === "pending" ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Criativos sendo processados...
                </p>
              </div>
            ) : jobData?.status === "failed" ? (
              <p className="text-xs text-destructive">
                ❌ Falha na geração: {jobData.error_message || "Erro desconhecido"}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                ⏳ Verifique no <strong>Estúdio de Criativos</strong> ou <strong>Meu Drive → Gestor de Tráfego IA</strong>.
              </p>
            )}
          </div>
        )}
      </DetailSection>

      {data.variations && data.variations.length > 0 && (
        <DetailSection icon={<Layers className="h-4 w-4" />} title={`Variações (${data.variations.length})`}>
          {data.variations.map((v: any, i: number) => (
            <div key={i} className="rounded-lg border p-3 space-y-1">
              <p className="font-medium text-sm">Variação {i + 1}</p>
              {v.headline && <DetailRow label="Título" value={v.headline} />}
              {v.copy_text && <DetailRow label="Texto" value={v.copy_text} />}
              {v.asset_url && (
                <img src={v.asset_url} alt={`Variação ${i + 1}`} className="rounded border max-h-32 object-contain mt-1" />
              )}
            </div>
          ))}
        </DetailSection>
      )}
    </div>
  );
}

/** Renders budget adjustment preview */
function BudgetPreview({ data }: { data: Record<string, any> }) {
  return (
    <div className="space-y-4">
      <DetailSection icon={<DollarSign className="h-4 w-4" />} title="Ajuste de Orçamento">
        <DetailRow label="Entidade" value={data.campaign_name || data.adset_name || data.campaign_id || data.adset_id} mono={!data.campaign_name && !data.adset_name} />
        {data.old_budget_cents != null && (
          <DetailRow label="Orçamento Anterior" value={formatCurrency(data.old_budget_cents)} />
        )}
        {data.new_budget_cents != null && (
          <DetailRow label="Novo Orçamento" value={formatCurrency(data.new_budget_cents)} highlight />
        )}
        {data.change_pct != null && (
          <DetailRow label="Variação" value={`${data.change_pct > 0 ? "+" : ""}${data.change_pct.toFixed(1)}%`} />
        )}
      </DetailSection>
    </div>
  );
}

/** Renders pause campaign preview */
function PausePreview({ data }: { data: Record<string, any> }) {
  return (
    <div className="space-y-4">
      <DetailSection icon={<Pause className="h-4 w-4" />} title="Pausar Campanha">
        <DetailRow label="Campanha" value={data.campaign_name || data.campaign_id} mono={!data.campaign_name} />
        {data.current_spend_cents != null && (
          <DetailRow label="Gasto Atual" value={formatCurrency(data.current_spend_cents)} />
        )}
        {data.expected_impact?.spend_reduction_cents_day != null && (
          <DetailRow label="Economia/dia" value={formatCurrency(data.expected_impact.spend_reduction_cents_day)} highlight />
        )}
      </DetailSection>
    </div>
  );
}

/** Targeting breakdown */
function TargetingPreview({ targeting }: { targeting: Record<string, any> }) {
  return (
    <div className="space-y-2 pl-2 border-l-2 border-muted">
      {targeting.age_min && (
        <DetailRow label="Idade" value={`${targeting.age_min} - ${targeting.age_max || 65}+`} />
      )}
      {targeting.genders && targeting.genders.length > 0 && (
        <DetailRow label="Gênero" value={targeting.genders.map((g: number) => g === 1 ? "Masculino" : g === 2 ? "Feminino" : "Todos").join(", ")} />
      )}
      {targeting.geo_locations?.countries && (
        <DetailRow label="Países" value={targeting.geo_locations.countries.join(", ")} />
      )}
      {targeting.geo_locations?.cities && targeting.geo_locations.cities.length > 0 && (
        <DetailRow label="Cidades" value={targeting.geo_locations.cities.map((c: any) => c.name || c.key).join(", ")} />
      )}
      {targeting.interests && targeting.interests.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Interesses:</p>
          <div className="flex flex-wrap gap-1">
            {targeting.interests.map((interest: any, i: number) => (
              <Badge key={i} variant="outline" className="text-xs">
                {interest.name || interest}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {targeting.custom_audiences && targeting.custom_audiences.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Públicos Personalizados:</p>
          <div className="flex flex-wrap gap-1">
            {targeting.custom_audiences.map((aud: any, i: number) => (
              <Badge key={i} variant="secondary" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {aud.name || aud.id}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {targeting.lookalike_spec && (
        <DetailRow label="Lookalike" value={`${(targeting.lookalike_spec.ratio * 100).toFixed(0)}% — ${targeting.lookalike_spec.country}`} />
      )}
    </div>
  );
}

/* ── Shared atoms ── */

function DetailSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      <div className="space-y-1.5 ml-6">{children}</div>
    </div>
  );
}

function DetailRow({ label, value, highlight, mono }: { label: string; value?: string | null; highlight?: boolean; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-muted-foreground min-w-[120px] shrink-0">{label}:</span>
      <span className={`${highlight ? "font-semibold text-primary" : ""} ${mono ? "font-mono text-xs" : ""} break-all`}>
        {value}
      </span>
    </div>
  );
}

/** Renders raw JSON fallback for unknown action types */
function RawDataPreview({ data, title }: { data: Record<string, any>; title: string }) {
  return (
    <DetailSection icon={<FileText className="h-4 w-4" />} title={title}>
      <pre className="text-xs bg-muted rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-64">
        {JSON.stringify(data, null, 2)}
      </pre>
    </DetailSection>
  );
}

export function ActionDetailDialog({ action, open, onOpenChange }: ActionDetailDialogProps) {
  if (!action) return null;

  const data = action.action_data || {};
  const rollback = action.rollback_data;
  const label = ACTION_LABELS[action.action_type] || action.action_type;

  const renderPreview = () => {
    switch (action.action_type) {
      case "create_campaign":
        return <CampaignPreview data={data} />;
      case "create_adset":
        return <AdsetPreview data={data} />;
      case "generate_creative":
        return <CreativePreview data={data} />;
      case "adjust_budget":
      case "allocate_budget":
        return <BudgetPreview data={data} />;
      case "pause_campaign":
        return <PausePreview data={data} />;
      case "report_insight":
        return (
          <DetailSection icon={<Bot className="h-4 w-4" />} title="Insight">
            <p className="text-sm">{action.reasoning || data.body || data.insight || "Sem detalhes"}</p>
            {data.category && <DetailRow label="Categoria" value={data.category} />}
            {data.priority && <DetailRow label="Prioridade" value={data.priority} />}
          </DetailSection>
        );
      default:
        return <RawDataPreview data={data} title="Dados da Ação" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {label}
            <Badge variant="outline" className="text-xs capitalize">{action.channel}</Badge>
          </DialogTitle>
          <DialogDescription className="text-xs">
            {new Date(action.created_at).toLocaleString("pt-BR")} · Sessão: {action.session_id.slice(0, 8)}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pb-4">
            {/* Reasoning */}
            {action.reasoning && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-1 font-medium">Raciocínio da IA</p>
                <p className="text-sm">{action.reasoning}</p>
              </div>
            )}

            {/* Confidence + Metric */}
            <div className="flex gap-2 flex-wrap">
              {action.confidence && (
                <Badge variant="outline" className="text-xs">
                  Confiança: {action.confidence}
                </Badge>
              )}
              {action.metric_trigger && (
                <Badge variant="outline" className="text-xs">
                  <Crosshair className="h-3 w-3 mr-1" />
                  {action.metric_trigger}
                </Badge>
              )}
              {action.expected_impact && typeof action.expected_impact === "string" && (
                <Badge variant="outline" className="text-xs">
                  Impacto: {action.expected_impact}
                </Badge>
              )}
            </div>

            <Separator />

            {/* Structured preview */}
            {renderPreview()}

            {/* Rollback data */}
            {rollback && Object.keys(rollback).length > 0 && (
              <>
                <Separator />
                <RawDataPreview data={rollback} title="Dados de Reversão" />
              </>
            )}

            {/* Error */}
            {action.error_message && (
              <>
                <Separator />
                <div className="rounded-lg bg-destructive/10 p-3">
                  <p className="text-xs text-destructive font-medium mb-1">Erro</p>
                  <p className="text-sm text-destructive">{action.error_message}</p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
