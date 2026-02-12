import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, Facebook, Instagram, Youtube, Send, Lightbulb, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CampaignsList } from "@/components/media/CampaignsList";
import { useYouTubeConnection } from "@/hooks/useYouTubeConnection";
import { usePlatformOperator } from "@/hooks/usePlatformOperator";
import { useAdminModeSafe } from "@/contexts/AdminModeContext";

export default function Media() {
  const { isConnected: youtubeConnected } = useYouTubeConnection();
  const { isPlatformOperator } = usePlatformOperator();
  const { isStoreMode } = useAdminModeSafe();
  
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

      <Tabs defaultValue="strategy" className="space-y-6">
        <TabsList>
          <TabsTrigger value="strategy" className="gap-2">
            <Lightbulb className="h-4 w-4" />
            Estratégia
          </TabsTrigger>
          <TabsTrigger value="publish" className="gap-2">
            <Send className="h-4 w-4" />
            Publicar
          </TabsTrigger>
          <TabsTrigger value="connections" className="gap-2" disabled>
            <Link className="h-4 w-4" />
            Conexões
          </TabsTrigger>
        </TabsList>

        {/* 1. Estratégia */}
        <TabsContent value="strategy">
          <CampaignsList />
        </TabsContent>

        {/* 2. Copys & Prompts */}
        <TabsContent value="copys">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Copys & Prompts
              </CardTitle>
              <CardDescription>
                Gere textos de legendas, CTAs, hashtags e prompts para criação de imagens e vídeos com IA
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Gerador de Copys com IA</h3>
                <p className="mb-1">Gere legendas, CTAs e prompts de imagem automaticamente.</p>
                <p className="text-xs">Selecione uma campanha na aba "Estratégia" e clique em "Gerar Sugestões" para começar.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. Publicar */}
        <TabsContent value="publish">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Send className="h-5 w-5" />
                Publicar nas Redes
              </CardTitle>
              <CardDescription>
                Agende e publique seus criativos diretamente no Facebook, Instagram e YouTube
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Publicação Automática</h3>
                <p className="mb-1">Após gerar seus criativos, agende a publicação aqui.</p>
                <p className="text-xs">Conecte suas redes sociais na aba "Conexões" para ativar.</p>
              </div>
            </CardContent>
          </Card>
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
