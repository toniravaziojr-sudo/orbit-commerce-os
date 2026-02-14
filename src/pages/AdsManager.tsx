import { useState, useMemo } from "react";
import { 
  BarChart3, RefreshCw, Plus, Target, Users, Image, 
  TrendingUp, MousePointer, Eye, DollarSign, Megaphone,
  Play, Pause, Archive
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMetaAds, type MetaAdCampaign } from "@/hooks/useMetaAds";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatNumber(n: number) {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function CampaignStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    ACTIVE: { label: "Ativa", variant: "default" },
    PAUSED: { label: "Pausada", variant: "secondary" },
    ARCHIVED: { label: "Arquivada", variant: "outline" },
    DELETED: { label: "Deletada", variant: "destructive" },
  };
  const info = map[status] || { label: status, variant: "outline" as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

// ============ Summary Cards ============
function SummaryCards({ campaigns, insights }: { campaigns: any[]; insights: any[] }) {
  const summary = useMemo(() => {
    return insights.reduce(
      (acc, row) => ({
        impressions: acc.impressions + (row.impressions || 0),
        clicks: acc.clicks + (row.clicks || 0),
        spend_cents: acc.spend_cents + (row.spend_cents || 0),
        reach: acc.reach + (row.reach || 0),
        conversions: acc.conversions + (row.conversions || 0),
      }),
      { impressions: 0, clicks: 0, spend_cents: 0, reach: 0, conversions: 0 }
    );
  }, [insights]);

  const ctr = summary.impressions > 0 ? (summary.clicks / summary.impressions) * 100 : 0;
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;

  const cards = [
    { title: "Campanhas Ativas", value: String(activeCampaigns), icon: Megaphone, description: `${campaigns.length} total` },
    { title: "Investimento", value: formatCurrency(summary.spend_cents), icon: DollarSign, description: "Período selecionado" },
    { title: "Impressões", value: formatNumber(summary.impressions), icon: Eye, description: `Alcance: ${formatNumber(summary.reach)}` },
    { title: "Cliques", value: formatNumber(summary.clicks), icon: MousePointer, description: `CTR: ${ctr.toFixed(2)}%` },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============ Campaigns Table ============
function CampaignsTable({ 
  campaigns, 
  isLoading, 
  onUpdate 
}: { 
  campaigns: MetaAdCampaign[]; 
  isLoading: boolean;
  onUpdate: (id: string, status: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="Nenhuma campanha"
        description="Sincronize suas campanhas da Meta ou crie uma nova"
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Campanha</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Objetivo</TableHead>
          <TableHead className="text-right">Orçamento Diário</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {campaigns.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium">{c.name}</TableCell>
            <TableCell><CampaignStatusBadge status={c.status} /></TableCell>
            <TableCell className="capitalize">{c.objective?.replace(/_/g, " ").toLowerCase() || "—"}</TableCell>
            <TableCell className="text-right">
              {c.daily_budget_cents ? formatCurrency(c.daily_budget_cents) : "—"}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                {c.status === "ACTIVE" ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onUpdate(c.meta_campaign_id, "PAUSED")}
                    title="Pausar"
                  >
                    <Pause className="h-4 w-4" />
                  </Button>
                ) : c.status === "PAUSED" ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onUpdate(c.meta_campaign_id, "ACTIVE")}
                    title="Ativar"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ============ Insights Table ============
function InsightsTable({ insights, isLoading }: { insights: any[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="Sem métricas"
        description="Sincronize os insights das suas campanhas"
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Campanha</TableHead>
          <TableHead>Período</TableHead>
          <TableHead className="text-right">Impressões</TableHead>
          <TableHead className="text-right">Cliques</TableHead>
          <TableHead className="text-right">CTR</TableHead>
          <TableHead className="text-right">Investimento</TableHead>
          <TableHead className="text-right">Conversões</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {insights.map((i) => (
          <TableRow key={i.id}>
            <TableCell className="font-medium">
              {i.meta_ad_campaigns?.name || i.meta_campaign_id}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {i.date_start} — {i.date_stop}
            </TableCell>
            <TableCell className="text-right">{formatNumber(i.impressions)}</TableCell>
            <TableCell className="text-right">{formatNumber(i.clicks)}</TableCell>
            <TableCell className="text-right">{Number(i.ctr).toFixed(2)}%</TableCell>
            <TableCell className="text-right">{formatCurrency(i.spend_cents)}</TableCell>
            <TableCell className="text-right">{formatNumber(i.conversions)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ============ Audiences List ============
function AudiencesList({ audiences, isLoading }: { audiences: any[]; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (audiences.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nenhum público"
        description="Sincronize seus públicos da Meta Ads"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {audiences.map((a) => (
        <Card key={a.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{a.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">{a.audience_type}</Badge>
              {a.approximate_count && (
                <span>{formatNumber(a.approximate_count)} pessoas</span>
              )}
            </div>
            {a.description && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{a.description}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============ Creatives List ============
function CreativesList({ creatives, isLoading }: { creatives: any[]; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (creatives.length === 0) {
    return (
      <EmptyState
        icon={Image}
        title="Nenhum criativo"
        description="Sincronize seus criativos da Meta Ads"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {creatives.map((c) => (
        <Card key={c.id}>
          <CardContent className="pt-4">
            {c.image_url && (
              <img
                src={c.image_url}
                alt={c.name}
                className="w-full h-32 object-cover rounded-md mb-3"
              />
            )}
            <h4 className="font-medium text-sm truncate">{c.name}</h4>
            {c.title && <p className="text-xs text-muted-foreground mt-1">{c.title}</p>}
            {c.call_to_action_type && (
              <Badge variant="outline" className="mt-2 text-xs">
                {c.call_to_action_type.replace(/_/g, " ")}
              </Badge>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============ MAIN PAGE ============
export default function AdsManager() {
  const {
    campaigns, campaignsLoading,
    insights, insightsLoading,
    audiences, audiencesLoading,
    creatives, creativesLoading,
    syncAll, updateCampaign,
  } = useMetaAds();

  const [activeTab, setActiveTab] = useState("overview");
  const isSyncing = syncAll.isPending;

  const handleToggleStatus = (metaCampaignId: string, newStatus: string) => {
    updateCampaign.mutate({ meta_campaign_id: metaCampaignId, status: newStatus });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Gestor de Tráfego"
        description="Gerencie campanhas, métricas e públicos do Meta Ads"
        actions={
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => syncAll.mutate()}
            disabled={isSyncing}
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Sincronizando..." : "Sincronizar"}
          </Button>
        }
      />

      <SummaryCards campaigns={campaigns} insights={insights} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-2">
            <Megaphone className="h-4 w-4" />
            Campanhas
            {campaigns.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                {campaigns.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="audiences" className="gap-2">
            <Users className="h-4 w-4" />
            Públicos
          </TabsTrigger>
          <TabsTrigger value="creatives" className="gap-2">
            <Image className="h-4 w-4" />
            Criativos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Métricas por Campanha</CardTitle>
            </CardHeader>
            <CardContent>
              <InsightsTable insights={insights} isLoading={insightsLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns">
          <Card>
            <CardHeader>
              <CardTitle>Campanhas Meta Ads</CardTitle>
            </CardHeader>
            <CardContent>
              <CampaignsTable
                campaigns={campaigns}
                isLoading={campaignsLoading}
                onUpdate={handleToggleStatus}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audiences">
          <AudiencesList audiences={audiences} isLoading={audiencesLoading} />
        </TabsContent>

        <TabsContent value="creatives">
          <CreativesList creatives={creatives} isLoading={creativesLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
