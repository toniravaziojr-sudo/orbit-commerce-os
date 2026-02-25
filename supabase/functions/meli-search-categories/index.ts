import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Mercado Livre Category Search
 * 
 * Busca categorias do ML via API pública.
 * - GET ?q=celular → Busca por texto (category_predictor)
 * - GET ?parentId=MLB5672 → Lista subcategorias
 * - GET ?categoryId=MLB1055 → Detalhes de uma categoria
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    if (query) {
      // Try category predictor first
      const predictorUrl = `https://api.mercadolibre.com/sites/MLB/category_predictor/predict?title=${encodeURIComponent(query)}`;
      console.log(`[meli-search-categories] Trying predictor: ${predictorUrl}`);
      const predictRes = await fetch(predictorUrl, { headers: mlHeaders });
      
      if (predictRes.ok) {
        const predictData = await predictRes.json();
        console.log(`[meli-search-categories] Predictor response:`, JSON.stringify(predictData).slice(0, 500));
        
        if (predictData.id) {
          const catRes = await fetch(`https://api.mercadolibre.com/categories/${predictData.id}`, { headers: mlHeaders });
          if (catRes.ok) {
            const catData = await catRes.json();
            path = (catData.path_from_root || []).map((p: any) => ({ id: p.id, name: p.name }));
            categories.push({
              id: catData.id,
              name: catData.name,
              total_items: catData.total_items_in_this_category,
            });
            if (catData.children_categories?.length > 0) {
              for (const child of catData.children_categories.slice(0, 15)) {
                categories.push({ id: child.id, name: child.name, total_items: child.total_items_in_this_category });
              }
            }
          }
        }
      } else {
        console.log(`[meli-search-categories] Predictor failed: ${predictRes.status}`);
      }
      
      // Fallback: search and extract category filter from results
      if (categories.length === 0) {
        const searchUrl = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=50`;
        console.log(`[meli-search-categories] Trying search fallback`);
        const res2 = await fetch(searchUrl, { headers: mlHeaders });
        if (res2.ok) {
          const searchData = await res2.json();
          
          // Try available_filters first, then filters
          let catFilter = (searchData.available_filters || []).find((f: any) => f.id === "category");
          if (!catFilter) {
            catFilter = (searchData.filters || []).find((f: any) => f.id === "category");
          }
          
          if (catFilter?.values) {
            categories = catFilter.values.map((v: any) => ({
              id: v.id,
              name: v.name,
              results: v.results,
            }));
          }
          
          // If still nothing, extract unique categories from search results
          if (categories.length === 0 && searchData.results?.length > 0) {
            const catMap = new Map<string, string>();
            for (const item of searchData.results) {
              if (item.category_id && !catMap.has(item.category_id)) {
                catMap.set(item.category_id, item.category_id);
              }
            }
            // Fetch category details for each unique category
            for (const catId of Array.from(catMap.keys()).slice(0, 10)) {
              try {
                const catRes = await fetch(`https://api.mercadolibre.com/categories/${catId}`, { headers: mlHeaders });
                if (catRes.ok) {
                  const catData = await catRes.json();
                  categories.push({
                    id: catData.id,
                    name: (catData.path_from_root || []).map((p: any) => p.name).join(" > "),
                  });
                }
              } catch { /* skip */ }
            }
          }
          
          console.log(`[meli-search-categories] Search fallback found ${categories.length} categories`);
        } else {
          console.log(`[meli-search-categories] Search failed: ${res2.status}`);
        }
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
      }
    } else {
      // List root categories for MLB
      console.log(`[meli-search-categories] Fetching root categories`);
      const res = await fetch("https://api.mercadolibre.com/sites/MLB/categories", { headers: mlHeaders });
      console.log(`[meli-search-categories] Root categories status: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        categories = (data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          children_count: 1, // Root categories always have children
        }));
      }
    }

    return new Response(
      JSON.stringify({ success: true, categories, path }),
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
