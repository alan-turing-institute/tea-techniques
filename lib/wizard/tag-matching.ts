export function matchesTagPath(tag: string, path: string): boolean {
  return tag === path || tag.startsWith(`${path}/`);
}

const MODEL_AGNOSTIC_TAG = 'applicable-models/architecture/model-agnostic';
const MODEL_AGNOSTIC_ANSWER = 'architecture/model-agnostic';

const ARCHITECTURE_PREFIX = 'applicable-models/architecture/';

// True when the technique is tagged for the named model type through the tag
// hierarchy: it carries that type's tag, a tag below it, or a tag for a
// broader type above it. A broader tag counts only when the technique carries
// none of that tag's own sub-types, since a broader tag beside one of its
// sub-types narrows the technique to that sub-type.
export function hasNamedModelTypeTag(tags: string[], answer: string): boolean {
  const answerTag = `applicable-models/${answer}`;
  return tags.some(
    (tag) =>
      matchesTagPath(tag, answerTag) ||
      (tag.startsWith(ARCHITECTURE_PREFIX) &&
        answerTag.startsWith(`${tag}/`) &&
        !tags.some((other) => other.startsWith(`${tag}/`)))
  );
}

// Decides whether a technique matches an answer to the model-type question.
// A named type matches techniques tagged for it (or a sub-type) and techniques
// that work with any model; "Any Model / Not Sure" matches only the latter.
export function matchesModelTypeAnswer(
  tags: string[],
  answer: string
): boolean {
  if (tags.includes(MODEL_AGNOSTIC_TAG)) {
    return true;
  }
  if (answer === MODEL_AGNOSTIC_ANSWER) {
    return false;
  }
  return hasNamedModelTypeTag(tags, answer);
}

export function matchesOptionTag(
  tag: string,
  filterTag: string,
  value: string
): boolean {
  if (filterTag === 'technique-type' && value === 'process') {
    return (
      tag === 'technique-type/process' || tag === 'technique-type/documentation'
    );
  }
  const prefix = filterTag.startsWith('applicable-models/')
    ? 'applicable-models'
    : filterTag;
  return matchesTagPath(tag, `${prefix}/${value}`);
}
