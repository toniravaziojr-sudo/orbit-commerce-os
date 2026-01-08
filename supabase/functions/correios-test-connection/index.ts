// ============================================
// CORREIOS TEST CONNECTION
// Tests Correios OAuth2 or Token authentication
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CORREIOS_TOKEN_URL = "https://api.correios.com.br/token/v1/autentica/cartaopostagem";
const CORREIOS_CEP_URL = "https://api.correios.com.br/cep/v2/enderecos";

interface TestRequest {
  auth_mode: 'oauth' | 'token';
  usuario?: string;
  senha?: string;
  cartao_postagem?: string;
  token?: string;
}

interface TestResult {
  success: boolean;
  auth_mode: string;
  token_expires_at?: string;
  cep_lookup_works?: boolean;
  error?: string;
  error_code?: string;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication failed" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const body: TestRequest = await req.json();
    const { auth_mode, usuario, senha, cartao_postagem, token } = body;

    console.log(`[correios-test] Testing auth_mode=${auth_mode} for user=${user.id}`);

    let result: TestResult;

    if (auth_mode === 'oauth') {
      // Validate required fields
      if (!usuario || !senha || !cartao_postagem) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Campos obrigatórios: usuário, senha e cartão de postagem",
            error_code: "MISSING_FIELDS"
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      result = await testOAuthAuth(usuario, senha, cartao_postagem);
    } else if (auth_mode === 'token') {
      // Validate required fields
      if (!token) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Token CWS é obrigatório",
            error_code: "MISSING_TOKEN"
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      result = await testTokenAuth(token);
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Modo de autenticação inválido",
          error_code: "INVALID_AUTH_MODE"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[correios-test] Result: success=${result.success}`);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[correios-test] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro interno",
        error_code: "INTERNAL_ERROR"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function testOAuthAuth(usuario: string, senha: string, cartao_postagem: string): Promise<TestResult> {
  try {
    // Step 1: Authenticate with Correios OAuth2
    const authResponse = await fetch(CORREIOS_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(`${usuario}:${senha}`)}`,
      },
      body: JSON.stringify({ numero: cartao_postagem }),
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error(`[correios-test] OAuth failed: ${authResponse.status} - ${errorText}`);

      if (authResponse.status === 401) {
        return {
          success: false,
          auth_mode: 'oauth',
          error: "Credenciais inválidas. Verifique usuário e senha.",
          error_code: "INVALID_CREDENTIALS"
        };
      }

      if (authResponse.status === 400) {
        return {
          success: false,
          auth_mode: 'oauth',
          error: "Cartão de postagem inválido ou não vinculado ao CNPJ.",
          error_code: "INVALID_POSTAGE_CARD"
        };
      }

      return {
        success: false,
        auth_mode: 'oauth',
        error: `Erro na autenticação: ${authResponse.status}`,
        error_code: "AUTH_ERROR"
      };
    }

    const authData = await authResponse.json();
    const accessToken = authData.token;
    const expiresAt = authData.expiraEm; // ISO date string

    // Step 2: Test a simple CEP lookup to validate permissions
    const cepResult = await testCepLookup(accessToken);

    return {
      success: true,
      auth_mode: 'oauth',
      token_expires_at: expiresAt,
      cep_lookup_works: cepResult.success,
      ...(cepResult.success ? {} : { error: cepResult.error })
    };

  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return {
        success: false,
        auth_mode: 'oauth',
        error: "Timeout na conexão com Correios. Tente novamente.",
        error_code: "TIMEOUT"
      };
    }

    console.error("[correios-test] OAuth error:", error);
    return {
      success: false,
      auth_mode: 'oauth',
      error: error instanceof Error ? error.message : "Erro desconhecido",
      error_code: "UNKNOWN_ERROR"
    };
  }
}

async function testTokenAuth(token: string): Promise<TestResult> {
  try {
    // Try to decode token to get expiration (JWT)
    let tokenExpiresAt: string | undefined;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp) {
          const expDate = new Date(payload.exp * 1000);
          tokenExpiresAt = expDate.toISOString();
          
          // Check if already expired
          if (expDate < new Date()) {
            return {
              success: false,
              auth_mode: 'token',
              token_expires_at: tokenExpiresAt,
              error: "Token expirado. Gere um novo token no portal CWS.",
              error_code: "TOKEN_EXPIRED"
            };
          }
        }
      }
    } catch {
      // Token might not be a valid JWT, continue with API test
    }

    // Test the token with a simple CEP lookup
    const cepResult = await testCepLookup(token);

    if (!cepResult.success) {
      // Check if it's an auth error
      if (cepResult.errorCode === 'UNAUTHORIZED') {
        return {
          success: false,
          auth_mode: 'token',
          token_expires_at: tokenExpiresAt,
          error: "Token inválido ou expirado. Gere um novo token no portal CWS.",
          error_code: "INVALID_TOKEN"
        };
      }

      return {
        success: false,
        auth_mode: 'token',
        token_expires_at: tokenExpiresAt,
        error: cepResult.error || "Erro ao validar token",
        error_code: cepResult.errorCode || "VALIDATION_ERROR"
      };
    }

    return {
      success: true,
      auth_mode: 'token',
      token_expires_at: tokenExpiresAt,
      cep_lookup_works: true
    };

  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return {
        success: false,
        auth_mode: 'token',
        error: "Timeout na conexão com Correios. Tente novamente.",
        error_code: "TIMEOUT"
      };
    }

    console.error("[correios-test] Token error:", error);
    return {
      success: false,
      auth_mode: 'token',
      error: error instanceof Error ? error.message : "Erro desconhecido",
      error_code: "UNKNOWN_ERROR"
    };
  }
}

async function testCepLookup(token: string): Promise<{ success: boolean; error?: string; errorCode?: string }> {
  try {
    // Use a well-known CEP for testing (Correios HQ in Brasilia)
    const testCep = "70002900";
    
    const response = await fetch(`${CORREIOS_CEP_URL}/${testCep}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (response.status === 401 || response.status === 403) {
      return { success: false, error: "Token não autorizado", errorCode: "UNAUTHORIZED" };
    }

    if (!response.ok) {
      return { success: false, error: `Erro na consulta: ${response.status}`, errorCode: "API_ERROR" };
    }

    return { success: true };

  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return { success: false, error: "Timeout na consulta de CEP", errorCode: "TIMEOUT" };
    }
    return { success: false, error: "Erro ao testar conexão", errorCode: "UNKNOWN" };
  }
}
