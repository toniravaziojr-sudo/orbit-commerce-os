/**
 * Health Check para o serviço de importação
 * Verifica se o serviço está online e acessível
 */

const DEPLOY_VERSION = '2026-01-08.2115';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    const healthData = {
      success: true,
      service: 'import-data',
      version: DEPLOY_VERSION,
      deployedAt: new Date().toISOString(),
      status: 'online',
      capabilities: ['products', 'categories', 'customers', 'orders'],
      maxBatchSize: 50,
    };

    console.log('[import-data-health] Health check OK:', healthData);

    return new Response(
      JSON.stringify(healthData),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: any) {
    console.error('[import-data-health] Health check failed:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Health check failed',
        message: error?.message || String(error)
      }),
      { 
        status: 200, // Return 200 even on error (business error pattern)
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
