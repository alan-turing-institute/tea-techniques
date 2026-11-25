import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getTagUrlPart } from '../lib/tag-utils';
import { formatSlugToTitle } from '../lib/technique-utils';
import type { Technique } from '../lib/types';
import { wizardConfig } from '../lib/wizard/config';
import {
  calculateMatchScore,
  getMatchReasons,
  sortTechniquesByRelevance,
} from '../lib/wizard/filters';
import {
  enrichOptionsWithCounts,
  loadDynamicOptions,
} from '../lib/wizard/options';
import type { QuestionOption, WizardState } from '../lib/wizard/types';
import { WizardStateMachine } from '../lib/wizard/wizard-machine';

const techniques: Technique[] = JSON.parse(
  fs.readFileSync(
    new URL('../public/data/techniques.json', import.meta.url),
    'utf8'
  )
);
const STATS_LINE = /<p class="text-lg text-muted-foreground">([^<]*)<\/p>/;
const ONE_SUBCATEGORY_STATS = /^1 subcategory • \d+ techniques$/;
const MANY_TECHNIQUES_STATS = /^\d+ techniques$/;
const goals = [...new Set(techniques.flatMap((t) => t.assurance_goals))];
function state(goal: string): WizardState {
  return {
    currentFlow: 'by-goal',
    currentQuestionIndex: 0,
    answers: { 'assurance-goal': goal },
    path: [],
    remainingTechniques: techniques.length,
    skippedQuestions: [],
  };
}

function filterOption(id: string, goal: string, value: string) {
  const flow = Object.values(wizardConfig.flows).find((candidate) =>
    candidate.questions.includes(id)
  );
  if (!flow) {
    throw new Error(`No flow for ${id}`);
  }
  const machine = new WizardStateMachine(techniques);
  let current = machine.startFlow(flow.id);
  const needsGoal =
    id === 'assurance-subcategory' || id.startsWith('explainability-');
  while (current && current.id !== id) {
    current = machine.submitAnswer(
      current.id === 'assurance-goal' && needsGoal ? goal : 'not-sure'
    );
  }
  if (current?.id !== id) {
    throw new Error(`${id} is unreachable`);
  }
  machine.submitAnswer(value);
  return machine.getFilteredTechniques();
}

test('every option in a live wizard question counts and filters real techniques', () => {
  const liveQuestions = new Set(
    Object.values(wizardConfig.flows).flatMap((flow) => flow.questions)
  );
  for (const id of liveQuestions) {
    const question = wizardConfig.questions[id];
    for (const goal of id === 'assurance-subcategory'
      ? goals.filter((g) => g !== 'Explainability')
      : ['Explainability']) {
      const options =
        question.options === 'dynamic'
          ? loadDynamicOptions(question, state(goal), techniques)
          : enrichOptionsWithCounts(
              question.options ?? [],
              question.filterTag ?? '',
              techniques
            );
      assert.ok(options.length, `${id}/${goal} has options`);
      for (const option of options) {
        assert.ok(
          option.count && option.count > 0,
          `${id}/${goal}/${option.value} has records`
        );
        assert.ok(
          filterOption(id, goal, option.value).length > 0,
          `${id}/${goal}/${option.value} filters records`
        );
      }
    }
  }
});

test('lifecycle parent paths and documentation score consistently with counts', () => {
  const technique = {
    ...techniques[0],
    assurance_goals: ['General'],
    tags: [
      'lifecycle-stage/project-design/problem-formulation',
      'technique-type/documentation',
    ],
  } as Technique;
  for (const [question, answer, expected] of [
    ['lifecycle-stage', 'project-design', 100],
    ['lifecycle-stage', 'design', 0],
    ['technique-type', 'process', 100],
    ['assurance-goal', 'Safety', 0],
    ['assurance-goal', 'General', 100],
  ] as const) {
    assert.equal(
      calculateMatchScore(technique, {
        ...state('General'),
        path: [{ question, answer }],
      }),
      expected
    );
  }
});

test('probabilistic architecture and paradigm have distinct filter URLs', () => {
  assert.equal(
    getTagUrlPart(
      'applicable-models/architecture/probabilistic',
      'applicable-models'
    ),
    'architecture-probabilistic'
  );
  assert.equal(
    getTagUrlPart(
      'applicable-models/paradigm/probabilistic',
      'applicable-models'
    ),
    'paradigm-probabilistic'
  );
});

test('a value page lists its own techniques beside its sub-values', async () => {
  (globalThis as { React?: unknown }).React = React;
  const { default: DimensionPage } = await import(
    '../app/categories/[goal]/[dimension]/page'
  );
  const render = async (goal: string, dimension: string) =>
    renderToStaticMarkup(
      await DimensionPage({ params: Promise.resolve({ goal, dimension }) })
    );

  const statsLine = (markup: string) => STATS_LINE.exec(markup)?.[1];

  const withSubValues = await render('privacy', 'exposure-reduction');
  assert.match(statsLine(withSubValues) ?? '', ONE_SUBCATEGORY_STATS);
  assert.ok(
    withSubValues.includes(
      '/categories/privacy/exposure-reduction/data-minimisation'
    )
  );
  for (const slug of ['k-anonymity', 'machine-unlearning']) {
    assert.ok(
      withSubValues.includes(`href="/techniques/${slug}"`),
      `${slug} is listed`
    );
  }

  const withoutSubValues = await render('safety', 'monitoring');
  assert.match(statsLine(withoutSubValues) ?? '', MANY_TECHNIQUES_STATS);

  const singleTechnique = await render('security', 'threat-analysis');
  assert.equal(statsLine(singleTechnique), '1 technique');
});

const ANY_MODEL_TAG = 'applicable-models/architecture/model-agnostic';
const modelTypeQuestion = wizardConfig.questions['model-architecture'];
const namedModelTypes = (modelTypeQuestion.options as { value: string }[])
  .map((option) => option.value)
  .filter((value) => value !== 'architecture/model-agnostic');

function carriesModelType(technique: Technique, value: string) {
  const tag = `applicable-models/${value}`;
  return (technique.tags ?? []).some(
    (t) => t === tag || t.startsWith(`${tag}/`)
  );
}

function modelTypeState(answer: string): WizardState {
  return {
    ...state('General'),
    path: [{ question: 'model-architecture', answer }],
  };
}

test('a named model type keeps its own techniques and the any-model ones', () => {
  assert.ok(namedModelTypes.length > 0);
  for (const value of namedModelTypes) {
    const expected = techniques
      .filter(
        (t) => carriesModelType(t, value) || t.tags?.includes(ANY_MODEL_TAG)
      )
      .map((t) => t.slug)
      .sort();
    const actual = filterOption('model-architecture', 'General', value)
      .map((t) => t.slug)
      .sort();
    assert.deepEqual(actual, expected, value);
  }
});

test('the count beside each model type equals the results it gives', () => {
  const options = enrichOptionsWithCounts(
    modelTypeQuestion.options as QuestionOption[],
    modelTypeQuestion.filterTag ?? '',
    techniques
  );
  for (const option of options) {
    assert.equal(
      option.count,
      filterOption('model-architecture', 'General', option.value).length,
      option.value
    );
  }
});

test('"Any Model / Not Sure" returns exactly the any-model techniques', () => {
  const expected = techniques
    .filter((t) => t.tags?.includes(ANY_MODEL_TAG))
    .map((t) => t.slug)
    .sort();
  const actual = filterOption(
    'model-architecture',
    'General',
    'architecture/model-agnostic'
  )
    .map((t) => t.slug)
    .sort();
  assert.deepEqual(actual, expected);
});

test('type-tagged techniques sort before any-model ones at equal score', () => {
  const answer = 'architecture/linear-models';
  const results = filterOption('model-architecture', 'General', answer);
  const sorted = sortTechniquesByRelevance(results, modelTypeState(answer));
  const specific = sorted.map((t) => carriesModelType(t, answer));
  assert.ok(specific.some(Boolean) && specific.some((s) => !s));
  assert.equal(specific.indexOf(false) > specific.lastIndexOf(true), true);
});

test('an any-model technique under a named type says it works with any model', () => {
  const answer = 'architecture/linear-models';
  const anyOnly = techniques.find(
    (t) => t.tags?.includes(ANY_MODEL_TAG) && !carriesModelType(t, answer)
  ) as Technique;
  const typed = techniques.find((t) =>
    carriesModelType(t, answer)
  ) as Technique;
  assert.ok(
    getMatchReasons(anyOnly, modelTypeState(answer)).includes(
      'Works with any model'
    )
  );
  assert.ok(
    getMatchReasons(typed, modelTypeState(answer)).includes('Linear Models')
  );
});

test('slug titles use title case with lower-case joining words', () => {
  assert.equal(
    formatSlugToTitle('confidence-and-limits'),
    'Confidence and Limits'
  );
  assert.equal(
    formatSlugToTitle('performance-by-group'),
    'Performance by Group'
  );
  assert.equal(formatSlugToTitle('exposure-reduction'), 'Exposure Reduction');
  assert.equal(formatSlugToTitle('in-processing'), 'In Processing');
});
