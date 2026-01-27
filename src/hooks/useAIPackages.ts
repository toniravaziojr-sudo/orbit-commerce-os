import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface AIPackage {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  price_cents: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TenantAISubscription {
  id: string;
  tenant_id: string;
  package_id: string;
  status: "active" | "cancelled" | "expired";
  credits_remaining: number;
  started_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  package?: AIPackage;
}

export interface TenantAIUsage {
  id: string;
  tenant_id: string;
  subscription_id: string;
  feature: string;
  credits_used: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export function useAIPackages() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all active packages (public)
  const packagesQuery = useQuery({
    queryKey: ["ai-packages"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ai_packages")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return (data || []) as AIPackage[];
    },
  });

  // Fetch current tenant subscription
  const subscriptionQuery = useQuery({
    queryKey: ["ai-subscription", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const { data, error } = await (supabase as any)
        .from("tenant_ai_subscriptions")
        .select("*, package:ai_packages(*)")
        .eq("tenant_id", currentTenant.id)
        .eq("status", "active")
        .maybeSingle();

      if (error) throw error;
      return data as TenantAISubscription | null;
    },
    enabled: !!currentTenant?.id,
  });

  // Fetch usage history
  const usageQuery = useQuery({
    queryKey: ["ai-usage", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await (supabase as any)
        .from("tenant_ai_usage")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as TenantAIUsage[];
    },
    enabled: !!currentTenant?.id,
  });

  // Subscribe to a package
  const subscribeMutation = useMutation({
    mutationFn: async (packageId: string) => {
      if (!currentTenant?.id) throw new Error("Tenant não encontrado");

      // Get package details
      const { data: pkg, error: pkgError } = await (supabase as any)
        .from("ai_packages")
        .select("*")
        .eq("id", packageId)
        .single();

      if (pkgError) throw pkgError;

      // Create subscription
      const { data, error } = await (supabase as any)
        .from("tenant_ai_subscriptions")
        .insert({
          tenant_id: currentTenant.id,
          package_id: packageId,
          status: "active",
          credits_remaining: (pkg as AIPackage).credits,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-subscription"] });
      toast.success("Pacote contratado com sucesso!");
    },
    onError: (error) => {
      console.error("Error subscribing:", error);
      toast.error("Erro ao contratar pacote");
    },
  });

  return {
    packages: packagesQuery.data ?? [],
    isLoadingPackages: packagesQuery.isLoading,
    
    subscription: subscriptionQuery.data,
    isLoadingSubscription: subscriptionQuery.isLoading,
    
    usage: usageQuery.data ?? [],
    isLoadingUsage: usageQuery.isLoading,
    
    subscribe: subscribeMutation.mutate,
    isSubscribing: subscribeMutation.isPending,
  };
}

// Hook for platform admins to manage packages
export function useAIPackagesAdmin() {
  const queryClient = useQueryClient();

  // Fetch all packages (including inactive)
  const allPackagesQuery = useQuery({
    queryKey: ["ai-packages-admin"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ai_packages")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return (data || []) as AIPackage[];
    },
  });

  // Create package
  const createMutation = useMutation({
    mutationFn: async (pkg: Omit<AIPackage, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await (supabase as any)
        .from("ai_packages")
        .insert(pkg)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-packages"] });
      queryClient.invalidateQueries({ queryKey: ["ai-packages-admin"] });
      toast.success("Pacote criado com sucesso!");
    },
    onError: (error) => {
      console.error("Error creating package:", error);
      toast.error("Erro ao criar pacote");
    },
  });

  // Update package
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AIPackage> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from("ai_packages")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-packages"] });
      queryClient.invalidateQueries({ queryKey: ["ai-packages-admin"] });
      toast.success("Pacote atualizado com sucesso!");
    },
    onError: (error) => {
      console.error("Error updating package:", error);
      toast.error("Erro ao atualizar pacote");
    },
  });

  // Delete package
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("ai_packages")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-packages"] });
      queryClient.invalidateQueries({ queryKey: ["ai-packages-admin"] });
      toast.success("Pacote removido com sucesso!");
    },
    onError: (error) => {
      console.error("Error deleting package:", error);
      toast.error("Erro ao remover pacote");
    },
  });

  return {
    packages: allPackagesQuery.data ?? [],
    isLoading: allPackagesQuery.isLoading,
    
    createPackage: createMutation.mutate,
    isCreating: createMutation.isPending,
    
    updatePackage: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    
    deletePackage: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}
