'use client';

import { ChevronDown } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { tagDefinitions } from '@/lib/data/tag-definitions';

export function AllTagDefinitions() {
  // Group tags by category
  const tagsByCategory = Object.entries(tagDefinitions).reduce<
    Record<string, Array<{ tag: string; definition: string }>>
  >((acc, [tag, definition]) => {
    const category = tag.split('/')[0];
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push({ tag, definition });
    return acc;
  }, {});

  // Category display names
  const categoryNames: Record<string, string> = {
    'assurance-goal-category': 'Assurance Goal Categories',
    'applicable-models': 'Applicable Models',
    'lifecycle-stage': 'Lifecycle Stages',
    'expertise-needed': 'Expertise Needed',
    'evidence-type': 'Evidence Types',
    'data-requirements': 'Data Requirements',
    'data-type': 'Data Types',
    'technique-type': 'Technique Types',
    'explanatory-scope': 'Explanatory Scope',
  };

  return (
    <div className="space-y-6">
      {Object.entries(tagsByCategory).map(([category, tags]) => (
        <Collapsible defaultOpen={false} key={category}>
          <CollapsibleTrigger asChild>
            <Button
              className="w-full justify-between p-4 text-left hover:bg-muted/50"
              variant="ghost"
            >
              <span className="font-semibold text-lg">
                {categoryNames[category] || category}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">
                  {tags.length} tags
                </span>
                <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 pb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Tag</TableHead>
                  <TableHead>Definition</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags
                  .sort((a, b) => a.tag.localeCompare(b.tag))
                  .map(({ tag, definition }) => (
                    <TableRow key={tag}>
                      <TableCell className="font-mono text-sm">{tag}</TableCell>
                      <TableCell className="text-sm">{definition}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}
