// Regression tests for the October 2026 security audit fixes.
// Run with `npm test` (Node's built-in runner executes TypeScript natively).
import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import { chatLinkPattern } from "../chat-links.ts";
import { hasBearerSecret, rejectUnauthorizedCron } from "../cron-auth.server.ts";
import { checkDeveloperPassword } from "../developer-auth.server.ts";
import { senderAuthenticated } from "../gmail-review-sync.server.ts";
import { escapeLikePattern, sameEmail } from "../like-pattern.ts";
import { safeHttpUrl } from "../safe-url.ts";

function links(text: string): string[] {
  return [...text.matchAll(chatLinkPattern())].map((match) => match[2]);
}

function request(authorization?: string): Request {
  return new Request("https://nyrj.org/api/public/review-reminders", {
    headers: authorization ? { authorization } : {},
  });
}

describe("developer password", () => {
  const original = process.env.DEVELOPER_PASSWORD;
  afterEach(() => {
    if (original === undefined) delete process.env.DEVELOPER_PASSWORD;
    else process.env.DEVELOPER_PASSWORD = original;
  });

  test("the old hard-coded fallback no longer signs in", () => {
    delete process.env.DEVELOPER_PASSWORD;
    assert.equal(checkDeveloperPassword("SOFTWARENYRJ"), false);
    assert.equal(checkDeveloperPassword(""), false);
  });

  test("only the configured password is accepted", () => {
    process.env.DEVELOPER_PASSWORD = "correct horse battery staple";
    assert.equal(checkDeveloperPassword("correct horse battery staple"), true);
    assert.equal(checkDeveloperPassword("SOFTWARENYRJ"), false);
  });
});

describe("cron authorization", () => {
  test("accepts the exact bearer secret", () => {
    assert.equal(hasBearerSecret(request("Bearer s3cret-value"), ["s3cret-value"]), true);
    assert.equal(rejectUnauthorizedCron(request("Bearer s3cret-value"), ["s3cret-value"]), null);
  });

  test("rejects missing, wrong, or query-string secrets", () => {
    assert.equal(hasBearerSecret(request(), ["s3cret-value"]), false);
    assert.equal(hasBearerSecret(request("Bearer wrong"), ["s3cret-value"]), false);
    assert.equal(hasBearerSecret(request("s3cret-value"), ["s3cret-value"]), false);
    const withQuery = new Request("https://nyrj.org/api/public/x?key=s3cret-value");
    assert.equal(hasBearerSecret(withQuery, ["s3cret-value"]), false);
    assert.equal(rejectUnauthorizedCron(request("Bearer wrong"), ["s3cret-value"])?.status, 401);
  });

  test("an unset secret never authorizes and reports misconfiguration", () => {
    assert.equal(hasBearerSecret(request("Bearer "), [undefined, ""]), false);
    assert.equal(rejectUnauthorizedCron(request("Bearer x"), [undefined])?.status, 500);
  });
});

describe("email identity matching", () => {
  test("LIKE wildcards are escaped", () => {
    assert.equal(escapeLikePattern("first_last@school.org"), "first\\_last@school.org");
    assert.equal(escapeLikePattern("100%@x.org"), "100\\%@x.org");
    assert.equal(escapeLikePattern("a\\b@x.org"), "a\\\\b@x.org");
  });

  test("only exact case-insensitive matches count", () => {
    assert.equal(sameEmail(" Reviewer@School.org ", "reviewer@school.org"), true);
    assert.equal(sameEmail("firstXlast@school.org", "first_last@school.org"), false);
    assert.equal(sameEmail("anyone@school.org", "*@school.org"), false);
    assert.equal(sameEmail("", ""), false);
    assert.equal(sameEmail(null, undefined), false);
  });
});

describe("assistant links", () => {
  test("same-origin paths become links", () => {
    assert.deepEqual(links("See [Submit](/submit) or [Contact](/contact#team)."), [
      "/submit",
      "/contact#team",
    ]);
  });

  test("protocol-relative and absolute URLs are not linked", () => {
    assert.deepEqual(links("[Login](//evil.example/login)"), []);
    assert.deepEqual(links("[Login](https://evil.example)"), []);
    assert.deepEqual(links("[x](javascript:alert(1))"), []);
  });
});

describe("external URLs", () => {
  test("only http(s) URLs are allowed", () => {
    assert.equal(safeHttpUrl("https://sponsor.example/about"), "https://sponsor.example/about");
    assert.equal(safeHttpUrl("http://sponsor.example"), "http://sponsor.example/");
    assert.equal(safeHttpUrl("javascript:alert(1)"), null);
    assert.equal(safeHttpUrl("data:text/html,<script>alert(1)</script>"), null);
    assert.equal(safeHttpUrl("/relative"), null);
    assert.equal(safeHttpUrl(""), null);
    assert.equal(safeHttpUrl(null), null);
  });
});

describe("Gmail reviewer reply authentication", () => {
  const sender = "reviewer@school.org";

  test("trusts DMARC pass or an aligned SPF/DKIM pass", () => {
    assert.equal(
      senderAuthenticated(
        "mx.google.com; dkim=pass header.i=@school.org; spf=pass smtp.mailfrom=reviewer@school.org; dmarc=pass (p=NONE) header.from=school.org",
        sender,
      ),
      true,
    );
    assert.equal(
      senderAuthenticated("mx.google.com; dkim=pass header.i=@mail.school.org header.s=s1", sender),
      true,
    );
    assert.equal(
      senderAuthenticated(
        "mx.google.com; spf=pass (google.com: domain of bounce@school.org designates 1.2.3.4) smtp.mailfrom=bounce@school.org",
        sender,
      ),
      true,
    );
  });

  test("rejects spoofed or unauthenticated replies", () => {
    assert.equal(senderAuthenticated("", sender), false);
    assert.equal(
      senderAuthenticated(
        "mx.google.com; dkim=pass header.i=@school.org; dmarc=fail (p=REJECT) header.from=school.org",
        sender,
      ),
      false,
    );
    assert.equal(
      senderAuthenticated(
        "mx.google.com; spf=pass smtp.mailfrom=attacker@evil.example; dmarc=none header.from=school.org",
        sender,
      ),
      false,
    );
    assert.equal(
      senderAuthenticated("mx.google.com; dkim=pass header.i=@evil.example; spf=softfail", sender),
      false,
    );
  });
});
