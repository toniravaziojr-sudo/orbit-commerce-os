// =============================================================================
// Onda H.3 — Gate de aprovação estrutural da Proposta de Campanha
//
// Função PURA. Decide se uma proposta `campaign_proposal_v1_1` pode ter sua
// ESTRUTURA aprovada (H.3), separando:
//   - blockers (fase h2_structural): impedem aprovação;
//   - account_config: NÃO bloqueiam aprovação; ficam em lifecycle.pending_account_config
//     e serão exigidos apenas na revisão final / publicação (H.4.2 / H.5);
//   - h4_future: não entram nesta fase (são variáveis da geração de criativos).
//
// Não chama banco, Meta, IA ou cria creative_jobs. Apenas classifica.
// =============================================================================

export interface PendingFieldLike {
  level: "identity" | "campaign" | "adset" | "ad";
  index?: number;
  field: string;
  label_pt?: string;
  phase: "h2_structural" | "h4_future" | "account_config" | string;
}

export interface H3Blocker {
  code: string;
  message_pt: string;
  level?: string;
  field?: string;
}

export interface H3AccountConfigPending {
  level: string;
  field: string;
  label_pt: string;
}

export interface H3GateInput {
  /** action_data da proposta */
  action_data: Record<string, any>;
}

export interface H3GateResult {
  blockers: H3Blocker[];
  account_config_pending: H3AccountConfigPending[];
  /** Itens cuja classificação está ambígua — tratados como blocker por segurança. */
  ambiguous: H3Blocker[];
}

/**
 * Classifica os pending_fields da proposta e adiciona checagens estruturais
 * mínimas de defesa em profundidade (caso pending_fields esteja ausente).
 */
export function classifyH3Approval(input: H3GateInput): H3GateResult {
  const data = input.action_data || {};
  const campaign = data.campaign || {};
  const adsets: any[] = Array.isArray(data.adsets) ? data.adsets : [];
  const plannedCreatives: any[] = Array.isArray(data.planned_creatives) ? data.planned_creatives : [];
  const pendingFields: PendingFieldLike[] = Array.isArray(data.pending_fields) ? data.pending_fields : [];

  const blockers: H3Blocker[] = [];
  const accountConfig: H3AccountConfigPending[] = [];
  const ambiguous: H3Blocker[] = [];

  // ---- Contrato/escopo suportado ------------------------------------------
  const contractStatus: string | null = data.contract_validation_status ?? null;
  if (contractStatus === "blocked") {
    blockers.push({
      code: "contract_blocked",
      message_pt: data.unsupported_reason || "Proposta fora do escopo suportado nesta onda.",
    });
  }
  const schemaVersion: string | null = data.schema_version ?? null;
  if (schemaVersion && schemaVersion !== "campaign_proposal_v1_1") {
    blockers.push({
      code: "unsupported_schema_version",
      message_pt: `Versão da proposta (${schemaVersion}) não é suportada nesta onda.`,
    });
  }

  // ---- Defesa em profundidade (campos mínimos sempre conferidos) ----------
  if (!campaign.name) {
    blockers.push({ code: "campaign_name_missing", message_pt: "Nome da campanha está vazio." });
  }
  if (!campaign.objective) {
    blockers.push({ code: "campaign_objective_missing", message_pt: "Objetivo da campanha não definido." });
  }
  const budgetMode = String(campaign.budget_mode || "").toUpperCase();
  if (budgetMode !== "ABO") {
    // CBO (ou modo não declarado) exige orçamento na campanha.
    if (!campaign.daily_budget_cents || Number(campaign.daily_budget_cents) <= 0) {
      blockers.push({ code: "campaign_budget_missing", message_pt: "Orçamento diário da campanha não definido." });
    }
  }
  if (adsets.length === 0) {
    blockers.push({ code: "no_adsets", message_pt: "Nenhum conjunto de anúncios definido." });
  }
  if (plannedCreatives.length === 0) {
    blockers.push({ code: "no_planned_creatives", message_pt: "Nenhum anúncio planejado vinculado a um conjunto." });
  } else {
    // Vínculo anúncio↔conjunto obrigatório (H.2.2).
    const orphan = plannedCreatives.some((c: any) =>
      c.adset_index === undefined || c.adset_index === null || Number.isNaN(Number(c.adset_index))
    );
    if (orphan) {
      blockers.push({ code: "creative_adset_link_missing", message_pt: "Há anúncio planejado sem vínculo com um conjunto." });
    }
  }

  // ---- pending_fields classificados pelo contrato (fonte preferencial) -----
  for (const pf of pendingFields) {
    const phase = pf.phase;
    const label = pf.label_pt || pf.field;
    const where = pf.level === "adset" ? `Conjunto ${typeof pf.index === "number" ? pf.index + 1 : ""}`.trim() :
                  pf.level === "ad"    ? `Anúncio ${typeof pf.index === "number" ? pf.index + 1 : ""}`.trim() :
                  pf.level === "campaign" ? "Campanha" :
                  pf.level === "identity" ? "Identidade da conta" : "";
    const msg = where ? `${where}: ${label}` : label;

    if (phase === "h2_structural") {
      // Evita duplicar mensagens já cobertas pela defesa em profundidade.
      const codeKey = `pf_${pf.level}_${pf.field}`;
      if (!blockers.some((b) => b.code === codeKey)) {
        blockers.push({ code: codeKey, message_pt: msg, level: pf.level, field: pf.field });
      }
    } else if (phase === "account_config") {
      accountConfig.push({ level: pf.level, field: pf.field, label_pt: label });
    } else if (phase === "h4_future") {
      // Não entra em H.3.
      continue;
    } else {
      // Fase desconhecida — não adivinhar; tratar como blocker até classificação segura.
      ambiguous.push({
        code: `pf_unknown_phase_${pf.field}`,
        message_pt: `${msg} (classificação pendente — bloqueado por segurança).`,
        level: pf.level,
        field: pf.field,
      });
    }
  }

  return { blockers, account_config_pending: accountConfig, ambiguous };
}
