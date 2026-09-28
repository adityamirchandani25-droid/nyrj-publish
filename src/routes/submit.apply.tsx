import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { submitManuscript } from "@/lib/manuscript-submissions.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/submit/apply")({
  head: () => ({
    meta: [
      { title: "Manuscript Submission Form — NYRJ" },
      {
        name: "description",
        content:
          "Complete the three-step NYRJ manuscript submission form: upload files, sign declarations, and enter author details.",
      },
      { property: "og:title", content: "NYRJ Manuscript Submission Form" },
      {
        property: "og:description",
        content:
          "Three-step submission: files, declarations, and author details — delivered straight to the NYRJ editorial office.",
      },
      { property: "og:url", content: "https://nyrj.org/submit/apply" },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [{ rel: "canonical", href: "https://nyrj.org/submit/apply" }],
  }),
  component: SubmitApply,
});

type Author = {
  name: string;
  email: string;
  institution: string;
  orcid: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  nation: string;
  institutionAddress: string;
};

const blankAuthor = (): Author => ({
  name: "",
  email: "",
  institution: "",
  orcid: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  nation: "",
  institutionAddress: "",
});

const RESEARCH_TYPES = [
  "Research Paper",
  "Perspective",
  "Review",
  "Theoretical Model",
  "Meta-analysis",
  "Other",
] as const;

function SubmitApply() {
  const navigate = useNavigate();
  const submitFn = useServerFn(submitManuscript);

  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Step 1 — files
  const [manuscriptFile, setManuscriptFile] = useState<File | null>(null);
  const [manuscriptKey, setManuscriptKey] = useState(0);
  const [altFormatFile, setAltFormatFile] = useState<File | null>(null);
  const [altFormatKey, setAltFormatKey] = useState(0);
  const [supplementaryFiles, setSupplementaryFiles] = useState<
    { file: File; description: string }[]
  >([]);
  const [supplementaryKey, setSupplementaryKey] = useState(0);
  const [consentFormFiles, setConsentFormFiles] = useState<File[]>([]);
  const [consentKey, setConsentKey] = useState(0);

  // Step 2 — declarations
  const [conflictOfInterest, setConflictOfInterest] = useState(false);
  const [conflictExplanation, setConflictExplanation] = useState("");
  const [funding, setFunding] = useState(false);
  const [fundingSource, setFundingSource] = useState("");
  const [usedGenAi, setUsedGenAi] = useState(false);
  const [genAiExplanation, setGenAiExplanation] = useState("");
  const [isOriginal, setIsOriginal] = useState(true);
  const [notUnderConsideration, setNotUnderConsideration] = useState(true);
  const [hasHumanOrVertebrate, setHasHumanOrVertebrate] = useState(false);
  const [dataAvailability, setDataAvailability] = useState<
    "openly_available_online" | "available_on_request" | "not_available"
  >("available_on_request");
  const [allAuthorsConsent, setAllAuthorsConsent] = useState(false);

  // Step 3 — manuscript info
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [researchType, setResearchType] =
    useState<(typeof RESEARCH_TYPES)[number]>("Research Paper");
  const [researchTypeOther, setResearchTypeOther] = useState("");
  const [keywords, setKeywords] = useState("");
  const [researchDomain, setResearchDomain] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [comments, setComments] = useState("");
  const [authors, setAuthors] = useState<Author[]>([blankAuthor()]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setAuthChecked(true);
    });
  }, []);

  const canNext = useMemo(() => {
    if (step === 1) {
      if (!manuscriptFile) return false;
      if (supplementaryFiles.some((f) => !f.description.trim())) return false;
      return true;
    }
    if (step === 2) {
      if (conflictOfInterest && !conflictExplanation.trim()) return false;
      if (funding && !fundingSource.trim()) return false;
      if (usedGenAi && !genAiExplanation.trim()) return false;
      if (!isOriginal) return false;
      if (!notUnderConsideration) return false;
      if (hasHumanOrVertebrate && consentFormFiles.length === 0) return false;
      if (!allAuthorsConsent) return false;
      return true;
    }
    if (step === 3) {
      if (title.trim().length < 3) return false;
      if (researchType === "Other" && !researchTypeOther.trim()) return false;
      if (!keywords.trim()) return false;
      if (!researchDomain.trim()) return false;
      if (!referralCode.trim()) return false;
      const authorFields: (keyof Author)[] = [
        "name",
        "email",
        "institution",
        "orcid",
        "phone",
        "address",
        "city",
        "state",
        "zip",
        "nation",
        "institutionAddress",
      ];
      for (const a of authors) {
        for (const k of authorFields) if (!a[k].trim()) return false;
        if (!isValidOrcid(a.orcid)) return false;
        if (!isValidPhone(a.phone)) return false;
      }
      return true;
    }
    return true;
  }, [
    step,
    manuscriptFile,
    supplementaryFiles,
    conflictOfInterest,
    conflictExplanation,
    funding,
    fundingSource,
    usedGenAi,
    genAiExplanation,
    isOriginal,
    notUnderConsideration,
    hasHumanOrVertebrate,
    consentFormFiles,
    allAuthorsConsent,
    title,
    researchType,
    researchTypeOther,
    keywords,
    researchDomain,
    referralCode,
    authors,
  ]);

  async function uploadFile(file: File, uid: string) {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
    const path = `${uid}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safe}`;
    const { error } = await supabase.storage.from("submissions").upload(path, file, {
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    return { path, filename: file.name };
  }

  async function handleSubmit() {
    setError(null);
    if (!userId) {
      setError("Please log in first.");
      return;
    }
    if (!manuscriptFile) {
      setError("Manuscript file is required.");
      return;
    }
    setSubmitting(true);
    try {
      const main = await uploadFile(manuscriptFile, userId);
      const supp: { path: string; filename: string; description: string }[] = [];
      if (altFormatFile) {
        const alt = await uploadFile(altFormatFile, userId);
        supp.push({ ...alt, description: "Alternate format of the manuscript (Word/PDF)" });
      }
      for (const f of supplementaryFiles) {
        const up = await uploadFile(f.file, userId);
        supp.push({ ...up, description: f.description.trim() });
      }
      const consent: { path: string; filename: string }[] = [];
      for (const f of consentFormFiles) {
        consent.push(await uploadFile(f, userId));
      }
      const res = await submitFn({
        data: {
          title: title.trim(),
          abstract: abstract.trim(),
          researchType,
          researchTypeOther: researchTypeOther.trim(),
          keywords: keywords.trim(),
          researchDomain: researchDomain.trim(),
          referralCode: referralCode.trim(),
          comments: comments.trim(),
          authors,
          conflictOfInterest,
          conflictExplanation: conflictExplanation.trim(),
          funding,
          fundingSource: fundingSource.trim(),
          usedGenAi,
          genAiExplanation: genAiExplanation.trim(),
          isOriginal,
          notUnderConsideration,
          hasHumanOrVertebrate,
          consentFormPaths: consent,
          dataAvailability,
          allAuthorsConsent: allAuthorsConsent as true,
          manuscriptPath: main.path,
          manuscriptFilename: main.filename,
          supplementaryPaths: supp,
        },
      });
      setDoneId(res.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!authChecked) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-3xl px-6 py-16">Loading…</section>
      </SiteLayout>
    );
  }

  if (!userId) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-3xl px-6 py-16">
          <h1 className="font-serif text-3xl text-primary">Log in to submit</h1>
          <p className="mt-3 text-muted-foreground">
            You need a student account so your submission appears in your tracker.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block px-5 py-3 bg-accent text-accent-foreground text-xs uppercase tracking-[0.2em]"
          >
            Log in / Create account
          </Link>
        </section>
      </SiteLayout>
    );
  }

  if (doneId) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-3xl px-6 py-16">
          <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Submitted</p>
          <h1 className="font-serif text-4xl text-primary mt-3">Thanks — we've got it.</h1>
          <p className="mt-4 text-muted-foreground">
            Your manuscript has been received. Reference ID:{" "}
            <span className="font-mono text-primary">{doneId.slice(0, 8)}</span>. You'll hear back
            within 5 days; first decision around 14 days.
          </p>
          <div className="mt-6 flex gap-3">
            <Button onClick={() => navigate({ to: "/track" })}>View tracker</Button>
            <Button variant="outline" onClick={() => navigate({ to: "/" })}>
              Home
            </Button>
          </div>
        </section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Submit Manuscript</p>
        <h1 className="font-serif text-4xl text-primary mt-2">Apply for Publication</h1>

        <div className="mt-6 flex gap-2 text-xs uppercase tracking-widest">
          {["Files", "Declarations", "Manuscript"].map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <div
                key={label}
                className={`flex-1 border px-3 py-2 ${
                  active
                    ? "border-accent bg-accent/10 text-primary"
                    : done
                      ? "border-primary/40 text-primary/70"
                      : "border-border text-muted-foreground"
                }`}
              >
                {n}. {label}
              </div>
            );
          })}
        </div>

        <div className="mt-8 space-y-6">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <Label>Manuscript file (Word or PDF) *</Label>
                <Input
                  key={manuscriptKey}
                  type="file"
                  accept=".doc,.docx,.pdf"
                  onChange={(e) => setManuscriptFile(e.target.files?.[0] ?? null)}
                />
                {manuscriptFile && (
                  <div className="flex items-center justify-between gap-3 mt-1">
                    <p className="text-xs text-muted-foreground truncate">{manuscriptFile.name}</p>
                    <button
                      type="button"
                      className="text-xs text-destructive"
                      onClick={() => {
                        setManuscriptFile(null);
                        setManuscriptKey((k) => k + 1);
                      }}
                    >
                      remove
                    </button>
                  </div>
                )}
              </div>
              <div>
                <Label>Second version in the other format (optional)</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  If you uploaded a Word file above, you can also add a PDF here — or the other way
                  around. Both versions stay attached to your submission.
                </p>
                <Input
                  key={altFormatKey}
                  type="file"
                  accept=".doc,.docx,.pdf"
                  className="mt-2"
                  onChange={(e) => setAltFormatFile(e.target.files?.[0] ?? null)}
                />
                {altFormatFile && (
                  <div className="flex items-center justify-between gap-3 mt-1">
                    <p className="text-xs text-muted-foreground truncate">{altFormatFile.name}</p>
                    <button
                      type="button"
                      className="text-xs text-destructive"
                      onClick={() => {
                        setAltFormatFile(null);
                        setAltFormatKey((k) => k + 1);
                      }}
                    >
                      remove
                    </button>
                  </div>
                )}
              </div>
              <div>
                <Label>Additional files (optional)</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Add any additional files. Every file must include a short description of what it
                  is.
                </p>
                <Input
                  key={supplementaryKey}
                  type="file"
                  multiple
                  onChange={(e) => {
                    setSupplementaryFiles((prev) => [
                      ...prev,
                      ...Array.from(e.target.files ?? []).map((file) => ({
                        file,
                        description: "",
                      })),
                    ]);
                    setSupplementaryKey((k) => k + 1);
                  }}
                />

                {supplementaryFiles.length > 0 && (
                  <ul className="mt-3 space-y-3">
                    {supplementaryFiles.map((f, i) => (
                      <li key={i} className="border border-border p-3 bg-card">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-primary truncate">{f.file.name}</p>
                          <button
                            type="button"
                            className="text-xs text-destructive"
                            onClick={() =>
                              setSupplementaryFiles((prev) => prev.filter((_, j) => j !== i))
                            }
                          >
                            remove
                          </button>
                        </div>
                        <Label className="text-xs mt-2 block">Description *</Label>
                        <Input
                          value={f.description}
                          placeholder="What is this file?"
                          onChange={(e) =>
                            setSupplementaryFiles((prev) =>
                              prev.map((x, j) =>
                                j === i ? { ...x, description: e.target.value } : x,
                              ),
                            )
                          }
                        />
                        {!f.description.trim() && (
                          <p className="text-xs text-destructive mt-1">
                            A description is required for every additional file.
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <DeclarationBlock
                label="Do any authors have a conflict of interest?"
                value={conflictOfInterest}
                onChange={setConflictOfInterest}
                detail={conflictExplanation}
                setDetail={setConflictExplanation}
                detailLabel="Please explain"
              />
              <DeclarationBlock
                label="Did you receive funding for this work?"
                value={funding}
                onChange={setFunding}
                detail={fundingSource}
                setDetail={setFundingSource}
                detailLabel="Funding source(s)"
              />
              <DeclarationBlock
                label="Did you use generative AI in preparing this manuscript?"
                value={usedGenAi}
                onChange={setUsedGenAi}
                detail={genAiExplanation}
                setDetail={setGenAiExplanation}
                detailLabel="Which parts and how"
              />

              <YesNoBlock
                label="I confirm this work is original and my/our own."
                value={isOriginal}
                onChange={setIsOriginal}
                requireYes
                errorMsg="You must confirm the work is original to submit."
              />

              <YesNoBlock
                label="This abstract has not been published and is not under consideration at another journal."
                value={notUnderConsideration}
                onChange={setNotUnderConsideration}
                requireYes
                errorMsg="Submissions must not be under consideration elsewhere."
              />

              <div className="border border-border p-4 bg-card space-y-3">
                <p className="text-sm">
                  Does this work include any live human subjects or vertebrate animals?
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={hasHumanOrVertebrate}
                      onCheckedChange={(c) => setHasHumanOrVertebrate(c === true)}
                    />
                    Yes
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={!hasHumanOrVertebrate}
                      onCheckedChange={(c) => setHasHumanOrVertebrate(c !== true)}
                    />
                    No
                  </label>
                </div>
                {hasHumanOrVertebrate && (
                  <div className="mt-2">
                    <Label className="text-xs">Upload consent form file(s) *</Label>
                    <Input
                      key={consentKey}
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                      onChange={(e) => {
                        setConsentFormFiles((prev) => [
                          ...prev,
                          ...Array.from(e.target.files ?? []),
                        ]);
                        setConsentKey((k) => k + 1);
                      }}
                    />
                    {consentFormFiles.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {consentFormFiles.map((f, i) => (
                          <li key={i} className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-muted-foreground truncate">{f.name}</span>
                            <button
                              type="button"
                              className="text-destructive"
                              onClick={() =>
                                setConsentFormFiles((prev) => prev.filter((_, j) => j !== i))
                              }
                            >
                              remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {consentFormFiles.length === 0 && (
                      <p className="text-xs text-destructive mt-1">
                        A consent form is required when human/vertebrate subjects are involved.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="border border-border p-4 bg-card space-y-3">
                <p className="text-sm">Data availability</p>
                {[
                  {
                    v: "openly_available_online",
                    l: "The data is openly available to the editors online.",
                  },
                  { v: "available_on_request", l: "The data is available to editors on request." },
                  { v: "not_available", l: "The data is not openly available." },
                ].map((opt) => (
                  <label key={opt.v} className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="data-availability"
                      className="mt-1"
                      checked={dataAvailability === opt.v}
                      onChange={() => setDataAvailability(opt.v as typeof dataAvailability)}
                    />
                    <span>{opt.l}</span>
                  </label>
                ))}
              </div>

              <div className="border border-border p-4 bg-card">
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={allAuthorsConsent}
                    onCheckedChange={(c) => setAllAuthorsConsent(c === true)}
                  />
                  <span>
                    All authors are aware of and consent to the submission of this article. *
                  </span>
                </label>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <Label>Title *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={500} />
              </div>
              <div>
                <Label>Abstract</Label>
                <Textarea
                  value={abstract}
                  onChange={(e) => setAbstract(e.target.value)}
                  rows={6}
                  maxLength={8000}
                />
              </div>
              <div>
                <Label>Research type</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={researchType}
                  onChange={(e) =>
                    setResearchType(e.target.value as (typeof RESEARCH_TYPES)[number])
                  }
                >
                  {RESEARCH_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                {researchType === "Other" && (
                  <div className="mt-2">
                    <Label className="text-xs">Please specify *</Label>
                    <Input
                      value={researchTypeOther}
                      onChange={(e) => setResearchTypeOther(e.target.value)}
                      maxLength={200}
                    />
                  </div>
                )}
              </div>

              <div>
                <Label>Research domain / field *</Label>
                <Input
                  value={researchDomain}
                  onChange={(e) => setResearchDomain(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Neuroscience, Environmental Science, Economics"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Helps us match your paper with the right peer reviewer.
                </p>
              </div>

              <div>
                <Label>Keywords *</Label>
                <Input
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  maxLength={300}
                  placeholder="e.g. microplastics, photocatalysis, water quality"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Separate keywords with commas (3–6 recommended).
                </p>
              </div>

              <div>
                <Label>Referral code *</Label>
                <Input
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  maxLength={60}
                  placeholder="e.g. NYRJ-CHAPTER-01"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Enter the code from the chapter, ambassador, or teacher who referred you. If you
                  were not referred, type NONE.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Authors</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAuthors([...authors, blankAuthor()])}
                  >
                    + Add author
                  </Button>
                </div>
                <div className="space-y-4">
                  {authors.map((a, idx) => (
                    <div key={idx} className="border border-border p-4 space-y-3 bg-card">
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">
                          Author {idx + 1}
                          {idx === 0 ? " (corresponding)" : ""}
                        </p>
                        {authors.length > 1 && (
                          <button
                            type="button"
                            className="text-xs text-destructive"
                            onClick={() => setAuthors(authors.filter((_, i) => i !== idx))}
                          >
                            remove
                          </button>
                        )}
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <AuthorField
                          label="Name *"
                          value={a.name}
                          onChange={(v) => updateAuthor(idx, "name", v)}
                        />
                        <AuthorField
                          label="Email *"
                          value={a.email}
                          onChange={(v) => updateAuthor(idx, "email", v)}
                        />
                        <AuthorField
                          label="Institution *"
                          value={a.institution}
                          onChange={(v) => updateAuthor(idx, "institution", v)}
                        />
                        <div>
                          <AuthorField
                            label="ORCID *"
                            value={a.orcid}
                            onChange={(v) => updateAuthor(idx, "orcid", v)}
                          />
                          <p
                            className={`mt-1 text-[11px] ${a.orcid.trim() && !isValidOrcid(a.orcid) ? "text-destructive" : "text-muted-foreground"}`}
                          >
                            Required for every author — format 0000-0002-1825-0097.{" "}
                            <a
                              href="https://orcid.org/register"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline underline-offset-2"
                            >
                              Get a free ORCID
                            </a>
                          </p>
                        </div>

                        <div>
                          <AuthorField
                            label="Phone (with country code) *"
                            value={a.phone}
                            onChange={(v) => updateAuthor(idx, "phone", v)}
                          />
                          <p
                            className={`mt-1 text-[11px] ${a.phone.trim() && !isValidPhone(a.phone) ? "text-destructive" : "text-muted-foreground"}`}
                          >
                            Start with your country code — e.g. +1 404 555 0199.
                          </p>
                        </div>

                        <AuthorField
                          label="Address *"
                          value={a.address}
                          onChange={(v) => updateAuthor(idx, "address", v)}
                        />
                        <AuthorField
                          label="City *"
                          value={a.city}
                          onChange={(v) => updateAuthor(idx, "city", v)}
                        />
                        <AuthorField
                          label="State / Region *"
                          value={a.state}
                          onChange={(v) => updateAuthor(idx, "state", v)}
                        />
                        <AuthorField
                          label="ZIP / Postal *"
                          value={a.zip}
                          onChange={(v) => updateAuthor(idx, "zip", v)}
                        />
                        <AuthorField
                          label="Nation *"
                          value={a.nation}
                          onChange={(v) => updateAuthor(idx, "nation", v)}
                        />
                        <AuthorField
                          label="Institution address *"
                          value={a.institutionAddress}
                          onChange={(v) => updateAuthor(idx, "institutionAddress", v)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Comments to the editors</Label>
                <Textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={4}
                  maxLength={4000}
                />
              </div>
            </div>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        <div className="mt-8 flex justify-between">
          <Button
            variant="outline"
            disabled={step === 1 || submitting}
            onClick={() => setStep(step - 1)}
          >
            Back
          </Button>
          {step < 3 ? (
            <Button disabled={!canNext} onClick={() => setStep(step + 1)}>
              Continue →
            </Button>
          ) : (
            <Button disabled={!canNext || submitting} onClick={handleSubmit}>
              {submitting ? "Submitting…" : "Submit Manuscript"}
            </Button>
          )}
        </div>
      </section>
    </SiteLayout>
  );

  function updateAuthor<K extends keyof Author>(idx: number, key: K, value: Author[K]) {
    setAuthors((prev) => prev.map((a, i) => (i === idx ? { ...a, [key]: value } : a)));
  }
}

function DeclarationBlock({
  label,
  value,
  onChange,
  detail,
  setDetail,
  detailLabel,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  detail: string;
  setDetail: (v: string) => void;
  detailLabel: string;
}) {
  return (
    <div className="border border-border p-4 bg-card">
      <p className="text-sm">{label}</p>
      <div className="mt-2 flex items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <Checkbox checked={value} onCheckedChange={(c) => onChange(c === true)} />
          Yes
        </label>
        <label className="flex items-center gap-2">
          <Checkbox checked={!value} onCheckedChange={(c) => onChange(c !== true)} />
          No
        </label>
      </div>
      {value && (
        <div className="mt-3">
          <Label className="text-xs">{detailLabel}</Label>
          <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} />
        </div>
      )}
    </div>
  );
}

function AuthorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function YesNoBlock({
  label,
  value,
  onChange,
  requireYes,
  errorMsg,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  requireYes?: boolean;
  errorMsg?: string;
}) {
  return (
    <div className="border border-border p-4 bg-card">
      <p className="text-sm">{label}</p>
      <div className="mt-2 flex items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <Checkbox checked={value} onCheckedChange={(c) => onChange(c === true)} />
          Yes
        </label>
        <label className="flex items-center gap-2">
          <Checkbox checked={!value} onCheckedChange={(c) => onChange(c !== true)} />
          No
        </label>
      </div>
      {requireYes && !value && errorMsg && (
        <p className="text-xs text-destructive mt-2">{errorMsg}</p>
      )}
    </div>
  );
}

function isValidOrcid(v: string): boolean {
  return /^(https?:\/\/orcid\.org\/)?\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(v.trim());
}

function isValidPhone(v: string): boolean {
  return /^\+\d{1,4}[\d\s().-]{5,20}$/.test(v.trim());
}
