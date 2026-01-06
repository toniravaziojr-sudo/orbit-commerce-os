import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Image, Link } from "lucide-react";
import { CampaignsList } from "@/components/media/CampaignsList";

export default function Media() {
  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Gestão de Mídias"
        description="Crie campanhas de conteúdo orgânico e deixe a IA gerar seu calendário editorial"
      />

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
