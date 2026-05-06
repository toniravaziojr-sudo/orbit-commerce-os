// A3.0.1 — Teste funcional isolado das RPCs reserve/capture/release
// Tenant sintético, wallet sintética, cleanup completo no final.
// Não chama provider, não gera imagem, não toca tenant real.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const RUN_ID = "a3-0-1-rpc-functional-test-2026-05-05";
const SERVICE_KEY = "fal.gpt-image-1.5.per_image.medium_1024";
const PLACEHOLDER_KEY = "firecrawl-scrape-page";
const FEATURE = "creative_image";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META = {
  motor_version: "v2",
  validation_run_id: RUN_ID,
  synthetic: true,
  technical_validation: true,
  service_key: SERVICE_KEY,
  expected_credits: 6,
  test_phase: "A3.0.1",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const results: any[] = [];
  const log = (name: string, ok: boolean, detail: any) => {
    results.push({ name, ok, detail });
    console.log(`[A3.0.1] ${name}: ${ok ? "PASS" : "FAIL"}`, JSON.stringify(detail));
  };

  // Identidades sintéticas
  const tenantId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const slug = `a3-0-1-test-${Date.now()}`;

  const cleanup = async () => {
    try {
      await supabase.from("service_usage_events").delete().eq("tenant_id", tenantId);
      await supabase.from("credit_ledger").delete().eq("tenant_id", tenantId);
      await supabase.from("credit_wallet").delete().eq("tenant_id", tenantId);
      await supabase.from("tenant_credit_motor_config").delete().eq("tenant_id", tenantId);
      await supabase.from("tenants").delete().eq("id", tenantId);
    } catch (e) {
      console.error("[A3.0.1] cleanup error", e);
    }
  };

  try {
    // ───── SETUP ─────
    const ten = await supabase.from("tenants").insert({
      id: tenantId, name: "A3.0.1 RPC Functional Test", slug, type: "customer",
    }).select().single();
    if (ten.error) throw new Error("setup tenant: " + ten.error.message);

    const wal = await supabase.from("credit_wallet").insert({
      tenant_id: tenantId, balance_credits: 100, reserved_credits: 0,
      lifetime_purchased: 100, lifetime_consumed: 0,
    }).select().single();
    if (wal.error) throw new Error("setup wallet: " + wal.error.message);

    const readWallet = async () => {
      const { data } = await supabase.from("credit_wallet")
        .select("balance_credits,reserved_credits,lifetime_consumed")
        .eq("tenant_id", tenantId).single();
      return data;
    };

    // ───── TESTE 1: dry-run ─────
    {
      const { data, error } = await supabase.rpc("reserve_credits_v2", {
        p_tenant_id: tenantId, p_user_id: userId, p_service_key: SERVICE_KEY,
        p_units: { images: 1 }, p_idempotency_key: `${RUN_ID}|dry|1`,
        p_job_id: null, p_feature: FEATURE, p_metadata: META,
        p_reservation_ttl_minutes: 30, p_dry_run: true,
      });
      const row = data?.[0];
      const w = await readWallet();
      log("T1_dry_run_reserve",
        !error && row?.success === true && row?.credits_reserved === 6 &&
        w!.balance_credits === 100 && w!.reserved_credits === 0,
        { error: error?.message, row, wallet: w });
    }

    // ───── TESTE 2: reserve real ─────
    let reservationA: string | null = null;
    {
      const { data, error } = await supabase.rpc("reserve_credits_v2", {
        p_tenant_id: tenantId, p_user_id: userId, p_service_key: SERVICE_KEY,
        p_units: { images: 1 }, p_idempotency_key: `${RUN_ID}|reserve|A`,
        p_job_id: null, p_feature: FEATURE, p_metadata: META,
        p_reservation_ttl_minutes: 30, p_dry_run: false,
      });
      const row = data?.[0];
      reservationA = row?.reservation_id ?? null;
      const w = await readWallet();
      log("T2_reserve_real",
        !error && row?.success === true && row?.credits_reserved === 6 &&
        !!reservationA && w!.balance_credits === 100 && w!.reserved_credits === 6,
        { error: error?.message, row, wallet: w });
    }

    // ───── TESTE 3: reserve idempotente ─────
    {
      const { data, error } = await supabase.rpc("reserve_credits_v2", {
        p_tenant_id: tenantId, p_user_id: userId, p_service_key: SERVICE_KEY,
        p_units: { images: 1 }, p_idempotency_key: `${RUN_ID}|reserve|A`,
        p_job_id: null, p_feature: FEATURE, p_metadata: META,
        p_reservation_ttl_minutes: 30, p_dry_run: false,
      });
      const row = data?.[0];
      const w = await readWallet();
      log("T3_reserve_idempotent",
        !error && row?.success === true && row?.reservation_id === reservationA &&
        w!.balance_credits === 100 && w!.reserved_credits === 6,
        { error: error?.message, row, wallet: w });
    }

    // ───── TESTE 4: capture ─────
    {
      const { data, error } = await supabase.rpc("capture_reservation", {
        p_tenant_id: tenantId, p_reservation_id: reservationA,
        p_actual_units: { images: 1 }, p_provider_cost_usd: 0.034,
        p_idempotency_key: `${RUN_ID}|capture|A`, p_metadata: META,
      });
      const row = data?.[0];
      const w = await readWallet();
      log("T4_capture",
        !error && row?.success === true && row?.credits_charged === 6 &&
        w!.balance_credits === 94 && w!.reserved_credits === 0 && w!.lifetime_consumed === 6,
        { error: error?.message, row, wallet: w });
    }

    // ───── TESTE 5: capture idempotente ─────
    {
      const { data, error } = await supabase.rpc("capture_reservation", {
        p_tenant_id: tenantId, p_reservation_id: reservationA,
        p_actual_units: { images: 1 }, p_provider_cost_usd: 0.034,
        p_idempotency_key: `${RUN_ID}|capture|A`, p_metadata: META,
      });
      const row = data?.[0];
      const w = await readWallet();
      log("T5_capture_idempotent",
        !error && row?.success === true && w!.balance_credits === 94,
        { error: error?.message, row, wallet: w });
    }

    // ───── TESTE 6: nova reserve + release ─────
    let reservationB: string | null = null;
    {
      const { data } = await supabase.rpc("reserve_credits_v2", {
        p_tenant_id: tenantId, p_user_id: userId, p_service_key: SERVICE_KEY,
        p_units: { images: 1 }, p_idempotency_key: `${RUN_ID}|reserve|B`,
        p_job_id: null, p_feature: FEATURE, p_metadata: META,
        p_reservation_ttl_minutes: 30, p_dry_run: false,
      });
      reservationB = data?.[0]?.reservation_id ?? null;
    }
    {
      const { data, error } = await supabase.rpc("release_reservation", {
        p_tenant_id: tenantId, p_reservation_id: reservationB, p_reason: "test_release",
        p_idempotency_key: `${RUN_ID}|release|B`, p_metadata: META,
      });
      const row = data?.[0];
      const w = await readWallet();
      log("T6_release",
        !error && row?.success === true && row?.credits_released === 6 &&
        w!.balance_credits === 94 && w!.reserved_credits === 0,
        { error: error?.message, row, wallet: w });
    }

    // ───── TESTE 7: release idempotente ─────
    {
      const { data, error } = await supabase.rpc("release_reservation", {
        p_tenant_id: tenantId, p_reservation_id: reservationB, p_reason: "test_release",
        p_idempotency_key: `${RUN_ID}|release|B`, p_metadata: META,
      });
      const row = data?.[0];
      const w = await readWallet();
      log("T7_release_idempotent",
        !error && row?.success === true && w!.balance_credits === 94 && w!.reserved_credits === 0,
        { error: error?.message, row, wallet: w });
    }

    // ───── TESTE 8: saldo insuficiente ─────
    {
      // reduzir wallet a 3 disponíveis
      await supabase.from("credit_wallet").update({ balance_credits: 3, reserved_credits: 0 })
        .eq("tenant_id", tenantId);
      const { data, error } = await supabase.rpc("reserve_credits_v2", {
        p_tenant_id: tenantId, p_user_id: userId, p_service_key: SERVICE_KEY,
        p_units: { images: 1 }, p_idempotency_key: `${RUN_ID}|insufficient|1`,
        p_job_id: null, p_feature: FEATURE, p_metadata: META,
        p_reservation_ttl_minutes: 30, p_dry_run: false,
      });
      const row = data?.[0];
      const w = await readWallet();
      log("T8_insufficient_balance",
        !error && row?.success === false && row?.error_code === "insufficient_balance" &&
        w!.balance_credits === 3 && w!.reserved_credits === 0,
        { error: error?.message, row, wallet: w });
    }

    // ───── TESTE 9A: capture após release ─────
    await supabase.from("credit_wallet").update({ balance_credits: 100, reserved_credits: 0 })
      .eq("tenant_id", tenantId);
    let reservationC: string | null = null;
    {
      const { data } = await supabase.rpc("reserve_credits_v2", {
        p_tenant_id: tenantId, p_user_id: userId, p_service_key: SERVICE_KEY,
        p_units: { images: 1 }, p_idempotency_key: `${RUN_ID}|conflict|C-reserve`,
        p_job_id: null, p_feature: FEATURE, p_metadata: META,
        p_reservation_ttl_minutes: 30, p_dry_run: false,
      });
      reservationC = data?.[0]?.reservation_id ?? null;
      await supabase.rpc("release_reservation", {
        p_tenant_id: tenantId, p_reservation_id: reservationC, p_reason: "conflict_test",
        p_idempotency_key: `${RUN_ID}|conflict|C-release`, p_metadata: META,
      });
      const { data: capData, error } = await supabase.rpc("capture_reservation", {
        p_tenant_id: tenantId, p_reservation_id: reservationC,
        p_actual_units: { images: 1 }, p_provider_cost_usd: 0.034,
        p_idempotency_key: `${RUN_ID}|conflict|C-capture-after-release`, p_metadata: META,
      });
      const row = capData?.[0];
      log("T9A_capture_after_release",
        !error && row?.success === false && row?.error_code === "reservation_already_finalized",
        { error: error?.message, row });
    }

    // ───── TESTE 9B: release após capture ─────
    let reservationD: string | null = null;
    {
      const { data } = await supabase.rpc("reserve_credits_v2", {
        p_tenant_id: tenantId, p_user_id: userId, p_service_key: SERVICE_KEY,
        p_units: { images: 1 }, p_idempotency_key: `${RUN_ID}|conflict|D-reserve`,
        p_job_id: null, p_feature: FEATURE, p_metadata: META,
        p_reservation_ttl_minutes: 30, p_dry_run: false,
      });
      reservationD = data?.[0]?.reservation_id ?? null;
      await supabase.rpc("capture_reservation", {
        p_tenant_id: tenantId, p_reservation_id: reservationD,
        p_actual_units: { images: 1 }, p_provider_cost_usd: 0.034,
        p_idempotency_key: `${RUN_ID}|conflict|D-capture`, p_metadata: META,
      });
      const { data: relData, error } = await supabase.rpc("release_reservation", {
        p_tenant_id: tenantId, p_reservation_id: reservationD, p_reason: "conflict_test",
        p_idempotency_key: `${RUN_ID}|conflict|D-release-after-capture`, p_metadata: META,
      });
      const row = relData?.[0];
      log("T9B_release_after_capture",
        !error && row?.success === false && row?.error_code === "reservation_already_finalized",
        { error: error?.message, row });
    }

    // ───── TESTE 10: PRICE_NOT_APPROVED ─────
    {
      const { data, error } = await supabase.rpc("reserve_credits_v2", {
        p_tenant_id: tenantId, p_user_id: userId, p_service_key: PLACEHOLDER_KEY,
        p_units: { quantity: 1 }, p_idempotency_key: `${RUN_ID}|price-not-approved|1`,
        p_job_id: null, p_feature: "test_placeholder",
        p_metadata: { ...META, service_key: PLACEHOLDER_KEY }, p_reservation_ttl_minutes: 30, p_dry_run: false,
      });
      const row = data?.[0];
      log("T10_price_not_approved",
        !error && row?.success === false && row?.error_code === "PRICE_NOT_APPROVED",
        { error: error?.message, row });
    }

    // ───── EVIDÊNCIAS ─────
    const finalWallet = await readWallet();
    const { data: ledgerRows } = await supabase.from("credit_ledger")
      .select("transaction_type,credits_delta,operation_status,balance_after,service_key")
      .eq("tenant_id", tenantId).order("created_at", { ascending: true });
    const { data: eventRows } = await supabase.from("service_usage_events")
      .select("status,cost_owner,service_key,origin_function")
      .eq("tenant_id", tenantId).order("created_at", { ascending: true });

    // ───── CLEANUP ─────
    await cleanup();

    // Verificar cleanup
    const { count: leftWallet } = await supabase.from("credit_wallet")
      .select("*", { count: "exact", head: true }).eq("tenant_id", tenantId);
    const { count: leftLedger } = await supabase.from("credit_ledger")
      .select("*", { count: "exact", head: true }).eq("tenant_id", tenantId);
    const { count: leftEvents } = await supabase.from("service_usage_events")
      .select("*", { count: "exact", head: true }).eq("tenant_id", tenantId);
    const { count: leftTenant } = await supabase.from("tenants")
      .select("*", { count: "exact", head: true }).eq("id", tenantId);

    const allPassed = results.every((r) => r.ok);
    const cleanupOk = (leftWallet ?? 0) === 0 && (leftLedger ?? 0) === 0 &&
                      (leftEvents ?? 0) === 0 && (leftTenant ?? 0) === 0;

    return new Response(JSON.stringify({
      success: allPassed && cleanupOk,
      run_id: RUN_ID,
      synthetic_tenant_id: tenantId,
      results,
      evidence: {
        final_wallet_before_cleanup: finalWallet,
        ledger_rows_count: ledgerRows?.length ?? 0,
        ledger_summary: ledgerRows,
        event_rows_count: eventRows?.length ?? 0,
        event_summary: eventRows,
      },
      cleanup: {
        ok: cleanupOk,
        left: { wallet: leftWallet, ledger: leftLedger, events: leftEvents, tenant: leftTenant },
      },
    }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[A3.0.1] fatal", e);
    await cleanup();
    return new Response(JSON.stringify({
      success: false, error: e?.message ?? String(e), results,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
