import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, FolderTree, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Mostra, de forma informativa, quantos produtos e categorias a IA está
 * usando como fonte automática de catálogo. Sem toggle: a busca é sempre
 * automática quando houver dados.
 */
export function AICatalogSourcesSummary() {
  const { currentTenant } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["ai-catalog-sources-summary", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return { products: 0, categories: 0 };
      const [{ count: products }, { count: categories }] = await Promise.all([
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", currentTenant.id)
          .neq("status", "archived"),
        supabase
          .from("product_categories")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", currentTenant.id),
      ]);
      return { products: products ?? 0, categories: categories ?? 0 };
    },
    enabled: !!currentTenant?.id,
  });

  const products = data?.products ?? 0;
  const categories = data?.categories ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Database className="h-4 w-4" />
          Fontes automáticas de catálogo
        </CardTitle>
        <CardDescription>
          A IA usa automaticamente seus produtos e categorias como fonte de
          conhecimento. Se não houver dados cadastrados, a busca simplesmente
          não acontece — sem necessidade de ativar nada.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Package className="h-4 w-4" /> Produtos
              </div>
              <Badge variant={products > 0 ? "default" : "secondary"}>
                {isLoading ? "…" : `${products} item(ns)`}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Catálogo, preços, descrições.
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FolderTree className="h-4 w-4" /> Categorias
              </div>
              <Badge variant={categories > 0 ? "default" : "secondary"}>
                {isLoading ? "…" : `${categories} item(ns)`}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Organização do catálogo.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
