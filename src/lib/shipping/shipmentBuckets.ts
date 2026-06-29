/**
 * Classificador único de objetos de postagem para a UI de Logística.
 *
 * Buckets:
 *  - `ready`             → rascunho aguardando emissão (delivery_status = 'draft')
 *  - `issued`            → objeto despachado com sucesso (qualquer status pós-emissão
 *                          válido: posted, in_transit, out_for_delivery, delivered,
 *                          label_created, etc.)
 *  - `pending_issuance`  → falha ANTES do despacho (delivery_status='failed' e ainda
 *                          sem tracking_code). É a antiga aba "Pendentes" — falha de
 *                          geração de etiqueta, NF ausente, erro Correios/Frenet.
 *  - `delivery_problem`  → falha DEPOIS do despacho (delivery_status em failed,
 *                          returned, unknown ou canceled E já existe tracking_code).
 *                          Pós-venda: devolução, extravio, tentativa frustrada.
 *
 * Regra: a presença de `tracking_code` é o divisor de águas entre "ainda não saiu da
 * loja" e "saiu mas deu problema lá fora".
 */
export type ShipmentBucket = "ready" | "issued" | "pending_issuance" | "delivery_problem";

export interface ShipmentBucketInput {
  delivery_status?: string | null;
  tracking_code?: string | null;
}

const POST_DISPATCH_PROBLEM = new Set(["failed", "returned", "unknown", "canceled", "cancelled"]);

export function classifyShipmentBucket(shipment: ShipmentBucketInput | null | undefined): ShipmentBucket | null {
  if (!shipment) return null;
  const status = (shipment.delivery_status || "").toLowerCase();
  const hasTracking = Boolean((shipment.tracking_code || "").trim());

  if (status === "draft") return "ready";
  if (status === "failed" && !hasTracking) return "pending_issuance";
  if (POST_DISPATCH_PROBLEM.has(status) && hasTracking) return "delivery_problem";
  // Tudo o que sobrou (posted, in_transit, delivered, label_created, etc.) = issued.
  return "issued";
}

export const SHIPMENT_BUCKET_LABEL: Record<ShipmentBucket, string> = {
  ready: "Prontos para emitir",
  issued: "Objetos emitidos",
  pending_issuance: "Pendentes",
  delivery_problem: "Problemas de envio/entrega",
};
