import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy: /articles/<slug> permanently redirects to /article/<slug>
export const Route = createFileRoute("/articles/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/article/$slug", params: { slug: params.slug }, replace: true });
  },
  component: () => null,
});
