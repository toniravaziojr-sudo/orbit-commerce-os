/**
 * Resolve o destino contextual ao clicar no badge "Envio" de um pedido na lista
 * de pedidos. O destino respeita a separação canônica:
 *   - gateway externo (Frenet, ML, Shopee...) → /external-shipping
 *   - despacho local (Correios, Loggi)         → /shipping
 *
 * E a sub-aba dentro de "Objetos de postagem" é escolhida pelo estado do envio:
 *   - problema pós-despacho   → aba "problemas"
 *   - em trânsito / entregue  → aba "rastreios"
 *   - falha de emissão        → aba "pendentes"
 *   - aguardando emissão      → aba "prontos"
 */

type OrderForDeepLink = {
  id?: string;
  shipping_status?: string | null;
  tracking_code?: string | null;
  resolved_shipping_provider_kind?: string | null;
  marketplace_source?: string | null;
  sales_channel?: string | null;
};

export interface ShippingDeepLink {
  to: string;
  enabled: boolean;
}

const POST_DISPATCH_PROBLEM = new Set([
  "problem",
  "failed",
  "returned",
  "delivery_failed",
  "lost",
  "exception",
]);

const IN_FLIGHT = new Set([
  "shipped",
  "in_transit",
  "out_for_delivery",
  "posted",
  "delivered",
  "label_issued",
  "label_created",
]);

const AWAITING_ISSUANCE = new Set([
  "awaiting_shipment",
  "pending",
  "ready_to_ship",
  "awaiting_invoice",
]);

export function resolveShippingDeepLink(order: OrderForDeepLink | null | undefined): ShippingDeepLink {
  if (!order) return { to: "/shipping", enabled: false };

  const isExternal =
    order.resolved_shipping_provider_kind === "gateway" ||
    Boolean(order.marketplace_source) ||
    order.sales_channel === "marketplace";

  const base = isExternal ? "/external-shipping" : "/shipping";
  const status = (order.shipping_status || "").toLowerCase();
  const hasTracking = Boolean((order.tracking_code || "").trim());

  // Pós-despacho com problema
  if (POST_DISPATCH_PROBLEM.has(status)) {
    return { to: `${base}?tab=objetos&aba=problemas&order=${order.id ?? ""}`, enabled: true };
  }

  // Em fluxo normal (em trânsito / entregue / saiu p/ entrega)
  if (IN_FLIGHT.has(status) || hasTracking) {
    if (isExternal) {
      return { to: `${base}?tab=tracking&order=${order.id ?? ""}`, enabled: true };
    }
    return { to: `${base}?tab=rastreios&order=${order.id ?? ""}`, enabled: true };
  }

  // Aguardando etiqueta / pronto para emitir
  if (AWAITING_ISSUANCE.has(status)) {
    return { to: `${base}?tab=objetos&aba=prontos&order=${order.id ?? ""}`, enabled: true };
  }

  // Sem envio (digital, retirada) — sem ação
  return { to: base, enabled: false };
}
