// =============================================
// B2B EXTRACTOR - Prospecção de Públicos B2B
// Extração de leads via CNPJ/CNAE com compliance LGPD
// =============================================

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Search, Users, Download, Settings, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import B2BSearchTab from "@/components/b2b-extractor/B2BSearchTab";
import B2BAudiencesTab from "@/components/b2b-extractor/B2BAudiencesTab";
import B2BEntitiesTab from "@/components/b2b-extractor/B2BEntitiesTab";
import B2BExportsTab from "@/components/b2b-extractor/B2BExportsTab";
import B2BSettingsTab from "@/components/b2b-extractor/B2BSettingsTab";

export default function B2BExtractor() {
  const [activeTab, setActiveTab] = useState("search");

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Extrator B2B</h1>
            <p className="text-muted-foreground">
              Prospecção de públicos empresariais via CNPJ, CNAE e dados públicos
            </p>
          </div>
        </div>
      </div>

      {/* Compliance Alert */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Compliance & LGPD</AlertTitle>
        <AlertDescription>
          Este módulo utiliza apenas fontes de dados públicas e licenciadas. 
          Certifique-se de obter consentimento antes de enviar comunicações por WhatsApp ou e-mail.
        </AlertDescription>
      </Alert>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Buscar</span>
          </TabsTrigger>
          <TabsTrigger value="entities" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Empresas</span>
          </TabsTrigger>
          <TabsTrigger value="audiences" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Públicos</span>
          </TabsTrigger>
          <TabsTrigger value="exports" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportações</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Config</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search">
          <B2BSearchTab />
        </TabsContent>

        <TabsContent value="entities">
          <B2BEntitiesTab />
        </TabsContent>

        <TabsContent value="audiences">
          <B2BAudiencesTab />
        </TabsContent>

        <TabsContent value="exports">
          <B2BExportsTab />
        </TabsContent>

        <TabsContent value="settings">
          <B2BSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
