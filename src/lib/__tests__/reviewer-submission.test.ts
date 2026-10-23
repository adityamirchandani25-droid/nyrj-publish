import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { reviewerDetails } from "../reviewer-submission.ts";
import { publicSiteUrl } from "../site-url.server.ts";

const original = process.env.PUBLIC_SITE_URL;
afterEach(() => {
  if (original === undefined) delete process.env.PUBLIC_SITE_URL;
  else process.env.PUBLIC_SITE_URL = original;
});

test("email links reject local and invalid origins", () => {
  for (const origin of [
    "http://localhost:3000",
    "https://localhost",
    "https://127.0.0.1",
    "https://[::1]",
    "https://preview.localhost",
    "ftp://nyrj.org",
    "garbage",
  ]) {
    process.env.PUBLIC_SITE_URL = origin;
    assert.equal(publicSiteUrl(), "https://nyrj.org");
  }
});
test("email links use the configured HTTPS origin without a path", () => {
  process.env.PUBLIC_SITE_URL = "https://nyrj.org/some/path";
  assert.equal(publicSiteUrl(), "https://nyrj.org");
});
test("reviewer details include declarations and exclude personal and internal fields", () => {
  const details = reviewerDetails({
    research_type: "Research Paper",
    funding: false,
    used_gen_ai: true,
    gen_ai_explanation: "Grammar assistance",
    data_availability: "available_on_request",
    authors: [{ name: "Private Author", email: "private@example.com" }],
    submitter_email: "private@example.com",
    referral_code: "PRIVATE-CODE",
    consent_form_paths: [{ path: "private/consent.pdf" }],
    resubmit_token: "SECRET-TOKEN",
    initial_reviewer_email: "internal@example.com",
  });
  assert.equal(details.find((d) => d.label === "Funding declared")?.value, "No");
  assert.equal(details.find((d) => d.label === "Generative AI used")?.value, "Yes");
  assert.equal(
    details.find((d) => d.label === "AI usage explanation")?.value,
    "Grammar assistance",
  );
  assert.equal(details.length, 5);
  assert.doesNotMatch(
    JSON.stringify(details),
    /Private Author|private@|PRIVATE-CODE|consent.pdf|SECRET-TOKEN|internal@/,
  );
});
