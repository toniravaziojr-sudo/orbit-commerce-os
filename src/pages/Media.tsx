import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Image, Link, Facebook, Instagram, Youtube } from "lucide-react";
import { CampaignsList } from "@/components/media/CampaignsList";
import { useYouTubeConnection } from "@/hooks/useYouTubeConnection";
import { usePlatformOperator } from "@/hooks/usePlatformOperator";
import { useAdminModeSafe } from "@/contexts/AdminModeContext";

export default function Media() {
  const { isConnected: youtubeConnected } = useYouTubeConnection();
  const { isPlatformOperator } = usePlatformOperator();
  const { isStoreMode } = useAdminModeSafe();
  
  // YouTube is only visible for platform operators in store mode (following rollout protocol)
  const showYouTube = isPlatformOperator && isStoreMode;

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Gestor de Mídias IA"
        description="Crie campanhas de conteúdo para Facebook, Instagram e YouTube com calendário editorial gerado por IA"
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
        {showYouTube && (
          <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${
            youtubeConnected 
              ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400" 
              : "bg-muted text-muted-foreground"
          }`}>
            <Youtube className="h-3.5 w-3.5" />
            YouTube
            {!youtubeConnected && <span className="text-xs ml-1">(conectar)</span>}
          </div>
        )}
      </div>

      <Tabs defaultValue="campaigns" className="space-y-6">
        <TabsList>
          <TabsTrigger value="campaigns" className="gap-2">
            <Calendar className="h-4 w-4" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="library" className="gap-2" disabled>
            <Image className="h-4 w-4" />
            Biblioteca
          </TabsTrigger>
          <TabsTrigger value="connections" className="gap-2" disabled>
            <Link className="h-4 w-4" />
            Conexões
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <CampaignsList />
        </TabsContent>

        <TabsContent value="library">
          <div className="text-center py-12 text-muted-foreground">
            <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Biblioteca de Mídias</h3>
            <p>Em breve você poderá gerenciar todos os seus assets aqui.</p>
          </div>
        </TabsContent>

        <TabsContent value="connections">
          <div className="text-center py-12 text-muted-foreground">
            <Link className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Conexões com Redes Sociais</h3>
            <p>Em breve você poderá conectar suas redes para publicação automática.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
