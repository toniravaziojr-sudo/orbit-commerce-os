import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { usePlatformCostsAlerts } from "@/hooks/usePlatformExternalCosts";
import { usePlatformOperator } from "@/hooks/usePlatformOperator";

/**
 * Banner fixo de alertas de custos externos.
 * Aparece no topo de qualquer rota /platform/* quando há serviço próximo do vencimento.
 * Apenas para platform admins.
 */
export function PlatformCostsAlertBanner() {
  const { isPlatformOperator } = usePlatformOperator();
  const { alerts, hasCritical } = usePlatformCostsAlerts();

  if (!isPlatformOperator || alerts.length === 0) return null;

  return (
    <div
      className={`px-4 py-2 text-sm flex items-center justify-between gap-3 border-b ${
        hasCritical ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
      }`}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <span>
          {alerts.length} serviço(s) externos próximos do vencimento:{" "}
          <strong>{alerts.slice(0, 3).map((a) => a.cost.display_name).join(", ")}</strong>
          {alerts.length > 3 && ` e +${alerts.length - 3}`}
        </span>
      </div>
      <Link to="/platform/external-costs" className="underline font-medium whitespace-nowrap">
        Ver detalhes
      </Link>
    </div>
  );
}
