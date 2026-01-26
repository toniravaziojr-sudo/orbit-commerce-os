import { useMeliConnection } from "@/hooks/useMeliConnection";
import { useShopeeConnection } from "@/hooks/useShopeeConnection";
import { useOlistConnection } from "@/hooks/useOlistConnection";
import { useLateConnection } from "@/hooks/useLateConnection";
import { useFiscalSettings } from "@/hooks/useFiscal";
import { usePaymentProviders } from "@/hooks/usePaymentProviders";

export type IntegrationType = 
  | "mercadolivre" 
  | "shopee"
  | "olist"
  | "whatsapp" 
  | "redes_sociais" 
  | "fiscal" 
  | "pagamentos"
  | "transportadoras";

export interface IntegrationInfo {
  name: string;
  isConfigured: boolean;
  isConnected: boolean;
  isLoading: boolean;
  redirectPath: string;
  buttonText: string;
}

/**
 * Hook centralizado para verificar status de todas as integrações.
 * Usado pelos módulos para mostrar avisos quando integração é necessária.
 */
export function useIntegrationStatus() {
  // Mercado Livre
  const { 
    platformConfigured: meliPlatformConfigured, 
    isConnected: meliConnected, 
    isLoading: meliLoading 
  } = useMeliConnection();

  // Shopee
  const {
    platformConfigured: shopeePlatformConfigured,
    isConnected: shopeeConnected,
    isLoading: shopeeLoading
  } = useShopeeConnection();

  // Olist
  const {
    platformConfigured: olistPlatformConfigured,
    isConnected: olistConnected,
    isLoading: olistLoading
  } = useOlistConnection();

  // Redes Sociais (Late)
  const { isConnected: lateConnected, isLoading: lateLoading } = useLateConnection();

  // Fiscal
  const { settings: fiscalSettings, isLoading: fiscalLoading } = useFiscalSettings();
  const fiscalConfigured = !!fiscalSettings?.is_configured && !!fiscalSettings?.cnpj;
  const fiscalHasCertificate = !!fiscalSettings?.certificado_valido_ate;

  // Pagamentos
  const { providers, isLoading: paymentsLoading } = usePaymentProviders();
  const hasActivePayment = providers.some(p => p.is_enabled);

  const integrations: Record<IntegrationType, IntegrationInfo> = {
    mercadolivre: {
      name: "Mercado Livre",
      isConfigured: meliPlatformConfigured,
      isConnected: meliConnected,
      isLoading: meliLoading,
      redirectPath: "/marketplaces",
      buttonText: "Conectar Mercado Livre",
    },
    shopee: {
      name: "Shopee",
      isConfigured: shopeePlatformConfigured,
      isConnected: shopeeConnected,
      isLoading: shopeeLoading,
      redirectPath: "/marketplaces",
      buttonText: "Conectar Shopee",
    },
    olist: {
      name: "Olist",
      isConfigured: olistPlatformConfigured,
      isConnected: olistConnected,
      isLoading: olistLoading,
      redirectPath: "/marketplaces/olist",
      buttonText: "Conectar Olist",
    },
    whatsapp: {
      name: "WhatsApp",
      isConfigured: true, // WhatsApp tem múltiplos providers, sempre "configurável"
      isConnected: false, // TODO: Implementar verificação real
      isLoading: false,
      redirectPath: "/integrations",
      buttonText: "Configurar WhatsApp",
    },
    redes_sociais: {
      name: "Redes Sociais",
      isConfigured: true,
      isConnected: lateConnected,
      isLoading: lateLoading,
      redirectPath: "/integrations",
      buttonText: "Conectar Redes Sociais",
    },
    fiscal: {
      name: "Nota Fiscal (NFe)",
      isConfigured: fiscalConfigured,
      isConnected: fiscalHasCertificate,
      isLoading: fiscalLoading,
      redirectPath: "/fiscal?tab=configuracoes",
      buttonText: "Configurar NFe",
    },
    pagamentos: {
      name: "Meios de Pagamento",
      isConfigured: true,
      isConnected: hasActivePayment,
      isLoading: paymentsLoading,
      redirectPath: "/integrations",
      buttonText: "Configurar Pagamentos",
    },
    transportadoras: {
      name: "Transportadoras",
      isConfigured: true,
      isConnected: false, // TODO: Implementar verificação real
      isLoading: false,
      redirectPath: "/shipping?tab=settings",
      buttonText: "Configurar Transportadoras",
    },
  };

  const getIntegration = (type: IntegrationType): IntegrationInfo => {
    return integrations[type];
  };

  const isIntegrationReady = (type: IntegrationType): boolean => {
    const info = integrations[type];
    return info.isConfigured && info.isConnected;
  };

  const needsIntegration = (type: IntegrationType): boolean => {
    const info = integrations[type];
    return !info.isConnected;
  };

  return {
    integrations,
    getIntegration,
    isIntegrationReady,
    needsIntegration,
    // Quick access
    isMeliConnected: meliConnected,
    isShopeeConnected: shopeeConnected,
    isOlistConnected: olistConnected,
    isLateConnected: lateConnected,
    isFiscalConfigured: fiscalConfigured && fiscalHasCertificate,
    hasActivePayment,
  };
}
