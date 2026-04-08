import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

const VERSION = "v1.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TIKTOK_SHOP_API = "https://open-api.tiktokglobalshop.com";

Deno.serve(async (req) => {
  console.log(`[tiktok-shop-stock-sync][${VERSION}] Request received`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Missing authorization' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { tenantId, action } = body;

    if (!tenantId) {
      return new Response(JSON.stringify({ success: false, error: 'tenant_id obrigatório' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[tiktok-shop-stock-sync][${VERSION}] Action: ${action}, tenant: ${tenantId}`);

    const { data: connection } = await supabase
      .from('tiktok_shop_connections')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (!connection) {
      return new Response(JSON.stringify({ success: false, error: 'TikTok Shop não conectado' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = connection.access_token;
    const shopId = connection.shop_id;

    // Get app credentials
    const appKey = await getCredential(supabase, tenantId, 'TIKTOK_SHOP_APP_KEY');
    if (!appKey) {
      return new Response(JSON.stringify({ success: false, error: 'TIKTOK_SHOP_APP_KEY not configured' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    switch (action) {
      case 'sync_from_tiktok': {
        // Pull stock quantities from TikTok Shop for synced products
        const { data: syncedProducts } = await supabase
          .from('tiktok_shop_products')
          .select('id, product_id, tiktok_product_id, tiktok_sku_id')
          .eq('tenant_id', tenantId)
          .eq('status', 'synced')
          .not('tiktok_product_id', 'is', null);

        if (!syncedProducts || syncedProducts.length === 0) {
          return new Response(JSON.stringify({ success: true, synced: 0, message: 'No synced products' }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        let synced = 0;
        for (const sp of syncedProducts) {
          try {
            // Fetch product detail from TikTok to get stock
            const detailUrl = `${TIKTOK_SHOP_API}/api/products/details?app_key=${appKey}&access_token=${accessToken}&shop_id=${shopId}&product_id=${sp.tiktok_product_id}`;
            
            const detailRes = await fetch(detailUrl);
            const detailData = await detailRes.json();

            if (detailData.code === 0 && detailData.data) {
              const skus = detailData.data.skus || [];
              let totalStock = 0;
              for (const sku of skus) {
                totalStock += (sku.stock_infos?.[0]?.available_stock || 0);
              }

              await supabase
                .from('tiktok_shop_products')
                .update({
                  stock_quantity: totalStock,
                  stock_synced_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', sp.id);

              synced++;
            }
          } catch (err) {
            console.error(`[tiktok-shop-stock-sync] Error fetching stock for ${sp.tiktok_product_id}:`, err);
          }
        }

        console.log(`[tiktok-shop-stock-sync][${VERSION}] Synced stock for ${synced}/${syncedProducts.length} products`);

        return new Response(JSON.stringify({ success: true, synced, total: syncedProducts.length }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'push_to_tiktok': {
        // Push local stock to TikTok Shop
        const { data: syncedProducts } = await supabase
          .from('tiktok_shop_products')
          .select('id, product_id, tiktok_product_id, tiktok_sku_id')
          .eq('tenant_id', tenantId)
          .eq('status', 'synced')
          .not('tiktok_product_id', 'is', null)
          .not('tiktok_sku_id', 'is', null);

        if (!syncedProducts || syncedProducts.length === 0) {
          return new Response(JSON.stringify({ success: true, pushed: 0, message: 'No synced products with SKU' }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get local product stock
        const productIds = syncedProducts.map(sp => sp.product_id);
        const { data: localProducts } = await supabase
          .from('products')
          .select('id, stock')
          .in('id', productIds);

        const stockMap = new Map((localProducts || []).map(p => [p.id, p.stock || 0]));

        let pushed = 0;
        for (const sp of syncedProducts) {
          const localStock = stockMap.get(sp.product_id) || 0;
          try {
            const updateUrl = `${TIKTOK_SHOP_API}/api/products/stocks`;
            const updateRes = await fetch(updateUrl, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'x-tts-access-token': accessToken,
              },
              body: JSON.stringify({
                app_key: appKey,
                shop_id: shopId,
                product_id: sp.tiktok_product_id,
                skus: [{
                  id: sp.tiktok_sku_id,
                  stock_infos: [{
                    available_stock: localStock,
                  }],
                }],
              }),
            });

            const updateData = await updateRes.json();
            if (updateData.code === 0) {
              await supabase
                .from('tiktok_shop_products')
                .update({
                  stock_quantity: localStock,
                  stock_synced_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', sp.id);
              pushed++;
            } else {
              console.error(`[tiktok-shop-stock-sync] Push error for ${sp.tiktok_product_id}:`, updateData);
            }
          } catch (err) {
            console.error(`[tiktok-shop-stock-sync] Push error for ${sp.tiktok_product_id}:`, err);
          }
        }

        console.log(`[tiktok-shop-stock-sync][${VERSION}] Pushed stock for ${pushed}/${syncedProducts.length} products`);

        return new Response(JSON.stringify({ success: true, pushed, total: syncedProducts.length }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ success: false, error: `Unknown action: ${action}` }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (err) {
    console.error(`[tiktok-shop-stock-sync][${VERSION}] Error:`, err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
