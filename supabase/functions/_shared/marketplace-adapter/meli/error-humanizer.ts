/**
 * Humanizador de erros do Mercado Livre.
 * Extraído de `meli-publish-listing/index.ts` (Onda C) para virar a primeira
 * peça compartilhada da camada adaptadora. Comportamento idêntico ao anterior.
 */
import type { MarketplaceErrorHumanizer } from "../core/contract.ts";

export function prettyAttrName(id: string): string {
  const dict: Record<string, string> = {
    FRAGRANCE: "Fragrância",
    HAIR_TREATMENT_PRESENTATION: "Formato de tratamento capilar",
    UNITS_PER_PACK: "Unidades por kit",
    ACTIVE_INGREDIENTS: "Ingredientes ativos",
    BRAND: "Marca",
    MODEL: "Modelo",
    GTIN: "Código de barras",
  };
  return dict[id.toUpperCase()] || id.toLowerCase().replace(/_/g, " ");
}

export function humanizeMeliError(raw: string, causes: unknown[]): string {
  const causeList = Array.isArray(causes) ? causes : [];
  const all = [
    raw,
    ...causeList.map((c: any) => c?.message || c?.code || "").filter(Boolean),
  ].join(" \n ");

  const bullets: string[] = [];
  const seen = new Set<string>();
  const add = (msg: string) => {
    if (msg && !seen.has(msg)) {
      seen.add(msg);
      bullets.push(msg);
    }
  };

  if (/value name must be null in not applicable attribute\s+([A-Z_]+)/i.test(all)) {
    const matches = [...all.matchAll(/value name must be null in not applicable attribute\s+([A-Z_]+)/gi)];
    for (const m of matches) {
      add(
        `A característica "${prettyAttrName(m[1])}" foi marcada como "Não se aplica" mas o Mercado Livre exige um valor real. Edite a característica no painel ou preencha no cadastro do produto.`,
      );
    }
  }
  if (/UNITS_PER_PACK/i.test(all) && /(Unidade|sale_format|formato de venda)/i.test(all)) {
    add('A característica "Unidades por kit" precisa ser pelo menos 1 quando o "Formato de venda" é "Unidade". Ajuste no painel de características.');
  }
  if (/Número de registro de produto na Anvisa.*incorreto/i.test(all) || /Número de notificação.*Anvisa.*incorreto/i.test(all) || /invalid_sanitary_registry_value/i.test(all)) {
    add('O número da ANVISA do produto está em formato inválido. O sistema espera 17 dígitos (Notificação/Comunicação prévia) ou 13 dígitos (Registro de produto). Revise o número no cadastro do produto (aba Fiscal/Regulatório).');
  }
  if (/Número de certificado da AFE.*incorreto/i.test(all) || /AFE.*formato.*inv[aá]lido/i.test(all)) {
    add('Este produto não tem registro AFE no cadastro — o sistema vai omitir esse campo automaticamente na próxima tentativa. Se o erro persistir, tente publicar novamente.');
  }
  if (/missing required attribute|atributo obrigat[oó]rio/i.test(all)) {
    add('Faltam características obrigatórias da categoria. Reabra o anúncio e revise o painel de características.');
  }
  if (/title.*(too long|invalid|exceeds)/i.test(all)) {
    add('O título do anúncio é inválido ou ultrapassa o limite de 60 caracteres.');
  }
  if (/price.*(invalid|missing)/i.test(all)) {
    add('O preço do anúncio é inválido ou está faltando.');
  }

  if (bullets.length === 0) {
    return "Não foi possível publicar o anúncio. Revise o cadastro do produto e as características antes de tentar de novo.";
  }
  return `Não foi possível publicar:\n• ${bullets.join("\n• ")}`;
}

export const meliErrorHumanizer: MarketplaceErrorHumanizer = {
  humanize: humanizeMeliError,
};
