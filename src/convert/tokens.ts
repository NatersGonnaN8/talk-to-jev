/** TypeSafe `docs/jev/typesafe/models.md` (fetched 2026-09-19). */
export const JEV_REQUEST_TOKEN_BUDGET = 64_000;
export const JEV_STATE_PLUS_LONGEST_Q = 32_000;

/** Rough English estimate. SPEC: ceil(chars / 4). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function tokenCheck(markdown: string, caseText: string) {
  const mdTokens = estimateTokens(markdown);
  const combinedTokens = estimateTokens(
    caseText ? `${caseText}\n\n${markdown}` : markdown,
  );
  const overRequest =
    mdTokens > JEV_REQUEST_TOKEN_BUDGET ||
    combinedTokens > JEV_REQUEST_TOKEN_BUDGET;
  const overState =
    mdTokens > JEV_STATE_PLUS_LONGEST_Q ||
    combinedTokens > JEV_STATE_PLUS_LONGEST_Q;
  return { mdTokens, combinedTokens, overRequest, overState };
}
