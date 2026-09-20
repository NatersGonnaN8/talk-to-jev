import type { JevQuestion, QuestionType } from "./types";
import { weatherPlaceholder } from "./weather";

export type SampleId =
  | "invoice"
  | "ticket"
  | "lead"
  | "refund"
  | "hire"
  | "launch"
  | "chargeback"
  | "vendor"
  | "moderate"
  | "jacket";

export type SampleKind = "business" | "weather";

export type SampleCase = {
  id: SampleId;
  label: string;
  pitch: string;
  kind: SampleKind;
  types: QuestionType[];
  state: string;
  questions: Record<string, JevQuestion>;
};

/** First-open / New Case. A business snap — not Jacket. */
export const LANDING_SAMPLE_ID: SampleId = "invoice";

/** The one weather case. Open-Meteo row is visible only here. */
export const WEATHER_SAMPLE_ID: SampleId = "jacket";

function caseText(kind: SampleKind, situation: string) {
  const body = situation.trim();
  if (kind === "weather") {
    return `${weatherPlaceholder()}

## Situation
${body}
`;
  }
  return `${body}\n`;
}

function typesOf(questions: Record<string, JevQuestion>): QuestionType[] {
  const seen = new Set<QuestionType>();
  const order: QuestionType[] = ["choice", "noul", "score"];
  for (const q of Object.values(questions)) seen.add(q.type);
  return order.filter((t) => seen.has(t));
}

function sample(
  id: SampleId,
  label: string,
  pitch: string,
  kind: SampleKind,
  situation: string,
  questions: Record<string, JevQuestion>,
): SampleCase {
  return {
    id,
    label,
    pitch,
    kind,
    types: typesOf(questions),
    state: caseText(kind, situation),
    questions,
  };
}

export const SAMPLES: SampleCase[] = [
  sample(
    "invoice",
    "Invoice exception",
    "Pay, hold, or reject an over-PO freight bill.",
    "business",
    `AP QUEUE · INV-18442 · Northwind Logistics LLC
Vendor: Net-30, 3 years, no prior disputes. Buyer: Ops (harbor freight). SLA: AP close Friday 5:00pm ET — last open exception on the close list.

Invoice: $18,640.00 for March freight against PO-9921 authorized $16,200.00. Variance +$2,440 (15.1% over PO).
- Line 4 “fuel surcharge Q1 true-up” $1,980 — not on the PO. No signed rate addendum on file.
- Line 7 pallet repair $460 — receiver notes “2 pallets crushed on arrival, claim filed with carrier.”

Policy AP-4.2:
- Auto-pay if variance ≤ $250 or ≤ 2% of PO.
- Hold for buyer if 2–5% or $250–$2,000.
- Reject or require an amended invoice if >5% or >$2,000.
- Fuel surcharges need a signed rate addendum.
- Damaged-goods charges wait on the carrier claim.

Buyer chat: “We did agree verbally to a winter fuel band. I don’t have the email. Do not pay the pallet line.”
Vendor dunning: 8 days past terms, threatening late fees.`,
    {
      action: {
        type: "choice",
        instructions: "What should AP do with INV-18442?",
        criteria: {
          pay: "Pay the invoice as billed",
          hold: "Hold for buyer / amended backup",
          reject: "Reject and require a corrected invoice",
        },
      },
      within_policy: {
        type: "noul",
        instructions: "Is paying this invoice as-is within AP-4.2?",
        criteria: {
          true: "Paying as billed is within policy",
          false: "Exception needs hold or reject — not a clean pay",
        },
      },
      exception_risk: {
        type: "score",
        instructions: "How material is this AP exception?",
        criteria: ["Routine", "Watch", "Material"],
      },
    },
  ),
  sample(
    "ticket",
    "Ticket route",
    "Billing, engineering, success, or spam.",
    "business",
    `ZENDESK #482911 · 14 minutes old · first-response SLA 1h
Account: Harbor Tools Cloud · Enterprise · ARR $94k · CSAT 92 last 90d · admin sender, domain matches owner · not on suppression.

Subject: “Production webhook 500s — also you billed us twice this month”

Body: “Checkout confirmations 500 since 16:40 UTC. Customers can’t complete. Your status page is green. Also saw two identical $2,400 invoices on the 1st. I’m the admin. If this is another ‘retry the dashboard’ I’ll escalate.”

Signals:
- 3 similar tickets in 40 minutes (webhook 5xx).
- Billing: invoice 7721 and 7721-DUP same amount, same Stripe charge id ending 4491.
- Last ticket 11d ago: billing, refunded politely.

Queues: Billing · Engineering · Success · Spam.`,
    {
      queue: {
        type: "choice",
        instructions: "Which queue should own this ticket?",
        criteria: {
          billing: "Payments, invoices, duplicate charges",
          engineering: "Production bugs, outages, webhooks",
          success: "Account health, how-to, relationship",
          spam: "Junk, abuse, or not a real customer",
        },
      },
      urgent: {
        type: "noul",
        instructions: "Does this need Sev-1 / immediate attention?",
        criteria: {
          true: "Production or enterprise-at-risk right now",
          false: "Can wait the remaining SLA",
        },
      },
      severity: {
        type: "score",
        instructions: "How severe is this ticket?",
        criteria: ["Low", "Medium", "Sev-1"],
      },
    },
  ),
  sample(
    "lead",
    "Lead qualify",
    "Book a demo, nurture, or disqualify.",
    "business",
    `HUBSPOT D-44190 · inbound “Book a demo” · 22 minutes ago
Company: Harbor & Pine Credit Union · 14 branches · ~$2.1B assets · 180 employees (Clearbit). Title: VP Operations. Tech: DNA core. No current vendor overlap.

Form: “Need a decision engine for loan exception queues. Budget this FY. Evaluating two others. Can we see a live demo Thursday?”

ICP: community banks / credit unions $500M–$10B assets, ops or risk buyer, use-case = exception queues or KYC.
Disqualify: agencies, students, competitors, <$20M assets, “researching for a paper.”

Playbook: book demo if ICP + timeline ≤ 60 days. Nurture if ICP but no timeline / junior title. Disqualify otherwise.

SDR note: they asked for “on-prem only.” We are cloud-only with VPC. That is a known loss cause.`,
    {
      disposition: {
        type: "choice",
        instructions: "How should SDR dispose this lead?",
        criteria: {
          book_demo: "Book the demo — ICP and timing are good enough",
          nurture: "Keep in sequence; not ready to demo",
          disqualify: "Out of ICP or a known no-fit",
        },
      },
      icp_fit: {
        type: "noul",
        instructions: "Does this account match ICP?",
        criteria: {
          true: "Matches ICP (segment, buyer, use-case)",
          false: "Out of ICP",
        },
      },
      intent: {
        type: "score",
        instructions: "How hot is buying intent?",
        criteria: ["Cold", "Warm", "Hot"],
      },
    },
  ),
  sample(
    "refund",
    "Refund call",
    "Full refund, partial, or deny.",
    "business",
    `STRIPE pi_3S9k · $247.00 · ORD-77120
Customer: Maya Chen · tenure 11 months · 2 prior refunds ($18, $42) both approved · lifetime revenue $1,104 · risk score 12/100.

Request (chat, 6m): “The annual plan renewed yesterday. I meant to cancel. I used it 3 days this period. Refund in full please. I’ll chargeback if not.”

Policy R-3:
- Full refund if unused, or within the 14-day new-customer window (she is not new).
- Partial: unused time minus one month already consumed (annual = $20.58/mo → ~$226 leftover) if cancel within 7 days of renewal.
- Deny: abuse, more than 2 refunds/year, or product fully consumed.
- A chargeback threat does not by itself deny.

Usage this period: 3 logins, 1 export, no seats added. Renewal was 19 hours ago. Cancel link was in the invoice email (opened, not clicked).`,
    {
      decision: {
        type: "choice",
        instructions: "What refund should Support issue?",
        criteria: {
          full: "Full $247 refund",
          partial: "Partial — unused months minus consumed time",
          deny: "Deny the refund",
        },
      },
      policy_allows_full: {
        type: "noul",
        instructions: "Does R-3 allow a full refund here?",
        criteria: {
          true: "Full refund is in policy",
          false: "Full refund is not in policy",
        },
      },
      abuse_risk: {
        type: "score",
        instructions: "How likely is refund abuse?",
        criteria: ["Clean", "Watch", "Abuse"],
      },
    },
  ),
  sample(
    "hire",
    "Hire screen",
    "Advance, hold, or pass this SWE-II.",
    "business",
    `REQ SWE-II · Decision Systems · recruiter screen + resume (redacted)

Candidate: Jordan Hale. 4.5 years. Last role: fintech, “built routing rules for disputes” (Rails + Sidekiq, not an LLM). CS, state school. GitHub: 12 public repos, one well-starred CSV cleaner.

Resume claims: “Designed a System-One-style classifier for chargebacks.” Recruiter: they could not name a typed-decision API; described a sklearn pipeline and a Slack bot.

Comp ask: $165k + 0.15%. Band: $140–170k cash, 0.08–0.20% equity. Notice: 3 weeks. Work auth: US citizen.

Scorecard musts: shipped production backend; evidence of judgment-under-uncertainty (ops, risk, or ML-in-prod); communicates tradeoffs.
Nice: TypeScript, payments.
Auto-pass: cannot discuss a real production system, fabricated logos, or requires >$190k.

Interviewer leftover: “Strong communicator, light on systems design. Would not put on-call in month 1.”`,
    {
      outcome: {
        type: "choice",
        instructions: "What is the screen call?",
        criteria: {
          advance: "Advance to onsite / next round",
          hold: "Hold — more signal needed before a yes or no",
          pass: "Pass — do not proceed",
        },
      },
      meets_musts: {
        type: "noul",
        instructions: "Do they meet the must-have scorecard?",
        criteria: {
          true: "Must-haves are met",
          false: "Must-haves are not met",
        },
      },
      fit: {
        type: "score",
        instructions: "How strong is overall fit for SWE-II?",
        criteria: ["Weak", "Mixed", "Strong"],
      },
    },
  ),
  sample(
    "launch",
    "Launch go/no-go",
    "Ship, wait, or ship with a rollback plan.",
    "business",
    `RELEASE billing-vats 2.12.0 · ship window today 16:00–18:00 ET
Change: new invoice PDF engine (Chromium worker). Dual-write old+new for 7 days. Flag pdf_v2 default off; this launch turns it on for EU tenants (VAT rules). ~1,100 EU invoices hit Friday; finance close is Monday.

Open issues:
- P1: German umlauts render as “?” in the footer on worker image tagged pdf-2026-09-18. Fix is on pdf-2026-09-19 — not the tag in this deploy ticket.
- P2: 2s slower first PDF; still within 8s SLA.
- Staging VAT golden files: 40/40 pass on the newer tag, 38/40 on the tagged build.

Rollback: flip flag off (tested, <2m). Old renderer still dual-writing. On-call: billing-platform.

Go criteria: no open P0/P1 on the artifact we ship. Wait: retag and slip to the next window. Rollback-plan: ship a known P1 only with a documented revert (legal has not asked).`,
    {
      call: {
        type: "choice",
        instructions: "What is the launch call for 2.12.0?",
        criteria: {
          ship: "Ship the tagged artifact in this window",
          wait: "Wait — retag / slip the window",
          rollback_plan: "Ship only with an explicit rollback plan for the known P1",
        },
      },
      artifact_ready: {
        type: "noul",
        instructions: "Is the tagged artifact ready to ship?",
        criteria: {
          true: "The SHA/tag we would ship is clean of P1",
          false: "The tagged artifact is not ready",
        },
      },
      readiness: {
        type: "score",
        instructions: "How ready is this launch?",
        criteria: ["Blocked", "Fragile", "Ready"],
      },
    },
  ),
  sample(
    "chargeback",
    "Chargeback",
    "Accept, represent, or block the account.",
    "business",
    `STRIPE DISPUTE dp_1S · $1,890.00 · reason: fraudulent · due in 6 days
Merchant: Pro Tools Cloud. Card: Visa *0244 issued NG. 3DS: not attempted (merchant exemption). AVS zip match, CVV fail.

Order: 40-seat annual, created 2.1 hours after signup, password reset twice, 8 API keys minted, data export of 12k rows, then chargeback. IP: Lagos datacenter ASN. Billing email ≠ login email. Device: first seen.

History: this card BIN has 4 disputes / 30d across our merchant (1.1% vs 0.3% category). Customer reply: none. Product usage looks like a scrape, not a team.

Policy:
- Represent if we have AVS+CVV+3DS or clear fulfillment evidence and the customer used the product as a real org.
- Accept (do not fight) if CVV fail + new account + export + no 3DS.
- Block the account if scrape/fraud pattern regardless of represent.

Compelling evidence on hand: invoice PDF, login logs, export log. No signed contract. No 3DS.`,
    {
      action: {
        type: "choice",
        instructions: "What should Risk do with this dispute?",
        criteria: {
          accept: "Accept the dispute — do not fight",
          represent: "Represent with compelling evidence",
          block: "Block the account (and usually accept the dispute)",
        },
      },
      fraud_likely: {
        type: "noul",
        instructions:
          "Is this likely fraud rather than a confused customer?",
        criteria: {
          true: "Fraud / scrape pattern",
          false: "Could be a real (non-fraud) dispute",
        },
      },
      evidence_strength: {
        type: "score",
        instructions: "How strong is representment evidence?",
        criteria: ["Thin", "Mixed", "Strong"],
      },
    },
  ),
  sample(
    "vendor",
    "Vendor risk",
    "Sign, redline, or walk the MSA.",
    "business",
    `VENDOR Northwind Observability Inc. · MSA + DPA
Spend: $86k year 1 · auto-renew 12 months. Liability cap: 3 months fees. Unlimited indemnity for us on IP; they want unlimited indemnity from us on “customer content.”

Security: SOC 2 Type II expired 4 months ago (“in recert”). No bridge letter. Data: EU + US. Subprocessors list includes a model provider with training-on-customer-data unless we opt out in an exhibit they have not attached.

Legal redlines already rejected twice: cap at 12 months fees, mutual IP indemnity only, no training on our tickets, 30-day termination for convenience after year 1.
Vendor latest: “Take it or we miss the Q3 implementation slot.”

Policy PROC-9:
- No unlimited indemnity outbound.
- No expired SOC 2 without a bridge letter.
- Training opt-out must be in the DPA.
- Walk if two of those three fail and spend is >$50k.`,
    {
      action: {
        type: "choice",
        instructions: "What should Procurement / Legal do?",
        criteria: {
          sign: "Sign as papered",
          redline: "Send another redline / hold the slot",
          walk: "Walk — do not sign",
        },
      },
      policy_clear: {
        type: "noul",
        instructions: "Can we sign this paper as-is under PROC-9?",
        criteria: {
          true: "Clear to sign under policy",
          false: "Not clear — redline or walk",
        },
      },
      risk: {
        type: "score",
        instructions: "How risky is this contract?",
        criteria: ["Acceptable", "Elevated", "Deal-breaker"],
      },
    },
  ),
  sample(
    "moderate",
    "Moderate",
    "Go live, force an edit, or kill the post.",
    "business",
    `TRUST & SAFETY · PUB-90331 · SLA 15 minutes (4 remaining)
Creator: @millshed · Pro · 2.4y · 18k followers · 2 prior strikes: medical-misinfo (2025), spam (2024). Format: 42s video + caption.

Caption: “This cheap peptide stack cured my cousin’s tumor. Link in bio, 40% off today only. Doctors hate this.”
Video: unidentified vials, no medical license, before/after stills that match a stock-photo watermark on frame 18.

Policy P-4 Health:
- No unproven treatment claims for cancer.
- No sales links on health claims.
- First cancer-claim strike = kill + 7-day feature ban; second = account disable.
- Spam strike is a different bucket.
- News/commentary exception does not apply to product pitches.

Regional: US + UK inventory. Brand safety: this would run next to a live hospital advertiser campaign.`,
    {
      action: {
        type: "choice",
        instructions: "What should T&S do with PUB-90331?",
        criteria: {
          go_live: "Leave it up as posted",
          edit: "Require an edit (strip claims / link) then re-review",
          kill: "Kill the post (and apply the strike policy)",
        },
      },
      policy_violation: {
        type: "noul",
        instructions: "Does this violate P-4 Health as posted?",
        criteria: {
          true: "It is a P-4 violation as posted",
          false: "It can stand under P-4",
        },
      },
      harm: {
        type: "score",
        instructions: "How much harm if this stays up?",
        criteria: ["Low", "Medium", "Severe"],
      },
    },
  ),
  sample(
    "jacket",
    "Jacket?",
    "Walk out with the right layer.",
    "weather",
    `15–20 minute outdoor errand — coffee run or a short walk. Judge jacket vs no jacket from the weather block plus this outing. Not a packing essay.`,
    {
      wear_jacket: {
        type: "noul",
        instructions:
          "Should they wear a jacket for this outing given the weather?",
        criteria: {
          true: "A jacket is warranted for comfort or weather",
          false: "Comfortable without a jacket",
        },
      },
      layer: {
        type: "choice",
        instructions: "If they dress for this outing, which layer is the snap call?",
        criteria: {
          tee: "T-shirt or equivalent; no extra layer",
          light_layer: "Shirt, hoodie, or light sweater",
          insulated: "Insulated coat or heavy jacket",
          rain_shell: "Rain shell / waterproof layer",
        },
      },
    },
  ),
];

/** Alias for Workshop Preset Cases — same ten as Use Cases. Do not fork this list. */
export const SAMPLE_CASES = SAMPLES;

export const SAMPLE_BY_ID: Record<SampleId, SampleCase> = Object.fromEntries(
  SAMPLES.map((s) => [s.id, s]),
) as Record<SampleId, SampleCase>;

export const DEFAULT_STATE = SAMPLE_BY_ID[LANDING_SAMPLE_ID].state;
export const DEFAULT_QUESTIONS = SAMPLE_BY_ID[LANDING_SAMPLE_ID].questions;

export function isSampleId(id: string | null | undefined): id is SampleId {
  return Boolean(id && id in SAMPLE_BY_ID);
}

export function isWeatherSample(id: string | null | undefined): boolean {
  return id === WEATHER_SAMPLE_ID;
}

export function getSample(id: string | null | undefined): SampleCase | null {
  if (!isSampleId(id)) return null;
  return SAMPLE_BY_ID[id];
}

export function cloneSample(id: string | null | undefined): SampleCase | null {
  const s = getSample(id);
  if (!s) return null;
  return {
    ...s,
    questions: structuredClone(s.questions),
  };
}

export function typeLine(types: QuestionType[]) {
  return types.join(" · ");
}
