import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial release — oEmbed para FB/IG/Threads
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/**
 * Meta oEmbed
 * 
 * Retorna HTML de incorporação para posts públicos do Facebook, Instagram e Threads.
 * Usa os endpoints oficiais de oEmbed da Meta.
 * 
 * Contrato:
 * - Sucesso = HTTP 200 + { success: true, html, provider_name, ... }
 * - Erro = HTTP 200 + { success: false, error, code }
 */

// oEmbed endpoints por plataforma
const OEMBED_ENDPOINTS: Record<string, string> = {
  instagram: "https://graph.facebook.com/v21.0/instagram_oembed",
  facebook: "https://graph.facebook.com/v21.0/oembed_post",
  threads: "https://graph.facebook.com/v21.0/threads_oembed",
};

function detectPlatform(url: string): string | null {
  const lower = url.toLowerCase();
  if (lower.includes("instagram.com") || lower.includes("instagr.am")) return "instagram";
  if (lower.includes("facebook.com") || lower.includes("fb.com") || lower.includes("fb.watch")) return "facebook";
  if (lower.includes("threads.net")) return "threads";
  return null;
}

serve(async (req) => {
  console.log(`[meta-oembed][${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { url, maxWidth } = body;

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: "URL é obrigatória", code: "MISSING_URL" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const platform = detectPlatform(url);
    if (!platform) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "URL não reconhecida. Use uma URL do Facebook, Instagram ou Threads.", 
          code: "UNSUPPORTED_URL" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const endpoint = OEMBED_ENDPOINTS[platform];
    
    // oEmbed da Meta requer access_token (pode ser app token: APP_ID|APP_SECRET)
    // Mas o endpoint público funciona sem token para posts públicos
    const oembedUrl = new URL(endpoint);
    oembedUrl.searchParams.set("url", url);
    oembedUrl.searchParams.set("omitscript", "false");
    if (maxWidth) {
      oembedUrl.searchParams.set("maxwidth", String(maxWidth));
    }

    // Tentar com app token se disponível
    const appId = Deno.env.get("META_APP_ID");
    const appSecret = Deno.env.get("META_APP_SECRET");
    if (appId && appSecret) {
      oembedUrl.searchParams.set("access_token", `${appId}|${appSecret}`);
    }

    console.log(`[meta-oembed] Fetching oEmbed for ${platform}: ${url}`);

    const response = await fetch(oembedUrl.toString());
    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[meta-oembed] Error from Meta API: ${responseText}`);
      let errorMsg = "Erro ao buscar dados de incorporação";
      try {
        const errorData = JSON.parse(responseText);
        errorMsg = errorData?.error?.message || errorMsg;
      } catch {}
      
      return new Response(
        JSON.stringify({ success: false, error: errorMsg, code: "OEMBED_ERROR" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = JSON.parse(responseText);

    return new Response(
      JSON.stringify({
        success: true,
        html: data.html,
        provider_name: data.provider_name || platform,
        author_name: data.author_name || null,
        author_url: data.author_url || null,
        thumbnail_url: data.thumbnail_url || null,
        width: data.width || null,
        height: data.height || null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[meta-oembed] Error:`, error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro interno",
        code: "INTERNAL_ERROR"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
