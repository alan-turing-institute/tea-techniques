export function matchesTagPath(tag: string, path: string): boolean {
  return tag === path || tag.startsWith(`${path}/`);
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
