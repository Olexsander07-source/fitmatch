# FitGoIn design system

Shared tokens live in `fitgoin-premium.css`; public core strings live in `fitgoin-i18n.mjs`.

| Element | Rule |
| --- | --- |
| Canvas | #101c29 |
| Panels | #182736 / #20313f |
| Text | #f2f0e9; secondary #b3bfc5 |
| Accent | #b5cbbb; ink #14291e |
| Focus | #c3dce8, visible outline |
| Error | #f1aca7 with readable text |
| Typography | Inter with Avenir/Segoe UI/system fallbacks; body 400, headings 500 |
| Corners | 24 px panels; rounded pill primary actions |
| Forms | Visible labels, explicit validation, mobile inputs 16 px |
| Touch | Main mobile controls at least 44 px |
| Motion | Short page transitions; optional brand background; reduced motion respected |
| State | Visible loading, saving, error and empty states; no synthetic metrics |
| Navigation | Separate client/trainer actions; mobile AI drawer supports keyboard focus and Escape |
| Language | RU current release, shared RU/EN core catalog; complete translation is future work |

Reusable families: header, primary/secondary button, panel, form/fieldset, status, choice card, step indicator, trainer card, MATCH reasons, trainer preview, AI sidebar/history, message/actions, composer, consent and footer.

QA evidence and implementation limits: [release report](premium-redesign-release.md), `docs/qa/premium/results.json` and adjacent screenshots.
