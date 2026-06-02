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
// IMPORTANT: este endpoint exige o **idPrePostagem** (ex.: PRV...), NÃO o código
// de rastreio/objeto (ex.: AP...). Usar o tracking code aqui retorna 404.
const CORREIOS_LABEL_URL = (idPrePostagem: string) =>
  `https://api.correios.com.br/prepostagem/v1/prepostagens/${idPrePostagem}/etiqueta?tipoRotulo=P`;

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
    credentials: CorreiosCredentials;
  },
): Promise<DownloadAndStoreResult> {
  const { tenantId, shipmentId, trackingCode, credentials } = params;

  const token = await getCorreiosAccessToken(credentials);
  if (!token) {
    return { success: false, error: "Falha na autenticação Correios para baixar a etiqueta" };
  }

  const labelResp = await fetch(CORREIOS_LABEL_URL(trackingCode), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/pdf",
    },
  });

  if (!labelResp.ok) {
    const txt = await labelResp.text().catch(() => "");
    return {
      success: false,
      error: `Correios não retornou a etiqueta (HTTP ${labelResp.status}). ${txt.slice(0, 160)}`,
    };
  }

  const contentType = labelResp.headers.get("content-type") || "";
  if (!contentType.includes("pdf") && !contentType.includes("octet-stream")) {
    // Em raros casos a resposta vem JSON com URL — não persistimos URL externa, falhamos aqui.
    return { success: false, error: "Resposta dos Correios não é PDF." };
  }

  const bytes = new Uint8Array(await labelResp.arrayBuffer());
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
