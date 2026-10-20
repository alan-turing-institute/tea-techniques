import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { getTagUrlPart } from '../lib/tag-utils';
import type { Technique } from '../lib/types';
import { wizardConfig } from '../lib/wizard/config';
import { calculateMatchScore } from '../lib/wizard/filters';
import {
  enrichOptionsWithCounts,
  loadDynamicOptions,
} from '../lib/wizard/options';
import type { WizardState } from '../lib/wizard/types';
import { WizardStateMachine } from '../lib/wizard/wizard-machine';

const techniques: Technique[] = JSON.parse(
  fs.readFileSync(
    new URL('../public/data/techniques.json', import.meta.url),
    'utf8'
  )
);
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
