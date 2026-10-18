// The four standing questions to the client that exist from day one of the engagement,
// regardless of how far along the workpaper is - seeded once, idempotently, by fixed id,
// rather than bundled into the big "load demo worked file" narrative. They give Home's
// "Open questions" and the Client portal real content immediately, and back the "Ask
// client" action on the checks/judgment items that need client input.
import type { WorkpaperEvent } from "../types/domain";

const SEEDED_AT = "2026-02-01T16:00:00Z";

export const SEED_QUESTIONS: WorkpaperEvent[] = [
  {
    id: "seed_q_crypto",
    at: SEEDED_AT,
    realAt: SEEDED_AT,
    actor: "st-01",
    role: "preparer",
    type: "question",
    target: { kind: "check", id: "check:CRYPTO-BASIS-MISSING", label: "Crypto lot has no cost basis or acquisition date" },
    payload: { question_text: "Can you send the CryptoNorth bank statement showing the $3,050 transfer on 03/15/2021? Your message gives us the amount, but we need the statement itself as evidence.", to: "client" },
  },
  {
    id: "seed_q_stbrigid",
    at: SEEDED_AT,
    realAt: SEEDED_AT,
    actor: "st-01",
    role: "preparer",
    type: "question",
    target: { kind: "other", id: "judgment:ST-BRIGID-RECEIPT-AMBIGUOUS", label: "St. Brigid receipt: digit ambiguous at 41% confidence" },
    payload: { question_text: "Can you get a written acknowledgment from St. Brigid for the $1,500 gift? It's required for any gift of $250 or more, and the receipt we have is hard to read.", to: "client" },
  },
  {
    id: "seed_q_sep",
    at: SEEDED_AT,
    realAt: SEEDED_AT,
    actor: "st-01",
    role: "preparer",
    type: "question",
    target: { kind: "check", id: "check:SEP-LIMIT", label: "SEP contribution exceeds the deductible limit" },
    payload: { question_text: "The SEP contribution is over the deductible limit by about $2,786 (more once other fixes are accepted). Do you want to withdraw the excess, or have us report and pay the 6% excise tax on Form 5329?", to: "client" },
  },
  {
    id: "seed_q_3520",
    at: SEEDED_AT,
    realAt: SEEDED_AT,
    actor: "st-01",
    role: "preparer",
    type: "question",
    target: { kind: "other", id: "judgment:PRIOR-OPEN-3520", label: "Form 3520 for the 2023 inheritance" },
    payload: { question_text: "We noticed the 2023 inheritance over $100,000 - can we talk about whether Form 3520 needs to be filed? This is outside our engagement scope, but we're required to advise you in writing either way.", to: "client" },
  },
];

export const SEED_QUESTION_IDS = new Set(SEED_QUESTIONS.map((e) => e.id));
