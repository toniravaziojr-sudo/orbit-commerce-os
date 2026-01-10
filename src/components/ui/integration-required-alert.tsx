import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Plug, ArrowRight, Loader2 } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { useIntegrationStatus, type IntegrationType } from "@/hooks/useIntegrationStatus";

interface IntegrationRequiredAlertProps {
  /** Nome da integração necessária */
  integrationName: string;
  /** Descrição do que a integração permite fazer */
  description?: string;
  /** Rota para a página de integração */
  integrationPath?: string;
  /** Texto do botão */
  buttonText?: string;
  /** Ícone customizado */
  icon?: LucideIcon;
  /** Variante do alert */
  variant?: "default" | "destructive";
  /** Se deve mostrar borda colorida */
  bordered?: boolean;
}

/**
 * Componente reutilizável para exibir aviso de integração necessária.
 * Usado em módulos que dependem de integrações externas.
 * 
 * @example
 * <IntegrationRequiredAlert 
 *   integrationName="Mercado Livre"
 *   description="para sincronizar pedidos e mensagens"
 *   integrationPath="/marketplaces"
 * />
 */
export function IntegrationRequiredAlert({
  integrationName,
  description,
  integrationPath = "/integrations",
  buttonText,
  icon: Icon = Plug,
  variant = "default",
  bordered = true,
}: IntegrationRequiredAlertProps) {
  return (
    <Alert 
      variant={variant}
      className={bordered ? "border-amber-500/30 bg-amber-50 dark:bg-amber-900/10" : ""}
    >
      <Icon className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-200">
        Integração necessária
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-300">
        <p className="mb-3">
          Você precisa conectar <strong>{integrationName}</strong>
          {description && ` ${description}`}.
        </p>
        <Button 
          asChild 
          variant="outline" 
          size="sm"
          className="border-amber-500/50 hover:bg-amber-100 dark:hover:bg-amber-900/30"
        >
          <Link to={integrationPath}>
            {buttonText || `Ir para ${integrationName}`}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}

interface SmartIntegrationAlertProps {
  /** Tipo da integração para verificar automaticamente */
  integrationType: IntegrationType;
  /** Descrição customizada (opcional) */
  description?: string;
  /** Ícone customizado */
  icon?: LucideIcon;
  /** Mostrar apenas quando não conectado (default: true) */
  showOnlyWhenNeeded?: boolean;
}

/**
 * Componente inteligente que verifica automaticamente o status da integração
 * e só exibe o alerta quando necessário.
 * 
 * @example
 * <SmartIntegrationAlert integrationType="mercadolivre" />
 */
export function SmartIntegrationAlert({
  integrationType,
  description,
  icon,
  showOnlyWhenNeeded = true,
}: SmartIntegrationAlertProps) {
  const { getIntegration, needsIntegration } = useIntegrationStatus();
  const integration = getIntegration(integrationType);

  // Se está carregando, não mostra nada
  if (integration.isLoading) {
    return null;
  }

  // Se já está conectado e showOnlyWhenNeeded=true, não mostra
  if (showOnlyWhenNeeded && !needsIntegration(integrationType)) {
    return null;
  }

  return (
    <IntegrationRequiredAlert
      integrationName={integration.name}
      description={description}
      integrationPath={integration.redirectPath}
      buttonText={integration.buttonText}
      icon={icon}
    />
  );
}
