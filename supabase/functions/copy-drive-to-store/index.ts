import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { sourcePaths, targetFolder } = await req.json();

    const results: { source: string; target: string; url: string }[] = [];

    for (const sourcePath of sourcePaths) {
      // Download from tenant-files
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("tenant-files")
        .download(sourcePath);

      if (downloadError) {
        console.error(`Error downloading ${sourcePath}:`, downloadError);
        continue;
      }

      // Extract filename from path
      const filename = sourcePath.split("/").pop()!;
      const targetPath = `${targetFolder}/${filename}`;

      // Upload to store-assets
      const { error: uploadError } = await supabase.storage
        .from("store-assets")
        .upload(targetPath, fileData, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        console.error(`Error uploading ${targetPath}:`, uploadError);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("store-assets")
        .getPublicUrl(targetPath);

      results.push({
        source: sourcePath,
        target: targetPath,
        url: urlData.publicUrl,
      });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
