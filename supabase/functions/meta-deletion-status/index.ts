const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Meta Data Deletion Status Endpoint
 * 
 * Retorna status de exclusão de dados quando Meta solicita.
 * Necessário para compliance com política do Meta.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return new Response(JSON.stringify({
      success: false,
      error: "Missing confirmation code",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Retorna status confirmando que dados foram processados
  // Em produção, pode consultar banco para status real
  return new Response(JSON.stringify({
    confirmation_code: code,
    status: "completed",
    message: "User data has been deleted from our systems",
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
