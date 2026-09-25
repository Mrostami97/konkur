# کنکورصفریک — UI redesign (local review build)

Status: approved by the owner on 2026-09-25.

## 1. Audit of the current UI (baseline)

Keep exactly
- The homepage hero: dark ink ground, real rank cards, the evidence-first claim. It is the brand's strongest idea — results with sources.
- Evidence storytelling (scorecard figure, "question I designed / question in the konkur"), `/evidence`.
- Reading layouts (`rd-*`): answer-first block, sticky table of contents, sources box.
- The mega-menu information architecture and the data-driven "coming soon" marks.
- Exam engine behaviour: autosave with per-question save state, flags, question palette, confirm-before-submit.

Polish lightly
- Header (keep structure; unify the accent, drop the blue login button).
- Subject pages, articles, guides (colour and radius alignment only).
- Admin shell and tables (already functional; typography and density).

Improve substantially
- Question bank: a card grid of three items with English slugs as metadata. Studying needs a dense, scannable list with filters that stay visible.
- Exam mode: shows the marketing header, footer and phone tab bar during a timed exam.
- Exam report: a linear dump; shows an internal scoring-version code; no way to review only mistakes.
- Rank estimate: free-text inputs for field, quota and subject that expect raw slugs (`computer-engineering`, `region-1`).
- Course detail: two equal cards and an empty dashed box; no sense of a learning path.
- Login: generic floating card, emoji greeting, Latin phone placeholder.
- Page heroes on app pages (`pg-hero`): a large empty band above every list.

Replace
- The footer's teal→violet gradient banner and the multi-colour gradient stat tiles (teal / violet / blue / orange). They read as template output and fight the single-accent brand.
- The row of six identical icon + title + sentence cards under the home hero.

Systemic defects
- One font file, one weight: every bold heading is synthesised fake-bold.
- Brand teal `#0ab39b` behind white text is 2.65:1 — fails WCAG AA on every primary button.
- Four parallel empty-state components (`EmptyState`, `DsEmptyState`, `ComingSoon`, `lp-empty`).
- ~160 gradients and ~70 corner radii of 20px+ across nine stylesheets.

## 2. Directions explored

Grounded in 21st.dev categories (timelines, data-grid tables, collapsible-sidebar dashboards, steppers) and in how real study tools work — not in the dark "stat bento" blocks that dominate the catalogue.

A. Study Desk — dense workbench
- Idea: the product is a tool you work in for hours. Lists and tables over cards, persistent filters, keyboard shortcuts, split panes.
- Density high; navigation side rail; typography does the hierarchy; almost no containers.
- Best for: question bank, exam, admin. Risk: cold for marketing and first-time visitors.

B. Editorial Academy — calm, typographic
- Idea: trust comes from reading like a serious academic publisher. Large type, rules instead of boxes, timeline rails for progression, generous but purposeful whitespace.
- Density low–medium; top navigation; content-first.
- Best for: subjects, articles, guides, course pages. Risk: too slow for daily study tasks.

C. Coach Cockpit — guided, action-first
- Idea: the student opens the app and is told what to do next. A "next action" strip, today's plan as a timeline, progress against the exam date, recommendations in context.
- Density medium; tabbed sections; more colour for state.
- Best for: dashboard, plan, results. Risk: gamified clutter if every metric gets a tile.

Current UI (baseline)
- Strong marketing and evidence story, weak product surfaces (generic `pg-hero` + card grid on every list page).

## 3. Synthesis — one system, different compositions

| Area | Composition | From |
|---|---|---|
| Home, results, evidence | Keep the dark ink hero and evidence story; replace gradient tiles with typographic figures and rules | Baseline + B |
| Subjects, articles, guides | Keep `rd-*`; align colour/radius | Baseline + B |
| Question bank | Filter rail + dense row list; question view as a focused two-column study page | A |
| Exam mode | Full-screen, no site chrome; sticky timer bar; numbered options with keyboard 1–4; palette side panel; drawer on phones | A |
| Exam report | Score header with konkur-method percent; filter tabs (all / wrong / blank / correct); per-question review with solution | A + C |
| Dashboard | Next action first, today's plan as a timeline rail, then progress; no decorative KPIs | C + B |
| Courses | Course list as editorial rows; course page as a module/lesson timeline with progress | B |
| Rank estimate | Real selects with Persian labels; result as a range bar, not a single number | A |
| Login | Split: product context on the ink panel, form on paper | B |

Consistency comes from the tokens below, not from every page sharing one template.

## 4. Design system

Typography
- Vazirmatn variable (OFL, self-hosted `public/fonts/Vazirmatn-Variable.woff2`) — real weights 400–900, no fake bold. Google Fonts is avoided because it is unreliable from Iran.
- Scale (px): 12 · 13 · 14 · 15 (base UI) · 17 (reading) · 20 · 24 · 30 · 38 · 48. Persian needs more leading than Latin: body 1.85, UI 1.6, headings 1.25–1.4.
- Weights: 400 text, 500 UI labels, 700 headings, 800 display figures.
- Numbers: Persian digits in UI; `tabular-nums` where figures align (timers, scores, tables).
- Latin/code: `ui-monospace, "Cascadia Mono", Consolas` inside `dir="ltr"` islands; KaTeX for maths.

Colour (one accent, semantic states, warm-neutral paper)
- Ink 900 `#0c1b2e` (text, dark surfaces) · 700 `#33475e` · 500 `#5b6b7f` (secondary text, 5.4:1) · 400 `#8593a3` (disabled/meta on dark).
- Paper `#f6f7f5` (app ground) · Surface `#ffffff` · Sunken `#f0f2f0`.
- Lines: hairline `#eceeec` · line `#e1e5e3` · strong `#cbd2d0`.
- Accent teal: 700 `#0b7a6a` (buttons, links — 5.24:1 with white) · 800 `#0a6457` (hover) · 50 `#e8f3f0` (tint) · 400 `#19c2a6` (on ink only, 7.8:1).
- Attention amber `#b45309` on `#fdf3e3`; success `#12805c`; danger `#c0392b`; info `#2f5f9e`.
- No violet or blue gradients. Gradients are allowed only on the ink hero surface and must stay within the teal/ink family.

Shape and depth
- Radii: 6 (chips, small controls) · 10 (buttons, inputs) · 14 (panels) · 20 (feature blocks only) · pill (tags).
- Borders do structure; shadows are for things that float: elev-1 raised controls, elev-3 menus/popovers, elev-4 dialogs.
- Border hierarchy: hairline for internal dividers, line for component edges, strong for inputs.

States
- Focus: 2px accent outline + 2px offset on every interactive element (`:focus-visible`).
- Hover: tint, never movement. Disabled: 50% opacity + `not-allowed`. Selected: accent border + tint.
- Motion: 120/180/260 ms, ease-out; transforms only for overlays; `prefers-reduced-motion` removes it.

Layout
- Breakpoints: 640 (phone), 900 (tablet), 1100 (laptop — nav switches to drawer), 1440 (wide).
- Containers: 1200px app, 1120px marketing, 720px reading measure.
- Phone: bottom tab bar for the site; exam uses its own bottom bar with the palette in a sheet.

## 5. What was built (local review build)

- Foundations: Vazirmatn variable font; the token set above in `globals.css`, with legacy variable names remapped so every page moves with it; 347 dead CSS rules removed; all hard-coded colours in the shared stylesheets replaced by tokens; radii normalised.
- Chrome: header and mega menu on the one accent; flat ink footer; phone tab bar with an active state.
- Homepage: after two rounds of owner feedback, a quiet page: centred message and search, the path in three steps, three practical reads (published articles first), three figures of proof.
- Question bank: filter rail + dense list with Persian subject and field names; a question opens as a study page (answer, then check, then solution).
- Exam sitting: no site chrome, sticky timer and progress bar, 5-minute and 1-minute warnings (also announced to screen readers), clear-answer, keyboard shortcuts that work on a Persian layout, palette as a bottom sheet on phones.
- Exam report: konkur-method percent (same formula as the API) as the headline, composition bar, standing panel, filter tabs and a status strip for review; the internal scoring-version code is no longer shown.
- Courses: catalogue as a list; course page as a numbered chapter rail with a sticky access column; lesson page as a reading view with previous/next lessons.
- Rank estimate: real selects (field, quota, subject) instead of typed codes; result drawn as a range.
- Login: form-first card; Persian digits accepted in the phone number; the API's English validation message shown in Persian.
- Student panel, reading pages, landing pages, evidence and admin shell: moved onto the tokens, gradients and hover lifts removed.
- ContentBlocks (questions, options, solutions, lessons): inline styles replaced by classes; a missing image no longer shows its internal key to students; a formula that is itself an answer option sits beside its number instead of centred.
- Lesson images: lessons carry their own images (`lessons.assets`, additive migration with a guarded down). Authors upload PNG/JPEG/WebP from the course editor (type checked by the file's bytes, 5 MB cap), describe each image, and can now edit a saved lesson. An image is served to whoever may read its lesson: guests only for a preview lesson or a public course.
- Student panel: exam history uses the konkur percent everywhere, so it matches each row and the report; select arrows drawn as a chevron; phone numbers in Persian digits.

## 6. Not done / remaining debt

- Dark mode (the product has none today; tokens are structured so it can be added).
- Tailwind/shadcn component source: the project uses a CSS-token system; shadcn composition rules were followed instead of importing Tailwind under 5,000 lines of existing CSS.
- Logged-in screens were reviewed in the browser with a local test account and a five-question exam built through the real Stage -> Review -> Publish path: onboarding, dashboard, exam sitting (keyboard, flag, confirm), report, every student-panel page and the main admin pages.
- Admin tables still show raw codes and Latin digits (subject and field slugs, years, the revenue chart axis); the admin panel also still lacks delete and user/role management.
- Lessons can be edited but not deleted or reordered from the panel.
- The phone-number account key is stored exactly as typed (09... and +989... are different accounts); worth normalising server-side in a separate, reviewed change.
