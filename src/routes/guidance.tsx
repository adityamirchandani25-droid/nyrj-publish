import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteLayout } from "@/components/SiteLayout";
import { getSession, isStaff, onAuthChange, staffToken, type Session } from "@/lib/auth";
import {
  guidanceVideosList,
  guidanceVideoCreate,
  guidanceVideoDelete,
  type GuidanceVideo,
} from "@/lib/guidance.functions";

export const Route = createFileRoute("/guidance")({
  head: () => ({
    meta: [
      { title: "Guidance — NYRJ" },
      {
        name: "description",
        content: "Get guidance and mentorship from the National Youth Research Journal advisors.",
      },
      {
        name: "keywords",
        content:
          "student research help, research mentorship for students, how to write a research paper, student research guidance, research advisors for students",
      },
    ],
  }),
  component: Guidance,
});

function embedSrc(v: GuidanceVideo): string {
  if (v.provider === "youtube") return `https://www.youtube.com/embed/${v.embed_id}`;
  return `https://player.vimeo.com/video/${v.embed_id}`;
}

function VideoMontage({
  videos,
  staff,
  onDelete,
}: {
  videos: GuidanceVideo[];
  staff: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="mt-6 flex flex-col gap-4">
      {videos.map((v) => (
        <div
          key={v.id}
          className="relative aspect-video w-full bg-muted border border-border overflow-hidden"
        >
          <iframe
            src={embedSrc(v)}
            title={v.title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="w-full h-full"
          />
          {staff && (
            <button
              type="button"
              onClick={() => onDelete(v.id)}
              className="absolute top-2 right-2 rounded-full bg-background/90 border border-border px-3 py-1 text-[10px] uppercase tracking-wider hover:bg-destructive hover:text-destructive-foreground transition"
            >
              Remove
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function StaffAddVideoForm({ onAdded }: { onAdded: () => void }) {
  const createFn = useServerFn(guidanceVideoCreate);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (input: { title: string; url: string }) => {
      const token = staffToken();
      if (!token) throw new Error("Staff session expired. Please sign in again.");
      return createFn({ data: { staffToken: token, title: input.title, url: input.url } });
    },
    onSuccess: () => {
      setTitle("");
      setUrl("");
      setError(null);
      onAdded();
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Failed to add video."),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim() || !url.trim()) return;
        mutation.mutate({ title: title.trim(), url: url.trim() });
      }}
      className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto] text-left"
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Video title"
        className="border border-border bg-background px-3 py-2 text-sm"
        required
      />
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="YouTube or Vimeo link"
        className="border border-border bg-background px-3 py-2 text-sm"
        required
      />
      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-full border border-border bg-primary text-primary-foreground px-6 py-2 text-xs uppercase tracking-wider disabled:opacity-60 hover:opacity-90 transition"
      >
        {mutation.isPending ? "Adding…" : "Add video"}
      </button>
      {error && <p className="sm:col-span-3 text-xs text-destructive text-left">{error}</p>}
    </form>
  );
}

function Guidance() {
  const [session, setSession] = useState<Session | null>(() => getSession());
  useEffect(() => onAuthChange(setSession), []);
  const staff = isStaff(session);

  const qc = useQueryClient();
  const listFn = useServerFn(guidanceVideosList);
  const deleteFn = useServerFn(guidanceVideoDelete);
  const { data: videos = [] } = useQuery({
    queryKey: ["guidance-videos"],
    queryFn: () => listFn(),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = staffToken();
      if (!token) throw new Error("Staff session expired.");
      return deleteFn({ data: { staffToken: token, id } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guidance-videos"] }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["guidance-videos"] });

  return (
    <SiteLayout>
      <section className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">
          GUIDANCE AND MENTORSHIP
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl text-primary mt-3 leading-tight">
          GUIDANCE&nbsp;
        </h1>
        <p className="mt-4 text-muted-foreground max-w-2xl">
          Need help with your research, manuscript, or submission? Our team is here for you. Reach
          out to the information team at NYRJINFO@Gmail.com. Whether it's help with formatting,
          author revisions, or even starting a project, we have you covered!
        </p>

        <div className="mt-10 border border-border bg-card p-6 sm:p-10 text-center">
          <p className="text-[10px] uppercase tracking-[0.25em] text-accent">Contact an Advisor</p>
          <p className="mt-3 text-sm text-foreground/85 max-w-lg mx-auto">
            Our advisors are here to help assist you. Any questions, concerns or comments you would
            like to ask our advisors can be answered by contacting our support team. They can then
            share the advisors contact details for you to communicate with them. *Before calling
            view our advisory board to determine the advisor whom will best be able to assist you.
          </p>
          <div className="mt-6">
            <Link
              to="/advisors"
              className="inline-block rounded-full border border-border bg-background px-6 py-2 text-xs uppercase tracking-wider hover:bg-primary hover:text-primary-foreground transition"
            >
              View Advisors
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-16">
        <div className="border border-border bg-card p-6 sm:p-10">
          <p className="text-[10px] uppercase tracking-[0.25em] text-accent">
            VIDEO GUIDE AND ASSISTANCE
          </p>
          <h3 className="font-serif text-2xl text-primary mt-2">Check Out our Videos!</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            A detailed walkthrough of the research and submission process can be viewed here. Email
            support for video suggestions!
          </p>

          {videos.length === 0 ? (
            <div className="mt-6 aspect-video bg-muted border border-border flex items-center justify-center">
              <span className="text-muted-foreground text-sm">
                {staff ? "No videos yet — add the first one below." : "Videos coming soon."}
              </span>
            </div>
          ) : (
            <VideoMontage
              videos={videos}
              staff={staff}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          )}

          {staff && <StaffAddVideoForm onAdded={refresh} />}
          {deleteMutation.isError && (
            <p className="mt-3 text-xs text-destructive">
              {deleteMutation.error instanceof Error
                ? deleteMutation.error.message
                : "Delete failed."}
            </p>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}
