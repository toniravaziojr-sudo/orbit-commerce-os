import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle } from "lucide-react";
import { WhatsAppZapiPlatformSettings } from "./WhatsAppZapiPlatformSettings";
import { WhatsAppMetaPlatformSettings } from "./WhatsAppMetaPlatformSettings";

/**
 * Platform admin settings for WhatsApp integrations.
 * Shows tabs for Meta Oficial (primary) and Z-API (legacy) configuration.
 */
export function WhatsAppPlatformSettings() {
  const [activeTab, setActiveTab] = useState("meta");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-green-600" />
        <h3 className="text-lg font-semibold">WhatsApp - Configuração do Integrador</h3>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="meta">Meta Oficial</TabsTrigger>
          <TabsTrigger value="zapi">Z-API (Legado)</TabsTrigger>
        </TabsList>

        <TabsContent value="meta" className="mt-4">
          <WhatsAppMetaPlatformSettings />
        </TabsContent>

        <TabsContent value="zapi" className="mt-4">
          <WhatsAppZapiPlatformSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
