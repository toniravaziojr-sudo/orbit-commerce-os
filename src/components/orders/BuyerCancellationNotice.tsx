// =============================================
// BUYER CANCELLATION NOTICE
// Linha discreta exibida abaixo do status quando o pedido foi
// cancelado pelo comprador (Mercado Livre/marketplace, devolução,
// chargeback). Substitui o banner grande para casos meramente
// informativos — o OrderRegressionBanner continua aparecendo só
// quando há ação manual concreta (NF autorizada / etiqueta despachada).
// =============================================

import { XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const REASON_HINT: Array<[RegExp, string]> = [
  [/cancel_purchase|buyer|comprador/i, "Pedido cancelado pelo comprador"],
  [/mediation/i, "Pedido cancelado em mediação no Mercado Livre"],
  [/expired|expirou/i, "Pedido cancelado por expiração de pagamento"],
  [/seller|vendedor/i, "Pedido cancelado pelo vendedor"],
  [/chargeback/i, "Pedido cancelado por chargeback"],
];

function humanize(reason: string | null | undefined): string {
  if (!reason) return "Pedido cancelado pelo comprador";
  for (const [re, label] of REASON_HINT) {
    if (re.test(reason)) return label;
  }
  return `Pedido cancelado — ${reason}`;
}

function isCancelledLike(status: string | null | undefined): boolean {
  if (!status) return false;
  return ["cancelled", "cancelled_by_user", "chargeback_lost"].includes(status);
}

export function BuyerCancellationNotice({
  orderId,
  status,
  cancellationReason,
}: {
  orderId?: string;
  status?: string | null;
  cancellationReason?: string | null;
}) {
  const { data } = useQuery({
    queryKey: ["buyer-cancellation-notice", orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data } = await supabase
        .from("orders")
        .select("status, cancellation_reason")
        .eq("id", orderId)
        .maybeSingle();
      return data as { status: string | null; cancellation_reason: string | null } | null;
    },
    enabled: !!orderId && (status === undefined || cancellationReason === undefined),
    staleTime: 60_000,
  });

  const finalStatus = status ?? data?.status ?? null;
  const finalReason = cancellationReason ?? data?.cancellation_reason ?? null;

  if (!isCancelledLike(finalStatus)) return null;

  return (
    <p className="flex items-center gap-1.5 text-xs text-destructive mt-1">
      <XCircle className="h-3.5 w-3.5 shrink-0" />
      <span>{humanize(finalReason)}</span>
    </p>
  );
}
