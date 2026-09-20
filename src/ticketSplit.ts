/** Workshop Jev’s State height. Storage: `talk-to-jev:ticket-height`. Never store keys. */

export const TICKET_HEIGHT_KEY = "talk-to-jev:ticket-height";
export const TICKET_HEIGHT_DEFAULT = 314;
export const TICKET_HEIGHT_MIN = 220;
export const BOARD_HEIGHT_MIN = 240;
export const TICKET_SPLITTER_PX = 8;
export const TICKET_NUDGE_PX = 16;
export const TICKET_NUDGE_SHIFT_PX = 64;

export function workshopColumnHeight(el: HTMLElement): number {
  const s = getComputedStyle(el);
  const pad =
    (Number.parseFloat(s.paddingTop) || 0) +
    (Number.parseFloat(s.paddingBottom) || 0);
  return Math.max(0, Math.round(el.clientHeight - pad));
}

export function ticketHeightBounds(columnPx: number): { min: number; max: number } {
  const usable = Math.max(0, columnPx - TICKET_SPLITTER_PX);
  const max = Math.max(80, Math.round(usable - BOARD_HEIGHT_MIN));
  const min = Math.min(TICKET_HEIGHT_MIN, max);
  return { min, max };
}

export function clampTicketHeight(px: number, columnPx: number): number {
  const { min, max } = ticketHeightBounds(columnPx);
  const n = Number.isFinite(px) ? px : TICKET_HEIGHT_DEFAULT;
  return Math.round(Math.min(max, Math.max(min, n)));
}

export function loadTicketHeight(fallback = TICKET_HEIGHT_DEFAULT): number {
  try {
    const n = Number(localStorage.getItem(TICKET_HEIGHT_KEY));
    if (Number.isFinite(n) && n >= 80 && n <= 2000) return Math.round(n);
  } catch {
    /* private mode */
  }
  return fallback;
}

export function saveTicketHeight(px: number) {
  try {
    localStorage.setItem(
      TICKET_HEIGHT_KEY,
      String(Math.round(Math.min(2000, Math.max(80, px)))),
    );
  } catch {
    /* quota */
  }
}
