import { MessageCircle } from "lucide-react";
import { WhatsAppMetaSettings } from "./WhatsAppMetaSettings";
import { WhatsAppActivationGuide } from "./meta/WhatsAppActivationGuide";

/**
 * WhatsApp settings container for tenants.
 * Uses Meta WhatsApp Cloud API as the sole provider.
 *
 * Renders, em ordem:
 *  1. Guia visual de ativação (4 passos didáticos com porquê + links).
 *  2. Card oficial de conexão / status / testes.
 */
export function WhatsAppProviderTabs() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-green-600" />
        <h3 className="text-lg font-semibold">WhatsApp</h3>
      </div>

      <WhatsAppActivationGuide variant="full" />

      <WhatsAppMetaSettings />
    </div>
  );
}