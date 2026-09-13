# Founder Exact Employer and Institution Coverage Audit

Audit date: 2026-09-14

This audit used only persisted Scouter data. It scanned 2,068 `raw_master_rows`, 2,060 founders, 2,068 pre-backfill company roles, 29,763 founder-tag links, 12,191 tags, and 17,772 provenance records. No external provider or model was called.

## Evidence semantics

- Structured employer history: `founder_company_roles` joined to `companies`, with `is_current = false`.
- Canonical institution evidence: exact institution aliases in `founder_tags` joined to `tags`.
- Raw evidence: exact, context-qualified evidence in `raw_master_rows.raw_json`, limited to `Mini LinkedIn / Kariyer Geçmişi`, `Uzmanlık / Pattern Etiketleri`, `Neden Takıldı Etiketleri`, and `Neden takıldı`.
- Broad taxonomy flags were measured separately and were never accepted as exact evidence.
- `founder_profile` and `founder_product_profile` are derived read views. They were not mutation targets.
- `field_provenance` confirms that normalized founder fields and search text are derived from imported columns, but it had no row-level prior-employer or education entity records. Backfilled roles therefore preserve their exact `source_row_id`; institution links preserve raw row and field in `founder_tags.source`.

`tags_only` is zero for the audited entities because every exact entity tag was also recoverable from its persisted raw import row. `raw_only` identifies exact evidence that had no corresponding exact/composite tag before backfill.

## Employer coverage

| Employer   | Structured before | Tags only | Raw only | Exact persisted evidence | Broad flag only, no exact | Structured after |
| ---------- | ----------------: | --------: | -------: | -----------------------: | ------------------------: | ---------------: |
| OpenAI     |                 0 |         0 |        0 |                        9 |                        18 |                9 |
| Anthropic  |                 0 |         0 |        0 |                        3 |                        24 |                3 |
| DeepMind   |                 0 |         0 |        1 |                       14 |                        14 |               14 |
| Mistral AI |                 0 |         0 |        0 |                        1 |                        26 |                1 |
| Cohere     |                 0 |         0 |        0 |                        0 |                        27 |                0 |
| xAI        |                 0 |         0 |        0 |                        2 |                        25 |                2 |
| Stripe     |                 0 |         0 |        0 |                       12 |                         9 |               12 |
| Revolut    |                 0 |         0 |        1 |                        8 |                        14 |                8 |
| Wise       |                 0 |         0 |        0 |                        0 |                        21 |                0 |
| Brex       |                 0 |         0 |        0 |                        0 |                        21 |                0 |
| Nubank     |                 0 |         0 |        0 |                        2 |                        19 |                2 |
| Adyen      |                 0 |         0 |        0 |                        1 |                        20 |                1 |
| Google     |                 0 |         0 |        1 |                      100 |                       170 |              100 |
| Meta       |                 0 |         0 |        2 |                       71 |                       199 |               71 |
| Microsoft  |                 0 |         0 |        1 |                       34 |                       236 |               34 |
| Amazon     |                 0 |         0 |        1 |                       58 |                       212 |               58 |
| Apple      |                 0 |         0 |        0 |                       40 |                       229 |               40 |
| Netflix    |                 0 |         0 |        0 |                        3 |                       266 |                3 |
| Notion     |                 0 |         0 |        0 |                        3 |                         8 |                3 |
| Linear     |                 0 |         0 |        0 |                        0 |                        11 |                0 |
| Figma      |                 0 |         0 |        0 |                        0 |                        11 |                0 |
| HubSpot    |                 0 |         0 |        0 |                        3 |                         8 |                3 |
| Salesforce |                 0 |         0 |        0 |                        4 |                         7 |                4 |

## Institution coverage

Institutions have no dedicated structured education-history table. “Canonical before/after” therefore refers to exact searchable `founder_tags → tags` links. “Exact persisted evidence” is the union of canonical/composite tags and qualified raw evidence.

| Institution             | Canonical before | Tags only | Raw only | Exact persisted evidence | Broad flag only, no exact | Added | Canonical after |
| ----------------------- | ---------------: | --------: | -------: | -----------------------: | ------------------------: | ----: | --------------: |
| MIT                     |               32 |         0 |       24 |                       69 |                        76 |    37 |              69 |
| Stanford                |               39 |         0 |       20 |                       81 |                        71 |    42 |              81 |
| Harvard                 |               24 |         0 |       19 |                       52 |                        87 |    28 |              52 |
| Oxford                  |               13 |         0 |        2 |                       18 |                        98 |     5 |              18 |
| Cambridge               |               11 |         0 |        2 |                       13 |                       101 |     2 |              13 |
| ETH Zurich              |                7 |         0 |        1 |                       10 |                        14 |     3 |              10 |
| CMU                     |                9 |         0 |        2 |                       17 |                        12 |     8 |              17 |
| Imperial College London |                1 |         0 |        8 |                        9 |                        20 |     8 |               9 |
| Caltech                 |                4 |         0 |        1 |                        7 |                        17 |     3 |               7 |

## Backfill applied

- 402 exact prior-employer roles were inserted across all supported canonical employer aliases.
- 143 canonical institution-tag links were inserted.
- Employer roles use `relationship_type = employee`, `is_current = false`, `confidence = High`, exact `source_row_id`, and a source-field note.
- Institution links use the existing allowed `tag_type = pattern`, `confidence = High`, and a source string containing the raw row UUID and field name.
- Existing correct roles/tags were not updated or overwritten.
- Semantic alias duplicate checks prevent `Stanford` and `Stanford University`, for example, from being linked twice as separate evidence.
- A post-apply dry run reported zero proposed employer roles and zero proposed institution tags.

## Search validation

Top results below are ordered by Scouter Score within the exact eligible set. The production route applies its existing Search Match ranking afterward.

| Query                      | Results | Top five                                                                                 |
| -------------------------- | ------: | ---------------------------------------------------------------------------------------- |
| `ex OpenAI`                |       9 | Phil Chen; Brad Lightcap; Shyamal Hitesh Anadkat; Pamela Bhattacharya; Victor Sunderland |
| `ex DeepMind`              |      14 | Phil Chen; Pannag Sanketi; Arthur Bražinskas; Sami Abu-el-Haija; Shreyas NS Nair         |
| `Stripe alumni`            |      12 | Fausto Ibarra; Fernando Dal'Sotto; Andrew Oh; Alex MacCaw; Jennifer Zhou                 |
| `former Google founder`    |     100 | Nick Alonso; Arthur Bražinskas; Shreyas NS Nair; Will Biederman; Anurag Jain             |
| `MIT or Stanford founders` |     144 | Phil Chen; Nick Alonso; Shreyas NS Nair; Murat Can Işık; Herbert Huang                   |

The generic word “founder” is no longer emitted as an additional role gate in the normalized plan because every record in this corpus is already a founder. Specific roles such as CEO, CTO, or Co-Founder remain eligible constraints.

## Reproduction

```powershell
npm run audit:founder-exact
npm run backfill:founder-exact
npm run backfill:founder-exact -- --apply
npm run verify:founder-exact
```

No SQL migration is required for this data-only repair. The scripts use the existing schema and are idempotent.
