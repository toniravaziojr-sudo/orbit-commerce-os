import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle } from "lucide-react";
import { useTenantContext } from "@/contexts/TenantContext";
import { isRespeiteOHomemTenant } from "@/config/tenant-anchors";
import { WhatsAppSettings } from "./WhatsAppSettings";
import { WhatsAppMetaSettings } from "./WhatsAppMetaSettings";

/**
 * Provider-agnostic container that shows tabs for each WhatsApp provider.
 * 
 * Visibility rules:
 * - Z-API tab: Only visible for tenant respeiteohomem@gmail.com
 * - Meta Oficial tab: Visible for ALL customers (including respeiteohomem)
 */
export function WhatsAppProviderTabs() {
  const { currentTenant } = useTenantContext();
  const tenantId = currentTenant?.id;
  
  // Check if this is the special tenant that uses Z-API
  const showZapiTab = isRespeiteOHomemTenant(tenantId);
  
  // Default tab: If Z-API is available, show it first (user is already using it)
  // Otherwise show Meta
  const defaultTab = showZapiTab ? "zapi" : "meta";
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-green-600" />
        <h3 className="text-lg font-semibold">WhatsApp</h3>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full" style={{ gridTemplateColumns: showZapiTab ? "1fr 1fr" : "1fr" }}>
          {showZapiTab && (
            <TabsTrigger value="zapi" className="gap-2">
              <span className="hidden sm:inline">WhatsApp</span> (Z-API)
            </TabsTrigger>
          )}
          <TabsTrigger value="meta" className="gap-2">
            <span className="hidden sm:inline">WhatsApp</span> (Meta Oficial)
          </TabsTrigger>
        </TabsList>

        {showZapiTab && (
          <TabsContent value="zapi" className="mt-4">
            <WhatsAppSettings />
          </TabsContent>
        )}

        <TabsContent value="meta" className="mt-4">
          <WhatsAppMetaSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
