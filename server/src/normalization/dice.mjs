export function normalizeDiceChatMessage(message) {
  if (!message || typeof message !== "object" || message.kind !== "dice") {
    return null;
  }

  const formula = String(message.formula ?? "").trim().slice(0, 80);
  const detail = String(message.detail ?? "").trim().slice(0, 240);
  if (!formula || !detail || !Number.isFinite(message.total)) {
    return null;
  }

  const tokenId = message.tokenId == null ? null : String(message.tokenId).trim().slice(0, 64) || null;
  const rollVisibility =
    message.rollVisibility === "public" || message.rollVisibility === "hidden" ? message.rollVisibility : null;

  return {
    kind: "dice",
    formula,
    total: Math.trunc(message.total),
    detail,
    tokenId,
    rollVisibility,
  };
}
