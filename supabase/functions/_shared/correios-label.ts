/**
 * Compartilhado entre `shipping-create-shipment` e `shipping-get-label`.
 *
 * Responsabilidades:
 * 1) Autenticar nos Correios (modos token / api_code / oauth legado).
 * 2) Baixar o PDF da etiqueta (`/prepostagem/v1/prepostagens/{cod}/etiqueta`).
 * 3) Subir para o bucket privado `shipping-labels` (path: `<tenantId>/<shipmentId>.pdf`).
 * 4) Gravar o **caminho** no `shipments.label_url` (não a URL signed).
 *
 * A leitura sempre gera signed URL fresca (1h) na hora do clique.
 * Isso permite "Reimprimir etiqueta" sempre disponível, sem URL expirada.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const CORREIOS_AUTH_URL = "https://api.correios.com.br/token/v1/autentica/cartaopostagem";
// Fluxo OFICIAL Correios (assíncrono em 2 passos):
//   1) POST /prepostagem/v1/prepostagens/rotulo/assincrono/pdf  → { idRecibo }
//   2) GET  /prepostagem/v1/prepostagens/rotulo/download/assincrono/{idRecibo} → PDF
// O endpoint `/prepostagens/{id}/etiqueta` NÃO existe (retorna 404 "No static resource").
const CORREIOS_ROTULO_ASYNC_URL = "https://api.correios.com.br/prepostagem/v1/prepostagens/rotulo/assincrono/pdf";
const CORREIOS_ROTULO_DOWNLOAD_URL = (idRecibo: string) =>
  `https://api.correios.com.br/prepostagem/v1/prepostagens/rotulo/download/assincrono/${idRecibo}`;

export const SHIPPING_LABELS_BUCKET = "shipping-labels";

export interface CorreiosCredentials {
  auth_mode?: string;
  token?: string;
  usuario?: string;
  senha?: string;
  codigo_acesso?: string;
  cartao_postagem?: string;
}

export async function getCorreiosAccessToken(creds: CorreiosCredentials): Promise<string | null> {
  const mode = creds.auth_mode ||
    (creds.codigo_acesso ? "api_code" : creds.token ? "token" : "oauth");

  if (mode === "token") {
    return creds.token && creds.token.length > 20 ? creds.token : null;
  }

  const pwd = mode === "api_code" ? creds.codigo_acesso : creds.senha;
  if (!creds.usuario || !pwd || !creds.cartao_postagem) return null;

  const basic = btoa(`${creds.usuario}:${pwd}`);
  const r = await fetch(CORREIOS_AUTH_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ numero: creds.cartao_postagem }),
  });
  if (!r.ok) return null;
  const data = await r.json().catch(() => ({}));
  return data?.token ?? null;
}

export interface DownloadAndStoreResult {
  success: boolean;
  storage_path?: string;
  error?: string;
}

/**
 * Baixa o PDF da etiqueta dos Correios e armazena no bucket privado.
 * Retorna `storage_path` (relativo ao bucket) para gravar em `shipments.label_url`.
 */
export async function downloadAndStoreCorreiosLabel(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    shipmentId: string;
    trackingCode: string;
    prepostId?: string | null;
    credentials: CorreiosCredentials;
  },
): Promise<DownloadAndStoreResult> {
  const { tenantId, shipmentId, trackingCode, prepostId, credentials } = params;

  if (!trackingCode) {
    return { success: false, error: "Código de rastreio ausente para baixar a etiqueta." };
  }

  const token = await getCorreiosAccessToken(credentials);
  if (!token) {
    return { success: false, error: "Falha na autenticação Correios para baixar a etiqueta" };
  }

  // ===== Passo 1: solicitar geração assíncrona do rótulo =====
  const asyncReq = {
    codigosObjeto: [trackingCode],
    idCorreios: credentials.usuario || undefined,
    numeroCartaoPostagem: credentials.cartao_postagem || undefined,
    tipoRotulo: "P",          // P (padrão) | R (reduzido)
    formatoRotulo: "ET",      // ET (Etiqueta) | EV (Envelope)
    imprimeRemetente: "S",
    layoutImpressao: "PADRAO",
  };

  const asyncResp = await fetch(CORREIOS_ROTULO_ASYNC_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(asyncReq),
  });

  if (!asyncResp.ok) {
    const txt = await asyncResp.text().catch(() => "");
    return {
      success: false,
      error: `Correios recusou a solicitação de rótulo (HTTP ${asyncResp.status}). ${txt.slice(0, 180)}`,
    };
  }

  const asyncData = await asyncResp.json().catch(() => ({} as any));
  const idRecibo: string | undefined = asyncData?.idRecibo || asyncData?.id;
  if (!idRecibo) {
    return { success: false, error: "Correios não retornou idRecibo para o rótulo." };
  }

  // ===== Passo 2: poll do download (com pequena espera; geralmente 1ª tentativa funciona) =====
  // O download retorna JSON com o PDF em base64 (campo `dados` / `arquivo`).
  let labelJson: any = null;
  let lastError = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    await new Promise((r) => setTimeout(r, attempt === 0 ? 800 : 1200));
    const r = await fetch(CORREIOS_ROTULO_DOWNLOAD_URL(idRecibo), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    if (r.ok) {
      labelJson = await r.json().catch(() => null);
      break;
    }
    const txt = await r.text().catch(() => "");
    lastError = `HTTP ${r.status} ${txt.slice(0, 160)}`;
    // 404/425 = ainda processando → tentar de novo
    if (r.status !== 404 && r.status !== 425) {
      return { success: false, error: `Correios não devolveu o PDF (${lastError})` };
    }
  }

  if (!labelJson) {
    return { success: false, error: `Tempo esgotado aguardando o PDF nos Correios. ${lastError}` };
  }

  // Extrai base64 do payload (Correios costuma usar `dados` ou `arquivo`).
  const b64: string | undefined =
    labelJson?.dados ||
    labelJson?.arquivo ||
    labelJson?.rotulo ||
    labelJson?.pdf ||
    (Array.isArray(labelJson?.itens) ? labelJson.itens[0]?.dados : undefined);

  if (!b64 || typeof b64 !== "string") {
    return {
      success: false,
      error: `Resposta Correios sem PDF em base64: ${JSON.stringify(labelJson).slice(0, 200)}`,
    };
  }

  // Decode base64 → bytes
  let bytes: Uint8Array;
  try {
    const bin = atob(b64.replace(/^data:application\/pdf;base64,/, ""));
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch (e: any) {
    return { success: false, error: `Base64 inválido na resposta Correios: ${e?.message || e}` };
  }

  const path = `${tenantId}/${shipmentId}.pdf`;

  const { error: upErr } = await supabase
    .storage
    .from(SHIPPING_LABELS_BUCKET)
    .upload(path, bytes, {
      contentType: "application/pdf",
      upsert: true,
      cacheControl: "3600",
    });

  if (upErr) {
    return { success: false, error: `Falha ao salvar etiqueta no Drive: ${upErr.message}` };
  }

  return { success: true, storage_path: path };
}

/**
 * Gera signed URL fresca para um path do bucket de etiquetas.
 */
export async function createLabelSignedUrl(
  supabase: SupabaseClient,
  storagePath: string,
  ttlSeconds = 3600,
): Promise<string | null> {
  const { data, error } = await supabase
    .storage
    .from(SHIPPING_LABELS_BUCKET)
    .createSignedUrl(storagePath, ttlSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/**
 * Detecta se um valor em `shipments.label_url` é um path interno do bucket
 * (relativo, sem protocolo) ou uma URL externa legada.
 */
export function isInternalLabelPath(value: string | null | undefined): boolean {
  if (!value) return false;
  if (/^https?:\/\//i.test(value)) return false;
  return value.includes("/") && value.endsWith(".pdf");
}
