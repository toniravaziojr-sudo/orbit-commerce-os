/**
 * Testes unitários da Reserva Sombra (Fase A2).
 * Funções puras — não tocam DB, RPCs, wallet, ledger ou provider.
 */
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  calculateShadowImageReservation,
  simulateShadowBalance,
  buildShadowReservationMetadata,
  finalizeShadowReservationOutcome,
  isShadowReservationEnabled,
  SHADOW_RESERVATION_VERSION,
} from "./shadow-reservation.ts";

const SK = "fal.gpt-image-1.5.per_image.medium_1024";
const PRICING_OK = {
  pricing_id: "1da61468-e950-4407-8268-6c9df71b2143",
  service_key: SK,
  cost_usd: 0.034,
  markup_pct: 50,
  unit: "image",
  is_active: true,
  effective_until: null,
};

Deno.test("aritmética medium_1024: 0.034 +50% → 6 créditos", () => {
  const r = calculateShadowImageReservation({ pricing: PRICING_OK, service_key: SK });
  assertEquals(r.pricing.cost_usd_snap, 0.034);
  assertEquals(r.pricing.markup_pct_snap, 50);
  assertEquals(r.pricing.sell_usd_snap, 0.051);
  assertEquals(r.formula.credits, 6);
  assertEquals(r.pricing.would_block_in_live, false);
  assertEquals(r.pricing.block_reason, null);
});

Deno.test("saldo suficiente: 500 disponível → insufficient=false", () => {
  const sim = simulateShadowBalance({ wallet: { balance_credits: 500, reserved_credits: 0 }, reserve_credits: 6 });
  assertEquals(sim.available_before, 500);
  assertEquals(sim.balance_after, 494);
  assertEquals(sim.insufficient, false);
});

Deno.test("saldo insuficiente: 3 disponível → insufficient=true e block=true", () => {
  const meta = buildShadowReservationMetadata({
    pricing: PRICING_OK,
    wallet: { balance_credits: 3, reserved_credits: 0 },
    service_key: SK,
  });
  assertEquals(meta.shadow_balance_simulation.insufficient, true);
  assertEquals(meta.shadow_would_block_provider_call, true);
  assertEquals(meta.shadow_reserve.would_run, false);
});

Deno.test("pricing ausente → would_block_in_live=true, credits=0", () => {
  const r = calculateShadowImageReservation({ pricing: null, service_key: SK });
  assertEquals(r.pricing.would_block_in_live, true);
  assertEquals(r.pricing.block_reason, "no_pricing");
  assertEquals(r.formula.credits, 0);
});

Deno.test("pricing inativo → block=pricing_inactive", () => {
  const r = calculateShadowImageReservation({
    pricing: { ...PRICING_OK, is_active: false },
    service_key: SK,
  });
  assertEquals(r.pricing.block_reason, "pricing_inactive");
  assertEquals(r.pricing.would_block_in_live, true);
});

Deno.test("pricing expirado → block=pricing_expired", () => {
  const r = calculateShadowImageReservation({
    pricing: { ...PRICING_OK, effective_until: "2020-01-01T00:00:00Z" },
    service_key: SK,
  });
  assertEquals(r.pricing.block_reason, "pricing_expired");
});

Deno.test("service_key fora do escopo A2 → block=service_key_out_of_scope", () => {
  const r = calculateShadowImageReservation({
    pricing: { ...PRICING_OK, service_key: "fal.gpt-image-1.5.per_image.high_1024" },
    service_key: "fal.gpt-image-1.5.per_image.high_1024",
  });
  assertEquals(r.pricing.block_reason, "service_key_out_of_scope");
});

Deno.test("job succeeded → shadow_capture.would_run=true; release=false", () => {
  const meta = buildShadowReservationMetadata({
    pricing: PRICING_OK,
    wallet: { balance_credits: 500, reserved_credits: 0 },
    service_key: SK,
  });
  const finalized = finalizeShadowReservationOutcome(meta, { succeeded: true });
  assertEquals(finalized.shadow_capture.would_run, true);
  assertEquals(finalized.shadow_capture.credits, 6);
  assertEquals(finalized.shadow_release.would_run, false);
});

Deno.test("job failed → shadow_release.would_run=true com reason; capture=false", () => {
  const meta = buildShadowReservationMetadata({
    pricing: PRICING_OK,
    wallet: { balance_credits: 500, reserved_credits: 0 },
    service_key: SK,
  });
  const finalized = finalizeShadowReservationOutcome(meta, {
    succeeded: false,
    failure_reason: "provider_timeout",
  });
  assertEquals(finalized.shadow_release.would_run, true);
  assertEquals(finalized.shadow_release.reason, "provider_timeout");
  assertEquals(finalized.shadow_release.credits, 6);
  assertEquals(finalized.shadow_capture.would_run, false);
});

Deno.test("invariantes: no_wallet_mutation e no_ledger_mutation sempre true", () => {
  const meta = buildShadowReservationMetadata({
    pricing: PRICING_OK,
    wallet: { balance_credits: 500, reserved_credits: 0 },
    service_key: SK,
  });
  assertEquals(meta.no_wallet_mutation, true);
  assertEquals(meta.no_ledger_mutation, true);
  assertEquals(meta.shadow_reservation_version, SHADOW_RESERVATION_VERSION);
});

Deno.test("gate isShadowReservationEnabled", () => {
  assertEquals(isShadowReservationEnabled(null), false);
  assertEquals(isShadowReservationEnabled({}), false);
  assertEquals(isShadowReservationEnabled({ shadow_reservation_enabled: false }), false);
  assert(isShadowReservationEnabled({ shadow_reservation_enabled: true }));
});
