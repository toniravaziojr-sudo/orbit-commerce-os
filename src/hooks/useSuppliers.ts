import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/error-toast";

export type SupplierPersonType = "PF" | "PJ";
export type SupplierContributorType =
  | "contribuinte"
  | "nao_contribuinte"
  | "contribuinte_isento";

export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  person_type: SupplierPersonType;
  cnpj: string | null;
  cpf: string | null;
  legal_name: string | null;
  trade_name: string | null;
  ie: string | null;
  ie_isento: boolean;
  im: string | null;
  contributor_type: SupplierContributorType;
  is_foreign: boolean;
  email: string | null;
  phone: string | null;
  phone_secondary: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  codigo_ibge: string | null;
  pais: string;
  address: string | null; // legado (texto livre)
  contact_person: string | null;
  notes: string | null;
  fiscal_notes: string | null;
  is_active: boolean;
  supplier_type_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SupplierInsert = Omit<
  Supplier,
  "id" | "tenant_id" | "created_at" | "updated_at" | "deleted_at"
>;
export type SupplierUpdate = Partial<SupplierInsert>;

function onlyDigits(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, "");
  return d.length === 0 ? null : d;
}

export function useSuppliers() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading, error } = useQuery({
    queryKey: ["suppliers", tenantId],
    queryFn: async () => {
      if (!tenantId) return [] as Supplier[];
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Supplier[];
    },
    enabled: !!tenantId,
  });

  const createSupplier = useMutation({
    mutationFn: async (input: Partial<SupplierInsert>) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      const payload: any = {
        ...input,
        tenant_id: tenantId,
        cnpj: onlyDigits(input.cnpj ?? null),
        cpf: onlyDigits(input.cpf ?? null),
        cep: onlyDigits(input.cep ?? null),
      };
      const { data, error } = await supabase
        .from("suppliers")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["purchase-suppliers", tenantId] });
      toast.success("Fornecedor cadastrado com sucesso");
    },
    onError: (err) => showErrorToast(err, { module: "fornecedores", action: "criar" }),
  });

  const updateSupplier = useMutation({
    mutationFn: async ({ id, ...updates }: SupplierUpdate & { id: string }) => {
      const payload: any = {
        ...updates,
        ...(updates.cnpj !== undefined ? { cnpj: onlyDigits(updates.cnpj) } : {}),
        ...(updates.cpf !== undefined ? { cpf: onlyDigits(updates.cpf) } : {}),
        ...(updates.cep !== undefined ? { cep: onlyDigits(updates.cep) } : {}),
      };
      const { data, error } = await supabase
        .from("suppliers")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["purchase-suppliers", tenantId] });
      toast.success("Fornecedor atualizado com sucesso");
    },
    onError: (err) => showErrorToast(err, { module: "fornecedores", action: "salvar" }),
  });

  /** Soft delete: marca deleted_at e inativa. */
  const deleteSupplier = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("suppliers")
        .update({ deleted_at: new Date().toISOString(), is_active: false } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["purchase-suppliers", tenantId] });
      toast.success("Fornecedor inativado com sucesso");
    },
    onError: (err) => showErrorToast(err, { module: "fornecedores", action: "excluir" }),
  });

  /** Busca por documento (CPF ou CNPJ) — usado pelo fluxo "Salvar na base". */
  const findByDocument = async (
    document: string,
    personType: SupplierPersonType
  ): Promise<Supplier | null> => {
    if (!tenantId) return null;
    const digits = onlyDigits(document);
    if (!digits) return null;
    const column = personType === "PJ" ? "cnpj" : "cpf";
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq(column, digits)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as Supplier) ?? null;
  };

  return {
    suppliers,
    isLoading,
    error,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    findByDocument,
  };
}
