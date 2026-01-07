import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate URL-friendly slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}

// Convert markdown to structured content for blog
function markdownToContent(markdown: string): any {
  // Simple conversion - in production you'd use a proper markdown parser
  const blocks: any[] = [];
  
  const lines = markdown.split("\n");
  let currentParagraph = "";
  
  for (const line of lines) {
    if (line.startsWith("### ")) {
      if (currentParagraph) {
        blocks.push({ type: "paragraph", content: currentParagraph.trim() });
        currentParagraph = "";
      }
      blocks.push({ type: "heading", level: 3, content: line.slice(4) });
    } else if (line.startsWith("## ")) {
      if (currentParagraph) {
        blocks.push({ type: "paragraph", content: currentParagraph.trim() });
        currentParagraph = "";
      }
      blocks.push({ type: "heading", level: 2, content: line.slice(3) });
    } else if (line.startsWith("# ")) {
      if (currentParagraph) {
        blocks.push({ type: "paragraph", content: currentParagraph.trim() });
        currentParagraph = "";
      }
      blocks.push({ type: "heading", level: 1, content: line.slice(2) });
    } else if (line.trim() === "") {
      if (currentParagraph) {
        blocks.push({ type: "paragraph", content: currentParagraph.trim() });
        currentParagraph = "";
      }
    } else {
      currentParagraph += " " + line;
    }
  }
  
  if (currentParagraph) {
    blocks.push({ type: "paragraph", content: currentParagraph.trim() });
  }
  
  return { blocks };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { calendar_item_id, publish_now } = await req.json();

    if (!calendar_item_id) {
      return new Response(
        JSON.stringify({ success: false, error: "calendar_item_id é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the calendar item with campaign info
    const { data: item, error: itemError } = await supabase
      .from("media_calendar_items")
      .select(`
        *,
        campaign:media_campaigns!inner(
          id,
          tenant_id,
          auto_publish
        )
      `)
      .eq("id", calendar_item_id)
      .single();

    if (itemError || !item) {
      return new Response(
        JSON.stringify({ success: false, error: "Item não encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this is a blog item
    if (item.target_channel !== "blog") {
      return new Response(
        JSON.stringify({ success: false, error: "Este item não é do canal Blog" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already published
    if (item.blog_post_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Este item já foi publicado como blog post" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = item.campaign.tenant_id;

    // Get asset URL if available
    let featuredImageUrl: string | null = null;
    
    // Check if there's a generated asset
    const { data: generation } = await supabase
      .from("media_asset_generations")
      .select("id")
      .eq("calendar_item_id", calendar_item_id)
      .eq("status", "succeeded")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (generation) {
      const { data: variant } = await supabase
        .from("media_asset_variants")
        .select("storage_path")
        .eq("generation_id", generation.id)
        .eq("variant_index", 1)
        .single();

      if (variant?.storage_path) {
        const { data: signedUrl } = await supabase.storage
          .from("media-assets")
          .createSignedUrl(variant.storage_path, 60 * 60 * 24 * 365); // 1 year
        
        featuredImageUrl = signedUrl?.signedUrl || null;
      }
    }

    // Generate unique slug
    const baseSlug = generateSlug(item.title || "post");
    let slug = baseSlug;
    let slugCounter = 1;

    // Check for slug conflicts
    while (true) {
      const { data: existing } = await supabase
        .from("blog_posts")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("slug", slug)
        .single();

      if (!existing) break;
      slug = `${baseSlug}-${slugCounter}`;
      slugCounter++;
    }

    // Convert copy (markdown) to structured content
    const content = markdownToContent(item.copy || "");

    // Calculate read time (rough estimate: 200 words per minute)
    const wordCount = (item.copy || "").split(/\s+/).length;
    const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

    // Determine publish status based on publish_now flag and scheduled date
    const now = new Date();
    const scheduledDate = new Date(item.scheduled_date);
    const shouldPublish = publish_now || (item.campaign.auto_publish && scheduledDate <= now);

    // Create the blog post
    const { data: blogPost, error: blogError } = await supabase
      .from("blog_posts")
      .insert({
        tenant_id: tenantId,
        title: item.title || "Sem título",
        slug: slug,
        content: content,
        excerpt: (item.copy || "").substring(0, 200) + "...",
        status: shouldPublish ? "published" : "draft",
        published_at: shouldPublish ? new Date().toISOString() : null,
        featured_image_url: featuredImageUrl,
        featured_image_alt: item.title,
        tags: item.hashtags || [],
        seo_title: item.title,
        seo_description: (item.copy || "").substring(0, 160),
        read_time_minutes: readTimeMinutes,
      })
      .select()
      .single();

    if (blogError) {
      console.error("Error creating blog post:", blogError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao criar post do blog" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the calendar item with the blog post reference
    await supabase
      .from("media_calendar_items")
      .update({
        blog_post_id: blogPost.id,
        published_blog_at: shouldPublish ? new Date().toISOString() : null,
        status: shouldPublish ? "published" : "approved",
        published_at: shouldPublish ? new Date().toISOString() : null,
        publish_results: {
          blog_post_id: blogPost.id,
          blog_slug: blogPost.slug,
          published: shouldPublish,
        },
      })
      .eq("id", calendar_item_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        blog_post_id: blogPost.id,
        slug: blogPost.slug,
        published: shouldPublish,
        message: shouldPublish 
          ? `Post publicado com sucesso: ${blogPost.title}` 
          : `Post salvo como rascunho: ${blogPost.title}`
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in media-publish-blog:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
