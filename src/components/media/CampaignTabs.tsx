import { useState, useMemo } from "react";
import { parseISO } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PenTool, CheckCircle2, BarChart3, Badge as BadgeIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useMediaCampaigns, useMediaCalendarItems, MediaCalendarItem } from "@/hooks/useMediaCampaigns";
import { useCalendarItemActions } from "@/hooks/useCalendarItemActions";
import { useAuth } from "@/hooks/useAuth";
import { useMetaConnection } from "@/hooks/useMetaConnection";
import { PlanningTab } from "./PlanningTab";
import { ApprovalTab } from "./ApprovalTab";
import { TrackingTab } from "./TrackingTab";
import { PublicationDialog } from "./PublicationDialog";
import { DayPostsList } from "./DayPostsList";
import { ScheduledEditChoiceDialog } from "./ScheduledEditChoiceDialog";
import { toast } from "sonner";

interface CampaignTabsProps {
  campaignId: string;
  campaign: NonNullable<ReturnType<typeof useMediaCampaigns>["campaigns"]>[number];
}

export function CampaignTabs({ campaignId, campaign }: CampaignTabsProps) {
  const { currentTenant, user } = useAuth();
  const { items, isLoading, refetch: refetchItems, deleteItem, createItem } = useMediaCalendarItems(campaignId);
  const { isConnected: metaConnected, isLoading: metaLoading } = useMetaConnection();
  const { duplicateAsNewVersion } = useCalendarItemActions(campaignId);

  const [activeTab, setActiveTab] = useState("planning");

  // Shared dialog state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<MediaCalendarItem | null>(null);
  const [dayListOpen, setDayListOpen] = useState(false);
  const [dayListDate, setDayListDate] = useState<Date | null>(null);
  const [replaceMode, setReplaceMode] = useState(false);
  const [scheduledChoiceItem, setScheduledChoiceItem] = useState<MediaCalendarItem | null>(null);

  const isBlog = false;

  // Stats
  const stats = useMemo(() => {
    if (!items) return { total: 0, readyToApprove: 0, approved: 0, published: 0, scheduled: 0, failed: 0, partial: 0, draft: 0 };
    return {
      total: items.length,
      readyToApprove: items.filter(i =>
        ["draft", "suggested", "review"].includes(i.status) &&
        i.title &&
        (i.copy && i.copy.trim() !== "") &&
        (isBlog || i.content_type === "text" || i.asset_url)
      ).length,
      approved: items.filter(i => i.status === "approved").length,
      published: items.filter(i => i.status === "published").length,
      scheduled: items.filter(i => ["scheduled", "publishing", "retry_pending"].includes(i.status)).length,
      failed: items.filter(i => ["failed", "partially_failed"].includes(i.status)).length,
      partial: items.filter(i => ["partially_published", "partially_failed"].includes(i.status)).length,
      draft: items.filter(i => ["draft", "suggested", "review", "generating_asset", "asset_review"].includes(i.status)).length,
    };
  }, [items, isBlog]);

  // Items by date
  const itemsByDate = useMemo(() => {
    const map = new Map<string, MediaCalendarItem[]>();
    items?.forEach((item) => {
      const key = item.scheduled_date;
      map.set(key, [...(map.get(key) || []), item]);
    });
    return map;
  }, [items]);

  // Shared handlers
  const handleEditItem = (item: MediaCalendarItem) => {
    setSelectedDate(parseISO(item.scheduled_date));
    setEditItem(item);
    setDialogOpen(true);
  };

  const handleAddItem = (date: Date) => {
    setSelectedDate(date);
    setEditItem(null);
    setDialogOpen(true);
  };

  const handleDeleteItem = async (id: string) => {
    await deleteItem.mutateAsync(id);
  };

  const handleDuplicateItem = async (item: MediaCalendarItem) => {
    if (!currentTenant) return;
    try {
      await createItem.mutateAsync({
        tenant_id: currentTenant.id, campaign_id: item.campaign_id,
        scheduled_date: item.scheduled_date, scheduled_time: item.scheduled_time,
        content_type: item.content_type, title: item.title ? `${item.title} (cópia)` : null,
        copy: item.copy, cta: item.cta, hashtags: item.hashtags,
        generation_prompt: item.generation_prompt, reference_urls: item.reference_urls,
        asset_url: null, asset_thumbnail_url: null, asset_metadata: {},
        status: "draft", target_channel: item.target_channel,
        blog_post_id: null, published_blog_at: null,
        target_platforms: item.target_platforms, published_at: null,
        publish_results: {}, version: 1, edited_by: null, edited_at: null, metadata: {},
      });
      toast.success("Publicação duplicada!");
    } catch { toast.error("Erro ao duplicar"); }
  };

  const handleOpenDayList = (date: Date) => {
    setDayListDate(date);
    setDayListOpen(true);
  };

  const handleReplaceScheduled = (item: MediaCalendarItem) => {
    setDayListOpen(false);
    setScheduledChoiceItem(item);
  };

  // Cross-tab navigation helpers
  const goToApproval = () => setActiveTab("approval");
  const goToPlanning = () => setActiveTab("planning");
  const goToTracking = () => setActiveTab("tracking");

  const dayListItems = dayListDate ? itemsByDate.get(
    `${dayListDate.getFullYear()}-${String(dayListDate.getMonth() + 1).padStart(2, '0')}-${String(dayListDate.getDate()).padStart(2, '0')}`
  ) || [] : [];

  const currentDateItems = selectedDate ? itemsByDate.get(
    `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
  ) || [] : [];

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start h-auto p-1 bg-muted/50">
          <TabsTrigger value="planning" className="gap-2 data-[state=active]:bg-background">
            <PenTool className="h-4 w-4" />
            Planejamento
            {stats.draft > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {stats.draft}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approval" className="gap-2 data-[state=active]:bg-background">
            <CheckCircle2 className="h-4 w-4" />
            Aprovação e Publicação
            {(stats.readyToApprove + stats.approved) > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {stats.readyToApprove + stats.approved}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tracking" className="gap-2 data-[state=active]:bg-background">
            <BarChart3 className="h-4 w-4" />
            Acompanhamento
            {(stats.published + stats.scheduled + stats.failed) > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {stats.published + stats.scheduled + stats.failed}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planning" className="mt-4">
          <PlanningTab
            campaignId={campaignId}
            campaign={campaign}
            items={items}
            isLoading={isLoading}
            itemsByDate={itemsByDate}
            refetchItems={refetchItems}
            onEditItem={handleEditItem}
            onAddItem={handleAddItem}
            onDeleteItem={handleDeleteItem}
            onDuplicateItem={handleDuplicateItem}
            onOpenDayList={handleOpenDayList}
            onReplaceScheduled={handleReplaceScheduled}
            onGoToApproval={goToApproval}
            metaConnected={metaConnected}
            metaLoading={metaLoading}
          />
        </TabsContent>

        <TabsContent value="approval" className="mt-4">
          <ApprovalTab
            campaignId={campaignId}
            campaign={campaign}
            items={items}
            refetchItems={refetchItems}
            onEditItem={(item) => {
              goToPlanning();
              setTimeout(() => handleEditItem(item), 100);
            }}
            onGoToPlanning={goToPlanning}
            metaConnected={metaConnected}
            metaLoading={metaLoading}
          />
        </TabsContent>

        <TabsContent value="tracking" className="mt-4">
          <TrackingTab
            campaignId={campaignId}
            campaign={campaign}
            items={items}
            isLoading={isLoading}
            itemsByDate={itemsByDate}
            onEditItem={handleEditItem}
            onDuplicateItem={handleDuplicateItem}
            onOpenDayList={handleOpenDayList}
            onReplaceScheduled={handleReplaceScheduled}
          />
        </TabsContent>
      </Tabs>

      {/* Shared dialogs */}
      <PublicationDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setReplaceMode(false); }}
        date={selectedDate}
        campaignId={campaignId}
        existingItems={currentDateItems}
        editItem={editItem}
        campaignStartDate={campaign?.start_date}
        campaignType="social"
        onBackToList={() => { if (selectedDate) { setDayListDate(selectedDate); setDayListOpen(true); } }}
        replaceMode={replaceMode}
      />

      {dayListDate && (
        <DayPostsList
          open={dayListOpen}
          onOpenChange={setDayListOpen}
          date={dayListDate}
          items={dayListItems}
          onEditItem={handleEditItem}
          onAddItem={handleAddItem}
          onDeleteItem={handleDeleteItem}
          onDuplicateItem={handleDuplicateItem}
          onReplaceScheduled={handleReplaceScheduled}
        />
      )}

      <ScheduledEditChoiceDialog
        open={!!scheduledChoiceItem}
        onOpenChange={(open) => { if (!open) setScheduledChoiceItem(null); }}
        item={scheduledChoiceItem}
        onReplace={(item) => {
          setScheduledChoiceItem(null);
          setSelectedDate(parseISO(item.scheduled_date));
          setEditItem(item);
          setReplaceMode(true);
          setDialogOpen(true);
        }}
        onDuplicate={(item) => {
          setScheduledChoiceItem(null);
          duplicateAsNewVersion.mutate(item);
        }}
      />
    </>
  );
}
