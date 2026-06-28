import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Truck, Package, FileText, AlertTriangle, RefreshCcw, ExternalLink, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDateBR } from "@/lib/date-format";
import { toast } from "sonner";

const SOURCE_LABELS: Record<string, string> = {
  mercadolivre: "Mercado Livre",
  shopee: "Shopee",
  tiktok_shop: "TikTok Shop",
  amazon_seller: "Amazon Seller",
  frenet: "Frenet",
  melhor_envio: "Melhor Envio",
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  awaiting_invoice: { label: "Aguardando NF", variant: "outline" },
  ready_to_ship: { label: "Pronto p/ envio", variant: "secondary" },
  label_issued: { label: "Etiqueta emitida", variant: "default" },
  in_transit: { label: "Em trânsito", variant: "default" },
  delivered: { label: "Entregue", variant: "secondary" },
  problem: { label: "Problema", variant: "destructive" },
  returned: { label: "Devolvido", variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "outline" },
};

export default function ExternalShipping() {
  const { currentTenant } = useAuth();
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [syncing, setSyncing] = useState(false);

  const { data: shipments = [], refetch } = useQuery({
    queryKey: ["marketplace_shipments", currentTenant?.id, sourceFilter],
    queryFn: async () => {
      let q = supabase
        .from("marketplace_shipments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (sourceFilter !== "all") q = q.eq("source_key", sourceFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenant?.id,
  });

  const { data: awaitingNf = [] } = useQuery({
    queryKey: ["external_awaiting_nf", currentTenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("meli_invoice_send_queue")
        .select("*")
        .in("status", ["pending", "failed"])
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!currentTenant?.id,
  });

  const kpis = useMemo(() => {
    const total = shipments.length;
    const awaiting = shipments.filter(s => s.status === "awaiting_invoice").length;
    const inTransit = shipments.filter(s => ["ready_to_ship", "in_transit"].includes(s.status)).length;
    const delivered = shipments.filter(s => s.status === "delivered").length;
    const problems = shipments.filter(s => ["problem", "returned"].includes(s.status)).length;
    return { total, awaiting, inTransit, delivered, problems };
  }, [shipments]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("external-shipping-sync-cron", { body: {} });
      if (error) throw error;
      toast.success("Sincronização disparada");
      await refetch();
    } catch (e: any) {
      toast.error("Erro ao sincronizar", { description: e.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleDownloadLabel = async (path: string | null) => {
    if (!path) return;
    if (path.startsWith("http")) { window.open(path, "_blank"); return; }
    const { data } = await supabase.storage.from("marketplace-labels").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="Logística Externa"
        description="Etiquetas de transporte emitidas por marketplaces e gateways (ML, Shopee, Frenet, Melhor Envio)"
        actions={
          <div className="flex gap-2">
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Fonte da etiqueta" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as fontes</SelectItem>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSync} disabled={syncing} variant="outline">
              <RefreshCcw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              Sincronizar agora
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Total" value={kpis.total} icon={Package} />
        <StatCard title="Aguardando NF" value={kpis.awaiting} icon={FileText} />
        <StatCard title="Em trânsito" value={kpis.inTransit} icon={Truck} />
        <StatCard title="Entregues" value={kpis.delivered} icon={Package} />
        <StatCard title="Problemas" value={kpis.problems} icon={AlertTriangle} />
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="objects">Objetos de postagem</TabsTrigger>
          <TabsTrigger value="tracking">Rastreios</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          {awaitingNf.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-orange-600">Aguardando envio da NF ao marketplace ({awaitingNf.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  A NF foi autorizada e está na fila para ser anexada ao pedido no marketplace.
                  O marketplace libera a etiqueta após receber a chave da NF.
                </p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle>Últimos objetos</CardTitle></CardHeader>
            <CardContent>
              <RenderTable rows={shipments.slice(0, 15)} onDownload={handleDownloadLabel} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="objects">
          <Card>
            <CardContent className="pt-6">
              <RenderTable rows={shipments} onDownload={handleDownloadLabel} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tracking">
          <Card>
            <CardContent className="pt-6">
              <RenderTable rows={shipments.filter(s => s.tracking_number)} onDownload={handleDownloadLabel} showTrackingOnly />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RenderTable({ rows, onDownload, showTrackingOnly }: { rows: any[]; onDownload: (p: string | null) => void; showTrackingOnly?: boolean }) {
  if (!rows.length) {
    return <p className="text-center text-muted-foreground py-8">Nenhum objeto registrado ainda.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Pedido</TableHead>
          <TableHead>Fonte</TableHead>
          <TableHead>Transportadora</TableHead>
          <TableHead>Rastreio</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Pratika</TableHead>
          <TableHead>Atualizado</TableHead>
          <TableHead>Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(s => {
          const st = STATUS_LABELS[s.status] || { label: s.status, variant: "outline" as const };
          return (
            <TableRow key={s.id}>
              <TableCell>{s.marketplace_order_id || "—"}</TableCell>
              <TableCell>{SOURCE_LABELS[s.source_key] || s.source_key}</TableCell>
              <TableCell>{s.carrier || "—"}</TableCell>
              <TableCell className="font-mono text-xs">{s.tracking_number || "—"}</TableCell>
              <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
              <TableCell>{s.pratika_sent_at ? <Badge variant="secondary">enviado</Badge> : "—"}</TableCell>
              <TableCell className="text-xs">{formatDateBR(s.updated_at)}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {s.label_pdf_url && (
                    <Button size="sm" variant="ghost" onClick={() => onDownload(s.label_pdf_url)}>
                      <Download className="h-3 w-3" />
                    </Button>
                  )}
                  {s.tracking_url && (
                    <Button size="sm" variant="ghost" onClick={() => window.open(s.tracking_url, "_blank")}>
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
