import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Mercado Livre Category Search v1.1.0
 * 
 * Busca categorias do ML via API pública.
 * - GET ?q=celular → Busca por texto (domain_discovery)
 * - GET ?parentId=MLB5672 → Lista subcategorias
 * - GET ?categoryId=MLB1055 → Detalhes de uma categoria (inclui max_title_length)
 * 
 * v1.1.0: Inclui max_title_length na resposta de categoryId
 */
const VERSION = "v1.1.0";
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[meli-search-categories][${VERSION}] Request received`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Sessão inválida" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    let query = url.searchParams.get("q");
    let parentId = url.searchParams.get("parentId");
    let categoryId = url.searchParams.get("categoryId");

    // Also support POST body params
    let tenantId: string | null = url.searchParams.get("tenantId");
    if (req.method === "POST") {
      try {
        const body = await req.json();
        query = body.q || query;
        parentId = body.parentId || parentId;
        categoryId = body.categoryId || categoryId;
        tenantId = body.tenantId || tenantId;
      } catch { /* ignore parse errors */ }
    }

    // Get ML access token (with auto-refresh if expired)
    let mlHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (tenantId) {
      const { data: connection } = await supabase
        .from("marketplace_connections")
        .select("id, access_token, refresh_token, expires_at")
        .eq("tenant_id", tenantId)
        .eq("marketplace", "mercadolivre")
        .eq("is_active", true)
        .maybeSingle();
      
      if (connection?.access_token) {
        let accessToken = connection.access_token;
        
        // Auto-refresh if token is expired
        if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
          console.log(`[meli-search-categories] Token expired, attempting auto-refresh...`);
          try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const refreshRes = await fetch(`${supabaseUrl}/functions/v1/meli-token-refresh`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ connectionId: connection.id }),
            });
            
            if (refreshRes.ok) {
              // Re-fetch the connection to get the new token
              const { data: refreshedConn } = await supabase
                .from("marketplace_connections")
                .select("access_token")
                .eq("id", connection.id)
                .single();
              
              if (refreshedConn?.access_token) {
                accessToken = refreshedConn.access_token;
                console.log(`[meli-search-categories] Token refreshed successfully`);
              }
            } else {
              console.log(`[meli-search-categories] Token refresh failed: ${refreshRes.status}`);
            }
          } catch (refreshErr) {
            console.error(`[meli-search-categories] Token refresh error:`, refreshErr);
          }
        }
        
        mlHeaders["Authorization"] = `Bearer ${accessToken}`;
        console.log(`[meli-search-categories] Using authenticated ML API`);
      } else {
        console.log(`[meli-search-categories] No ML connection found, using public API`);
      }
    }


    let categories: any[] = [];
    let path: any[] = [];
    let maxTitleLength: number | null = null;

    if (query) {
      // Strategy 1: domain_discovery/search (replaces deprecated category_predictor)
      const discoveryUrl = `https://api.mercadolibre.com/sites/MLB/domain_discovery/search?limit=10&q=${encodeURIComponent(query)}`;
      console.log(`[meli-search-categories] Trying domain_discovery: ${discoveryUrl}`);
      const discoveryRes = await fetch(discoveryUrl, { headers: mlHeaders });
      
      if (discoveryRes.ok) {
        const discoveryData = await discoveryRes.json();
        console.log(`[meli-search-categories] Discovery response:`, JSON.stringify(discoveryData).slice(0, 500));
        
        if (Array.isArray(discoveryData) && discoveryData.length > 0) {
          // Use the first result to get the path
          const topResult = discoveryData[0];
          if (topResult.category_id) {
            const catRes = await fetch(`https://api.mercadolibre.com/categories/${topResult.category_id}`, { headers: mlHeaders });
            if (catRes.ok) {
              const catData = await catRes.json();
              path = (catData.path_from_root || []).map((p: any) => ({ id: p.id, name: p.name }));
            } else {
              await catRes.text();
            }
          }
          
          // Map all discovery results to categories
          for (const item of discoveryData) {
            if (item.category_id) {
              categories.push({
                id: item.category_id,
                name: item.category_name || item.domain_name || item.category_id,
                domain_id: item.domain_id,
              });
            }
          }
        }
      } else {
        const errBody = await discoveryRes.text();
        console.log(`[meli-search-categories] Discovery failed: ${discoveryRes.status} - ${errBody.slice(0, 200)}`);
      }
      
      // Fallback: if domain_discovery didn't work, try /categories/ endpoint with individual category IDs
      if (categories.length === 0) {
        console.log(`[meli-search-categories] domain_discovery returned no results for "${query}"`);
      }
    } else if (parentId) {
      const res = await fetch(`https://api.mercadolibre.com/categories/${parentId}`, { headers: mlHeaders });
      if (res.ok) {
        const data = await res.json();
        // Fetch each child to get their children_count
        const childCats = data.children_categories || [];
        categories = [];
        for (const c of childCats) {
          // Check if child has children by fetching its details
          try {
            const childRes = await fetch(`https://api.mercadolibre.com/categories/${c.id}`, { headers: mlHeaders });
            if (childRes.ok) {
              const childData = await childRes.json();
              categories.push({
                id: c.id,
                name: c.name,
                total_items: c.total_items_in_this_category,
                children_count: childData.children_categories?.length || 0,
              });
            } else {
              await childRes.text();
              categories.push({
                id: c.id,
                name: c.name,
                total_items: c.total_items_in_this_category,
                children_count: 0,
              });
            }
          } catch {
            categories.push({
              id: c.id,
              name: c.name,
              total_items: c.total_items_in_this_category,
              children_count: 0,
            });
          }
        }
        path = (data.path_from_root || []).map((p: any) => ({ id: p.id, name: p.name }));
      }
    } else if (categoryId) {
      const res = await fetch(`https://api.mercadolibre.com/categories/${categoryId}`, { headers: mlHeaders });
      if (res.ok) {
        const data = await res.json();
        categories = [{
          id: data.id,
          name: data.name,
          children_count: data.children_categories?.length || 0,
          total_items: data.total_items_in_this_category,
        }];
        path = (data.path_from_root || []).map((p: any) => ({ id: p.id, name: p.name }));
        // Extract max_title_length from category settings
        if (data.settings?.max_title_length) {
          maxTitleLength = data.settings.max_title_length;
        }
      }
    } else {
      // List root categories for MLB (hardcoded since /sites/MLB/categories now requires special auth)
      console.log(`[meli-search-categories] Using hardcoded MLB root categories`);
      categories = [
        { id: "MLB5672", name: "Acessórios para Veículos", children_count: 1 },
        { id: "MLB1071", name: "Animais", children_count: 1 },
        { id: "MLB1367", name: "Antiguidades e Coleções", children_count: 1 },
        { id: "MLB1368", name: "Arte, Papelaria e Armarinho", children_count: 1 },
        { id: "MLB1384", name: "Bebês", children_count: 1 },
        { id: "MLB1246", name: "Beleza e Cuidado Pessoal", children_count: 1 },
        { id: "MLB1132", name: "Brinquedos e Hobbies", children_count: 1 },
        { id: "MLB1430", name: "Calçados, Roupas e Bolsas", children_count: 1 },
        { id: "MLB1039", name: "Câmeras e Acessórios", children_count: 1 },
        { id: "MLB1743", name: "Carros, Motos e Outros", children_count: 1 },
        { id: "MLB1574", name: "Casa, Móveis e Decoração", children_count: 1 },
        { id: "MLB1051", name: "Celulares e Telefones", children_count: 1 },
        { id: "MLB1648", name: "Computadores", children_count: 1 },
        { id: "MLB1144", name: "Consoles e Videogames", children_count: 1 },
        { id: "MLB1500", name: "Construção", children_count: 1 },
        { id: "MLB1276", name: "Esportes e Fitness", children_count: 1 },
        { id: "MLB263532", name: "Eletrônicos, Áudio e Vídeo", children_count: 1 },
        { id: "MLB1000", name: "Eletrodomésticos", children_count: 1 },
        { id: "MLB12404", name: "Ferramentas", children_count: 1 },
        { id: "MLB1182", name: "Instrumentos Musicais", children_count: 1 },
        { id: "MLB3937", name: "Joias e Relógios", children_count: 1 },
        { id: "MLB1196", name: "Livros, Revistas e Comics", children_count: 1 },
        { id: "MLB1168", name: "Música, Filmes e Seriados", children_count: 1 },
        { id: "MLB264586", name: "Saúde", children_count: 1 },
        { id: "MLB1540", name: "Serviços", children_count: 1 },
        { id: "MLB1953", name: "Mais Categorias", children_count: 1 },
      ];
    }

    const responsePayload: any = { success: true, categories, path };
    if (maxTitleLength !== null) {
      responsePayload.max_title_length = maxTitleLength;
    }

    return new Response(
      JSON.stringify(responsePayload),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[meli-search-categories] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
