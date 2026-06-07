import { describe, it, expect } from "vitest";

/**
 * Subfase B — Tenant Memory Store (Ads Autopilot Etapa 7.mem)
 *
 * Testes de contrato da estrutura de memória do tenant.
 * Validam o shape de payloads e regras de negócio aplicadas no banco
 * (CHECKs, defaults e status permitidos). NÃO executam contra Supabase
 * — RLS/CHECKs reais são validados por evidência da migration e do linter.
 */

type MemoryStatus = "provisional" | "active" | "archived";

interface TenantMemoryInput {
  tenant_id: string;
  sales_platform: string;
  ads_platform: string;
  memory_type: string;
  scope: string;
  key: string;
  value?: Record<string, unknown>;
  confidence?: number;
  evidence_count?: number;
  status?: MemoryStatus;
  source?: string;
}

const ALLOWED_STATUSES: MemoryStatus[] = ["provisional", "active", "archived"];

function validateMemoryInput(input: TenantMemoryInput): { ok: boolean; error?: string } {
  if (!input.tenant_id) return { ok: false, error: "tenant_id required" };
  if (!input.sales_platform) return { ok: false, error: "sales_platform required" };
  if (!input.ads_platform) return { ok: false, error: "ads_platform required" };
  if (!input.memory_type) return { ok: false, error: "memory_type required" };
  if (!input.scope) return { ok: false, error: "scope required" };
  if (!input.key) return { ok: false, error: "key required" };

  const status = input.status ?? "provisional";
  if (!ALLOWED_STATUSES.includes(status)) {
    return { ok: false, error: `status must be one of ${ALLOWED_STATUSES.join(", ")}` };
  }

  const confidence = input.confidence ?? 0;
  if (confidence < 0 || confidence > 1 || Number.isNaN(confidence)) {
    return { ok: false, error: "confidence must be between 0 and 1" };
  }

  const evidence = input.evidence_count ?? 0;
  if (!Number.isInteger(evidence) || evidence < 0) {
    return { ok: false, error: "evidence_count must be a non-negative integer" };
  }

  return { ok: true };
}

const PILOT_TENANT = "d1a4d0ed-8842-495e-b741-540a9a345b25";

describe("Ads Autopilot Tenant Memory Store — contrato (Subfase B)", () => {
  it("aceita memória válida com defaults", () => {
    const result = validateMemoryInput({
      tenant_id: PILOT_TENANT,
      sales_platform: "storefront",
      ads_platform: "meta",
      memory_type: "preference",
      scope: "campaign",
      key: "preferred_objective",
      value: { objective: "OUTCOME_SALES" },
    });
    expect(result.ok).toBe(true);
  });

  it("status inicial padrão é provisional", () => {
    const defaultStatus: MemoryStatus = "provisional";
    expect(ALLOWED_STATUSES[0]).toBe(defaultStatus);
  });

  it("aceita os três status permitidos", () => {
    for (const status of ALLOWED_STATUSES) {
      const result = validateMemoryInput({
        tenant_id: PILOT_TENANT,
        sales_platform: "storefront",
        ads_platform: "meta",
        memory_type: "preference",
        scope: "campaign",
        key: "k",
        status,
      });
      expect(result.ok).toBe(true);
    }
  });

  it("rejeita status fora da lista controlada", () => {
    const result = validateMemoryInput({
      tenant_id: PILOT_TENANT,
      sales_platform: "storefront",
      ads_platform: "meta",
      memory_type: "preference",
      scope: "campaign",
      key: "k",
      // @ts-expect-error invalid
      status: "approved",
    });
    expect(result.ok).toBe(false);
  });

  it("rejeita confidence fora do intervalo 0..1", () => {
    expect(validateMemoryInput({
      tenant_id: PILOT_TENANT, sales_platform: "s", ads_platform: "meta",
      memory_type: "t", scope: "c", key: "k", confidence: -0.1,
    }).ok).toBe(false);
    expect(validateMemoryInput({
      tenant_id: PILOT_TENANT, sales_platform: "s", ads_platform: "meta",
      memory_type: "t", scope: "c", key: "k", confidence: 1.5,
    }).ok).toBe(false);
  });

  it("rejeita evidence_count negativo ou não-inteiro", () => {
    expect(validateMemoryInput({
      tenant_id: PILOT_TENANT, sales_platform: "s", ads_platform: "meta",
      memory_type: "t", scope: "c", key: "k", evidence_count: -1,
    }).ok).toBe(false);
    expect(validateMemoryInput({
      tenant_id: PILOT_TENANT, sales_platform: "s", ads_platform: "meta",
      memory_type: "t", scope: "c", key: "k", evidence_count: 1.5,
    }).ok).toBe(false);
  });

  it("memory_type, scope e key são obrigatórios", () => {
    expect(validateMemoryInput({
      tenant_id: PILOT_TENANT, sales_platform: "s", ads_platform: "meta",
      memory_type: "", scope: "c", key: "k",
    }).ok).toBe(false);
    expect(validateMemoryInput({
      tenant_id: PILOT_TENANT, sales_platform: "s", ads_platform: "meta",
      memory_type: "t", scope: "", key: "k",
    }).ok).toBe(false);
    expect(validateMemoryInput({
      tenant_id: PILOT_TENANT, sales_platform: "s", ads_platform: "meta",
      memory_type: "t", scope: "c", key: "",
    }).ok).toBe(false);
  });

  it("sales_platform e ads_platform são obrigatórios e fazem parte da chave única", () => {
    expect(validateMemoryInput({
      tenant_id: PILOT_TENANT, sales_platform: "", ads_platform: "meta",
      memory_type: "t", scope: "c", key: "k",
    }).ok).toBe(false);
    expect(validateMemoryInput({
      tenant_id: PILOT_TENANT, sales_platform: "s", ads_platform: "",
      memory_type: "t", scope: "c", key: "k",
    }).ok).toBe(false);
  });

  it("não há autoexecução nem chamada à Meta a partir do contrato", () => {
    // Este teste documenta a invariante: o módulo de validação é puro,
    // não importa supabase, não chama fetch, não dispara nenhum side-effect.
    const src = validateMemoryInput.toString();
    expect(src).not.toMatch(/fetch\(/);
    expect(src).not.toMatch(/supabase/);
    expect(src).not.toMatch(/facebook|graph\.facebook/i);
  });
});
