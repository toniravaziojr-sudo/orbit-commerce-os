import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Importação de mídias do storage a partir de URLs exportadas
// ===========================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  console.log(`[storage-import][${VERSION}] Request received`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verificar auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Não autorizado" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Token inválido" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar se é owner
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .limit(1);

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Apenas owners podem importar" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // Ação 1: Importar um arquivo a partir de URL
    if (action === "import_file") {
      const { bucket, path, url } = body;

      if (!bucket || !path || !url) {
        return new Response(JSON.stringify({ success: false, error: "Parâmetros 'bucket', 'path' e 'url' são obrigatórios" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Download do arquivo da URL
      console.log(`[storage-import][${VERSION}] Downloading: ${url.substring(0, 100)}...`);
      const fileRes = await fetch(url);
      if (!fileRes.ok) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Falha ao baixar arquivo: HTTP ${fileRes.status}`,
          path,
        }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fileBlob = await fileRes.blob();
      const contentType = fileRes.headers.get("content-type") || "application/octet-stream";

      // Upload para o storage
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, fileBlob, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        console.error(`[storage-import][${VERSION}] Upload error:`, uploadError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: uploadError.message,
          path,
        }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[storage-import][${VERSION}] Uploaded: ${bucket}/${path}`);

      return new Response(JSON.stringify({
        success: true,
        action: "import_file",
        bucket,
        path,
        size: fileBlob.size,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ação 2: Importar batch de arquivos (até 5 por vez para não exceder timeout)
    if (action === "import_batch") {
      const { files } = body;
      // files: Array<{ bucket, path, url }>

      if (!files || !Array.isArray(files)) {
        return new Response(JSON.stringify({ success: false, error: "Parâmetro 'files' é obrigatório" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const MAX_BATCH = 5;
      const batch = files.slice(0, MAX_BATCH);
      const results: Array<{ path: string; success: boolean; error?: string; size?: number }> = [];

      for (const file of batch) {
        try {
          const fileRes = await fetch(file.url);
          if (!fileRes.ok) {
            results.push({ path: file.path, success: false, error: `HTTP ${fileRes.status}` });
            continue;
          }

          const fileBlob = await fileRes.blob();
          const contentType = fileRes.headers.get("content-type") || "application/octet-stream";

          const { error: uploadError } = await supabase.storage
            .from(file.bucket)
            .upload(file.path, fileBlob, { contentType, upsert: true });

          if (uploadError) {
            results.push({ path: file.path, success: false, error: uploadError.message });
          } else {
            results.push({ path: file.path, success: true, size: fileBlob.size });
          }
        } catch (err) {
          results.push({ path: file.path, success: false, error: err.message });
        }
      }

      const imported = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      console.log(`[storage-import][${VERSION}] Batch: ${imported} ok, ${failed} failed`);

      return new Response(JSON.stringify({
        success: true,
        action: "import_batch",
        imported,
        failed,
        total_sent: batch.length,
        remaining: files.length - batch.length,
        results,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: "Ação inválida",
      actions: ["import_file", "import_batch"],
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[storage-import][${VERSION}] Error:`, error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
