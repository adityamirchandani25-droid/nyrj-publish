/** Everyone who receives operational manuscript and review notifications. */
export const MASTER_STAFF_EMAILS = [
  "keyaanmerchant24@gmail.com",
  "Madhavarora529@gmail.com",
  "anirudh.budumuru@gmail.com",
] as const;

/** Reviewer follow-up updates also go to the journal mailbox. */
export const REVIEW_FOLLOWUP_STAFF_EMAILS = ["NYRJINFO@gmail.com", ...MASTER_STAFF_EMAILS] as const;
