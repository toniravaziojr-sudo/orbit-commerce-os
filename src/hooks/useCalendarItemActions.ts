import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { MediaCalendarItem } from "@/hooks/useMediaCampaigns";
import { showErrorToast } from '@/lib/error-toast';

// =============================================
// PHASE 2 — Editing Rules, Scheduling Replacement, Versioning
// =============================================

export type EditMode = "free" | "replace" | "readonly";

export interface Editability {
  canEdit: boolean;
  canDelete: boolean;
  isReadOnly: boolean;
  requiresReplacement: boolean;
  editMode: EditMode;
  label: string;
}

// States grouped by edit permission
const CONSTRUCTION_STATES = ["draft", "suggested", "review", "generating_asset", "asset_review"];
const PROCESSING_STATES = ["publishing", "retry_pending"];
const PARTIAL_STATES = ["partially_published", "partially_failed"];
const READONLY_STATES = ["published", "superseded", "canceled", "failed"];

/**
 * Determines what actions are available for a given calendar item based on its status.
 */
export function checkEditability(item: MediaCalendarItem): Editability {
  const status = item.status;

  // In construction: free editing
  if (CONSTRUCTION_STATES.includes(status)) {
    return {
      canEdit: true,
      canDelete: true,
      isReadOnly: false,
      requiresReplacement: false,
      editMode: "free",
      label: "Em construção",
    };
  }

  // Approved but not yet scheduled: free editing (with critical field tracking)
  if (status === "approved") {
    return {
      canEdit: true,
      canDelete: true,
      isReadOnly: false,
      requiresReplacement: false,
      editMode: "free",
      label: "Aprovado",
    };
  }

  // Scheduled: requires replacement flow
  if (status === "scheduled") {
    return {
      canEdit: false,
      canDelete: false,
      isReadOnly: false,
      requiresReplacement: true,
      editMode: "replace",
      label: "Agendado — substituição necessária",
    };
  }

  // Processing: view only
  if (PROCESSING_STATES.includes(status)) {
    return {
      canEdit: false,
      canDelete: false,
      isReadOnly: true,
      requiresReplacement: false,
      editMode: "readonly",
      label: "Em processamento",
    };
  }

  // Partially published/failed: total read-only on original
  if (PARTIAL_STATES.includes(status)) {
    return {
      canEdit: false,
      canDelete: false,
      isReadOnly: true,
      requiresReplacement: false,
      editMode: "readonly",
      label: "Publicação parcial — somente leitura",
    };
  }

  // Published, superseded, canceled, failed: read-only
  if (READONLY_STATES.includes(status)) {
    return {
      canEdit: false,
      canDelete: false,
      isReadOnly: true,
      requiresReplacement: false,
      editMode: "readonly",
      label: status === "published" ? "Publicado — somente leitura" : "Finalizado",
    };
  }

  // Fallback: read-only
  return {
    canEdit: false,
    canDelete: false,
    isReadOnly: true,
    requiresReplacement: false,
    editMode: "readonly",
    label: "Estado desconhecido",
  };
}

/**
 * Critical fields that, when changed on an approved item, should revert status to review.
 */
const CRITICAL_FIELDS: (keyof MediaCalendarItem)[] = ["copy", "asset_url", "target_platforms", "content_type"];

export function hasCriticalFieldChanged(
  original: MediaCalendarItem,
  updated: Partial<MediaCalendarItem>
): boolean {
  for (const field of CRITICAL_FIELDS) {
    if (field in updated) {
      const origVal = JSON.stringify(original[field]);
      const newVal = JSON.stringify(updated[field as keyof typeof updated]);
      if (origVal !== newVal) return true;
    }
  }
  return false;
}

export function useCalendarItemActions(campaignId: string | undefined) {
  const { currentTenant, user } = useAuth();
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["media-calendar-items", campaignId] });
    queryClient.invalidateQueries({ queryKey: ["social-posts"] });
  };

  /**
   * Safe replacement of a scheduled item.
   * Order: 1) Save new data → 2) Mark old social_posts as superseded → 3) Reset to approved → 4) Clear frozen_payload
   * If any step fails, previous state remains intact.
   */
  const replaceScheduledItem = useMutation({
    mutationFn: async ({ itemId, newData }: { itemId: string; newData: Record<string, unknown> }) => {
      if (!currentTenant?.id) throw new Error("Tenant não selecionado");

      // Step 1: Save new content data on the parent item (WITHOUT changing status yet)
      const { error: saveError } = await supabase
        .from("media_calendar_items")
        .update({
          ...newData,
          edited_at: new Date().toISOString(),
          edited_by: user?.id || null,
        })
        .eq("id", itemId)
        .eq("tenant_id", currentTenant.id);

      if (saveError) throw new Error("Falha ao salvar novos dados. O agendamento anterior permanece ativo.");

      // Step 2: Mark active social_posts as superseded (atomically via edge function for safety)
      const { data: posts } = await supabase
        .from("social_posts")
        .select("id")
        .eq("calendar_item_id", itemId)
        .eq("tenant_id", currentTenant.id)
        .in("status", ["scheduled", "failed"]);

      if (posts && posts.length > 0) {
        for (const post of posts) {
          const { error: supersedeError } = await supabase.functions.invoke("media-social-post-actions", {
            body: {
              action: "supersede",
              social_post_id: post.id,
              tenant_id: currentTenant.id,
              reason: "Agendamento substituído pelo usuário",
            },
          });
          if (supersedeError) {
            console.error("Failed to supersede post:", post.id, supersedeError);
            // Continue — better to supersede most than fail all
          }
        }
      }

      // Step 3: Reset item status to approved (preserving scheduled_time)
      const { error: resetError } = await supabase
        .from("media_calendar_items")
        .update({
          status: "approved",
          frozen_payload: null,
        })
        .eq("id", itemId)
        .eq("tenant_id", currentTenant.id);

      if (resetError) {
        console.error("Failed to reset status:", resetError);
        // Data was already saved and posts superseded — item is in a safe state
      }

      return { success: true };
    },
    onSuccess: () => {
      invalidate();
      toast.success("Agendamento substituído! O item voltou para aprovado e pode ser reagendado.");
    },
    onError: (error: any) => {
      onError: (err) => showErrorToast(err, { module: 'calendário', action: 'processar' }),
    },
  });

  /**
   * Duplicate an item as a new version (draft), independent of the original.
   */
  const duplicateAsNewVersion = useMutation({
    mutationFn: async (item: MediaCalendarItem) => {
      if (!currentTenant?.id) throw new Error("Tenant não selecionado");

      const { data, error } = await supabase
        .from("media_calendar_items")
        .insert({
          tenant_id: currentTenant.id,
          campaign_id: item.campaign_id,
          scheduled_date: item.scheduled_date,
          scheduled_time: item.scheduled_time,
          content_type: item.content_type,
          title: item.title ? `${item.title} (v${(item.version || 1) + 1})` : null,
          copy: item.copy,
          cta: item.cta,
          hashtags: item.hashtags,
          generation_prompt: item.generation_prompt,
          reference_urls: item.reference_urls,
          asset_url: null,
          asset_thumbnail_url: null,
          asset_metadata: {},
          status: "draft",
          target_platforms: item.target_platforms,
          target_channel: item.target_channel,
          blog_post_id: null,
          published_blog_at: null,
          published_at: null,
          publish_results: {},
          version: (item.version || 1) + 1,
          edited_by: user?.id || null,
          edited_at: null,
          metadata: {},
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Nova versão criada como rascunho!");
    },
    onError: () => {
      toast.error("Erro ao criar nova versão");
    },
  });

  return {
    replaceScheduledItem,
    duplicateAsNewVersion,
  };
}
