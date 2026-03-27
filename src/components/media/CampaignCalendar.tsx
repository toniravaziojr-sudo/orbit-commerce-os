import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useMediaCampaigns } from "@/hooks/useMediaCampaigns";
import { CampaignTabs } from "./CampaignTabs";

export function CampaignCalendar() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { campaigns } = useMediaCampaigns();

  const campaign = campaigns?.find((c) => c.id === campaignId);

  if (!campaign) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Campanha não encontrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={campaign.name}
        description={campaign.prompt}
        actions={
          <Button variant="outline" onClick={() => navigate(campaign?.target_channel === "blog" ? "/blog/campaigns" : "/media")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        }
      />

      <CampaignTabs campaignId={campaignId!} campaign={campaign} />
    </div>
  );
}
