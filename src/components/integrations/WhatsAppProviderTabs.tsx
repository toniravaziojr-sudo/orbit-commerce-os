import { MessageCircle } from "lucide-react";
import { WhatsAppMetaSettings } from "./WhatsAppMetaSettings";
import { WhatsAppActivationGuide } from "./meta/WhatsAppActivationGuide";
import { WhatsAppChannelStatusCard } from "./meta/WhatsAppChannelStatusCard";

/**
 * WhatsApp settings container for tenants.
 * Uses Meta WhatsApp Cloud API as the sole provider.
 *
 * Renders, em ordem:
 *  1. Card de status v2 (3 sinais separados + Validar agora + abrir wizard cross-business)
 *  2. Guia visual de ativação (4 passos didáticos com porquê + links)
 *  3. Card oficial de conexão / status técnico / testes
 */
export function WhatsAppProviderTabs() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-green-600" />
        <h3 className="text-lg font-semibold">WhatsApp</h3>
      </div>

      <WhatsAppChannelStatusCard />

      <WhatsAppActivationGuide variant="full" />

      <WhatsAppMetaSettings />
    </div>
  );
}
