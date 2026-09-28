import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ChatbotPopup } from "@/components/ChatbotPopup";
import { CookieConsent } from "@/components/CookieConsent";
import { EditorialLoader } from "@/components/EditorialLoader";

const THEME_BOOTSTRAP = `(function(){try{var saved=localStorage.getItem('nyrj.theme');var dark=saved==='dark'||(!saved&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark);document.documentElement.style.colorScheme=dark?'dark':'light';}catch(_){}})();`;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "National Youth Research Journal" },
      {
        name: "description",
        content:
          "Peer-reviewed scholarship by middle and high school researchers — every discipline, published on a rolling basis.",
      },
      { name: "author", content: "Madhav Arora" },
      { name: "founder", content: "Madhav Arora" },
      { name: "co-founder", content: "Keyaan" },
      {
        name: "keywords",
        content:
          "student research journal, youth research, peer-reviewed journal, high school research publication, middle school research, open access student journal, NYRJ, student science journal, undergraduate research, scholarly publishing for students, ISSN 3143-3030",
      },
      { property: "og:site_name", content: "National Youth Research Journal" },
      { property: "og:title", content: "National Youth Research Journal" },
      {
        property: "og:description",
        content:
          "Peer-reviewed scholarship by middle and high school researchers — every discipline, published on a rolling basis.",
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "en_US" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "National Youth Research Journal" },
      {
        name: "twitter:description",
        content:
          "Peer-reviewed scholarship by middle and high school researchers — every discipline, published on a rolling basis.",
      },
      { name: "theme-color", content: "#0f172a" },
      { name: "format-detection", content: "telephone=no" },
      { name: "google-site-verification", content: "9QYOpw7qVzg_ohyxifcqEd111qCjSFWRTmnGSnhOkPc" },
    ],
    links: [
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/favicon.png" },
      { rel: "shortcut icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://nyrj.org/#organization",
              name: "National Youth Research Journal",
              alternateName: "NYRJ",
              url: "https://nyrj.org",
              email: "NYRJINFO@gmail.com",
              description:
                "Open-access, peer-reviewed rolling-publication scholarly journal publishing original student research from middle school through medical school, across every academic discipline.",
              sameAs: ["https://nyrj.org"],
              address: {
                "@type": "PostalAddress",
                addressLocality: "Atlanta",
                addressRegion: "GA",
                addressCountry: "US",
              },
              foundingDate: "2025",
              founder: [
                {
                  "@type": "Person",
                  "@id": "https://nyrj.org/#founder-madhav-arora",
                  name: "Madhav Arora",
                  jobTitle: "Founder",
                  affiliation: { "@id": "https://nyrj.org/#organization" },
                },
                {
                  "@type": "Person",
                  "@id": "https://nyrj.org/#cofounder-keyaan",
                  name: "Keyaan",
                  jobTitle: "Co-Founder",
                  affiliation: { "@id": "https://nyrj.org/#organization" },
                },
              ],
              founders: [
                {
                  "@type": "Person",
                  name: "Madhav Arora",
                  jobTitle: "Founder",
                },
                {
                  "@type": "Person",
                  name: "Keyaan",
                  jobTitle: "Co-Founder",
                },
              ],
            },
            {
              "@type": "WebSite",
              "@id": "https://nyrj.org/#website",
              url: "https://nyrj.org",
              name: "National Youth Research Journal",
              publisher: { "@id": "https://nyrj.org/#organization" },
              inLanguage: "en-US",
              potentialAction: {
                "@type": "SearchAction",
                target: "https://nyrj.org/search?q={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            },
            {
              "@type": "Periodical",
              "@id": "https://nyrj.org/#periodical",
              name: "National Youth Research Journal",
              alternateName: "NYRJ",
              issn: "3143-3030",
              publisher: { "@id": "https://nyrj.org/#organization" },
              url: "https://nyrj.org",
              inLanguage: "en",
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    import("@/lib/auth").then((m) => m.bridgeSupabaseSession());
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <EditorialLoader />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <ChatbotPopup />
      <CookieConsent />
    </QueryClientProvider>
  );
}
