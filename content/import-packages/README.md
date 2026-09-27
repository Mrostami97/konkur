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
