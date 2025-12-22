import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export type DiscountType = "order_percent" | "order_fixed" | "free_shipping";

export interface Discount {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
  type: DiscountType;
  value: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  usage_limit_total: number | null;
  usage_limit_per_customer: number | null;
  min_subtotal: number | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  usage_count?: number;
}

export interface CreateDiscountInput {
  name: string;
  code: string;
  type: DiscountType;
  value: number;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active?: boolean;
  usage_limit_total?: number | null;
  usage_limit_per_customer?: number | null;
  min_subtotal?: number | null;
  description?: string | null;
}

export interface UpdateDiscountInput extends Partial<CreateDiscountInput> {
  id: string;
}

export function useDiscounts() {
  const { currentTenant } = useAuth();
  const currentTenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  // Fetch discounts with usage count
  const { data: discounts = [], isLoading, error } = useQuery({
    queryKey: ["discounts", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];

      const { data, error } = await supabase
        .from("discounts")
        .select("*")
        .eq("tenant_id", currentTenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch usage counts
      const discountsWithUsage = await Promise.all(
        (data || []).map(async (discount) => {
          const { count } = await supabase
            .from("discount_redemptions")
            .select("*", { count: "exact", head: true })
            .eq("discount_id", discount.id)
            .in("status", ["reserved", "applied"]);

          return {
            ...discount,
            usage_count: count || 0,
          };
        })
      );

      return discountsWithUsage as Discount[];
    },
    enabled: !!currentTenantId,
  });

  // Create discount
  const createDiscount = useMutation({
    mutationFn: async (input: CreateDiscountInput) => {
      if (!currentTenantId) throw new Error("No tenant selected");

      const { data, error } = await supabase
        .from("discounts")
        .insert({
          ...input,
          tenant_id: currentTenantId,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Já existe um cupom com este código");
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discounts", currentTenantId] });
      toast({ title: "Cupom criado com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar cupom", description: error.message, variant: "destructive" });
    },
  });

  // Update discount
  const updateDiscount = useMutation({
    mutationFn: async ({ id, ...input }: UpdateDiscountInput) => {
      const { data, error } = await supabase
        .from("discounts")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Já existe um cupom com este código");
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discounts", currentTenantId] });
      toast({ title: "Cupom atualizado com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar cupom", description: error.message, variant: "destructive" });
    },
  });

  // Delete discount
  const deleteDiscount = useMutation({
    mutationFn: async (id: string) => {
      // Check if discount was ever used
      const { count } = await supabase
        .from("discount_redemptions")
        .select("*", { count: "exact", head: true })
        .eq("discount_id", id);

      if (count && count > 0) {
        throw new Error("Este cupom já foi utilizado e não pode ser excluído");
      }

      const { error } = await supabase
        .from("discounts")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discounts", currentTenantId] });
      toast({ title: "Cupom excluído com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir cupom", description: error.message, variant: "destructive" });
    },
  });

  // Toggle discount active status
  const toggleDiscount = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("discounts")
        .update({ is_active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discounts", currentTenantId] });
    },
  });

  // Duplicate discount
  const duplicateDiscount = useMutation({
    mutationFn: async (discount: Discount) => {
      if (!currentTenantId) throw new Error("No tenant selected");

      const newCode = `${discount.code}_COPY`;
      
      const { data, error } = await supabase
        .from("discounts")
        .insert({
          tenant_id: currentTenantId,
          name: `${discount.name} (Cópia)`,
          code: newCode,
          type: discount.type,
          value: discount.value,
          starts_at: discount.starts_at,
          ends_at: discount.ends_at,
          is_active: false,
          usage_limit_total: discount.usage_limit_total,
          usage_limit_per_customer: discount.usage_limit_per_customer,
          min_subtotal: discount.min_subtotal,
          description: discount.description,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discounts", currentTenantId] });
      toast({ title: "Cupom duplicado com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao duplicar cupom", description: error.message, variant: "destructive" });
    },
  });

  return {
    discounts,
    isLoading,
    error,
    createDiscount,
    updateDiscount,
    deleteDiscount,
    toggleDiscount,
    duplicateDiscount,
  };
}

// Helper to get discount status
export function getDiscountStatus(discount: Discount): "active" | "scheduled" | "expired" | "inactive" {
  if (!discount.is_active) return "inactive";
  
  const now = new Date();
  
  if (discount.starts_at && new Date(discount.starts_at) > now) return "scheduled";
  if (discount.ends_at && new Date(discount.ends_at) < now) return "expired";
  
  return "active";
}

// Helper to format discount value
export function formatDiscountValue(discount: Discount): string {
  switch (discount.type) {
    case "order_percent":
      return `${discount.value}%`;
    case "order_fixed":
      return `R$ ${discount.value.toFixed(2).replace(".", ",")}`;
    case "free_shipping":
      return "Frete grátis";
    default:
      return String(discount.value);
  }
}

// Type labels
export const discountTypeLabels: Record<DiscountType, string> = {
  order_percent: "Desconto no pedido (%)",
  order_fixed: "Desconto no pedido (R$)",
  free_shipping: "Frete grátis",
};
