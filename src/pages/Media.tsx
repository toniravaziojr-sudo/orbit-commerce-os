import { Image, Plus, Calendar, Sparkles, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Media() {
  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Mídias"
        description="Biblioteca de criativos, geração com IA e agendamento de posts"
        actions={
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Gerar com IA
            </Button>
            <Button className="gap-2">
              <Upload className="h-4 w-4" />
              Fazer Upload
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="library" className="space-y-6">
        <TabsList>
          <TabsTrigger value="library" className="gap-2">
            <Image className="h-4 w-4" />
            Biblioteca
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-2">
            <Calendar className="h-4 w-4" />
            Agenda
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Sparkles className="h-4 w-4" />
            IA Criativa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Criativos</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={Image}
                title="Biblioteca vazia"
                description="Faça upload de imagens e vídeos para usar em campanhas, posts e comunicações com clientes."
                action={{
                  label: "Fazer Upload",
                  onClick: () => {},
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Agenda de Posts</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={Calendar}
                title="Nenhum post agendado"
                description="Agende posts para suas redes sociais com fluxo: rascunho → aprovado → agendado → publicado."
                action={{
                  label: "Agendar Post",
                  onClick: () => {},
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Geração com IA</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={Sparkles}
                title="Crie com inteligência artificial"
                description="Gere imagens realistas para seus produtos e campanhas usando IA generativa."
                action={{
                  label: "Gerar Imagem",
                  onClick: () => {},
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
