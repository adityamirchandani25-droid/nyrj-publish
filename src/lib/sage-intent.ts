export type StaffIntent =
  "resubmissions" | "reviewers" | "approvals" | "emails" | "counts" | "unknown";

/** Match the newest question first, then carry a topic through a short follow-up. */
export function staffQuestionIntent(question: string, previousQuestion = ""): StaffIntent {
  const q = question.toLowerCase();
  if (/email|notif|deliver|bounce|spam|sendgrid/.test(q)) return "emails";
  if (/(how many|count|number of)/.test(q) && /(paper|submission|reviewer)/.test(q))
    return "counts";
  if (/resubmi|waiting.*edit|awaiting.*revision/.test(q)) return "resubmissions";
  if (/reviewer|feedback/.test(q) && /haven|missing|waiting|pending|not |yet|overdue/.test(q))
    return "reviewers";
  if (/request|accept|approv/.test(q) && !/^(how|why|can|what is)\b/.test(q)) return "approvals";
  if (/^(and|what about|how about|those|them|which ones)\b/.test(q)) {
    return staffQuestionIntent(previousQuestion);
  }
  return "unknown";
}
