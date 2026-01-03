// ============================================
// INTEGRATION CONFIG - Server-side config management
// Handles payment/shipping provider configs securely
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Mask sensitive credentials for safe display
function maskCredential(value: string | undefined): string {
  if (!value) return '';
  if (value.length <= 8) return '••••••••';
  return '••••••' + value.slice(-4);
}

// Check if running with fallback (Secrets) or database config
// NOTE: Frenet removed from fallback - pure multi-tenant model, each tenant uses their own token
function getEnvFallback(provider: string): Record<string, string> {
  if (provider === 'pagarme') {
    return {
      api_key: Deno.env.get('PAGARME_API_KEY') || '',
      account_id: Deno.env.get('PAGARME_ACCOUNT_ID') || '',
      public_key: Deno.env.get('PAGARME_PUBLIC_KEY') || '',
    };
  }
  // Frenet: No fallback - tenants must configure their own token
  return {};
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header and verify user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authorization required');
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Verify JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authorization');
    }

    // Handle POST requests with body-based action
    if (req.method === 'POST') {
      const body = await req.json();
      const { action } = body;

      // System email config actions
      if (action === 'get-system-email-config') {
        // Check if user is platform operator (owner of any tenant)
        const { data: roles } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'owner')
          .limit(1);

        if (!roles || roles.length === 0) {
          throw new Error('Apenas operadores da plataforma podem acessar');
        }

        const { data: config, error } = await supabaseClient
          .from('system_email_config')
          .select('*')
          .limit(1)
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        return new Response(JSON.stringify({ config: config || null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'update-system-email-config') {
        const { from_name, from_email, reply_to } = body;

        // Check if user is platform operator
        const { data: roles } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'owner')
          .limit(1);

        if (!roles || roles.length === 0) {
          throw new Error('Apenas operadores da plataforma podem editar');
        }

        const { data: config, error: fetchError } = await supabaseClient
          .from('system_email_config')
          .select('*')
          .limit(1)
          .single();

        if (fetchError) throw fetchError;

        const { error: updateError } = await supabaseClient
          .from('system_email_config')
          .update({
            from_name,
            from_email,
            reply_to,
          })
          .eq('id', config.id);

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'reset-system-email-config') {
        // Check if user is platform operator
        const { data: roles } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'owner')
          .limit(1);

        if (!roles || roles.length === 0) {
          throw new Error('Apenas operadores da plataforma podem editar');
        }

        const { data: config, error: fetchError } = await supabaseClient
          .from('system_email_config')
          .select('*')
          .limit(1)
          .single();

        if (fetchError) throw fetchError;

        // Reset domain-related fields only (from_name/from_email are NOT NULL)
        const { error: updateError } = await supabaseClient
          .from('system_email_config')
          .update({
            sending_domain: null,
            resend_domain_id: null,
            dns_records: [],
            verification_status: 'not_started',
            verified_at: null,
            last_verify_check_at: null,
            last_verify_error: null,
            last_test_at: null,
            last_test_result: null,
            provider_type: 'sendgrid',
          })
          .eq('id', config.id);

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const providerType = url.searchParams.get('type'); // 'payment' or 'shipping'
    
    // GET: Load provider configs (masked)
    if (req.method === 'GET' && action === 'list') {
      const tenantId = url.searchParams.get('tenant_id');
      if (!tenantId) throw new Error('tenant_id required');

      // Verify user belongs to tenant
      const { data: userRole } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .single();

      if (!userRole) {
        throw new Error('Access denied to this tenant');
      }

      if (providerType === 'payment') {
        const { data: providers } = await supabaseClient
          .from('payment_providers')
          .select('*')
          .eq('tenant_id', tenantId);

        // Mask credentials and add fallback status
        const masked = (providers || []).map(p => ({
          ...p,
          credentials: Object.fromEntries(
            Object.entries(p.credentials || {}).map(([k, v]) => [k, maskCredential(v as string)])
          ),
          has_credentials: Object.values(p.credentials || {}).some(v => v && (v as string).length > 0),
        }));

        // Check if fallback is active (no DB config but Secrets exist)
        const envFallback = getEnvFallback('pagarme');
        const hasFallback = Object.values(envFallback).some(v => v.length > 0);
        const hasDbConfig = masked.some(p => p.has_credentials);

        return new Response(JSON.stringify({
          providers: masked,
          fallback_active: hasFallback && !hasDbConfig,
          fallback_provider: hasFallback ? 'pagarme' : null,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (providerType === 'shipping') {
        const { data: providers } = await supabaseClient
          .from('shipping_providers')
          .select('*')
          .eq('tenant_id', tenantId);

        const masked = (providers || []).map(p => ({
          ...p,
          credentials: Object.fromEntries(
            Object.entries(p.credentials || {}).map(([k, v]) => [k, maskCredential(v as string)])
          ),
          has_credentials: Object.values(p.credentials || {}).some(v => v && (v as string).length > 0),
        }));

        const envFallback = getEnvFallback('frenet');
        const hasFallback = Object.values(envFallback).some(v => v.length > 0);
        const hasDbConfig = masked.some(p => p.has_credentials);

        return new Response(JSON.stringify({
          providers: masked,
          fallback_active: hasFallback && !hasDbConfig,
          fallback_provider: hasFallback ? 'frenet' : null,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // POST: Save provider config
    if (req.method === 'POST' && action === 'save') {
      const body = await req.json();
      const { tenant_id, provider, is_enabled, environment, credentials, settings } = body;

      if (!tenant_id || !provider) {
        throw new Error('tenant_id and provider required');
      }

      // Verify user has admin access
      const { data: userRole } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('tenant_id', tenant_id)
        .single();

      if (!userRole || !['owner', 'admin'].includes(userRole.role)) {
        throw new Error('Admin access required');
      }

      // Log the change (audit)
      console.log(`[AUDIT] User ${user.id} updating ${providerType} provider ${provider} for tenant ${tenant_id}`);

      if (providerType === 'payment') {
        // Check if exists
        const { data: existing } = await supabaseClient
          .from('payment_providers')
          .select('id, credentials')
          .eq('tenant_id', tenant_id)
          .eq('provider', provider)
          .single();

        // Merge credentials - only update non-empty values (preserve existing if not provided)
        let finalCredentials = credentials || {};
        if (existing?.credentials) {
          finalCredentials = { ...existing.credentials };
          for (const [key, value] of Object.entries(credentials || {})) {
            // Only update if new value is provided and not masked placeholder
            if (value && !(value as string).startsWith('••••')) {
              finalCredentials[key] = value;
            }
          }
        }

        if (existing) {
          const { error } = await supabaseClient
            .from('payment_providers')
            .update({
              is_enabled,
              environment: environment || 'sandbox',
              credentials: finalCredentials,
              settings: settings || {},
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (error) throw error;
        } else {
          const { error } = await supabaseClient
            .from('payment_providers')
            .insert({
              tenant_id,
              provider,
              is_enabled: is_enabled ?? false,
              environment: environment || 'sandbox',
              credentials: finalCredentials,
              settings: settings || {},
            });

          if (error) throw error;
        }
      }

      if (providerType === 'shipping') {
        const { data: existing } = await supabaseClient
          .from('shipping_providers')
          .select('id, credentials')
          .eq('tenant_id', tenant_id)
          .eq('provider', provider)
          .single();

        let finalCredentials = credentials || {};
        if (existing?.credentials) {
          finalCredentials = { ...existing.credentials };
          for (const [key, value] of Object.entries(credentials || {})) {
            if (value && !(value as string).startsWith('••••')) {
              finalCredentials[key] = value;
            }
          }
        }

        if (existing) {
          const { error } = await supabaseClient
            .from('shipping_providers')
            .update({
              is_enabled,
              credentials: finalCredentials,
              settings: settings || {},
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (error) throw error;
        } else {
          const { error } = await supabaseClient
            .from('shipping_providers')
            .insert({
              tenant_id,
              provider,
              is_enabled: is_enabled ?? false,
              credentials: finalCredentials,
              settings: settings || {},
            });

          if (error) throw error;
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST: Test connection
    if (req.method === 'POST' && action === 'test') {
      const body = await req.json();
      const { tenant_id, provider } = body;

      if (!tenant_id || !provider) {
        throw new Error('tenant_id and provider required');
      }

      // Verify user access
      const { data: userRole } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('tenant_id', tenant_id)
        .single();

      if (!userRole) {
        throw new Error('Access denied');
      }

      if (provider === 'pagarme') {
        // Get credentials from DB or fallback
        let apiKey = '';
        const { data: dbProvider } = await supabaseClient
          .from('payment_providers')
          .select('credentials')
          .eq('tenant_id', tenant_id)
          .eq('provider', 'pagarme')
          .single();

        if (dbProvider?.credentials?.api_key) {
          apiKey = dbProvider.credentials.api_key;
        } else {
          apiKey = Deno.env.get('PAGARME_API_KEY') || '';
        }

        if (!apiKey) {
          return new Response(JSON.stringify({
            success: false,
            message: 'API Key não configurada',
            source: 'none',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Test Pagar.me connection
        try {
          const authHeader = btoa(`${apiKey}:`);
          const response = await fetch('https://api.pagar.me/core/v5/customers?size=1', {
            headers: { 'Authorization': `Basic ${authHeader}` },
          });

          const isDb = !!dbProvider?.credentials?.api_key;
          
          if (response.ok) {
            return new Response(JSON.stringify({
              success: true,
              message: 'Conexão estabelecida com sucesso',
              source: isDb ? 'database' : 'fallback (Secrets)',
              tested_at: new Date().toISOString(),
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          } else {
            const err = await response.json();
            return new Response(JSON.stringify({
              success: false,
              message: err.message || 'Falha na autenticação',
              source: isDb ? 'database' : 'fallback (Secrets)',
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } catch (e) {
          return new Response(JSON.stringify({
            success: false,
            message: 'Erro de conexão com Pagar.me',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      if (provider === 'frenet') {
        // Pure multi-tenant: NO fallback to env vars
        const { data: dbProvider } = await supabaseClient
          .from('shipping_providers')
          .select('credentials, settings')
          .eq('tenant_id', tenant_id)
          .eq('provider', 'frenet')
          .single();

        if (!dbProvider?.credentials?.token) {
          return new Response(JSON.stringify({
            success: false,
            message: 'Token Frenet não configurado. Insira seu token acima.',
            source: 'none',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const token = dbProvider.credentials.token;
        const originCep = dbProvider.credentials.seller_cep || dbProvider.settings?.origin_cep;
        
        if (!originCep) {
          return new Response(JSON.stringify({
            success: false,
            message: 'CEP de origem não configurado. Insira o CEP de origem acima.',
            source: 'database',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Test Frenet connection with a simple quote
        try {
          const testPayload = {
            SellerCEP: originCep.replace(/\D/g, ''),
            RecipientCEP: '04543000',
            ShipmentInvoiceValue: 100,
            ShippingItemArray: [{
              Height: 10,
              Length: 10,
              Width: 10,
              Weight: 0.5,
              Quantity: 1,
              SKU: 'TEST',
              Category: 'Geral'
            }],
            RecipientCountry: 'BR'
          };

          const response = await fetch('https://api.frenet.com.br/shipping/quote', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'token': token
            },
            body: JSON.stringify(testPayload)
          });

          const data = await response.json();

          if (response.ok && data.ShippingSevicesArray) {
            return new Response(JSON.stringify({
              success: true,
              message: `Conexão OK - ${data.ShippingSevicesArray.length} serviços disponíveis`,
              origin_cep: originCep,
              tested_at: new Date().toISOString(),
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          } else {
            return new Response(JSON.stringify({
              success: false,
              message: data.Message || 'Token inválido ou sem permissão',
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } catch (e) {
          return new Response(JSON.stringify({
            success: false,
            message: 'Erro de conexão com Frenet - verifique sua internet',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response(JSON.stringify({
        success: false,
        message: 'Provider não suportado',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');

  } catch (error: any) {
    console.error('Integration config error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
