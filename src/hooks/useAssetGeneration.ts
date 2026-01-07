import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect } from "react";

export interface AssetGeneration {
  id: string;
  tenant_id: string;
  calendar_item_id: string;
  provider: string;
  model: string;
  prompt_final: string;
  status: "queued" | "generating" | "succeeded" | "failed";
  variant_count: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface AssetVariant {
  id: string;
  generation_id: string;
  variant_index: number;
  storage_path: string | null;
  public_url: string | null;
  thumb_url: string | null;
  width: number | null;
  height: number | null;
  approved_at: string | null;
  rejected_at: string | null;
  feedback: string | null;
  created_at: string;
  signed_url?: string; // Populated client-side
}

export function useAssetGenerations(calendarItemId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["asset-generations", calendarItemId],
    queryFn: async () => {
      if (!calendarItemId) return [];

      const { data, error } = await supabase
        .from("media_asset_generations")
        .select("*")
        .eq("calendar_item_id", calendarItemId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AssetGeneration[];
    },
    enabled: !!calendarItemId,
  });

  // Set up realtime subscription for generations
  useEffect(() => {
    if (!calendarItemId) return;

    const channel = supabase
      .channel(`generations-${calendarItemId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "media_asset_generations",
          filter: `calendar_item_id=eq.${calendarItemId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["asset-generations", calendarItemId],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [calendarItemId, queryClient]);

  return query;
}

export function useAssetVariants(generationId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["asset-variants", generationId],
    queryFn: async () => {
      if (!generationId) return [];

      const { data, error } = await supabase
        .from("media_asset_variants")
        .select("*")
        .eq("generation_id", generationId)
        .order("variant_index", { ascending: true });

      if (error) throw error;
      return data as AssetVariant[];
    },
    enabled: !!generationId,
  });

  // Set up realtime subscription for variants
  useEffect(() => {
    if (!generationId) return;

    const channel = supabase
      .channel(`variants-${generationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "media_asset_variants",
          filter: `generation_id=eq.${generationId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["asset-variants", generationId],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [generationId, queryClient]);

  return query;
}

export function useAllVariantsForItem(calendarItemId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["all-variants", calendarItemId],
    queryFn: async () => {
      if (!calendarItemId) return [];

      // First get all generations for this item
      const { data: generations, error: genError } = await supabase
        .from("media_asset_generations")
        .select("id")
        .eq("calendar_item_id", calendarItemId)
        .in("status", ["succeeded", "generating"]);

      if (genError) throw genError;
      if (!generations || generations.length === 0) return [];

      const generationIds = generations.map((g) => g.id);

      // Then get all variants for those generations
      const { data: variants, error: varError } = await supabase
        .from("media_asset_variants")
        .select("*")
        .in("generation_id", generationIds)
        .is("rejected_at", null)
        .order("created_at", { ascending: false });

      if (varError) throw varError;
      return variants as AssetVariant[];
    },
    enabled: !!calendarItemId,
  });

  // Set up realtime subscription
  useEffect(() => {
    if (!calendarItemId) return;

    const channel = supabase
      .channel(`all-variants-${calendarItemId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "media_asset_variants",
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["all-variants", calendarItemId],
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "media_asset_generations",
          filter: `calendar_item_id=eq.${calendarItemId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["all-variants", calendarItemId],
          });
          queryClient.invalidateQueries({
            queryKey: ["asset-generations", calendarItemId],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [calendarItemId, queryClient]);

  return query;
}

export function useGenerateImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      calendarItemId,
      variantCount = 4,
    }: {
      calendarItemId: string;
      variantCount?: number;
    }) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error("Não autenticado");
      }

      const response = await supabase.functions.invoke("media-generate-image", {
        body: {
          calendar_item_id: calendarItemId,
          variant_count: variantCount,
        },
      });

      if (response.error) throw response.error;
      
      const data = response.data as { success: boolean; error?: string; generation_id?: string };
      if (!data.success) {
        throw new Error(data.error || "Erro ao gerar imagem");
      }

      return data;
    },
    onSuccess: (_, variables) => {
      toast.success("Geração adicionada à fila");
      queryClient.invalidateQueries({
        queryKey: ["asset-generations", variables.calendarItemId],
      });
      queryClient.invalidateQueries({
        queryKey: ["all-variants", variables.calendarItemId],
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Erro ao gerar imagem");
    },
  });
}

export function useApproveVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variantId: string) => {
      const response = await supabase.functions.invoke("media-approve-variant", {
        body: { variant_id: variantId },
      });

      if (response.error) throw response.error;
      
      const data = response.data as { success: boolean; error?: string; public_url?: string };
      if (!data.success) {
        throw new Error(data.error || "Erro ao aprovar variante");
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Criativo aprovado e publicado");
      queryClient.invalidateQueries({ queryKey: ["all-variants"] });
      queryClient.invalidateQueries({ queryKey: ["asset-variants"] });
      queryClient.invalidateQueries({ queryKey: ["media-calendar-items"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Erro ao aprovar");
    },
  });
}

export function useRegenerateVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      variantId,
      feedback,
    }: {
      variantId: string;
      feedback: string;
    }) => {
      const response = await supabase.functions.invoke("media-regenerate-variant", {
        body: { variant_id: variantId, feedback },
      });

      if (response.error) throw response.error;
      
      const data = response.data as { success: boolean; error?: string; generation_id?: string };
      if (!data.success) {
        throw new Error(data.error || "Erro ao regenerar");
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Regeneração adicionada à fila");
      queryClient.invalidateQueries({ queryKey: ["all-variants"] });
      queryClient.invalidateQueries({ queryKey: ["asset-generations"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Erro ao regenerar");
    },
  });
}

export function useGetSignedUrl() {
  return useMutation({
    mutationFn: async (variantId: string) => {
      const response = await supabase.functions.invoke("media-get-signed-url", {
        body: { variant_id: variantId },
      });

      if (response.error) throw response.error;
      
      const data = response.data as { success: boolean; error?: string; signed_url?: string };
      if (!data.success) {
        throw new Error(data.error || "Erro ao obter URL");
      }

      return data.signed_url;
    },
  });
}
