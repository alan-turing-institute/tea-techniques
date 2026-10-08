# Technique quality standard

This page defines what a complete, good technique record is. It is version 1, a
draft from October 2026. Every record in `public/data/techniques.json` must meet
it, and the quality report measures against it. Two other documents sit beside
it. `CONTRIBUTING-TECHNIQUES.md` explains how to write a record field by field,
and the [evaluation criteria](/about/technique-evaluation) page explains whether
a technique belongs in the library at all. Where this page and the contributor
guide disagree, this page wins and the guide needs updating.

## 1. One technique, one record

A record describes one method a practitioner can apply to produce evidence for
an assurance claim. It is not a category header, a family of methods, or a
research area. If a record would need the phrase "techniques such as" to
describe what it covers, it is an umbrella and should be split or retired. The
six evaluation criteria (relevance to an assurance goal, the evidence it
produces, applicability, maturity, practicality, interpretability of its output)
decide whether the method belongs.

The test is whether the description can say how to run the technique without
naming other techniques as the way to do it.

Records that pass:

- **Permutation Importance.** Shuffle one feature, measure the drop in
  performance, repeat per feature. One procedure, one output.
- **Conformal Prediction.** A defined procedure that turns any model's scores
  into prediction sets with a stated coverage guarantee.
- **Model Cards.** Not an algorithm, but a named documentation practice with a
  defined template and a single original paper.
- **Red Teaming.** Broad in what it probes, but a named practice with its own
  procedure and literature. The record describes how to run an exercise, not a
  list of attacks.

Records that failed the test (all retired in February 2026):

- **Prediction Intervals.** An output type, not a method. The methods that
  produce one (conformal prediction, quantile regression, bootstrapping,
  jackknife resampling) were already separate records. It became a tag.
- **Intrinsically Interpretable Models.** A model class. Its description listed
  decision trees, linear models and generalised additive models, each of which
  is its own record. It became a tag.
- **Anomaly Detection.** "Statistical, machine learning or rule-based methods":
  a family. Its members (out-of-distribution detection, data-poisoning
  detection, runtime monitoring) are separate records.
- **Synthetic Data Generation.** Named GANs, VAEs and statistical sampling as
  ways to do it. It was split into GAN-based tabular synthetic data,
  simulation-based synthetic data, and statistical oversampling methods.

## 2. Description

- Accurate. It describes the mechanism correctly, gets the scope right, and
  claims nothing the technique does not do.
- Three to five sentences. One or two give an overview. The rest explain the
  mechanism and what it produces.
- Written for a reader with general AI assurance literacy and no specialist
  background (e.g. statistics, behavioural science). It explains any term beyond
  that the first time it uses it.
- British English.

## 3. Assurance goals and example use cases

- `assurance_goals` lists every goal the technique gives direct evidence for,
  and no goal it merely touches.
- Every listed goal has at least one example use case tagged with that goal. A
  script checks this.
- Each use case is a concrete scenario with context (who is using the technique,
  on what system, to decide what). It adds something the description does not
  already say.
- Across a record's use cases the application domains vary. Two to five use
  cases is typical. The set may grow to cover a goal, and filler goes.

## 4. Limitations

- Three to five limitations, each specific to this technique. A limitation that
  would be true of any technique is boilerplate and goes.
- Limitations should be meaningful and help a user determine whether the
  technique applies to their use case.Each states its impact, meaning why it
  matters and when it bites, not just the name of a weakness.
- Together they cover the different kinds of limitation that apply, such as
  theoretical assumptions, computational cost, data requirements, and the
  situations where the technique fails or misleads.
- They agree with the description and the use cases. A use case must not show
  the technique succeeding where the limitations say it fails.

## 5. Resources: five slots

Every resource is a Zotero item in the TEA Techniques group library. The record
refers to it by its citation key, and the Zotero item carries the tags
`technique:<slug>` and `type:<slot>`. Each record fills the following slots.

| Slot                               | `source_type`       | What qualifies                                                                                                                                                   |
| ---------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Official documentation             | `documentation`     | The maintained documentation for the technique or its reference implementation. For a technique defined by a standard, the standard itself.                      |
| Software package                   | `software_package`  | An official or widely used implementation, linked at the repository or package-index page.                                                                       |
| Original paper                     | `technical_paper`   | The work that proposed the technique, or the earliest standard reference for it. Linked by DOI where one exists.                                                 |
| Tutorial                           | `tutorial`          | A step-by-step guide. The documentation's own tutorial page is acceptable, otherwise a distinct link. An official or peer-maintained tutorial beats a blog post. |
| Application papers (0–2, optional) | `application_paper` | Peer-reviewed work that applies the technique in a real setting.                                                                                                 |

Rules:

- A slot can be empty only when nothing suitable exists. The reviewer records an
  empty slot together with the search they made, so the next reviewer does not
  repeat it. For process and governance techniques (`technique-type/process` or
  `technique-type/documentation`) the software slot is usually empty, and that
  is not a defect.
- Every citation key resolves in the Zotero export. Every item has a title, a
  URL, authors where the work has them, and a date.
- Every URL resolves. Papers link by DOI where one exists. Software links to the
  canonical repository or package page. Documentation links to the maintained
  site, not a mirror or a cached copy.
- Three to seven resources per record is the normal range. More is fine when the
  application papers are strong. Fewer means a slot is empty and recorded as
  such.

## 6. Tags

- `lib/data/tag-definitions.ts` defines every tag in use. A tag missing from it
  is a defect, not a proposal.
- Every record has at least one tag in each of these categories:
  `applicable-models` (one under `architecture/` and one under `requirements/`),
  `lifecycle-stage`, `technique-type`, `data-requirements`, `data-type`,
  `evidence-type`, `expertise-needed`.
- For every listed assurance goal the record carries one sub-category tag under
  `assurance-goal-category/<goal>/...`, so a reader can see not just that the
  technique serves fairness but which kind of fairness work it does.
- Explainability techniques carry an `explanatory-scope` tag. Fairness
  techniques carry a `fairness-approach` tag.
- Tags exist for discovery. A record carries a tag when a practitioner filtering
  by it would expect to find this technique, and not otherwise. Catch-all tags
  (`data-type/any`, `lifecycle-stage/all`) belong only on a technique that is
  genuinely indifferent to that dimension.

## 7. Related techniques

The data generator computes `related_techniques` from tag overlap and embedding
similarity, and writes at most three slugs. Nobody hand-edits the field. Until
the computation lands, the curated list stays as it is.

## 8. Acronym, sample claims and ratings

- `acronym` is present only when the technique is commonly known by one.
- `complexity_rating` and `computational_cost_rating` are outside this standard.
  The 1–5 scales in the contributor guide have no defined measure behind them,
  so two reviewers can rate the same technique differently and neither is wrong.
  Existing values stay as they are. Reviewers do not add, change or audit them,
  and the quality report does not score them. The field returns to the standard
  when a scale with a stated basis exists.
- `sample_claims` holds three to five assurance claims the technique can
  support, each tagged with a goal. The techniques server uses these to match a
  claim to a technique, so each reads as a practitioner would write a claim in
  an assurance case, not as a restatement of the description.

## 9. How a record is checked

- `pnpm validate` checks the schema and the tag vocabulary.
- `pnpm quality-report` scores each record against sections 3, 4, 5 and 6 and
  lists gaps.
- `scripts/dq/check-links.js` checks every resource URL.
- A record is complete when all three pass and a reviewer has read it and
  confirmed sections 2 and 4.
