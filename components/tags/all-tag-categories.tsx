'use client';

import { ChevronDown } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { tagDefinitions } from '@/lib/data/tag-definitions';
import { TagCategoryDisplay } from './tag-category-display';

/**
 * Configuration for tag categories to display
 */
const TAG_CATEGORIES = [
  {
    key: 'assurance-goal-category',
    name: 'Assurance Goal Categories',
    description:
      'The assurance goal(s) that the technique helps achieve (e.g., explainability, fairness, privacy)',
  },
  {
    key: 'applicable-models',
    name: 'Applicable Models',
    description: 'Types of ML/AI models to which the technique can be applied',
  },
  {
    key: 'lifecycle-stage',
    name: 'Lifecycle Stages',
    description:
      'Stages of the project/system lifecycle where the technique is applicable',
  },
  {
    key: 'expertise-needed',
    name: 'Expertise Needed',
    description:
      'Type of knowledge or expertise required to apply the technique effectively',
  },
  {
    key: 'evidence-type',
    name: 'Evidence Types',
    description:
      'Type of output or evidential artifact produced by the technique',
  },
  {
    key: 'data-type',
    name: 'Data Types',
    description: 'Types of data the technique is designed for or applicable to',
  },
  {
    key: 'data-requirements',
    name: 'Data Requirements',
    description:
      'Additional data needs or dependencies for using the technique',
  },
  {
    key: 'technique-type',
    name: 'Technique Types',
    description: 'Fundamental nature and approach of the technique',
  },
  {
    key: 'explanatory-scope',
    name: 'Explanatory Scope',
    description:
      'Whether the explanation is instance-specific (local) or model-wide (global)',
  },
] as const;

/**
 * Displays all tag categories with collapsible sections
 */
export function AllTagCategories() {
  return (
    <div className="space-y-4">
      {TAG_CATEGORIES.map((category) => {
        // Count tags in this category
        const tagCount = Object.keys(tagDefinitions).filter((tag) =>
          tag.startsWith(`${category.key}/`)
        ).length;

        if (tagCount === 0) {
          return null;
        }

        return (
          <Collapsible defaultOpen={false} key={category.key}>
            <CollapsibleTrigger asChild>
              <Button
                className="w-full justify-between p-4 text-left hover:bg-muted/50"
                variant="ghost"
              >
                <div className="flex flex-col items-start gap-1">
                  <span className="font-semibold text-lg">{category.name}</span>
                  <span className="font-normal text-muted-foreground text-xs">
                    {category.description}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">
                    {tagCount} tags
                  </span>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4">
              <TagCategoryDisplay category={category.key} />
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
