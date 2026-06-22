// Pure mapping from Mercado Livre item snapshot → local listing state.
// Exported so it can be unit-tested without network/DB.

export type LocalStatus =
  | "draft"
  | "ready"
  | "approved"
  | "publishing"
  | "published"
  | "paused"
  | "inactive"
  | "error";

export interface MappedResult {
  action: "update" | "delete";
  status: LocalStatus;
  error_message?: string | null;
  inactive_reason?: string | null;
}

/**
 * Maps the ML item snapshot into a local mutation.
 *
 * Rules:
 *  - active        → published
 *  - paused        → paused
 *  - under_review  → publishing (with "Em revisão pelo Mercado Livre")
 *  - inactive      → paused (ML's "inactive" is a soft pause)
 *  - closed:
 *      • if sub_status includes 'deleted' AND the local listing never reached
 *        published/paused/inactive → delete the local row.
 *      • otherwise → mark local as inactive with a friendly reason.
 */
export function mapMeliItemToLocal(
  mlItem: { status?: string; sub_status?: string[] | string },
  currentLocalStatus: LocalStatus,
): MappedResult {
  const mlStatus = mlItem.status;
  const subStatus = Array.isArray(mlItem.sub_status)
    ? mlItem.sub_status
    : mlItem.sub_status
    ? [mlItem.sub_status]
    : [];

  if (mlStatus === "active") {
    return { action: "update", status: "published", error_message: null, inactive_reason: null };
  }
  if (mlStatus === "paused") {
    return { action: "update", status: "paused", error_message: null };
  }
  if (mlStatus === "under_review") {
    return {
      action: "update",
      status: "publishing",
      error_message: "Em revisão pelo Mercado Livre",
    };
  }
  if (mlStatus === "inactive") {
    const detail = subStatus.length ? subStatus.join(", ") : "sem detalhes";
    return {
      action: "update",
      status: "paused",
      error_message: `Inativo no ML: ${detail}`,
    };
  }
  if (mlStatus === "closed") {
    const everPublished = ["published", "paused", "inactive"].includes(currentLocalStatus);
    const isDeleted = subStatus.includes("deleted");

    if (isDeleted && !everPublished) {
      // never sold a thing — safe to remove locally
      return { action: "delete", status: "inactive" };
    }

    const reason = isDeleted
      ? "Excluído no Mercado Livre"
      : subStatus.includes("expired")
      ? "Expirado no Mercado Livre"
      : subStatus.includes("out_of_stock")
      ? "Sem estoque no Mercado Livre"
      : "Finalizado no Mercado Livre";

    return {
      action: "update",
      status: "inactive",
      error_message: reason,
      inactive_reason: reason,
    };
  }

  // Unknown status — keep current
  return {
    action: "update",
    status: currentLocalStatus,
    error_message: null,
  };
}
