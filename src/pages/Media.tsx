import { PageHeader } from "@/components/ui/page-header";
import { Facebook, Instagram } from "lucide-react";
import { CampaignsList } from "@/components/media/CampaignsList";

export default function Media() {

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Calendário de Conteúdo"
        description="Crie campanhas de conteúdo para Facebook e Instagram com calendário editorial completo"
      />
      
      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-1 px-3 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-full">
          <Facebook className="h-3.5 w-3.5" />
          Facebook
        </div>
        <div className="flex items-center gap-1 px-3 py-1 bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 rounded-full">
          <Instagram className="h-3.5 w-3.5" />
          Instagram
        </div>
      </div>

      <CampaignsList />
    </div>
  );
}
