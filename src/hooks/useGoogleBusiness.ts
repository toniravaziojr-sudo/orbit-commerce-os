import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

async function callBusinessReviews(action: string, tenantId: string, params: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("google-business-reviews", {
    body: { action, tenantId, ...params },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
  return data.data;
}

async function callBusinessPosts(action: string, tenantId: string, params: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("google-business-posts", {
    body: { action, tenantId, ...params },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
  return data.data;
}

export function useGoogleBusiness(locationId?: string) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  // ===== LOCATIONS =====
  const locationsQuery = useQuery({
    queryKey: ["google-business", "locations", tenantId],
    queryFn: () => callBusinessReviews("locations", tenantId!),
    enabled: !!tenantId,
    staleTime: 10 * 60 * 1000,
  });

  // ===== REVIEWS =====
  const reviewsQuery = useQuery({
    queryKey: ["google-business", "reviews", tenantId, locationId],
    queryFn: () => callBusinessReviews("list", tenantId!, { locationId }),
    enabled: !!tenantId && !!locationId,
    staleTime: 5 * 60 * 1000,
  });

  const syncReviewsMutation = useMutation({
    mutationFn: (locId: string) => callBusinessReviews("sync", tenantId!, { locationId: locId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["google-business", "reviews"] }),
  });

  const replyMutation = useMutation({
    mutationFn: (params: { locationId: string; reviewId: string; replyText: string }) =>
      callBusinessReviews("reply", tenantId!, params),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["google-business", "reviews"] }),
  });

  // ===== POSTS =====
  const postsQuery = useQuery({
    queryKey: ["google-business", "posts", tenantId, locationId],
    queryFn: () => callBusinessPosts("list", tenantId!, { locationId }),
    enabled: !!tenantId && !!locationId,
    staleTime: 5 * 60 * 1000,
  });

  const syncPostsMutation = useMutation({
    mutationFn: (locId: string) => callBusinessPosts("sync", tenantId!, { locationId: locId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["google-business", "posts"] }),
  });

  const createPostMutation = useMutation({
    mutationFn: (params: { locationId: string; post: any }) =>
      callBusinessPosts("create", tenantId!, params),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["google-business", "posts"] }),
  });

  const deletePostMutation = useMutation({
    mutationFn: (params: { locationId: string; postName: string }) =>
      callBusinessPosts("delete", tenantId!, params),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["google-business", "posts"] }),
  });

  // ===== SYNC ALL =====
  const syncAllMutation = useMutation({
    mutationFn: async (locId: string) => {
      const [reviews, posts] = await Promise.all([
        callBusinessReviews("sync", tenantId!, { locationId: locId }),
        callBusinessPosts("sync", tenantId!, { locationId: locId }),
      ]);
      return { reviews, posts };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["google-business"] }),
  });

  return {
    locationsQuery,
    reviewsQuery,
    syncReviewsMutation,
    replyMutation,
    postsQuery,
    syncPostsMutation,
    createPostMutation,
    deletePostMutation,
    syncAllMutation,
  };
}
