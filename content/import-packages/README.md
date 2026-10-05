# Article import packages

Editorial articles written outside the site runtime, kept here so they survive a
host move. Nothing in this folder reaches the site on its own: the deploy does
not read it, and the API seed does not load it. An article goes live only after
an operator uploads its zip at `/admin/import`, reviews it and publishes it
(CLAUDE.md: external writing produces import/review artifacts only).

- `articles/<slug>.mjs` is the source of one `article.v2` item.
- `packages/<slug>/` holds the built `payload.json`, a readable `preview.md`,
  and `<slug>.zip`, the file to upload.
- `build.mjs <slug...>` validates each article against `contracts` and rebuilds
  its package. It refuses a package whose `content_type` or `slug` differs from
  the seeded draft with the same `external_id`, because that would move a live
  public URL. Build `contracts` first. The zip is made separately, for example
  `Compress-Archive -Path payload.json -DestinationPath <slug>.zip -Force`.
- `fix-source-titles.md` and `author-profile-mohammad-rostami.md` are admin
  edits still to be made by hand (source titles, new sources, author profile).

Before publishing `registration-calendar-1406`, check its dates again against
the official announcement (t.me/msrt_iri/43538); they were last checked on
2026-09-08.

Some lessons link to each other. Publish `regular-languages-dfa-nfa`,
`pumping-lemma`, `context-free-grammars-pda` and
`turing-machines-decidability` together, or in that order, so no public page
links to an unpublished one.

`union-find-linear-sorting` links to `amortized-analysis`, and
`np-complete-reductions` links to `turing-machines-decidability`; publish each
after (or with) the lesson it links to.

`deadlock-bankers-algorithm` links to `cpu-scheduling`, and
`process-synchronization` links to both; publish the three operating-systems
lessons together or in that order.

## Many packages in one upload

`/admin/import` accepts a `payload.json` holding an array of items, so several
packages can go up as one zip:

```
node bundle.mjs <out.zip> <slug> <slug> ...
```

It refuses to bundle two items with the same `external_id` or URL, or items
with different schema versions. On the job page, use the checkbox in the
table header to select every valid item. Then approve them and press
«انتشار تأییدشده‌ها»; all of them publish together, so links between them
never point at an unpublished page.

## Articles edited on the live site

The owner edits some articles in the admin panel. Before rebuilding a bundle, pull
those edits back so a re-import never reverts them:

```
node sync-live.mjs <slug> <slug> ...
```

It writes `live-overrides/<slug>.json` (published text, SEO, taxonomy and sources);
`build.mjs` lays it over `articles/<slug>.mjs` and skips the `seo-upgrades.mjs`
overlay for that slug. If a live source cannot be matched to a ContentSource
external id (sources added only in the admin panel), the override is marked
`importable: false` and `bundle.mjs` leaves the article out of every zip; add any
new links to such an article by hand in the admin panel.
