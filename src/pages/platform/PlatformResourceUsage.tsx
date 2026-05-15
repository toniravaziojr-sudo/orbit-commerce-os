import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Activity, Moon } from "lucide-react";
import { PlatformAdminGate } from "@/components/auth/PlatformAdminGate";
import { PlatformAccessDenied } from "@/components/auth/PlatformAccessDenied";
import { useSystemResourceUsage, useSystemResourceSkipLog, type SystemResourceUsage } from "@/hooks/useSystemResourceUsage";
import { formatDateTimeBR } from "@/lib/date-format";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function StatusBadge({ status, count }: { status: "active" | "dormant"; count: number }) {
  if (status === "active") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30">
        <Activity className="h-3 w-3 mr-1" /> Em uso ({count})
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <Moon className="h-3 w-3 mr-1" /> Adormecido
    </Badge>
  );
}

function GroupCard({ group, items, skipsByModule }: {
  group: string;
  items: SystemResourceUsage[];
  skipsByModule: Record<string, number>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{group}</CardTitle>
        <CardDescription>
          {items.filter(i => i.status === "active").length} de {items.length} recursos em uso
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="py-2 px-3 text-left font-medium">Recurso</th>
                <th className="py-2 px-3 text-left font-medium">Status</th>
                <th className="py-2 px-3 text-left font-medium">Última verificação</th>
                <th className="py-2 px-3 text-left font-medium">Execuções puladas (24h)</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.module_key} className="border-b last:border-0">
                  <td className="py-3 px-3 font-medium">{item.module_name}</td>
                  <td className="py-3 px-3">
                    <StatusBadge status={item.status} count={item.active_tenant_count} />
                  </td>
                  <td className="py-3 px-3 text-muted-foreground text-xs">
                    {formatDateTimeBR(item.last_refreshed_at)}
                  </td>
                  <td className="py-3 px-3 text-muted-foreground">
                    {skipsByModule[item.module_key] ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function PlatformResourceUsageInner() {
  const { data: usage, isLoading } = useSystemResourceUsage();
  const { data: skips } = useSystemResourceSkipLog(24);
  const queryClient = useQueryClient();

  const grouped = useMemo(() => {
    const map = new Map<string, SystemResourceUsage[]>();
    for (const item of usage ?? []) {
      if (!map.has(item.module_group)) map.set(item.module_group, []);
      map.get(item.module_group)!.push(item);
    }
    return Array.from(map.entries());
  }, [usage]);

  const skipsByModule = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const s of skips ?? []) {
      acc[s.module_key] = (acc[s.module_key] ?? 0) + 1;
    }
    return acc;
  }, [skips]);

  const handleRefresh = async () => {
    try {
      const { error } = await supabase.rpc("refresh_system_resource_usage");
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["system-resource-usage"] });
      toast.success("Registro atualizado");
    } catch (e: any) {
      toast.error("Falha ao atualizar: " + (e?.message ?? "erro desconhecido"));
    }
  };

  const totalActive = (usage ?? []).filter(u => u.status === "active").length;
  const totalDormant = (usage ?? []).filter(u => u.status === "dormant").length;
  const totalSkips = skips?.length ?? 0;

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recursos em uso</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mostra quais módulos do sistema têm pelo menos um lojista usando de fato.
            Recursos adormecidos não consomem processamento de fundo.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCcw className="h-4 w-4 mr-2" /> Atualizar agora
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recursos em uso</CardDescription>
            <CardTitle className="text-3xl text-emerald-600 dark:text-emerald-400">{totalActive}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recursos adormecidos</CardDescription>
            <CardTitle className="text-3xl text-muted-foreground">{totalDormant}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Execuções puladas (24h)</CardDescription>
            <CardTitle className="text-3xl">{totalSkips}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando...</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([group, items]) => (
            <GroupCard key={group} group={group} items={items} skipsByModule={skipsByModule} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlatformResourceUsage() {
  return (
    <PlatformAdminGate fallback={<PlatformAccessDenied />}>
      <PlatformResourceUsageInner />
    </PlatformAdminGate>
  );
}
