import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const MAX_CHUNK_TOKENS = 500;
const CHUNK_OVERLAP_TOKENS = 50;

interface IngestRequest {
  doc_id?: string;
  tenant_id: string;
  action?: "ingest" | "sync_products" | "sync_categories" | "sync_policies";
}

interface ChunkData {
  chunk_index: number;
  chunk_text: string;
  chunk_tokens: number;
  embedding: number[];
}

/**
 * Estima número de tokens em um texto (aproximação simples)
 * OpenAI usa ~4 chars por token para português
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Divide texto em chunks respeitando limites de tokens
 */
function chunkText(text: string, maxTokens: number = MAX_CHUNK_TOKENS, overlap: number = CHUNK_OVERLAP_TOKENS): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let currentChunk = "";
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);
    
    if (currentTokens + sentenceTokens > maxTokens && currentChunk) {
      chunks.push(currentChunk.trim());
      
      // Overlap: manter últimas palavras do chunk anterior
      const words = currentChunk.split(/\s+/);
      const overlapWords = words.slice(-Math.ceil(overlap / 2));
      currentChunk = overlapWords.join(" ") + " " + sentence;
      currentTokens = estimateTokens(currentChunk);
    } else {
      currentChunk += (currentChunk ? " " : "") + sentence;
      currentTokens += sentenceTokens;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // Se não conseguiu dividir em chunks, dividir por caracteres
  if (chunks.length === 0 && text.length > 0) {
    const chunkSize = maxTokens * 4; // ~4 chars per token
    for (let i = 0; i < text.length; i += chunkSize - (overlap * 4)) {
      chunks.push(text.slice(i, i + chunkSize).trim());
    }
  }

  return chunks.filter(c => c.length > 10); // Ignorar chunks muito pequenos
}

/**
 * Gera embeddings para textos via OpenAI
 */
async function generateEmbeddings(texts: string[], openaiKey: string): Promise<number[][]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data.map((item: { embedding: number[] }) => item.embedding);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "AI not configured", code: "AI_NOT_CONFIGURED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { doc_id, tenant_id, action = "ingest" }: IngestRequest = await req.json();

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id is required", code: "MISSING_TENANT" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ai-kb-ingest] Action: ${action}, tenant: ${tenant_id}, doc_id: ${doc_id || 'N/A'}`);

    // ================================================
    // ACTION: INGEST - Processar documento específico
    // ================================================
    if (action === "ingest" && doc_id) {
      // Buscar documento
      const { data: doc, error: docError } = await supabase
        .from("knowledge_base_docs")
        .select("*")
        .eq("id", doc_id)
        .eq("tenant_id", tenant_id)
        .single();

      if (docError || !doc) {
        return new Response(
          JSON.stringify({ success: false, error: "Document not found", code: "DOC_NOT_FOUND" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Deletar chunks antigos
      await supabase
        .from("knowledge_base_chunks")
        .delete()
        .eq("doc_id", doc_id);

      // Dividir em chunks
      const chunks = chunkText(doc.content);
      console.log(`[ai-kb-ingest] Doc ${doc_id}: ${chunks.length} chunks created`);

      if (chunks.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "No chunks generated", chunks_created: 0 }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Gerar embeddings em batch
      const embeddings = await generateEmbeddings(chunks, OPENAI_API_KEY);

      // Preparar dados para inserção
      const chunkData: ChunkData[] = chunks.map((text, index) => ({
        chunk_index: index,
        chunk_text: text,
        chunk_tokens: estimateTokens(text),
        embedding: embeddings[index],
      }));

      // Inserir chunks
      const { error: insertError } = await supabase
        .from("knowledge_base_chunks")
        .insert(chunkData.map(c => ({
          doc_id,
          tenant_id,
          chunk_index: c.chunk_index,
          chunk_text: c.chunk_text,
          chunk_tokens: c.chunk_tokens,
          embedding: `[${c.embedding.join(",")}]`, // Formato vector
          is_active: doc.status === "active",
        })));

      if (insertError) {
        console.error("[ai-kb-ingest] Error inserting chunks:", insertError);
        return new Response(
          JSON.stringify({ success: false, error: "Error saving chunks", code: "INSERT_ERROR" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Document ingested successfully",
          chunks_created: chunks.length,
          total_tokens: chunkData.reduce((sum, c) => sum + c.chunk_tokens, 0),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ================================================
    // ACTION: SYNC_PRODUCTS - Auto-importar produtos
    // ================================================
    if (action === "sync_products") {
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, description, price, sku, slug")
        .eq("tenant_id", tenant_id)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(200);

      if (productsError) {
        console.error("[ai-kb-ingest] Error fetching products:", productsError);
        return new Response(
          JSON.stringify({ success: false, error: "Error fetching products" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let synced = 0;
      for (const product of products || []) {
        const content = [
          `Produto: ${product.name}`,
          product.sku ? `SKU: ${product.sku}` : "",
          product.price ? `Preço: R$ ${product.price.toFixed(2)}` : "",
          product.description || "",
        ].filter(Boolean).join("\n");

        // Upsert documento
        const { data: doc, error: upsertError } = await supabase
          .from("knowledge_base_docs")
          .upsert({
            tenant_id,
            title: product.name,
            doc_type: "product",
            status: "active",
            priority: 60,
            content,
            source: "auto_import_products",
            source_id: product.id,
          }, {
            onConflict: "tenant_id,doc_type,source,source_id",
          })
          .select("id")
          .single();

        if (!upsertError && doc) {
          // Processar chunks para este documento
          const chunks = chunkText(content);
          if (chunks.length > 0) {
            // Deletar chunks antigos
            await supabase.from("knowledge_base_chunks").delete().eq("doc_id", doc.id);
            
            // Gerar embeddings
            const embeddings = await generateEmbeddings(chunks, OPENAI_API_KEY);
            
            // Inserir novos chunks
            await supabase.from("knowledge_base_chunks").insert(
              chunks.map((text, index) => ({
                doc_id: doc.id,
                tenant_id,
                chunk_index: index,
                chunk_text: text,
                chunk_tokens: estimateTokens(text),
                embedding: `[${embeddings[index].join(",")}]`,
                is_active: true,
              }))
            );
            synced++;
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: `Synced ${synced} products` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ================================================
    // ACTION: SYNC_CATEGORIES
    // ================================================
    if (action === "sync_categories") {
      const { data: categories } = await supabase
        .from("categories")
        .select("id, name, description, slug")
        .eq("tenant_id", tenant_id)
        .eq("is_active", true);

      let synced = 0;
      for (const category of categories || []) {
        const content = [
          `Categoria: ${category.name}`,
          category.description || "",
        ].filter(Boolean).join("\n");

        const { data: doc } = await supabase
          .from("knowledge_base_docs")
          .upsert({
            tenant_id,
            title: `Categoria: ${category.name}`,
            doc_type: "category",
            status: "active",
            priority: 70,
            content,
            source: "auto_import_categories",
            source_id: category.id,
          }, { onConflict: "tenant_id,doc_type,source,source_id" })
          .select("id")
          .single();

        if (doc && content.length > 20) {
          await supabase.from("knowledge_base_chunks").delete().eq("doc_id", doc.id);
          const chunks = chunkText(content);
          if (chunks.length > 0) {
            const embeddings = await generateEmbeddings(chunks, OPENAI_API_KEY);
            await supabase.from("knowledge_base_chunks").insert(
              chunks.map((text, index) => ({
                doc_id: doc.id,
                tenant_id,
                chunk_index: index,
                chunk_text: text,
                chunk_tokens: estimateTokens(text),
                embedding: `[${embeddings[index].join(",")}]`,
                is_active: true,
              }))
            );
            synced++;
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: `Synced ${synced} categories` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ================================================
    // ACTION: SYNC_POLICIES - Políticas da loja
    // ================================================
    if (action === "sync_policies") {
      const { data: storeSettings } = await supabase
        .from("store_settings")
        .select("return_policy, shipping_policy, privacy_policy, terms_of_service")
        .eq("tenant_id", tenant_id)
        .single();

      if (!storeSettings) {
        return new Response(
          JSON.stringify({ success: true, message: "No policies found" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const policies = [
        { key: "return_policy", title: "Política de Trocas e Devoluções", content: storeSettings.return_policy },
        { key: "shipping_policy", title: "Política de Frete", content: storeSettings.shipping_policy },
        { key: "privacy_policy", title: "Política de Privacidade", content: storeSettings.privacy_policy },
        { key: "terms_of_service", title: "Termos de Serviço", content: storeSettings.terms_of_service },
      ].filter(p => p.content && p.content.length > 10);

      let synced = 0;
      for (const policy of policies) {
        const { data: doc } = await supabase
          .from("knowledge_base_docs")
          .upsert({
            tenant_id,
            title: policy.title,
            doc_type: "policy",
            status: "active",
            priority: 10, // Alta prioridade para políticas
            content: policy.content!,
            source: "auto_import_policies",
            source_id: policy.key,
          }, { onConflict: "tenant_id,doc_type,source,source_id" })
          .select("id")
          .single();

        if (doc) {
          await supabase.from("knowledge_base_chunks").delete().eq("doc_id", doc.id);
          const chunks = chunkText(policy.content!);
          if (chunks.length > 0) {
            const embeddings = await generateEmbeddings(chunks, OPENAI_API_KEY);
            await supabase.from("knowledge_base_chunks").insert(
              chunks.map((text, index) => ({
                doc_id: doc.id,
                tenant_id,
                chunk_index: index,
                chunk_text: text,
                chunk_tokens: estimateTokens(text),
                embedding: `[${embeddings[index].join(",")}]`,
                is_active: true,
              }))
            );
            synced++;
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: `Synced ${synced} policies` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action", code: "INVALID_ACTION" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ai-kb-ingest] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
