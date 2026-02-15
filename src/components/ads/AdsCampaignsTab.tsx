import { Play, Pause, Megaphone } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

interface AdAccount {
  id: string;
  name: string;
}

interface AdsCampaignsTabProps {
  campaigns: any[];
  isLoading: boolean;
  channel: string;
  onUpdateCampaign: (id: string, status: string) => void;
  selectedAccountIds?: string[];
  adAccounts?: AdAccount[];
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    ACTIVE: { label: "Ativa", variant: "default" },
    PAUSED: { label: "Pausada", variant: "secondary" },
    ARCHIVED: { label: "Arquivada", variant: "outline" },
    DELETED: { label: "Deletada", variant: "destructive" },
    ENABLE: { label: "Ativa", variant: "default" },
    DISABLE: { label: "Inativa", variant: "secondary" },
  };
  const info = map[status] || { label: status, variant: "outline" as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

function getAccountId(campaign: any): string {
  return campaign.ad_account_id || campaign.advertiser_id || campaign.customer_id || "unknown";
}

export function AdsCampaignsTab({ campaigns, isLoading, channel, onUpdateCampaign, selectedAccountIds, adAccounts }: AdsCampaignsTabProps) {
  // Filter campaigns by selected accounts
  const filteredCampaigns = selectedAccountIds && selectedAccountIds.length > 0
    ? campaigns.filter(c => selectedAccountIds.includes(getAccountId(c)))
    : campaigns;

  // Group campaigns by account
  const groupByAccount = adAccounts && adAccounts.length > 1 && selectedAccountIds && selectedAccountIds.length > 1;

  const groupedCampaigns = groupByAccount
    ? selectedAccountIds!.reduce((acc, accountId) => {
        const accountCampaigns = filteredCampaigns.filter(c => getAccountId(c) === accountId);
        if (accountCampaigns.length > 0) {
          acc.push({
            accountId,
            accountName: adAccounts!.find(a => a.id === accountId)?.name || accountId,
            campaigns: accountCampaigns,
          });
        }
        return acc;
      }, [] as Array<{ accountId: string; accountName: string; campaigns: any[] }>)
    : null;

  const renderCampaignRow = (c: any) => {
    const name = c.name;
    const status = c.status;
    const objective = c.objective || c.advertising_channel_type || c.objective_type || "—";
    const budget = c.daily_budget_cents || c.budget_amount_micros ? Math.round((c.budget_amount_micros || 0) / 10000) : c.budget_cents || 0;
    const campaignId = c.meta_campaign_id || c.google_campaign_id || c.tiktok_campaign_id;

    return (
      <TableRow key={c.id}>
        <TableCell className="font-medium">{name}</TableCell>
        <TableCell><StatusBadge status={status} /></TableCell>
        <TableCell className="capitalize text-sm">{objective?.replace(/_/g, " ").toLowerCase()}</TableCell>
        <TableCell className="text-right">{budget ? formatCurrency(budget) : "—"}</TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            {(status === "ACTIVE" || status === "ENABLE") && (
              <Button size="icon" variant="ghost" onClick={() => onUpdateCampaign(campaignId, "PAUSED")} title="Pausar">
                <Pause className="h-4 w-4" />
              </Button>
            )}
            {(status === "PAUSED" || status === "DISABLE") && (
              <Button size="icon" variant="ghost" onClick={() => onUpdateCampaign(campaignId, "ACTIVE")} title="Ativar">
                <Play className="h-4 w-4" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const renderTable = (campaignsList: any[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Campanha</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Objetivo</TableHead>
          <TableHead className="text-right">Orçamento</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {campaignsList.map(renderCampaignRow)}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : selectedAccountIds && selectedAccountIds.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nenhuma conta selecionada"
          description="Selecione ao menos uma conta de anúncio acima para ver as campanhas"
        />
      ) : filteredCampaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nenhuma campanha"
          description="Conecte sua conta e a IA sincronizará suas campanhas automaticamente"
        />
      ) : groupedCampaigns ? (
        groupedCampaigns.map(group => (
          <div key={group.accountId} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-semibold">
                {group.accountName}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {group.campaigns.length} campanha{group.campaigns.length !== 1 ? "s" : ""}
              </span>
            </div>
            {renderTable(group.campaigns)}
          </div>
        ))
      ) : (
        renderTable(filteredCampaigns)
      )}
    </div>
  );
}
