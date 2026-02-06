import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Store, Crown, Star } from "lucide-react";

const planColors: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  start: "bg-muted text-muted-foreground",
  starter: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  growth: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  scale: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  enterprise: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  unlimited: "bg-primary text-primary-foreground",
};

export default function PlatformTenants() {
  const { data: tenants, isLoading } = useQuery({
    queryKey: ["platform-tenants-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, slug, plan, type, is_special, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tenants"
        description={`${tenants?.length ?? 0} tenants cadastrados na plataforma`}
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loja</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants?.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{tenant.name}</span>
                      {tenant.is_special && (
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {tenant.slug}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={planColors[tenant.plan ?? "free"] ?? ""}
                    >
                      {tenant.plan === "unlimited" && <Crown className="h-3 w-3 mr-1" />}
                      {(tenant.plan ?? "free").toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={tenant.type === "platform" ? "default" : "outline"}>
                      {tenant.type === "platform" ? "Plataforma" : "Cliente"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(tenant.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                </TableRow>
              ))}
              {tenants?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum tenant encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
