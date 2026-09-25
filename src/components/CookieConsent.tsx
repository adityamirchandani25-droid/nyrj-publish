import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

type CookieChoice = "all" | "essential";

const COOKIE_NAME = "nyrj_cookie_consent";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function readChoice(): CookieChoice | null {
  if (typeof document === "undefined") return null;
  const value = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${COOKIE_NAME}=`))
    ?.split("=")[1];
  return value === "all" || value === "essential" ? value : null;
}

function saveChoice(choice: CookieChoice) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${choice}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent("nyrj:cookie-consent", { detail: choice }));
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readChoice() === null);
  }, []);

  function choose(choice: CookieChoice) {
    saveChoice(choice);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside
      className="cookie-consent"
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
    >
      <div className="cookie-consent__seal" aria-hidden="true">
        <span>NYRJ</span>
      </div>
      <div className="cookie-consent__copy">
        <p className="cookie-consent__eyebrow">Your privacy</p>
        <h2 id="cookie-consent-title">A quick note about cookies.</h2>
        <p id="cookie-consent-description">
          NYRJ uses essential browser storage to keep accounts signed in and remember site
          preferences. You can also allow optional cookies that may help us understand and improve
          the journal experience.
        </p>
        <Link to="/privacy" className="cookie-consent__link">
          Read our privacy policy →
        </Link>
      </div>
      <div className="cookie-consent__actions">
        <button type="button" className="cookie-consent__accept" onClick={() => choose("all")}>
          Accept all
        </button>
        <button
          type="button"
          className="cookie-consent__essential"
          onClick={() => choose("essential")}
        >
          Necessary only
        </button>
      </div>
    </aside>
  );
}
