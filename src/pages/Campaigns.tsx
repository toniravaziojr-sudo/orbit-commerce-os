import { Megaphone, Plus, Target, Users, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Campaigns() {
  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Campanhas"
        description="IA Estrategista para pesquisa, estruturação e planejamento de campanhas"
        actions={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Campanha
          </Button>
        }
      />

      <Tabs defaultValue="campaigns" className="space-y-6">
        <TabsList>
          <TabsTrigger value="campaigns" className="gap-2">
            <Megaphone className="h-4 w-4" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="personas" className="gap-2">
            <Users className="h-4 w-4" />
            Personas
          </TabsTrigger>
          <TabsTrigger value="angles" className="gap-2">
            <Target className="h-4 w-4" />
            Ângulos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Suas Campanhas</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={Megaphone}
                title="Nenhuma campanha criada"
                description="Use a IA para pesquisar e estruturar campanhas completas para Meta, Google, TikTok com personas, copies e criativos sugeridos."
                action={{
                  label: "Criar com IA",
                  onClick: () => {},
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="personas">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Personas</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={Users}
                title="Defina suas personas"
                description="A IA ajuda a criar personas detalhadas com dores, desejos, objeções e linguagem para segmentação precisa."
                action={{
                  label: "Criar Persona",
                  onClick: () => {},
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="angles">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Ângulos de Copy</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={Target}
                title="Explore ângulos de venda"
                description="Descubra diferentes ângulos e gatilhos para suas campanhas: urgência, prova social, autoridade, etc."
                action={{
                  label: "Gerar Ângulos",
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
