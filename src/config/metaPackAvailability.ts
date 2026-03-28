/**
 * META PACK AVAILABILITY — Fonte de verdade centralizada
 * 
 * Define a disponibilidade de cada pacote de escopos Meta.
 * Usado no frontend (bloqueio visual) e espelhado no backend (validação).
 * 
 * Para liberar um novo pack para externos:
 * 1. Mudar availability de "internal" para "public" AQUI
 * 2. Mudar a mesma constante em supabase/functions/meta-oauth-start/index.ts
 * 3. Nenhum outro arquivo precisa ser alterado
 * 
 * IMPORTANTE: Este arquivo e a constante PACK_AVAILABILITY no meta-oauth-start
 * DEVEM estar sempre sincronizados. Qualquer divergência é um bug.
 */

import type { MetaScopePack } from "@/hooks/useMetaConnection";

export type PackAvailability = "public" | "internal" | "unavailable";

export interface MetaPackConfig {
  id: MetaScopePack;
  label: string;
  description: string;
  availability: PackAvailability;
  blockedReason?: string;
}

/**
 * Configuração central de disponibilidade dos packs Meta.
 * 
 * - "public": Liberado para todos os tenants (casos de uso aprovados na Meta)
 * - "internal": Visível e usável apenas por operadores da plataforma (teste/rollout)
 * - "unavailable": Bloqueado para todos (funcionalidade ainda não implementada)
 */
export const META_PACK_AVAILABILITY: MetaPackConfig[] = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    description: "WABA / Cloud API",
    availability: "public",
  },
  {
    id: "publicacao",
    label: "Publicação",
    description: "Facebook + Instagram Posts, Stories, Reels",
    availability: "public",
  },
  {
    id: "atendimento",
    label: "Atendimento",
    description: "Messenger + Instagram DM + Comentários",
    availability: "internal",
    blockedReason: "Disponível em breve",
  },
  {
    id: "ads",
    label: "Anúncios",
    description: "Campanhas e métricas",
    availability: "internal",
    blockedReason: "Disponível em breve",
  },
  {
    id: "leads",
    label: "Leads",
    description: "Lead Ads",
    availability: "internal",
    blockedReason: "Disponível em breve",
  },
  {
    id: "catalogo",
    label: "Catálogo",
    description: "Produtos e Commerce Manager",
    availability: "internal",
    blockedReason: "Disponível em breve",
  },
  {
    id: "threads",
    label: "Threads",
    description: "Publicação e gestão no Threads",
    availability: "internal",
    blockedReason: "Disponível em breve",
  },
  {
    id: "live_video",
    label: "Lives",
    description: "Transmissões ao vivo",
    availability: "internal",
    blockedReason: "Disponível em breve",
  },
  {
    id: "pixel",
    label: "Pixel + CAPI",
    description: "Rastreamento e Conversions API",
    availability: "internal",
    blockedReason: "Disponível em breve",
  },
  {
    id: "insights",
    label: "Insights",
    description: "Métricas de páginas e perfis",
    availability: "internal",
    blockedReason: "Disponível em breve",
  },
];

/**
 * Retorna se um pack está disponível para o contexto atual.
 * 
 * @param packId - ID do pack Meta
 * @param isPlatformOperator - Se o usuário logado é operador da plataforma
 * @returns true se o pack pode ser selecionado/usado
 */
export function isPackAvailable(packId: MetaScopePack, isPlatformOperator: boolean): boolean {
  const pack = META_PACK_AVAILABILITY.find(p => p.id === packId);
  if (!pack) return false;

  switch (pack.availability) {
    case "public":
      return true;
    case "internal":
      return isPlatformOperator;
    case "unavailable":
      return false;
    default:
      return false;
  }
}

/**
 * Retorna a configuração de um pack pelo ID.
 */
export function getPackConfig(packId: MetaScopePack): MetaPackConfig | undefined {
  return META_PACK_AVAILABILITY.find(p => p.id === packId);
}
