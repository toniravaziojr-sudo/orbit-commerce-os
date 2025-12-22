import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckResult {
  name: string;
  status: 'pass' | 'fail';
  message: string;
  duration_ms?: number;
}

interface SuiteResult {
  suite: string;
  status: 'pass' | 'fail' | 'partial';
  checks: CheckResult[];
  duration_ms: number;
}

interface Target {
  id: string;
  tenant_id: string;
  label: string;
  storefront_base_url: string;
  shops_base_url: string | null;
  test_coupon_code: string | null;
}

// Helper to measure execution time
function measure<T>(fn: () => Promise<T>): Promise<{ result: T; duration_ms: number }> {
  const start = Date.now();
  return fn().then(result => ({ result, duration_ms: Date.now() - start }));
}

// Suite A: Domínios e URLs
async function runDomainChecks(target: Target): Promise<SuiteResult> {
  const checks: CheckResult[] = [];
  const start = Date.now();

  // Check custom domain
  if (target.storefront_base_url) {
    try {
      const { result: response, duration_ms } = await measure(() => 
        fetch(target.storefront_base_url, { 
          method: 'GET',
          headers: { 'User-Agent': 'HealthMonitor/1.0' },
          redirect: 'follow'
        })
      );

      if (response.ok) {
        const html = await response.text();
        
        // Check for app.comandocentral.com.br (should NOT exist)
        if (html.includes('app.comandocentral.com.br')) {
          checks.push({
            name: 'custom_domain_no_app_url',
            status: 'fail',
            message: `Encontrado app.comandocentral.com.br no HTML do domínio custom`,
            duration_ms
          });
        } else {
          checks.push({
            name: 'custom_domain_no_app_url',
            status: 'pass',
            message: 'Nenhuma referência a app.comandocentral no domínio custom',
            duration_ms
          });
        }

        // Check for /store/ links in custom domain (should NOT exist)
        // More specific pattern to avoid false positives
        const storePattern = /href=["'][^"']*\/store\/[^"']+["']/gi;
        if (storePattern.test(html)) {
          checks.push({
            name: 'custom_domain_no_store_path',
            status: 'fail',
            message: 'Encontrado link com /store/ no domínio custom (hardcode)',
            duration_ms
          });
        } else {
          checks.push({
            name: 'custom_domain_no_store_path',
            status: 'pass',
            message: 'Nenhum link com /store/ hardcoded no domínio custom',
            duration_ms
          });
        }
      } else {
        checks.push({
          name: 'custom_domain_accessible',
          status: 'fail',
          message: `Domínio custom retornou status ${response.status}`,
          duration_ms
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      checks.push({
        name: 'custom_domain_accessible',
        status: 'fail',
        message: `Erro ao acessar domínio custom: ${errorMessage}`
      });
    }
  }

  // Check shops domain
  if (target.shops_base_url) {
    try {
      const { result: response, duration_ms } = await measure(() => 
        fetch(target.shops_base_url!, { 
          method: 'GET',
          headers: { 'User-Agent': 'HealthMonitor/1.0' },
          redirect: 'follow'
        })
      );

      if (response.ok) {
        checks.push({
          name: 'shops_domain_accessible',
          status: 'pass',
          message: 'Domínio shops acessível',
          duration_ms
        });
      } else {
        checks.push({
          name: 'shops_domain_accessible',
          status: 'fail',
          message: `Domínio shops retornou status ${response.status}`,
          duration_ms
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      checks.push({
        name: 'shops_domain_accessible',
        status: 'fail',
        message: `Erro ao acessar domínio shops: ${errorMessage}`
      });
    }
  }

  const failCount = checks.filter(c => c.status === 'fail').length;
  const status = failCount === 0 ? 'pass' : failCount === checks.length ? 'fail' : 'partial';

  return {
    suite: 'domains',
    status,
    checks,
    duration_ms: Date.now() - start
  };
}

// Suite B: Checkout Session Tracking
async function runCheckoutTrackingChecks(target: Target, supabaseUrl: string, serviceRoleKey: string): Promise<SuiteResult> {
  const checks: CheckResult[] = [];
  const start = Date.now();

  try {
    // Extract host from storefront URL
    const url = new URL(target.storefront_base_url);
    const storeHost = url.hostname;

    // Test checkout-session-start
    const { result: startResponse, duration_ms: startDuration } = await measure(() =>
      fetch(`${supabaseUrl}/functions/v1/checkout-session-start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`
        },
        body: JSON.stringify({
          store_host: storeHost,
          cart_id: `health-check-${Date.now()}`,
          items_snapshot: [],
          total_estimated: 0
        })
      })
    );

    if (startResponse.ok) {
      const data = await startResponse.json();
      if (data.session_id) {
        checks.push({
          name: 'checkout_session_start',
          status: 'pass',
          message: 'Sessão de checkout criada com sucesso',
          duration_ms: startDuration
        });

        // Test heartbeat
        const { result: heartbeatResponse, duration_ms: heartbeatDuration } = await measure(() =>
          fetch(`${supabaseUrl}/functions/v1/checkout-session-heartbeat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceRoleKey}`
            },
            body: JSON.stringify({
              session_id: data.session_id,
              store_host: storeHost
            })
          })
        );

        if (heartbeatResponse.ok) {
          checks.push({
            name: 'checkout_session_heartbeat',
            status: 'pass',
            message: 'Heartbeat funcionando',
            duration_ms: heartbeatDuration
          });
        } else {
          checks.push({
            name: 'checkout_session_heartbeat',
            status: 'fail',
            message: `Heartbeat retornou status ${heartbeatResponse.status}`,
            duration_ms: heartbeatDuration
          });
        }

        // Test end session
        const { result: endResponse, duration_ms: endDuration } = await measure(() =>
          fetch(`${supabaseUrl}/functions/v1/checkout-session-end`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceRoleKey}`
            },
            body: JSON.stringify({
              session_id: data.session_id,
              store_host: storeHost
            })
          })
        );

        if (endResponse.ok) {
          checks.push({
            name: 'checkout_session_end',
            status: 'pass',
            message: 'Sessão encerrada com sucesso',
            duration_ms: endDuration
          });
        } else {
          checks.push({
            name: 'checkout_session_end',
            status: 'fail',
            message: `End session retornou status ${endResponse.status}`,
            duration_ms: endDuration
          });
        }
      } else {
        checks.push({
          name: 'checkout_session_start',
          status: 'fail',
          message: 'Sessão criada mas sem session_id',
          duration_ms: startDuration
        });
      }
    } else {
      checks.push({
        name: 'checkout_session_start',
        status: 'fail',
        message: `checkout-session-start retornou status ${startResponse.status}`,
        duration_ms: startDuration
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    checks.push({
      name: 'checkout_tracking',
      status: 'fail',
      message: `Erro no tracking de checkout: ${errorMessage}`
    });
  }

  const failCount = checks.filter(c => c.status === 'fail').length;
  const status = failCount === 0 ? 'pass' : failCount === checks.length ? 'fail' : 'partial';

  return {
    suite: 'checkout_tracking',
    status,
    checks,
    duration_ms: Date.now() - start
  };
}

// Suite C: Cupons
async function runCouponChecks(target: Target, supabaseUrl: string, serviceRoleKey: string): Promise<SuiteResult> {
  const checks: CheckResult[] = [];
  const start = Date.now();

  if (!target.test_coupon_code) {
    checks.push({
      name: 'coupon_validation',
      status: 'pass',
      message: 'Nenhum cupom de teste configurado (skip)'
    });
    return { suite: 'coupons', status: 'pass', checks, duration_ms: Date.now() - start };
  }

  try {
    const url = new URL(target.storefront_base_url);
    const storeHost = url.hostname;

    const { result: response, duration_ms } = await measure(() =>
      fetch(`${supabaseUrl}/functions/v1/discount-validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`
        },
        body: JSON.stringify({
          store_host: storeHost,
          code: target.test_coupon_code,
          subtotal: 100,
          customer_email: 'health-check@test.com'
        })
      })
    );

    if (response.ok) {
      const data = await response.json();
      if (data.valid) {
        checks.push({
          name: 'coupon_validation',
          status: 'pass',
          message: `Cupom ${target.test_coupon_code} validado com sucesso`,
          duration_ms
        });
      } else {
        checks.push({
          name: 'coupon_validation',
          status: 'fail',
          message: `Cupom inválido: ${data.error || 'motivo desconhecido'}`,
          duration_ms
        });
      }
    } else {
      checks.push({
        name: 'coupon_validation',
        status: 'fail',
        message: `discount-validate retornou status ${response.status}`,
        duration_ms
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    checks.push({
      name: 'coupon_validation',
      status: 'fail',
      message: `Erro na validação de cupom: ${errorMessage}`
    });
  }

  const failCount = checks.filter(c => c.status === 'fail').length;
  const status = failCount === 0 ? 'pass' : 'fail';

  return {
    suite: 'coupons',
    status,
    checks,
    duration_ms: Date.now() - start
  };
}

// Suite D: Pagamentos (sanidade)
async function runPaymentChecks(supabaseUrl: string, serviceRoleKey: string): Promise<SuiteResult> {
  const checks: CheckResult[] = [];
  const start = Date.now();

  try {
    // Test that reconcile-payments responds
    const { result: response, duration_ms } = await measure(() =>
      fetch(`${supabaseUrl}/functions/v1/reconcile-payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`
        },
        body: JSON.stringify({ dry_run: true })
      })
    );

    // Any response is ok for health check (even 400 means function is working)
    if (response.status < 500) {
      checks.push({
        name: 'reconcile_payments_available',
        status: 'pass',
        message: 'Edge function reconcile-payments respondendo',
        duration_ms
      });
    } else {
      checks.push({
        name: 'reconcile_payments_available',
        status: 'fail',
        message: `reconcile-payments retornou status ${response.status}`,
        duration_ms
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    checks.push({
      name: 'reconcile_payments_available',
      status: 'fail',
      message: `Erro ao acessar reconcile-payments: ${errorMessage}`
    });
  }

  const failCount = checks.filter(c => c.status === 'fail').length;
  const status = failCount === 0 ? 'pass' : 'fail';

  return {
    suite: 'payments',
    status,
    checks,
    duration_ms: Date.now() - start
  };
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Create service role client
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  console.log('[health-check-run] Starting health check run...');

  try {
    // Fetch all enabled targets
    const { data: targets, error: targetsError } = await supabase
      .from('system_health_check_targets')
      .select('*')
      .eq('is_enabled', true);

    if (targetsError) {
      console.error('[health-check-run] Error fetching targets:', targetsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch targets' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!targets || targets.length === 0) {
      console.log('[health-check-run] No enabled targets found');
      return new Response(JSON.stringify({ message: 'No targets to check' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[health-check-run] Found ${targets.length} targets to check`);

    const results: { target: Target; suites: SuiteResult[] }[] = [];

    for (const target of targets as Target[]) {
      console.log(`[health-check-run] Checking target: ${target.label}`);
      
      const suites: SuiteResult[] = [];

      // Run all suites
      const [domainResult, checkoutResult, couponResult, paymentResult] = await Promise.all([
        runDomainChecks(target),
        runCheckoutTrackingChecks(target, supabaseUrl, serviceRoleKey),
        runCouponChecks(target, supabaseUrl, serviceRoleKey),
        runPaymentChecks(supabaseUrl, serviceRoleKey)
      ]);

      suites.push(domainResult, checkoutResult, couponResult, paymentResult);

      // Determine overall status
      const criticalSuites = suites.filter(s => ['domains', 'checkout_tracking', 'coupons'].includes(s.suite));
      const criticalFails = criticalSuites.filter(s => s.status === 'fail').length;
      const anyFails = suites.some(s => s.status === 'fail');
      
      const overallStatus = criticalFails > 0 ? 'fail' : anyFails ? 'partial' : 'pass';
      const totalDuration = suites.reduce((acc, s) => acc + s.duration_ms, 0);

      // Save to database
      const { error: insertError } = await supabase
        .from('system_health_checks')
        .insert({
          target_id: target.id,
          tenant_id: target.tenant_id,
          check_suite: 'full',
          status: overallStatus,
          summary: overallStatus === 'pass' 
            ? 'Todas as checagens passaram' 
            : `${criticalFails} suite(s) crítica(s) falharam`,
          details: { suites },
          duration_ms: totalDuration
        });

      if (insertError) {
        console.error(`[health-check-run] Error saving results for ${target.label}:`, insertError);
      }

      // If critical failure, emit event for notifications
      if (overallStatus === 'fail') {
        console.log(`[health-check-run] Critical failure for ${target.label}, emitting event...`);
        
        const failedSuites = suites.filter(s => s.status === 'fail').map(s => s.suite).join(', ');
        
        await supabase.from('events_inbox').insert({
          tenant_id: target.tenant_id,
          provider: 'internal',
          event_type: 'system.health.failed',
          idempotency_key: `health-fail-${target.id}-${Math.floor(Date.now() / (15 * 60 * 1000))}`, // 15min window
          payload_raw: {
            target_id: target.id,
            target_label: target.label,
            failed_suites: failedSuites,
            details: suites.filter(s => s.status === 'fail')
          }
        });
      }

      // Check for accumulated runtime violations (proactive alert)
      const { count: violationCount } = await supabase
        .from('storefront_runtime_violations')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', target.tenant_id)
        .eq('is_resolved', false)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (violationCount && violationCount >= 5) {
        console.log(`[health-check-run] High violation count (${violationCount}) for tenant ${target.tenant_id}`);
        
        // Emit alert event (idempotency by 6 hours to avoid spam)
        await supabase.from('events_inbox').insert({
          tenant_id: target.tenant_id,
          provider: 'internal',
          event_type: 'system.violations.accumulated',
          idempotency_key: `violations-accumulated-${target.tenant_id}-${Math.floor(Date.now() / (6 * 60 * 60 * 1000))}`,
          payload_raw: {
            violation_count: violationCount,
            target_label: target.label,
            message: `Detectadas ${violationCount} violações de URL não resolvidas nas últimas 24h`
          }
        });
      }

      results.push({ target, suites });
    }

    console.log(`[health-check-run] Completed. ${results.length} targets checked.`);

    return new Response(JSON.stringify({ 
      success: true, 
      targets_checked: results.length,
      results: results.map(r => ({
        label: r.target.label,
        status: r.suites.some(s => s.status === 'fail') ? 'fail' : 'pass'
      }))
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[health-check-run] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
