
This is a large multi-feature request. Here is the proposed implementation broken into phases. Please review and confirm (or adjust) before I build — once approved I'll execute it all.

## 1. Navigation overhaul

- Top-nav collapses to: **Home · About · Collection · Advisors · For Authors**
- **About** becomes a dropdown: Mission · Editorial Team · Board Members · Contact
- **For Authors** dropdown keeps existing subsections (Guidelines, Submit, Guidance, etc.)
- **Contact** moves to footer only
- Top-right additions: a central **search bar** + a **"Submit Manuscript"** button icon
- Footer: ISSN 3143-3030 line + "NYRJ is fiscally sponsored under a 501(c)(3)" note
- Top banner under hero clearly states: **Open Access** + tagline/motto alongside the NYRJ name

## 2. In-app submission system (replace Google Form)

New route `/submit/apply` (multi-step form), saved to a new `manuscript_submissions` table + emailed to NYRJINFO@gmail.com. Sections:

1. **File Upload** — Manuscript file, Supplementary files
2. **Declarations** — Conflict of interest (Y/N + explain), Funding (Y/N + who), Gen-AI use (Y/N + what parts)
3. **Manuscript Info** — Authors (add-author button; per author: name, institution, ORCID, address, email, zip, nation, state, city, institution address), Title, Abstract, Research type (Research Paper / Perspective / Review / Theoretical Model / Meta-analysis / Other), Comments

Email delivery: I'll use Lovable's built-in email infrastructure (requires you to set up a sender domain — I'll trigger the setup dialog when we get there). Files stored in a new private `submissions` bucket.

## 3. Article pages & citations

- URL format becomes `/articles/<slug>` (currently `/article/<slug>`) — old route kept as redirect
- Add **NYRJ ID**: format `SP-#####` (5-digit), auto-assigned, displayed prominently
- Add **DOI** and **ORCID(s)** fields, editable in staff library view
- Public article view gets a **"Copy Citation"** button (APA-style journal reference)
- New `citation_count` column; increments each time citation is copied (RPC call)
- Google Scholar tags already present — I'll add `citation_doi` and verify all required tags

## 4. Library editor enhancements

- Edit modal already exists; extend it with: DOI, ORCID list, NYRJ ID (read-only), **Featured** checkbox

## 5. Home page — Featured Papers

- New "Featured Papers" section below the hero showing entries flagged `featured = true`
- Staff toggles via checkbox in the library editor

## 6. FAQ section on /authors (or new /authors/faq)

Real Q&A including a **Journal Metrics** block:
- Days to first response: **5 days**
- Days to first decision: **~14 days**
- Days to publication: **~30 days**
- Plus: Who can submit? Cost? Open access? Copyright? Plagiarism policy? Format requirements? Etc.

## 7. Site search (top-right)

Lightweight client-side keyword index of all routes + article titles → navigates to the best match. Opens a dropdown with top results.

## 8. AI chatbot (bottom-right)

Floating widget using Lovable AI Gateway (`google/gemini-2.5-flash`). System prompt scoped to NYRJ navigation/FAQ help. New `/api/chat` server route with streaming.

## 9. About → Mission + NYRJ Team

- Mission dropdown/subpage with a polished humanized mission statement
- **NYRJ Team** section pulling from a new `team_members` table (name, role, photo)
- Staff login gains a "Manage Team" panel (add/edit/delete with photo upload to `team-photos` bucket)
- Founders (Madhav, Keyaan) move out of the About page body into the Team table as seed rows

## 10. SEO

- Sitemap already exists — I'll update it to use `/articles/<slug>` and include all entries
- Confirm robots.txt allows Google Scholar (it already does: `User-agent: * / Allow: /`)

---

### Technical summary (for reference)

**DB migrations:**
- `library_entries`: add `doi text`, `nyrj_id text unique`, `featured bool default false`, `citation_count int default 0`; ORCID column exists
- new `manuscript_submissions` (all form fields + file paths + status)
- new `team_members` (name, role, photo_path, sort_order)
- new `citations` increment RPC
- new private buckets: `submissions`, `team-photos`
- trigger to auto-assign `SP-#####` on insert

**Server functions:** submission create + list + delete, team CRUD, citation increment, search index endpoint

**Email:** Lovable Emails (will prompt for domain setup)

**AI chat:** `/api/chat` streaming route + floating chat widget

---

### Scope question

This is roughly 25+ files of new/changed code and 3 DB migrations. **Two options:**

- **A) Build it all in one go** (long single response, ~10–15 min of tool calls)
- **B) Phase it** — I'll do navigation + article URL + citation + featured papers + library editor fields first, then submission system + email, then AI chatbot + search + team management as separate turns

Reply with **A** or **B** (or edit the plan) and I'll start.
