import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Register (or re-register) a WhatsApp phone number on Meta Cloud API.
 * Step 3 of the registration flow. Requires a 6-digit PIN.
 */
Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-whatsapp-register-phone][${traceId}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Não autenticado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Não autenticado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id, pin } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ success: false, error: "tenant_id é obrigatório" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PIN is mandatory
    if (!pin || !/^\d{6}$/.test(String(pin))) {
      return new Response(JSON.stringify({ success: false, error: "PIN de 6 dígitos é obrigatório para registrar o número." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user belongs to tenant with admin/owner role
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant_id)
      .single();

    if (!userRole || !["owner", "admin"].includes(userRole.role)) {
      return new Response(JSON.stringify({ success: false, error: "Permissão negada" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get WhatsApp config for this tenant
    const { data: config, error: configError } = await supabase
      .from("whatsapp_configs")
      .select("id, phone_number_id, waba_id, access_token, token_expires_at")
      .eq("tenant_id", tenant_id)
      .eq("provider", "meta")
      .single();

    if (configError || !config) {
      return new Response(JSON.stringify({ success: false, error: "Configuração WhatsApp não encontrada. Conecte primeiro." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!config.access_token) {
      return new Response(JSON.stringify({ success: false, error: "Token de acesso não disponível. Reconecte sua conta." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (config.token_expires_at && new Date(config.token_expires_at) < new Date()) {
      await supabase
        .from("whatsapp_configs")
        .update({
          connection_status: "token_invalid",
          last_error: "Token expirado. Reconecte sua conta Meta para continuar.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);
      return new Response(JSON.stringify({ success: false, error: "Token expirado. Reconecte sua conta Meta." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Graph API version
    const { data: credentials } = await supabase
      .from("platform_credentials")
      .select("credential_value")
      .eq("credential_key", "META_GRAPH_API_VERSION")
      .eq("is_active", true)
      .maybeSingle();

    const graphApiVersion = credentials?.credential_value || "v21.0";

    // ===== PRE-FLIGHT TOKEN VALIDATION =====
    // Validar token contra /me ANTES de tentar register/deregister.
    // Se o token foi invalidado (código 190), Meta rejeita silenciosamente o register
    // e o número fica preso em "pendente" para sempre. Detectamos cedo aqui.
    console.log(`[meta-whatsapp-register-phone][${traceId}] Pre-flight: validating token against /me...`);
    const meCheckUrl = `https://graph.facebook.com/${graphApiVersion}/me?access_token=${config.access_token}`;
    const meResp = await fetch(meCheckUrl);
    const meData = await meResp.json();

    if (meData.error) {
      const code = meData.error.code;
      const subcode = meData.error.error_subcode;
      const isInvalidToken = code === 190;
      const friendlyError = isInvalidToken
        ? "Sua sessão Meta expirou ou foi invalidada (provavelmente por troca de senha ou logout). Clique em Reconectar para gerar uma nova autorização."
        : `Token Meta rejeitado: ${meData.error.message || "erro desconhecido"}`;

      await supabase
        .from("whatsapp_configs")
        .update({
          connection_status: isInvalidToken ? "token_invalid" : "pending_registration",
          last_error: `${friendlyError} [code=${code}, subcode=${subcode}]`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);

      console.error(`[meta-whatsapp-register-phone][${traceId}] Pre-flight failed:`, JSON.stringify(meData.error));

      return new Response(JSON.stringify({
        success: false,
        error: friendlyError,
        token_invalid: isInvalidToken,
        meta_diagnostic: { preflight: { code, subcode, message: meData.error.message } },
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[meta-whatsapp-register-phone][${traceId}] Pre-flight OK — token valid for user ${meData.id}`);

    // Step 1: Deregister the phone number first to clear residual state (2FA/registration)
    console.log(`[meta-whatsapp-register-phone][${traceId}] Step 1: Deregistering phone ${config.phone_number_id} to clear residual state...`);
    
    const deregisterUrl = `https://graph.facebook.com/${graphApiVersion}/${config.phone_number_id}/deregister`;
    const deregisterResponse = await fetch(deregisterUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.access_token}`,
      },
      body: JSON.stringify({ messaging_product: "whatsapp" }),
    });
    const deregisterData = await deregisterResponse.json();
    
    const deregisterDiagnostic = {
      http_status: deregisterResponse.status,
      success: deregisterData.success === true,
      error_message: deregisterData.error?.message || null,
      error_code: deregisterData.error?.code || null,
      error_subcode: deregisterData.error?.error_subcode || null,
      fbtrace_id: deregisterData.error?.fbtrace_id || null,
    };
    
    console.log(`[meta-whatsapp-register-phone][${traceId}] Deregister result:`, JSON.stringify(deregisterDiagnostic));

    // Step 2: Register the phone number on Cloud API
    console.log(`[meta-whatsapp-register-phone][${traceId}] Step 2: Registering phone ${config.phone_number_id}...`);
    
    const registerUrl = `https://graph.facebook.com/${graphApiVersion}/${config.phone_number_id}/register`;
    const registerResponse = await fetch(registerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.access_token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        pin: String(pin),
      }),
    });
    const registerData = await registerResponse.json();

    console.log(`[meta-whatsapp-register-phone][${traceId}] Register response:`, JSON.stringify(registerData));

    // Build raw diagnostic object for every attempt
    const metaDiagnostic = {
      deregister: deregisterDiagnostic,
      register: {
        http_status: registerResponse.status,
        error_message: registerData.error?.message || null,
        error_code: registerData.error?.code || null,
        error_subcode: registerData.error?.error_subcode || null,
        fbtrace_id: registerData.error?.fbtrace_id || null,
        error_user_msg: registerData.error?.error_user_msg || null,
        raw_success: registerData.success,
      },
      timestamp: new Date().toISOString(),
      trace_id: traceId,
      endpoint_called: registerUrl,
      phone_number_id_used: config.phone_number_id,
    };

    console.log(`[meta-whatsapp-register-phone][${traceId}] Meta diagnostic:`, JSON.stringify(metaDiagnostic));

    if (registerData.success === true) {
      // Update status to connected
      await supabase
        .from("whatsapp_configs")
        .update({
          connection_status: "connected",
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);

      console.log(`[meta-whatsapp-register-phone][${traceId}] Phone registered successfully!`);

      return new Response(JSON.stringify({
        success: true,
        message: "Número registrado com sucesso na Cloud API!",
        meta_diagnostic: metaDiagnostic,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const errorMsg = registerData.error?.message || JSON.stringify(registerData);
      const errorCode = registerData.error?.code;
      const errorSubcode = registerData.error?.error_subcode;
      const errorUserMsg = registerData.error?.error_user_msg;
      
      // Precise error normalization — do NOT lump everything as "PIN inválido"
      let friendlyError: string;
      
      if (errorSubcode === 2388001 && errorCode === 100) {
        // subcode 2388001 + code 100 = Meta rejected the register call.
        // This can mean: wrong PIN, 2FA state mismatch, number not ready, or parameter issue.
        // Show the REAL Meta message instead of assuming "wrong PIN".
        const metaUserMsg = errorUserMsg || errorMsg || "Parâmetro inválido";
        friendlyError = `A Meta rejeitou o registro do número. Motivo informado pela Meta: "${metaUserMsg}"`;
      } else if (errorSubcode === 136025) {
        friendlyError = "Número já registrado em outra conta. Desregistre o número da conta atual antes de registrar aqui.";
      } else if (errorCode === 100) {
        friendlyError = `A Meta rejeitou um parâmetro da requisição. Detalhe: ${errorMsg}${errorUserMsg ? ` — ${errorUserMsg}` : ""}`;
      } else if (errorMsg) {
        friendlyError = `Erro da Meta: ${errorMsg}${errorUserMsg ? ` — ${errorUserMsg}` : ""}`;
      } else {
        friendlyError = "Não foi possível finalizar o registro agora. Tente novamente em instantes.";
      }
      
      // Save friendly error + raw diagnostic in last_error for debugging
      const diagnosticSummary = `${friendlyError} [code=${errorCode}, subcode=${errorSubcode}, fbtrace=${metaDiagnostic.fbtrace_id}]`;
      
      // Update with error
      await supabase
        .from("whatsapp_configs")
        .update({
          connection_status: "pending_registration",
          last_error: diagnosticSummary,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);

      console.error(`[meta-whatsapp-register-phone][${traceId}] Register failed:`, errorMsg);

      return new Response(JSON.stringify({
        success: false,
        error: friendlyError,
        meta_diagnostic: metaDiagnostic,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (error) {
    console.error(`[meta-whatsapp-register-phone][${traceId}] Error:`, error);
    return errorResponse(error, corsHeaders, { module: 'whatsapp-register', action: 'register' });
  }
});
