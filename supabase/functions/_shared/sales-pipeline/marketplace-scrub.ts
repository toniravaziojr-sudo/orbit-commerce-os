// ============================================================
// Marketplace Scrub Gate (Reg #19)
//
// Gate determinístico pós-resposta para canais onde a IA NÃO pode
// direcionar o cliente para fora da plataforma (regra de marketplace
// e comentários públicos). Roda APÓS todos os demais gates de saída
// e ANTES da persistência/entrega da mensagem.
//
// Canais cobertos:
//   - mercadolivre
//   - shopee
//   - tiktok_shop
//   - facebook_comments
//   - instagram_comments (alias suportado caso seja usado)
//
// O que é removido / mascarado:
//   - URLs externas (qualquer http(s):// que não bata com o domínio
//     da loja do tenant — quando o domínio é conhecido). Quando o
//     domínio não é conhecido, TODA URL externa é removida.
//   - Atalhos de redes externas: wa.me, whatsapp.com, t.me/telegram,
//     instagram.com/<user>, facebook.com/<user>, fb.me, m.me.
//   - E-mails (formato user@dominio).
//   - Telefones (sequências brasileiras: +55 opcional, DDD + 8/9
//     dígitos, com ou sem traço/espaço/parênteses).
//   - Menções textuais a canais externos: "WhatsApp", "Instagram",
//     "Telegram", "telefone", "ligue", "me chama no zap" — são
//     suavizadas para "(canal externo)" ou removidas se a frase
//     ficar vazia.
//
// O scrub NUNCA pode esvaziar a mensagem. Se sobrar nada, devolve
// uma resposta-padrão pedindo ao cliente que continue a conversa
// dentro da própria plataforma.
// ============================================================

const MARKETPLACE_CHANNELS = new Set<string>([
  "mercadolivre",
  "shopee",
  "tiktok_shop",
  "facebook_comments",
  "instagram_comments",
]);

export function isMarketplaceLikeChannel(channel: string | null | undefined): boolean {
  if (!channel) return false;
  return MARKETPLACE_CHANNELS.has(String(channel).toLowerCase());
}

export interface MarketplaceScrubInput {
  channelType: string;
  aiResponse: string;
  /** Domínio público da loja do tenant (sem protocolo). Ex.: "lojinha.com.br". */
  ownStoreDomain?: string | null;
}

export interface MarketplaceScrubResult {
  scrubbed: boolean;
  reason: string;
  removed: string[];
  after: string;
}

const URL_REGEX = /\bhttps?:\/\/[^\s)>\]]+/gi;
const BARE_URL_REGEX = /\b(?:wa\.me|m\.me|fb\.me|t\.me|telegra\.ph)\/[^\s)>\]]+/gi;
const SOCIAL_HANDLE_REGEX = /\b(?:instagram|facebook)\.com\/[A-Za-z0-9_.\-/]+/gi;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// Telefone BR — captura formatos típicos com 10 ou 11 dígitos no número.
// Aceita +55, DDI, parênteses no DDD, traço, espaço ou nada.
const PHONE_REGEX =
  /(?:\+?\d{1,3}[\s.\-]?)?\(?\d{2}\)?[\s.\-]?9?\d{4}[\s.\-]?\d{4}/g;
const EXTERNAL_WORDS_REGEX =
  /\b(whats?app|zap[\s-]?zap|insta(?:gram)?|telegram|me\s+chama\s+(?:no|pelo)\s+(zap|whats|telegram|insta)|me\s+manda\s+(?:no|pelo)\s+(zap|whats|telegram|insta)|fora\s+(?:do|da)\s+(mercado\s*livre|shopee|tiktok|plataforma))\b/gi;

function normalizeDomain(d: string | null | undefined): string | null {
  if (!d) return null;
  return String(d)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .trim() || null;
}

function urlMatchesOwnDomain(rawUrl: string, ownDomain: string | null): boolean {
  if (!ownDomain) return false;
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    return host === ownDomain || host.endsWith("." + ownDomain);
  } catch {
    return false;
  }
}

const REPLACEMENT = "(canal externo)";

const FALLBACK_BY_CHANNEL: Record<string, string> = {
  mercadolivre:
    "Posso te ajudar por aqui mesmo no Mercado Livre. Me conta o que você precisa que eu respondo na sequência.",
  shopee:
    "Posso te ajudar por aqui mesmo na Shopee. Me conta o que você precisa que eu respondo na sequência.",
  tiktok_shop:
    "Posso te ajudar por aqui mesmo no TikTok Shop. Me conta o que você precisa que eu respondo na sequência.",
  facebook_comments:
    "Posso te responder por aqui mesmo. Me conta o que você precisa que eu respondo na sequência.",
  instagram_comments:
    "Posso te responder por aqui mesmo. Me conta o que você precisa que eu respondo na sequência.",
};

export function scrubMarketplaceResponse(
  input: MarketplaceScrubInput,
): MarketplaceScrubResult {
  const channel = String(input.channelType || "").toLowerCase();
  if (!isMarketplaceLikeChannel(channel)) {
    return { scrubbed: false, reason: "channel_not_marketplace", removed: [], after: input.aiResponse };
  }

  let text = input.aiResponse || "";
  if (!text.trim()) {
    return { scrubbed: false, reason: "empty_input", removed: [], after: text };
  }

  const ownDomain = normalizeDomain(input.ownStoreDomain ?? null);
  const removed: string[] = [];

  // 1) URLs completas — remove se não bater com o domínio próprio.
  text = text.replace(URL_REGEX, (m) => {
    if (urlMatchesOwnDomain(m, ownDomain)) return m;
    removed.push(m);
    return REPLACEMENT;
  });

  // 2) URLs/atalhos sem protocolo (wa.me, m.me, fb.me, t.me).
  text = text.replace(BARE_URL_REGEX, (m) => {
    removed.push(m);
    return REPLACEMENT;
  });

  // 3) Handles instagram.com/foo, facebook.com/foo.
  text = text.replace(SOCIAL_HANDLE_REGEX, (m) => {
    removed.push(m);
    return REPLACEMENT;
  });

  // 4) E-mails.
  text = text.replace(EMAIL_REGEX, (m) => {
    removed.push(m);
    return REPLACEMENT;
  });

  // 5) Telefones.
  text = text.replace(PHONE_REGEX, (m) => {
    // Evita falso-positivo em números que claramente não são telefone
    // (ex.: "10000" sozinho). PHONE_REGEX já exige formato de telefone BR,
    // mas reforçamos: precisa ter pelo menos 10 dígitos.
    const digits = m.replace(/\D/g, "");
    if (digits.length < 10) return m;
    removed.push(m);
    return REPLACEMENT;
  });

  // 6) Palavras de canal externo — substitui por marcador genérico.
  text = text.replace(EXTERNAL_WORDS_REGEX, (m) => {
    removed.push(m);
    return REPLACEMENT;
  });

  // Colapsa marcadores repetidos e espaços extras.
  text = text
    .replace(new RegExp(`(?:\\s*\\${REPLACEMENT.charAt(0)}canal externo\\)\\s*){2,}`, "g"), `${REPLACEMENT} `)
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const scrubbed = removed.length > 0;

  // Se sobrou nada (ou só pontuação/marcadores), devolve fallback do canal.
  const meaningful = text.replace(new RegExp(`\\${REPLACEMENT.charAt(0)}canal externo\\)`, "g"), "").trim();
  if (!meaningful || meaningful.length < 8) {
    return {
      scrubbed: true,
      reason: "emptied_after_scrub",
      removed,
      after: FALLBACK_BY_CHANNEL[channel] || FALLBACK_BY_CHANNEL["mercadolivre"],
    };
  }

  return {
    scrubbed,
    reason: scrubbed ? "marketplace_external_stripped" : "noop",
    removed,
    after: text,
  };
}
