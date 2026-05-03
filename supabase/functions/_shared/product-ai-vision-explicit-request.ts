// ============================================================
// Onda 1C — Detector de explicit_request (dry_run only)
//
// Função pura. Recebe o texto do turno + o pool de produtos enriquecido
// e devolve a lista de IDs que devem ser tratados como pedido explícito
// pelo ProductRecommendationContextBuilder.
//
// Regras (conservadoras, somente para dry_run):
//   1. SKU literal aparecendo no texto -> explicit_request (motivo=sku).
//   2. Nome "core" do produto (sem parênteses, sem sufixos de pack)
//      contido no texto normalizado -> explicit_request (motivo=name).
//   3. Padrão de quantidade ("2x","3x","6x","12x") combinado com nome
//      core no texto -> explicit_request (motivo=name+pack_size) só
//      para o item cujo nome contém aquele "(Nx)".
//   4. Palavras "kit"/"combo" + nome core do kit no texto -> explicit
//      (motivo=kit_keyword).
//
// NÃO altera ranking/payload efetivo: o caller usa apenas em trace
// e na chamada ao builder em modo dry_run.
// ============================================================

export interface ExplicitDetectorItem {
  id: string;
  name: string;
  sku?: string | null;
}

export interface ExplicitMatch {
  product_id: string;
  reason: "sku" | "name" | "name+pack_size" | "kit_keyword";
  matched_token: string;
}

const PAREN_RE = /\([^)]*\)/g;
const PACK_RE = /\b(\d{1,2})\s*x\b/gi;
const KIT_RE = /\b(kit|combo|completo|tratamento\s+completo)\b/i;

function norm(s: string | null | undefined): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function coreName(name: string): string {
  // Remove parênteses ("(2x)", "(Dia)", "(FLEX)") e marcas comuns.
  return norm(name.replace(PAREN_RE, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function extractPackSizesFromText(text: string): number[] {
  const out: number[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(PACK_RE.source, "gi");
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n >= 2 && n <= 24) out.push(n);
  }
  return out;
}

function extractPackSizeFromName(name: string): number | null {
  const m = String(name || "").match(/\(\s*(\d{1,2})\s*x\s*\)/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n >= 2 ? n : null;
}

export function detectExplicitRequestIds(
  userText: string | null | undefined,
  items: ExplicitDetectorItem[]
): ExplicitMatch[] {
  const text = norm(userText);
  if (!text || !items?.length) return [];

  const packSizesInText = extractPackSizesFromText(text);
  const kitMentioned = KIT_RE.test(String(userText || ""));

  const matches: ExplicitMatch[] = [];
  const seen = new Set<string>();

  // 1) SKU literal — só se o SKU aparece como token "isolado" (evita falso match em palavras).
  for (const it of items) {
    if (!it.sku) continue;
    const sku = String(it.sku).toLowerCase().trim();
    if (sku.length < 3) continue;
    const skuRe = new RegExp(`(^|[^a-z0-9])${sku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i");
    if (skuRe.test(text)) {
      if (!seen.has(it.id)) {
        matches.push({ product_id: it.id, reason: "sku", matched_token: sku });
        seen.add(it.id);
      }
    }
  }

  // 2 + 3) Nome core contido no texto, OU token-chave + qty.
  for (const it of items) {
    if (seen.has(it.id)) continue;
    const core = coreName(it.name);
    if (core.length < 4) continue;

    const itemPack = extractPackSizeFromName(it.name);
    const fullCoreInText = text.includes(core);

    // Tokens significativos do core (≥4 chars), excluindo stopwords curtas.
    const coreTokens = core.split(/\s+/).filter(t => t.length >= 4);
    const tokenInText = coreTokens.find(t => text.includes(t));

    if (itemPack && packSizesInText.length > 0) {
      // Variação Nx: precisa qty bater + (nome core completo OU pelo menos um token-chave).
      if (packSizesInText.includes(itemPack) && (fullCoreInText || tokenInText)) {
        matches.push({
          product_id: it.id,
          reason: "name+pack_size",
          matched_token: `${tokenInText || core} (${itemPack}x)`,
        });
        seen.add(it.id);
      }
      continue;
    }

    if (itemPack) {
      // Item é variação Nx mas o texto não menciona qty: não promove para evitar variação errada.
      continue;
    }

    if (!fullCoreInText) continue;

    // Sem qty no texto e nome core completo bate: produto-base pedido nominalmente.
    if (kitMentioned && /\bkit\b/i.test(it.name)) {
      matches.push({ product_id: it.id, reason: "kit_keyword", matched_token: core });
    } else {
      matches.push({ product_id: it.id, reason: "name", matched_token: core });
    }
    seen.add(it.id);
  }

  return matches;
}
