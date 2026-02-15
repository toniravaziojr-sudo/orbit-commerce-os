import { AlertTriangle, ExternalLink, CheckCircle2, Check, Bot } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface AdAccount {
  id: string;
  name: string;
}

interface AdsChannelIntegrationAlertProps {
  channel: string;
  isConnected: boolean;
  isLoading: boolean;
  adAccounts: AdAccount[];
  selectedAccountIds: string[];
  onToggleAccount: (accountId: string) => void;
  aiEnabledAccountIds: string[];
  onToggleAI: (accountId: string) => void;
}

const CHANNEL_INFO: Record<string, { label: string; integrationPath: string; description: string }> = {
  meta: {
    label: "Meta Ads",
    integrationPath: "/integrations",
    description: "Conecte sua conta Meta (Facebook/Instagram) para que a IA possa gerenciar suas campanhas.",
  },
  google: {
    label: "Google Ads",
    integrationPath: "/integrations",
    description: "Conecte sua conta Google Ads para que a IA possa gerenciar suas campanhas.",
  },
  tiktok: {
    label: "TikTok Ads",
    integrationPath: "/integrations",
    description: "Conecte sua conta TikTok Ads para que a IA possa gerenciar suas campanhas.",
  },
};

export function AdsChannelIntegrationAlert({ channel, isConnected, isLoading, adAccounts, selectedAccountIds, onToggleAccount, aiEnabledAccountIds, onToggleAI }: AdsChannelIntegrationAlertProps) {
  const navigate = useNavigate();
  const info = CHANNEL_INFO[channel] || CHANNEL_INFO.meta;

  if (isLoading) return null;

  if (!isConnected) {
    return (
      <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle className="font-semibold">Integração não conectada</AlertTitle>
        <AlertDescription className="mt-1 space-y-3">
          <p className="text-sm">{info.description}</p>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => navigate(info.integrationPath)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ir para Integrações
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (adAccounts.length > 0) {
    return (
      <Alert className="border-primary/20 bg-primary/5">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <AlertTitle className="font-semibold text-sm">Contas de anúncio conectadas</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="text-xs text-muted-foreground mb-2">
            Selecione as contas para visualizar e clique no ícone <Bot className="h-3 w-3 inline" /> para ativar a IA:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {adAccounts.map((acc) => {
              const isSelected = selectedAccountIds.includes(acc.id);
              const isAI = aiEnabledAccountIds.includes(acc.id);
              return (
                <div key={acc.id} className="flex items-center gap-0">
                  <button
                    onClick={() => onToggleAccount(acc.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-l-md border border-r-0 px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                    {acc.name || acc.id}
                  </button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onToggleAI(acc.id)}
                        className={cn(
                          "inline-flex items-center justify-center rounded-r-md border px-1.5 py-1 transition-colors cursor-pointer h-full",
                          isAI
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Bot className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {isAI ? "IA ativa nesta conta — clique para desativar" : "Clique para ativar a IA nesta conta"}
                    </TooltipContent>
                  </Tooltip>
                </div>
              );
            })}
          </div>
          {selectedAccountIds.length === 0 && (
            <p className="text-xs text-destructive mt-2">
              Selecione ao menos uma conta para visualizar as campanhas.
            </p>
          )}
          {aiEnabledAccountIds.length > 0 && (
            <p className="text-[11px] text-primary/80 mt-2 flex items-center gap-1">
              <Bot className="h-3 w-3" />
              IA ativa em {aiEnabledAccountIds.length} conta{aiEnabledAccountIds.length > 1 ? "s" : ""}
            </p>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
