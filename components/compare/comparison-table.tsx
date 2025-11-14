'use client';

import Link from 'next/link';
import { X } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import GoalIcon from '@/components/ui/goal-icon';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Technique } from '@/lib/types';

interface ComparisonTableProps {
  techniques: Technique[];
  onRemoveTechnique: (slug: string) => void;
  onClearAll: () => void;
}

export function ComparisonTable({
  techniques,
  onRemoveTechnique,
  onClearAll,
}: ComparisonTableProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onClearAll} size="sm" variant="outline">
          Clear All
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px] font-semibold">Field</TableHead>
              {techniques.map((technique) => (
                <TableHead className="min-w-[250px]" key={technique.slug}>
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      className="font-semibold text-foreground hover:text-primary hover:underline"
                      href={`/techniques/${technique.slug}`}
                    >
                      {technique.name}
                    </Link>
                    <button
                      className="shrink-0 rounded-full p-1 hover:bg-secondary"
                      onClick={() => onRemoveTechnique(technique.slug)}
                      title="Remove from comparison"
                      type="button"
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Remove {technique.name}</span>
                    </button>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Description Row */}
            <TableRow>
              <TableCell className="align-top font-medium">
                Description
              </TableCell>
              {techniques.map((technique) => (
                <TableCell className="align-top" key={technique.slug}>
                  <p className="text-sm">{technique.description}</p>
                </TableCell>
              ))}
            </TableRow>

            {/* Assurance Goals Row */}
            <TableRow>
              <TableCell className="align-top font-medium">
                Assurance Goals
              </TableCell>
              {techniques.map((technique) => (
                <TableCell className="align-top" key={technique.slug}>
                  <div className="flex flex-wrap gap-1">
                    {technique.assurance_goals?.map((goal) => (
                      <Badge
                        className="flex items-center gap-1"
                        key={goal}
                        variant="secondary"
                      >
                        <GoalIcon goalName={goal} size={12} />
                        <span className="text-xs">{goal}</span>
                      </Badge>
                    ))}
                  </div>
                </TableCell>
              ))}
            </TableRow>

            {/* Use Cases Row */}
            <TableRow>
              <TableCell className="align-top font-medium">
                Example Use Cases
              </TableCell>
              {techniques.map((technique) => (
                <TableCell className="align-top" key={technique.slug}>
                  {technique.example_use_cases &&
                  technique.example_use_cases.length > 0 ? (
                    <div className="space-y-2">
                      {technique.example_use_cases.map((useCase) => (
                        <div
                          className="flex flex-col gap-1"
                          key={`${technique.slug}-${useCase.goal}-${useCase.description.slice(0, 20)}`}
                        >
                          <Badge
                            className="flex w-fit items-center gap-1"
                            variant="secondary"
                          >
                            <GoalIcon goalName={useCase.goal} size={12} />
                            <span className="text-xs">{useCase.goal}</span>
                          </Badge>
                          <p className="text-sm">{useCase.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm italic">
                      No use cases available
                    </p>
                  )}
                </TableCell>
              ))}
            </TableRow>

            {/* Limitations Row */}
            <TableRow>
              <TableCell className="align-top font-medium">
                Limitations
              </TableCell>
              {techniques.map((technique) => (
                <TableCell className="align-top" key={technique.slug}>
                  {technique.limitations && technique.limitations.length > 0 ? (
                    <ul className="list-inside list-disc space-y-2">
                      {technique.limitations.map((limitation) => (
                        <li
                          className="text-sm"
                          key={`${technique.slug}-${limitation.description.slice(0, 30)}`}
                        >
                          {limitation.description}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground text-sm italic">
                      No limitations documented
                    </p>
                  )}
                </TableCell>
              ))}
            </TableRow>

            {/* Link Row */}
            <TableRow>
              <TableCell className="align-top font-medium">
                Full Details
              </TableCell>
              {techniques.map((technique) => (
                <TableCell className="align-top" key={technique.slug}>
                  <Link href={`/techniques/${technique.slug}`}>
                    <Button className="w-full" size="sm" variant="outline">
                      View Full Technique
                    </Button>
                  </Link>
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
