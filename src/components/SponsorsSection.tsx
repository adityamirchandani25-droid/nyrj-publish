import { useEffect, useState } from "react";
import { getSession, isStaff, onAuthChange, staffToken, type Session } from "@/lib/auth";
import {
  sponsorsList,
  sponsorCreate,
  sponsorDelete,
  type SponsorRow,
} from "@/lib/sponsors.functions";

const TIER_LABEL: Record<string, string> = {
  founding: "Founding Partner",
  partner: "Partner",
  gold: "Gold Sponsor",
  silver: "Silver Sponsor",
  bronze: "Bronze Sponsor",
  supporter: "Supporter",
};

async function toBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (const b of buf) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function SponsorsSection() {
  const [rows, setRows] = useState<SponsorRow[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [name, setName] = useState("");
  const [tier, setTier] = useState<
    "founding" | "partner" | "gold" | "silver" | "bronze" | "supporter"
  >("supporter");
  const [website, setWebsite] = useState("");
  const [blurb, setBlurb] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [logoKey, setLogoKey] = useState(0);

  // Research Spark Hub already has the large spotlight card above, so keep it
  // out of the small sponsor grid to avoid showing it twice.
  const isSpotlight = (s: SponsorRow) =>
    /researchsparkhub/i.test(s.website ?? "") || /research\s*spark\s*hub/i.test(s.name);

  const reload = () =>
    sponsorsList()
      .then((all) => setRows(all.filter((s) => !isSpotlight(s))))
      .catch(() => setRows([]));

  useEffect(() => {
    reload();
    setSession(getSession());
    return onAuthChange(setSession);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const staff = isStaff(session);

  const add = async () => {
    setErr("");
    if (!name.trim()) return setErr("Sponsor name is required.");
    setBusy(true);
    try {
      await sponsorCreate({
        data: {
          staffToken: staffToken(),
          name: name.trim(),
          tier,
          website: website.trim(),
          blurb: blurb.trim(),
          ...(logo
            ? { logoBase64: await toBase64(logo), logoMime: logo.type, logoFileName: logo.name }
            : {}),
        },
      });
      setName("");
      setWebsite("");
      setBlurb("");
      setLogo(null);
      setLogoKey((k) => k + 1);
      setOpen(false);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not add sponsor.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this sponsor?")) return;
    await sponsorDelete({ data: { staffToken: staffToken(), id } });
    await reload();
  };

  if (!rows.length && !staff) {
    return (
      <section className="mt-16 border-t border-border pt-8">
        <h2 className="font-serif text-2xl text-primary">Sponsors &amp; supporters</h2>
        <SponsorSpotlight />
        <p className="mt-3 text-sm text-foreground/85 leading-relaxed">
          NYRJ is free to read and free to submit to. Sponsors help keep it that way. Sponsors have
          no influence over peer review or editorial decisions.
        </p>
        <p className="mt-3 text-sm">
          Interested in supporting the journal?{" "}
          <a
            href="mailto:NYRJINFO@gmail.com?subject=NYRJ%20Sponsorship"
            className="text-primary underline underline-offset-4 hover:text-accent"
          >
            Email NYRJINFO@gmail.com
          </a>
        </p>
      </section>
    );
  }

  return (
    <section className="mt-16 border-t border-border pt-8">
      <h2 className="font-serif text-2xl text-primary">Sponsors &amp; supporters</h2>
      <SponsorSpotlight />
      <p className="mt-3 text-sm text-foreground/85 leading-relaxed">
        NYRJ is fiscally sponsored under a 501(c)(3) nonprofit organization and remains free to read
        and free to submit to. Sponsors have no influence over peer review or editorial decisions.
      </p>

      {rows.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((s) => (
            <div key={s.id} className="relative border border-border bg-card p-5">
              {staff && (
                <button
                  onClick={() => remove(s.id)}
                  className="absolute right-2 top-2 text-xs text-destructive hover:underline"
                  aria-label={`Remove ${s.name}`}
                >
                  Remove
                </button>
              )}
              {s.logo_url && (
                <img
                  src={s.logo_url}
                  alt={`${s.name} logo`}
                  loading="lazy"
                  className="h-12 w-auto object-contain"
                />
              )}
              <p className="mt-3 font-serif text-lg text-primary">
                {s.website ? (
                  <a
                    href={s.website}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="hover:text-accent"
                  >
                    {s.name}
                  </a>
                ) : (
                  s.name
                )}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-accent">
                {TIER_LABEL[s.tier] ?? s.tier}
              </p>
              {s.blurb && <p className="mt-2 text-sm text-foreground/80">{s.blurb}</p>}
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-sm">
        Interested in supporting the journal?{" "}
        <a
          href="mailto:NYRJINFO@gmail.com?subject=NYRJ%20Sponsorship"
          className="text-primary underline underline-offset-4 hover:text-accent"
        >
          Email NYRJINFO@gmail.com
        </a>
      </p>

      {staff && (
        <div className="mt-8 border border-dashed border-border p-5">
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-xs uppercase tracking-[0.2em] text-accent"
          >
            {open ? "Cancel" : "+ Add sponsor (staff)"}
          </button>
          {open && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sponsor name"
                className="border border-border bg-background px-3 py-2 text-sm"
              />
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as typeof tier)}
                className="border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="founding">Founding Partner</option>
                <option value="partner">Partner</option>
                <option value="gold">Gold Sponsor</option>
                <option value="silver">Silver Sponsor</option>
                <option value="bronze">Bronze Sponsor</option>
                <option value="supporter">Supporter</option>
              </select>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://sponsor.org (optional)"
                className="border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                key={logoKey}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
                className="text-sm"
              />
              <textarea
                value={blurb}
                onChange={(e) => setBlurb(e.target.value)}
                placeholder="Short blurb (optional)"
                rows={2}
                className="sm:col-span-2 border border-border bg-background px-3 py-2 text-sm"
              />
              {err && <p className="sm:col-span-2 text-sm text-destructive">{err}</p>}
              <div className="sm:col-span-2">
                <button
                  onClick={add}
                  disabled={busy}
                  className="bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60"
                >
                  {busy ? "Saving…" : "Save sponsor"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function SponsorSpotlight() {
  return (
    <a
      href="https://www.researchsparkhub.com"
      target="_blank"
      rel="noopener noreferrer"
      className="group relative mt-6 block overflow-hidden rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-xl"
    >
      <span
        aria-hidden
        className="animate-nyrj-glow pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/25 blur-3xl"
      />
      <span
        aria-hidden
        className="animate-nyrj-glow pointer-events-none absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-primary/20 blur-3xl"
      />
      <div className="relative flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
        <img
          src="/research-spark-hub.png"
          alt="Research Spark Hub logo"
          loading="lazy"
          className="animate-nyrj-float h-24 w-24 shrink-0 object-contain drop-shadow-md transition-transform duration-500 group-hover:scale-110"
        />
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">Bronze Sponsor</p>
          <p className="mt-1 font-serif text-2xl text-primary">Research Spark Hub</p>
          <p className="mt-2 text-sm text-foreground/80">
            Supporting student researchers with programs, mentorship, and opportunities to take
            their work further.
          </p>
          <span className="mt-3 inline-flex items-center gap-2 text-sm text-primary underline underline-offset-4 group-hover:text-accent">
            researchsparkhub.com
            <span
              aria-hidden
              className="transition-transform duration-300 group-hover:translate-x-1"
            >
              →
            </span>
          </span>
        </div>
      </div>
    </a>
  );
}
