import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { getSession, logout, onAuthChange, type Session } from "@/lib/auth";
import {
  SocialLink,
  SOCIAL_LINKEDIN,
  SOCIAL_INSTAGRAM,
  SOCIAL_YOUTUBE,
  LinkedInIcon,
  InstagramIcon,
  YouTubeIcon,
} from "@/components/SocialLinks";
import { ScrollRevealRegion } from "@/components/ScrollRevealRegion";

export function SiteLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />
      <ScrollRevealRegion>{children ?? <Outlet />}</ScrollRevealRegion>
      <Footer />
    </div>
  );
}

// Inaugural issue: July 2026. Issue increments each month, volume each July.
function currentIssueInfo() {
  const now = new Date();
  const launch = new Date(2026, 6, 1); // July 2026
  const months = Math.max(
    0,
    (now.getFullYear() - launch.getFullYear()) * 12 + (now.getMonth() - launch.getMonth()),
  );
  const issue = (months % 12) + 1;
  const volNum = Math.floor(months / 12) + 1;
  return { volume: toRoman(volNum), issue, year: now.getFullYear() };
}

function toRoman(n: number): string {
  const map: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  for (const [v, s] of map) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}

function Header() {
  const [session, setSession] = useState<Session | null>(null);
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    setSession(getSession());
    return onAuthChange(setSession);
  }, []);

  const { volume, issue, year } = currentIssueInfo();

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    void navigate({ to: "/search", search: { q } });
  }

  return (
    <header className="border-b border-border bg-background">
      <div className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground flex justify-between items-center gap-4">
          <span>
            Vol. {volume} · Issue {issue} · {year}
          </span>
          <div className="flex items-center gap-4 sm:gap-6">
            <span className="hidden md:inline">ISSN 3143-3030</span>
            <ThemeToggle />
            <form onSubmit={handleSearch} className="flex items-center" role="search">
              <label htmlFor="site-search" className="sr-only">
                Search NYRJ
              </label>
              <input
                id="site-search"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search…"
                className="w-24 sm:w-48 border border-border bg-background px-2 py-1 text-[11px] normal-case tracking-normal focus:outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="ml-1 px-2 py-1 border border-border text-[10px] font-semibold hover:bg-primary hover:text-primary-foreground transition"
                aria-label="Search"
              >
                Go
              </button>
            </form>
            {session ? (
              <span className="flex items-center gap-3">
                <span className="text-accent normal-case tracking-normal">
                  {session.username} <span className="text-muted-foreground">({session.role})</span>
                </span>
                <button onClick={() => logout()} className="hover:text-accent transition">
                  Log out
                </button>
              </span>
            ) : (
              <Link
                to="/login"
                className="rounded-full border border-current px-3 py-1 text-[10px] font-semibold uppercase tracking-wider hover:bg-primary hover:text-primary-foreground transition"
              >
                Log in
              </Link>
            )}
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-6 py-10 grid grid-cols-[auto_1fr_auto] items-center gap-6">
        <Link
          to="/"
          aria-label="NYRJ home"
          className="journal-logo-shell shrink-0 justify-self-start"
        >
          <img
            src="/nyrj-logo.png"
            alt="National Youth Research Journal logo"
            className="journal-mark h-16 sm:h-20 w-auto"
            width={320}
            height={320}
          />
        </Link>
        <Link to="/" className="flex flex-col items-center text-center gap-2 min-w-0">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.35em] text-accent">
            National Youth Research Journal
          </p>
          <p
            className="font-serif text-5xl sm:text-6xl md:text-7xl tracking-tight leading-none"
            aria-label="NYRJ — National Youth Research Journal"
          >
            NYRJ
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground italic max-w-xl">
            From middle school to med school — student research, every discipline, published on a
            rolling basis.
          </p>
        </Link>
        <Link
          to="/submit/apply"
          className="justify-self-end px-4 sm:px-6 py-2.5 rounded-full bg-accent text-accent-foreground text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] hover:opacity-90 transition whitespace-nowrap"
        >
          Submit <span className="hidden sm:inline">Manuscript</span> →
        </Link>
      </div>
      <nav className="journal-nav border-t border-border bg-primary text-primary-foreground">
        <div className="mx-auto max-w-6xl px-6 flex flex-wrap justify-center items-center gap-x-8 gap-y-2 py-3 text-xs uppercase tracking-[0.18em]">
          <NavItem to="/">Home</NavItem>
          <DropdownMenu label="About" items={ABOUT_ITEMS} />
          <NavItem to="/archive">Library</NavItem>
          <DropdownMenu
            label="For Students"
            items={session ? STUDENT_ITEMS : STUDENT_ITEMS.filter((i) => i.to !== "/track")}
          />
          <NavItem to="/events">Events</NavItem>
          <NavItem to="/contact">Contact</NavItem>
          {session?.role === "staff" && (
            <>
              <NavItem to="/admin/submissions">Staff · Submissions</NavItem>
              <NavItem to="/admin/chapters">Staff · Chapters</NavItem>
            </>
          )}
          {session?.role === "ambassador" && (
            <NavItem to="/ambassador">Ambassador · Dashboard</NavItem>
          )}
        </div>
      </nav>
    </header>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.style.colorScheme = next ? "dark" : "light";
    window.localStorage.setItem("nyrj.theme", next ? "dark" : "light");
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Sun className="theme-toggle__sun" aria-hidden="true" />
      <Moon className="theme-toggle__moon" aria-hidden="true" />
    </button>
  );
}

function NavItem({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="hover:text-accent transition-colors"
      activeProps={{ className: "text-accent" }}
      activeOptions={{ exact: to === "/" }}
    >
      {children}
    </Link>
  );
}

const ABOUT_ITEMS = [
  { to: "/about", label: "About & Mission" },
  { to: "/advisors", label: "Advisors" },
  { to: "/team", label: "NYRJ Team" },
  { to: "/metrics", label: "Journal Metrics" },
];

const STUDENT_ITEMS = [
  { to: "/submit", label: "Submit a Manuscript" },
  { to: "/track", label: "Track Submissions" },
  { to: "/guidelines", label: "Author Guidelines" },
  { to: "/editors", label: "Editing Process" },
  { to: "/guidance", label: "Guidance" },
  { to: "/chapters", label: "Chapters" },
];

function DropdownMenu({ label, items }: { label: string; items: { to: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef<(HTMLAnchorElement | null)[]>([]);
  const menuId = useId();

  const scheduleClose = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(false), 400);
  };

  const cancelClose = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleOpen = () => {
    cancelClose();
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  useEffect(() => {
    if (open) setActiveIndex(0);
  }, [open]);

  useEffect(() => {
    if (open) itemsRef.current[activeIndex]?.focus();
  }, [activeIndex, open]);

  const handleButtonKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        if (open) handleClose();
        else handleOpen();
        break;
      case "ArrowDown":
        e.preventDefault();
        if (!open) handleOpen();
        else setActiveIndex((i) => Math.min(i + 1, items.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (open) setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          handleClose();
        }
        break;
    }
  };

  const handleItemKeyDown = (e: React.KeyboardEvent<HTMLAnchorElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, items.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(items.length - 1);
        break;
      case "Escape":
        e.preventDefault();
        handleClose();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div className="relative" onMouseEnter={handleOpen} onMouseLeave={scheduleClose}>
      <button
        ref={buttonRef}
        type="button"
        id={menuId}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleButtonKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${menuId}-list` : undefined}
        className="hover:text-accent transition-colors flex items-center gap-1 uppercase tracking-[0.18em]"
      >
        {label}
        <span aria-hidden className="text-[0.65rem]">
          ▾
        </span>
      </button>
      {open && (
        <div
          id={`${menuId}-list`}
          role="menu"
          aria-labelledby={menuId}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 min-w-[220px] border border-border bg-background text-foreground shadow-lg"
        >
          {items.map((item, i) => (
            <Link
              key={item.to}
              ref={(el) => {
                itemsRef.current[i] = el;
              }}
              to={item.to}
              role="menuitem"
              tabIndex={-1}
              onClick={() => setOpen(false)}
              onKeyDown={handleItemKeyDown}
              className="block px-4 py-2.5 text-[11px] uppercase tracking-[0.18em] hover:bg-secondary hover:text-accent transition-colors border-b border-border last:border-b-0"
              activeProps={{ className: "text-accent" }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-primary text-primary-foreground mt-16">
      <div className="mx-auto max-w-6xl px-6 py-10 grid gap-8 md:grid-cols-3 text-sm">
        <div>
          <p className="font-serif text-2xl">NYRJ</p>
          <p className="text-primary-foreground/70 mt-2">
            National Youth Research Journal. Publishing student research across every field, on a
            rolling basis
          </p>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-16 items-center justify-center rounded bg-primary-foreground px-3">
              <img
                src="/crossref-logo.svg"
                alt="Crossref member"
                width={200}
                height={48}
                loading="eager"
                decoding="async"
                fetchPriority="low"
                className="h-12 w-auto"
              />
            </div>
            <div className="flex flex-col items-center">
              <div className="flex h-16 items-center justify-center rounded bg-primary-foreground px-3">
                <img
                  src="/issn-logo.png"
                  alt="ISSN"
                  width={136}
                  height={40}
                  loading="eager"
                  decoding="async"
                  fetchPriority="low"
                  className="h-10 w-auto"
                />
              </div>

              <p className="mt-1 text-xs font-medium tracking-wide text-primary-foreground/90">
                3143-3030
              </p>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <SocialLink
              href={SOCIAL_LINKEDIN}
              label="NYRJ on LinkedIn"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/10 hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <LinkedInIcon className="h-4.5 w-4.5" />
            </SocialLink>
            <SocialLink
              href={SOCIAL_INSTAGRAM}
              label="NYRJ on Instagram"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/10 hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <InstagramIcon className="h-4.5 w-4.5" />
            </SocialLink>
            <SocialLink
              href={SOCIAL_YOUTUBE}
              label="NYRJ on YouTube"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/10 hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <YouTubeIcon className="h-4.5 w-4.5" />
            </SocialLink>
          </div>
        </div>

        <div>
          <p className="uppercase tracking-[0.18em] text-xs text-accent mb-2">Contact</p>
          <a href="mailto:NYRJINFO@gmail.com" className="hover:text-accent">
            NYRJINFO@gmail.com
          </a>
        </div>
        <div>
          <p className="uppercase tracking-[0.18em] text-xs text-accent mb-2">Sections</p>
          <ul className="space-y-1 text-primary-foreground/80">
            <li>
              <Link to="/about" className="hover:text-accent">
                About & Mission
              </Link>
            </li>
            <li>
              <Link to="/team" className="hover:text-accent">
                NYRJ Team
              </Link>
            </li>
            <li>
              <Link to="/metrics" className="hover:text-accent">
                Journal Metrics
              </Link>
            </li>
            <li>
              <Link to="/submit" className="hover:text-accent">
                Submit Manuscript
              </Link>
            </li>
            <li>
              <Link to="/track" className="hover:text-accent">
                Track Submissions
              </Link>
            </li>
            <li>
              <Link to="/archive" className="hover:text-accent">
                Library
              </Link>
            </li>
            <li>
              <Link to="/events" className="hover:text-accent">
                Events
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="hover:text-accent">
                Privacy Policy
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-primary-foreground/15 text-center py-4 text-xs text-primary-foreground/60 space-y-1">
        <p>
          Published in Atlanta, Georgia, USA · Open Access · © {new Date().getFullYear()} National
          Youth Research Journal. All rights reserved.
        </p>
        <p className="text-primary-foreground/50">
          NYRJ is fiscally sponsored under a 501(c)(3) nonprofit organization ·{" "}
          <Link to="/privacy" className="hover:text-accent underline underline-offset-2">
            Privacy Policy
          </Link>
        </p>
      </div>
    </footer>
  );
}
