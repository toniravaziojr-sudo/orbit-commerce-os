import { useState } from "react";
import { Play, Pause, Megaphone, RefreshCw, Loader2, Filter } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
  isConnected?: boolean;
  onSync?: () => void;
  isSyncing?: boolean;
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

type StatusFilter = "all" | "active" | "paused";

function matchesStatusFilter(status: string, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "active") return status === "ACTIVE" || status === "ENABLE";
  if (filter === "paused") return status === "PAUSED" || status === "DISABLE" || status === "ARCHIVED";
  return true;
}

export function AdsCampaignsTab({ campaigns, isLoading, channel, onUpdateCampaign, selectedAccountIds, adAccounts, isConnected, onSync, isSyncing }: AdsCampaignsTabProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Filter campaigns by selected accounts
  const accountFiltered = selectedAccountIds && selectedAccountIds.length > 0
    ? campaigns.filter(c => selectedAccountIds.includes(getAccountId(c)))
    : campaigns;

  // Apply status filter
  const filteredCampaigns = accountFiltered.filter(c => matchesStatusFilter(c.status, statusFilter));

  // Count by status for badges
  const activeCount = accountFiltered.filter(c => c.status === "ACTIVE" || c.status === "ENABLE").length;
  const pausedCount = accountFiltered.filter(c => c.status === "PAUSED" || c.status === "DISABLE" || c.status === "ARCHIVED").length;

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

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleToggleStatus = (campaignId: string, currentStatus: string) => {
    setUpdatingId(campaignId);
    const newStatus = (currentStatus === "ACTIVE" || currentStatus === "ENABLE") ? "PAUSED" : "ACTIVE";
    onUpdateCampaign(campaignId, newStatus);
    // Reset after a delay (mutation will refresh data)
    setTimeout(() => setUpdatingId(null), 3000);
  };

  const renderCampaignRow = (c: any) => {
    const name = c.name;
    const status = c.status;
    const objective = c.objective || c.advertising_channel_type || c.objective_type || "—";
    const budget = c.daily_budget_cents || c.budget_amount_micros ? Math.round((c.budget_amount_micros || 0) / 10000) : c.budget_cents || 0;
    const campaignId = c.meta_campaign_id || c.google_campaign_id || c.tiktok_campaign_id;
    const isUpdating = updatingId === campaignId;

    return (
      <TableRow key={c.id}>
        <TableCell className="font-medium max-w-[280px] truncate">{name}</TableCell>
        <TableCell><StatusBadge status={status} /></TableCell>
        <TableCell className="capitalize text-sm text-muted-foreground">{objective?.replace(/_/g, " ").toLowerCase()}</TableCell>
        <TableCell className="text-right tabular-nums">{budget ? formatCurrency(budget) : "—"}</TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            {isUpdating ? (
              <Button size="icon" variant="ghost" disabled>
                <Loader2 className="h-4 w-4 animate-spin" />
              </Button>
            ) : (status === "ACTIVE" || status === "ENABLE") ? (
              <Button size="icon" variant="ghost" onClick={() => handleToggleStatus(campaignId, status)} title="Pausar campanha">
                <Pause className="h-4 w-4" />
              </Button>
            ) : (status === "PAUSED" || status === "DISABLE") ? (
              <Button size="icon" variant="ghost" onClick={() => handleToggleStatus(campaignId, status)} title="Ativar campanha">
                <Play className="h-4 w-4" />
              </Button>
            ) : null}
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

  const hasAnyCampaigns = accountFiltered.length > 0;

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
      ) : !hasAnyCampaigns ? (
        <EmptyState
          icon={Megaphone}
          title={isConnected ? "Nenhuma campanha sincronizada" : "Nenhuma campanha"}
          description={isConnected
            ? "Clique em sincronizar para importar as campanhas das contas selecionadas"
            : "Conecte sua conta e a IA sincronizará suas campanhas automaticamente"
          }
          action={isConnected && onSync ? {
            label: isSyncing ? "Sincronizando..." : "Sincronizar campanhas",
            onClick: onSync,
          } : undefined}
        />
      ) : (
        <>
          {/* Toolbar: filters + sync */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <ToggleGroup type="single" value={statusFilter} onValueChange={(v) => v && setStatusFilter(v as StatusFilter)} size="sm">
                <ToggleGroupItem value="all" className="text-xs gap-1.5">
                  Todas
                  <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">{accountFiltered.length}</Badge>
                </ToggleGroupItem>
                <ToggleGroupItem value="active" className="text-xs gap-1.5">
                  Ativas
                  <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">{activeCount}</Badge>
                </ToggleGroupItem>
                <ToggleGroupItem value="paused" className="text-xs gap-1.5">
                  Pausadas
                  <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">{pausedCount}</Badge>
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {isConnected && onSync && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSync}
                disabled={isSyncing}
                className="gap-2"
              >
                {isSyncing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Sincronizar
              </Button>
            )}
          </div>

          {filteredCampaigns.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhuma campanha {statusFilter === "active" ? "ativa" : "pausada"} encontrada
            </div>
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
        </>
      )}
    </div>
  );
}
