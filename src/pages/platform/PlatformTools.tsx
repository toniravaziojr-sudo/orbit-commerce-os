import { PageHeader } from "@/components/ui/page-header";
import { GoogleMapsToFacebookConverter } from "@/components/tools/GoogleMapsToFacebookConverter";
import { StorageExporter } from "@/components/tools/StorageExporter";
import { DatabaseExporter } from "@/components/tools/DatabaseExporter";
import { DatabaseImporter } from "@/components/tools/DatabaseImporter";
import { StorageImporter } from "@/components/tools/StorageImporter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PlatformTools() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Ferramentas da Plataforma"
        description="Utilitários exclusivos para administração da plataforma"
      />

      <Tabs defaultValue="export" className="w-full">
        <TabsList>
          <TabsTrigger value="export">📤 Exportar</TabsTrigger>
          <TabsTrigger value="import">📥 Importar</TabsTrigger>
          <TabsTrigger value="tools">🔧 Outras</TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="space-y-6 mt-4">
          <DatabaseExporter />
          <StorageExporter />
        </TabsContent>

        <TabsContent value="import" className="space-y-6 mt-4">
          <DatabaseImporter />
          <StorageImporter />
        </TabsContent>

        <TabsContent value="tools" className="space-y-6 mt-4">
          <GoogleMapsToFacebookConverter />
        </TabsContent>
      </Tabs>
    </div>
  );
}