// =============================================
// ORDER REGRESSION BANNER
// Mostra alertas quando o pedido regrediu (cancelado, chargeback,
// estornado, expirado etc.) e existem NF-e autorizadas ou etiquetas
// despachadas que precisam de ação humana.
// Fonte: fiscal_invoices.requires_action / shipments.requires_action
// (sinalizado por triggers DB + order-regression-handler).
// =============================================

import { AlertTriangle, FileText, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useOrderRegressionAlerts } from "@/hooks/useOrderRegressionAlerts";

const REASON_LABEL: Record<string, string> = {
  cancelled: "Pedido cancelado",
  returned: "Pedido devolvido",
  returning: "Pedido em devolução",
  chargeback_detected: "Chargeback detectado",
  chargeback_lost: "Chargeback perdido",
  payment_expired: "Pagamento expirado",
  invoice_cancelled: "NF-e cancelada",
};

function reasonText(reason: string | null) {
  if (!reason) return "Ação manual necessária";
  return REASON_LABEL[reason] ?? reason;
}

export function OrderRegressionBanner({ orderId }: { orderId?: string }) {
  const { data } = useOrderRegressionAlerts(orderId);
  if (!data?.hasAny) return null;

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
        <h3 className="font-semibold text-destructive">
          Ação manual necessária após regressão do pedido
        </h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Este pedido mudou para um status que impede o fluxo fiscal/logístico
        normal, mas já existiam documentos emitidos ou remessas em andamento.
        Reverta-os manualmente conforme a situação real.
      </p>

      {data.invoices.length > 0 && (
        <div className="space-y-2">
          {data.invoices.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between gap-3 rounded-md border bg-background p-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    NF-e {inv.numero ? `#${inv.numero}` : "(sem número)"}{" "}
                    {inv.serie ? `• Série ${inv.serie}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Status atual: {inv.status} • Motivo: {reasonText(inv.action_reason)}
                  </p>
                </div>
              </div>
              <Badge variant="destructive">Cancelar / Inutilizar</Badge>
            </div>
          ))}
        </div>
      )}

      {data.shipments.length > 0 && (
        <div className="space-y-2">
          {data.shipments.map((sh) => (
            <div
              key={sh.id}
              className="flex items-center justify-between gap-3 rounded-md border bg-background p-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    Etiqueta {sh.tracking_code ?? "(sem código)"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Status atual: {sh.delivery_status ?? "—"} • Motivo:{" "}
                    {reasonText(sh.action_reason)}
                  </p>
                </div>
              </div>
              <Badge variant="destructive">Cancelar / Reverter envio</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
