import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Image as ImageIcon, FileText, Instagram, Facebook, Send, Loader2, ArrowLeft, AlertCircle, PenTool } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";

import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MediaCalendarItem, MediaCampaign } from "@/hooks/useMediaCampaigns";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const platformIcons: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-3.5 w-3.5 text-pink-500" />,
  facebook: <Facebook className="h-3.5 w-3.5 text-blue-500" />,
  feed_instagram: <Instagram className="h-3.5 w-3.5 text-pink-500" />,
  feed_facebook: <Facebook className="h-3.5 w-3.5 text-blue-500" />,
  story_instagram: <Instagram className="h-3.5 w-3.5 text-pink-500" />,
  story_facebook: <Facebook className="h-3.5 w-3.5 text-blue-500" />,
};

interface ApprovalTabProps {
  campaignId: string;
  campaign: MediaCampaign;
  items: MediaCalendarItem[] | undefined;
  refetchItems: () => Promise<any>;
  onEditItem: (item: MediaCalendarItem) => void;
  onGoToPlanning: () => void;
  metaConnected: boolean;
  metaLoading: boolean;
}

type FilterType = "ready" | "approved";

export function ApprovalTab({
  campaignId, campaign, items, refetchItems, onEditItem, onGoToPlanning,
  metaConnected, metaLoading,
}: ApprovalTabProps) {
  const { currentTenant } = useAuth();
  const navigate = useNavigate();
  const isBlog = campaign?.target_channel === "blog";

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterType>("ready");
  const [isApproving, setIsApproving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Filter items
  const readyToApprove = useMemo(() => {
    if (!items) return [];
    return items.filter(i =>
      ["draft", "suggested", "review"].includes(i.status) &&
      i.title && (i.copy && i.copy.trim() !== "") &&
      (isBlog || i.content_type === "text" || i.asset_url)
    );
  }, [items, isBlog]);

  const approvedItems = useMemo(() => {
    if (!items) return [];
    return items.filter(i => i.status === "approved");
  }, [items]);

  const displayItems = filter === "ready" ? readyToApprove : approvedItems;

  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === displayItems.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(displayItems.map(i => i.id)));
  };

  const handleApproveSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsApproving(true);
    try {
      for (const id of selectedIds) {
        await supabase.from("media_calendar_items").update({ status: "approved" }).eq("id", id);
      }
      toast.success(`${selectedIds.size} item(ns) aprovado(s)!`);
      setSelectedIds(new Set());
      await refetchItems();
    } catch { toast.error("Erro ao aprovar"); }
    finally { setIsApproving(false); }
  };

  const handlePublish = async () => {
    if (!items || !currentTenant) return;
    const toPublish = approvedItems.filter(i => selectedIds.has(i.id));
    if (toPublish.length === 0) { toast.info("Selecione itens aprovados para publicar."); return; }

    setIsPublishing(true);
    try {
      if (isBlog) {
        let scheduled = 0, published = 0, failedCount = 0;
        for (const item of toPublish) {
          const scheduleAt = item.scheduled_date ? `${item.scheduled_date}T${item.scheduled_time || "10:00:00"}` : null;
          const { data, error } = await supabase.functions.invoke("media-publish-blog", {
            body: { calendar_item_id: item.id, publish_now: false, schedule_at: scheduleAt },
          });
          if (error || !data?.success) failedCount++;
          else if (data.published) published++;
          else if (data.scheduled) scheduled++;
        }
        if (scheduled > 0) toast.success(`${scheduled} post(s) agendado(s)!`);
        if (published > 0) toast.success(`${published} post(s) publicado(s)!`);
        if (failedCount > 0) toast.error(`${failedCount} post(s) falharam`);
      } else {
        if (!metaConnected) {
          toast.error("Conecte suas redes sociais primeiro", {
            action: { label: "Conectar", onClick: () => navigate("/integrations") },
          });
          setIsPublishing(false);
          return;
        }
        const { data, error } = await supabase.functions.invoke("meta-publish-post", {
          body: { calendar_item_ids: toPublish.map(i => i.id), tenant_id: currentTenant.id },
        });
        if (error) toast.error("Erro ao publicar");
        else if (data?.success) {
          const parts = [];
          if (data.published > 0) parts.push(`${data.published} publicado(s)`);
          if (data.scheduled > 0) parts.push(`${data.scheduled} agendado(s)`);
          if (parts.length > 0) toast.success(parts.join(", ") + "!");
          if (data.failed > 0) toast.error(`${data.failed} falharam`);
        } else toast.error(data?.error || "Erro");
      }
      setSelectedIds(new Set());
      await refetchItems();
    } catch { toast.error("Erro ao publicar"); }
    finally { setIsPublishing(false); }
  };

  const isEmpty = readyToApprove.length === 0 && approvedItems.length === 0;

  // Count incomplete drafts (have title but missing copy or creative)
  const incompleteDrafts = useMemo(() => {
    if (!items) return 0;
    return items.filter(i =>
      ["draft", "suggested", "review"].includes(i.status) &&
      i.title &&
      ((!i.copy || i.copy.trim() === "") || (!isBlog && i.content_type !== "text" && !i.asset_url))
    ).length;
  }, [items, isBlog]);

  return (
    <div className="space-y-4">
      {/* Meta connection warning */}
      {!metaLoading && !metaConnected && !isBlog && (
        <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-amber-800 dark:text-amber-200">Para publicar nas redes sociais, conecte suas contas.</span>
            <Button size="sm" variant="outline" onClick={() => navigate("/integrations")} className="ml-4">Conectar</Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Incomplete drafts alert */}
      {incompleteDrafts > 0 && isEmpty && (
        <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <PenTool className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-amber-800 dark:text-amber-200">
              {incompleteDrafts} item(ns) ainda precisam de copy ou criativo antes de aprovar.
            </span>
            <Button size="sm" variant="outline" onClick={onGoToPlanning} className="ml-4 gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              Ir ao Planejamento
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isEmpty ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nenhum item pronto para aprovar"
          description="Quando os itens estiverem com copy e criativo preenchidos, eles aparecerão aqui para revisão e publicação."
          action={{ label: "Ir ao Planejamento", onClick: onGoToPlanning }}
        />
      ) : (
        <>
          {/* Filter tabs */}
          <div className="flex items-center gap-2">
            <Button
              variant={filter === "ready" ? "default" : "outline"}
              size="sm"
              onClick={() => { setFilter("ready"); setSelectedIds(new Set()); }}
              className="gap-1.5"
            >
              Prontos para Aprovar
              {readyToApprove.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{readyToApprove.length}</Badge>
              )}
            </Button>
            <Button
              variant={filter === "approved" ? "default" : "outline"}
              size="sm"
              onClick={() => { setFilter("approved"); setSelectedIds(new Set()); }}
              className="gap-1.5"
            >
              Aprovados para Publicar
              {approvedItems.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{approvedItems.length}</Badge>
              )}
            </Button>
          </div>

          {/* Selection bar */}
          {displayItems.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg border bg-muted/30">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={selectedIds.size === displayItems.length && displayItems.length > 0}
                  onCheckedChange={toggleAll}
                />
                Selecionar todos ({displayItems.length})
              </label>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{selectedIds.size} selecionado(s)</Badge>
                {filter === "ready" && selectedIds.size > 0 && (
                  <Button size="sm" onClick={handleApproveSelected} disabled={isApproving} className="bg-green-600 hover:bg-green-700 text-white gap-1">
                    {isApproving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Aprovar ({selectedIds.size})
                  </Button>
                )}
                {filter === "approved" && selectedIds.size > 0 && (
                  <Button size="sm" onClick={handlePublish} disabled={isPublishing} className="gap-1">
                    {isPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Publicar ({selectedIds.size})
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Items list */}
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              {displayItems.map((item) => {
                const isSelected = selectedIds.has(item.id);
                const platforms = item.target_platforms || [];

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                      isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/30"
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleItem(item.id)}
                      className="mt-1 shrink-0"
                    />

                    {/* Thumbnail */}
                    <div className="w-16 h-16 rounded-md overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                      {item.asset_url ? (
                        <img src={item.asset_url} alt={item.title || "Criativo"} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          {item.content_type === "text" ? <FileText className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1" onClick={() => toggleItem(item.id)}>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium truncate">{item.title || "Sem título"}</h4>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {format(new Date(item.scheduled_date), "dd/MM", { locale: ptBR })}
                        </span>
                      </div>
                      {item.copy && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{item.copy}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        {platforms.map(p => (
                          <span key={p} className="flex items-center gap-1 text-xs text-muted-foreground">
                            {platformIcons[p] || null}
                            <span className="capitalize">{p.replace("feed_", "").replace("story_", "S:")}</span>
                          </span>
                        ))}
                        {item.scheduled_time && (
                          <span className="text-xs text-muted-foreground">🕐 {item.scheduled_time.slice(0, 5)}</span>
                        )}
                      </div>
                    </div>

                    {/* Edit shortcut back to planning */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs shrink-0 self-center"
                      onClick={(e) => { e.stopPropagation(); onEditItem(item); }}
                    >
                      Editar
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
