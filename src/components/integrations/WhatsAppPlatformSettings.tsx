import { MessageCircle } from "lucide-react";
import { WhatsAppMetaPlatformSettings } from "./WhatsAppMetaPlatformSettings";

/**
 * Platform admin settings for WhatsApp integrations.
 * Uses Meta WhatsApp Cloud API as the sole provider.
 */
export function WhatsAppPlatformSettings() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-green-600" />
        <h3 className="text-lg font-semibold">WhatsApp - Configuração do Integrador</h3>
      </div>

      <WhatsAppMetaPlatformSettings />
    </div>
  );
}
