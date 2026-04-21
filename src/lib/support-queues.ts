// =============================================================
// Phase 2 — Regra oficial das 3 filas do /support
// =============================================================
// Fonte única de verdade para classificar uma conversa em uma das
// 3 filas operacionais do atendimento. Toda a UI (lista, contadores,
// filtros) DEVE consumir este helper. NUNCA reimplementar a regra
// localmente em componentes ou hooks.
//
// Regra:
//   - IA          = status = 'bot'
//   - Em aberto   = aguardando humano, sem responsável
//   - Atendimento = humano assumiu (assigned_to != null)
//
// Conversas com status 'resolved' / 'spam' ficam FORA das 3 filas
// principais e não devem aparecer em nenhuma delas, nem nos
// contadores oficiais.
// =============================================================

import type { Conversation, ConversationStatus } from "@/hooks/useConversations";

export type SupportQueue = "ai" | "open" | "in_service";

/** Status que representam conversas "vivas" aguardando algum tipo de ação. */
const LIVE_HUMAN_STATUSES: ReadonlyArray<ConversationStatus> = [
  "new",
  "waiting_agent",
  "open",
  "waiting_customer",
];

/**
 * Classifica uma conversa em uma das 3 filas oficiais ou retorna
 * `null` quando ela está fora delas (resolved / spam).
 */
export function getConversationQueue(
  conversation: Pick<Conversation, "status" | "assigned_to">,
): SupportQueue | null {
  const { status, assigned_to } = conversation;

  // Conversas finalizadas não pertencem a nenhuma fila operacional
  if (status === "resolved" || status === "spam") return null;

  // IA owned
  if (status === "bot") return "ai";

  // A partir daqui é fila humana — diferenciada por assignee
  if (!LIVE_HUMAN_STATUSES.includes(status)) return null;

  return assigned_to ? "in_service" : "open";
}

/** Helper para filtrar uma lista de conversas por fila. */
export function filterByQueue<T extends Pick<Conversation, "status" | "assigned_to">>(
  conversations: T[],
  queue: SupportQueue,
): T[] {
  return conversations.filter((c) => getConversationQueue(c) === queue);
}

/** Calcula os contadores oficiais das 3 filas. */
export function countByQueue<T extends Pick<Conversation, "status" | "assigned_to">>(
  conversations: T[],
): Record<SupportQueue, number> {
  const counts: Record<SupportQueue, number> = {
    ai: 0,
    open: 0,
    in_service: 0,
  };

  for (const c of conversations) {
    const q = getConversationQueue(c);
    if (q) counts[q] += 1;
  }

  return counts;
}

/** Rótulos canônicos das filas (PT-BR). */
export const QUEUE_LABELS: Record<SupportQueue, string> = {
  ai: "IA",
  open: "Em aberto",
  in_service: "Atendimento",
};
