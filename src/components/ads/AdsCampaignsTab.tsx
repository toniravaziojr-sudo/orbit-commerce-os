import { Play, Pause, Megaphone } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AdsChannelRoasConfig } from "@/components/ads/AdsChannelRoasConfig";
import type { AutopilotConfig } from "@/hooks/useAdsAutopilot";

interface AdsCampaignsTabProps {
  campaigns: any[];
  isLoading: boolean;
  channel: string;
  channelConfig: AutopilotConfig | null;
  onToggleChannel: (channel: string, enabled: boolean) => void;
  onUpdateCampaign: (id: string, status: string) => void;
  onSaveChannelConfig: (config: Partial<AutopilotConfig> & { channel: string }) => void;
  isSavingConfig: boolean;
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

export function AdsCampaignsTab({ campaigns, isLoading, channel, channelConfig, onToggleChannel, onUpdateCampaign, onSaveChannelConfig, isSavingConfig }: AdsCampaignsTabProps) {
  const isChannelEnabled = channelConfig?.is_enabled || false;

  return (
    <div className="space-y-4">
      {/* Channel AI toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium">IA ativa neste canal</Label>
          {isChannelEnabled && (
            <Badge variant="default" className="text-xs">IA Ativa</Badge>
          )}
        </div>
        <Switch
          checked={isChannelEnabled}
          onCheckedChange={(checked) => onToggleChannel(channel, checked)}
        />
      </div>

      {/* Per-channel ROAS targets */}
      <AdsChannelRoasConfig
        channel={channel}
        channelConfig={channelConfig}
        onSave={onSaveChannelConfig}
        isSaving={isSavingConfig}
      />

      {/* Campaigns table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nenhuma campanha"
          description="Sincronize suas campanhas ou crie uma nova"
        />
      ) : (
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
            {campaigns.map(c => {
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
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
