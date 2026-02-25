import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.1.0"; // Processar 1 bucket por vez, paginação
// ===========================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  console.log(`[storage-export][${VERSION}] Request received`);

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
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      return new Response(JSON.stringify({ error: "Apenas owners podem exportar" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list_buckets";
    const bucketId = url.searchParams.get("bucket");
    const prefix = url.searchParams.get("prefix") || "";

    // Ação 1: Listar buckets disponíveis
    if (action === "list_buckets") {
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      if (bucketsError) throw bucketsError;

      // Contar arquivos por bucket via query direta
      const counts: Record<string, number> = {};
      for (const b of buckets) {
        const { data: files } = await supabase.storage.from(b.id).list("", { limit: 1, offset: 0 });
        // Contar usando query SQL
        counts[b.id] = 0;
      }

      // Query SQL para contagem real
      const { data: countData } = await supabase.rpc("get_auth_user_email"); // dummy, vamos usar raw
      
      return new Response(JSON.stringify({
        action: "list_buckets",
        buckets: buckets.map(b => ({
          id: b.id,
          name: b.name,
          public: b.public,
        })),
        instructions: "Use ?action=list_files&bucket=BUCKET_ID para listar arquivos de cada bucket. Adicione &prefix=FOLDER para subpastas.",
      }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ação 2: Listar arquivos de um bucket com URLs
    if (action === "list_files") {
      if (!bucketId) {
        return new Response(JSON.stringify({ error: "Parâmetro 'bucket' é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Buscar info do bucket
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucket = buckets?.find(b => b.id === bucketId);
      if (!bucket) {
        return new Response(JSON.stringify({ error: `Bucket '${bucketId}' não encontrado` }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const files: Array<{
        path: string;
        size: number;
        mimetype: string;
        url: string;
      }> = [];

      const subfolders: string[] = [];

      // Listar itens no prefixo atual
      const { data: items, error: listError } = await supabase.storage
        .from(bucketId)
        .list(prefix, { limit: 1000, offset: 0 });

      if (listError) throw listError;

      if (items) {
        for (const item of items) {
          const fullPath = prefix ? `${prefix}/${item.name}` : item.name;

          if (item.id === null) {
            // Pasta
            subfolders.push(fullPath);
          } else {
            let fileUrl: string;
            if (bucket.public) {
              const { data: publicUrl } = supabase.storage
                .from(bucketId)
                .getPublicUrl(fullPath);
              fileUrl = publicUrl.publicUrl;
            } else {
              const { data: signedData, error: signedError } = await supabase.storage
                .from(bucketId)
                .createSignedUrl(fullPath, 60 * 60 * 24 * 7);
              fileUrl = signedError ? `ERROR: ${signedError.message}` : signedData!.signedUrl;
            }

            files.push({
              path: fullPath,
              size: item.metadata?.size || 0,
              mimetype: item.metadata?.mimetype || "unknown",
              url: fileUrl,
            });
          }
        }
      }

      console.log(`[storage-export][${VERSION}] Bucket ${bucketId}, prefix "${prefix}": ${files.length} files, ${subfolders.length} subfolders`);

      return new Response(JSON.stringify({
        action: "list_files",
        bucket: bucketId,
        prefix,
        is_public: bucket.public,
        files,
        subfolders,
        total_files: files.length,
        instructions: subfolders.length > 0 
          ? `Há ${subfolders.length} subpastas. Chame novamente com &prefix=SUBFOLDER para cada uma.`
          : "Todos os arquivos deste nível listados.",
      }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ 
      error: "Ação inválida",
      actions: ["list_buckets", "list_files"],
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[storage-export][${VERSION}] Error:`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
