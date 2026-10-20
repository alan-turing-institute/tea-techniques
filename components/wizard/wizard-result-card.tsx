'use client';

import { Check, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Technique } from '@/lib/types';
import { cn } from '@/lib/utils';

interface WizardResultCardProps {
  technique: Technique;
  matchScore: number;
  matchReasons: string[];
}

export function WizardResultCard({
  technique,
  matchScore,
  matchReasons,
}: WizardResultCardProps) {
  // Parse match reasons into more user-friendly format
  const formatReason = (reason: string) => {
    // Convert technical reasons to user-friendly text
    if (
      reason.includes('Works with any model') ||
      reason.includes('agnostic')
    ) {
      return 'Works with your model type';
    }
    if (
      ['Planning and design', 'Development', 'Deployment and use'].some(
        (label) => reason.includes(label)
      )
    ) {
      return `Suitable for ${reason.toLowerCase()}`;
    }
    if (reason.includes('Process') || reason.includes('Documentation')) {
      return 'Matches your technique type preference';
    }
    // For assurance goals
    if (
      [
        'Transparency',
        'Fairness',
        'General',
        'Safety',
        'Reliability',
        'Privacy',
        'Explainability',
        'Security',
      ].some((goal) => reason.includes(goal))
    ) {
      return `Addresses ${reason.toLowerCase()} goal`;
    }
    return reason;
  };

  const formattedReasons = matchReasons.map(formatReason);

  return (
    <Card
      className={cn(
        'relative transition-all hover:shadow-lg',
        matchScore === 100 && 'ring-2 ring-green-500/20'
      )}
    >
      {/* Match Score Badge */}
      <div className="-top-2 -right-2 absolute z-10">
        <Badge
          className={cn(
            'px-3 py-1 font-semibold',
            matchScore === 100 && 'bg-green-500 text-white hover:bg-green-600',
            matchScore >= 75 &&
              matchScore < 100 &&
              'bg-blue-500 text-white hover:bg-blue-600',
            matchScore < 75 && 'bg-gray-500 text-white hover:bg-gray-600'
          )}
        >
          {matchScore}% match
        </Badge>
      </div>

      <CardHeader>
        <CardTitle className="text-xl">{technique.name}</CardTitle>
        <div className="mt-2 flex flex-wrap gap-2">
          {technique.assurance_goals.map((goal) => (
            <Badge className="text-xs" key={goal} variant="secondary">
              {goal}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <CardDescription className="line-clamp-3 text-sm">
          {technique.description}
        </CardDescription>

        {/* Match Rationale Section */}
        <div className="rounded-lg bg-muted/50 p-4">
          <h4 className="mb-2 flex items-center gap-2 font-medium text-sm">
            <Check className="h-4 w-4 text-green-500" />
            Why this technique matches:
          </h4>
          <ul className="space-y-1">
            {formattedReasons.map((reason) => (
              <li
                className="flex items-start gap-2 text-muted-foreground text-sm"
                key={reason}
              >
                <span className="mt-0.5 text-green-500">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Key Properties */}
        {technique.tags && (
          <div className="flex flex-wrap gap-1">
            {technique.tags
              .filter(
                (tag) =>
                  tag.startsWith('applicable-models/') ||
                  tag.startsWith('lifecycle-stage/')
              )
              .slice(0, 4)
              .map((tag) => (
                <Badge className="text-xs" key={tag} variant="outline">
                  {tag.split('/').pop()?.replace(/-/g, ' ')}
                </Badge>
              ))}
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Link className="w-full" href={`/techniques/${technique.slug}`}>
          <Button className="w-full" size="lg">
            View Details
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
