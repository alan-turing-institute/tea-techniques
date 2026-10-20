/**
 * Hierarchical Tags Display Component
 *
 * This component displays technique tags in a hierarchical, grouped format
 * for assurance goals that have dimensional organization (e.g., explainability).
 * It automatically falls back to flat display for non-hierarchical tags.
 *
 * FEATURES:
 * - Automatically detects hierarchical tag structures
 * - Groups tags by dimensions (Method, Target, Property, etc.)
 * - Preserves original flat display for non-hierarchical tags
 * - Generates appropriate links based on tag structure
 *
 * USAGE:
 * <TechniqueTagsHierarchical technique={technique} />
 *
 * EXTENDING:
 * To add support for new hierarchical assurance goals:
 * 1. Update TAG_HIERARCHIES in lib/data/tag-hierarchies.ts
 * 2. This component will automatically handle the new structure
 *
 * DATA FLOW:
 * 1. Receives technique with tags array
 * 2. Separates hierarchical from non-hierarchical tags
 * 3. Groups hierarchical tags by their dimensions
 * 4. Renders each group with appropriate styling and links
 */

import {
  Blocks,
  Calendar,
  ChartBar,
  CheckCircle,
  Cpu,
  Database,
  FileText,
  GitBranch,
  Image,
  Layers,
  Minimize,
  Network,
  Settings,
  Target,
  TriangleAlert,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { tagDefinitions } from '@/lib/data/tag-definitions';
import {
  type DimensionConfig,
  getDimensionOrder,
  groupTagsByDimension,
  hasHierarchicalTags,
} from '@/lib/data/tag-hierarchies';
import { getTagUrlPart } from '@/lib/tag-utils';
import {
  formatTagCategory,
  formatTagName,
  groupTagsByCategory,
} from '@/lib/technique-utils';
import type { Technique } from '@/lib/types';

interface TechniqueTagsHierarchicalProps {
  technique: Technique;
}

/**
 * Maps icon names to Lucide React components
 * Add new icons here as needed for new dimensions
 */
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'chart-bar': ChartBar,
  layers: Layers,
  image: Image,
  cpu: Cpu,
  database: Database,
  'alert-triangle': TriangleAlert,
  'git-branch': GitBranch,
  minimize: Minimize,
  target: Target,
  'check-circle': CheckCircle,
  // Fallback icons for standard categories
  'applicable-models': Layers,
  'data-requirements': Database,
  'data-type': Database,
  'evidence-type': FileText,
  'expertise-needed': Users,
  'explanatory-scope': Network,
  'lifecycle-stage': Calendar,
  'technique-type': Settings,
};

/**
 * Gets the appropriate icon component for a category or dimension
 */
function getIcon(iconName: string | undefined, category?: string) {
  if (iconName && iconMap[iconName]) {
    return iconMap[iconName];
  }
  if (category && iconMap[category]) {
    return iconMap[category];
  }
  return Blocks; // Default fallback icon
}

/**
 * Renders a single tag with its badge and link
 */
function TagBadge({ tag, category }: { tag: string; category: string }) {
  const tagParts = tag.split('/');
  const lastPart = tagParts.at(-1) ?? tag;
  const displayName = formatTagName(lastPart);
  const urlPart = getTagUrlPart(tag, category);

  // For hierarchical assurance-goal-category tags, use categories route

  // For flat tags, use filters route
  const isHierarchical =
    tagParts.length >= 3 && category === 'assurance-goal-category';
  const href = isHierarchical
    ? `/categories/${tagParts[1]}/${tagParts.slice(2).join('/')}`
    : `/filters/${category}/${urlPart}`;

  // Get tooltip content from tag definitions
  const tooltipContent = tagDefinitions[tag];

  const badge = (
    <Badge
      className="cursor-pointer transition-all hover:bg-primary hover:text-primary-foreground"
      variant="secondary"
    >
      {displayName}
    </Badge>
  );

  // Wrap in tooltip if definition exists
  if (tooltipContent) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={href}>{badge}</Link>
        </TooltipTrigger>
        <TooltipContent className="max-w-[200px]" sideOffset={5}>
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    );
  }

  return <Link href={href}>{badge}</Link>;
}

/**
 * Renders a group of hierarchical tags under a dimension heading
 */
function HierarchicalTagGroup({
  config,
  tags,
}: {
  config: DimensionConfig;
  tags: string[];
}) {
  const Icon = getIcon(config.icon);

  // Filter out parent tags if more specific child tags exist
  const uniqueTags = tags.filter((tag) => {
    return !tags.some(
      (otherTag) => otherTag !== tag && otherTag.startsWith(`${tag}/`)
    );
  });

  // A goal value tagged without a sub-value would print its name as both the
  // group label and the badge, so only the badge is shown.
  const isValueOnly =
    uniqueTags.length === 1 &&
    uniqueTags[0].startsWith('assurance-goal-category/') &&
    uniqueTags[0].split('/').length === 3;

  return (
    <div className="flex flex-wrap items-start gap-2">
      <div className="flex min-w-fit items-center gap-2 font-medium text-muted-foreground text-sm">
        <Icon className="h-4 w-4" />
        {!isValueOnly &&
          (config.description ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help border-muted-foreground border-b border-dotted">
                  {config.name}:
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-[280px]" sideOffset={5}>
                {config.description}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span>{config.name}:</span>
          ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {uniqueTags.map((tag) => {
          // Use correct category for explanatory-scope tags
          const category = tag.startsWith('explanatory-scope/')
            ? 'explanatory-scope'
            : 'assurance-goal-category';
          return <TagBadge category={category} key={tag} tag={tag} />;
        })}
      </div>
    </div>
  );
}

/**
 * Renders a group of flat (non-hierarchical) tags
 */
function FlatTagGroup({
  category,
  tags,
}: {
  category: string;
  tags: string[];
}) {
  const Icon = getIcon(undefined, category);

  // Filter out hierarchical assurance-goal-category tags and parent tags
  const flatTags = tags.filter((tag) => {
    const parts = tag.split('/');
    // Skip hierarchical assurance-goal-category tags (they're handled separately)
    if (category === 'assurance-goal-category' && parts.length >= 3) {
      return false;
    }
    // Check if this tag is a parent of any other tag
    return !tags.some(
      (otherTag) => otherTag !== tag && otherTag.startsWith(`${tag}/`)
    );
  });

  if (flatTags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex min-w-fit items-center gap-2 font-medium text-muted-foreground text-sm">
        <Icon className="h-4 w-4" />
        <span>{formatTagCategory(category)}:</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {flatTags.map((tag) => (
          <TagBadge category={category} key={tag} tag={tag} />
        ))}
      </div>
    </div>
  );
}

/**
 * Helper function to build hierarchical sections for a goal
 */
function buildHierarchicalSection(goal: string, technique: Technique) {
  const goalLower = goal.toLowerCase();

  // For explainability, also include explanatory-scope tags
  const goalTags = technique.tags.filter((tag) => {
    if (tag.startsWith(`assurance-goal-category/${goalLower}/`)) {
      return true;
    }
    // Include explanatory-scope tags only for explainability
    if (
      goalLower === 'explainability' &&
      tag.startsWith('explanatory-scope/')
    ) {
      return true;
    }
    return false;
  });

  if (goalTags.length === 0) {
    return null;
  }

  const grouped = groupTagsByDimension(goalTags, goalLower);
  const dimensionOrder = getDimensionOrder(goalLower);

  if (Object.keys(grouped).length === 0) {
    return null;
  }

  return (
    <div className="space-y-3" key={`${goalLower}-hierarchical`}>
      <h3 className="font-semibold text-base text-muted-foreground">
        {goal} Dimensions
      </h3>
      {dimensionOrder
        .filter((dimension) => grouped[dimension])
        .map((dimension) => (
          <HierarchicalTagGroup
            config={grouped[dimension].config}
            key={`${goalLower}-${dimension}`}
            tags={grouped[dimension].tags}
          />
        ))}
    </div>
  );
}

/**
 * Helper function to build flat tag sections
 */
function buildFlatSections(
  tagsByCategory: Record<string, string[]>,
  technique: Technique
) {
  const sections: ReactElement[] = [];
  const hasExplainability = technique.assurance_goals
    .map((g) => g.toLowerCase())
    .includes('explainability');

  for (const [category, tags] of Object.entries(tagsByCategory)) {
    // Skip explanatory-scope if the technique has explainability goal
    // since it will be shown in the hierarchical section
    if (category === 'explanatory-scope' && hasExplainability) {
      continue;
    }

    // Skip assurance-goal-category tags as they're shown as badges at the top
    if (category === 'assurance-goal-category') {
      continue;
    }

    sections.push(
      <FlatTagGroup category={category} key={category} tags={tags} />
    );
  }

  return sections;
}

/**
 * Main component for displaying hierarchical and flat tags
 */
export function TechniqueTagsHierarchical({
  technique,
}: TechniqueTagsHierarchicalProps) {
  if (!technique.tags || technique.tags.length === 0) {
    return null;
  }

  // Group all tags by category first
  const tagsByCategory = groupTagsByCategory(technique.tags);

  // Build hierarchical sections for goals that support it
  const hierarchicalSections = technique.assurance_goals
    .filter((goal) => hasHierarchicalTags(goal.toLowerCase()))
    .map((goal) => buildHierarchicalSection(goal, technique))
    .filter(Boolean) as ReactElement[];

  // Build flat tag sections
  const flatSections = buildFlatSections(tagsByCategory, technique);

  return (
    <TooltipProvider>
      <section className="mb-12" id="tags">
        <h2 className="mb-6 font-semibold text-2xl">Tags</h2>

        {/* Render hierarchical sections first if they exist */}
        {hierarchicalSections.length > 0 && (
          <div className="mb-6 space-y-6">{hierarchicalSections}</div>
        )}

        {/* Render flat sections */}
        {flatSections.length > 0 && (
          <div className="space-y-3">
            {hierarchicalSections.length > 0 && (
              <h3 className="font-semibold text-base text-muted-foreground">
                Other Categories
              </h3>
            )}
            {flatSections}
          </div>
        )}
      </section>
    </TooltipProvider>
  );
}
