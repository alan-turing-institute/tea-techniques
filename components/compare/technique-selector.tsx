'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronsUpDown, Search, X } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useFuseSearch } from '@/lib/hooks/use-fuse-search';
import type { Technique } from '@/lib/types';

interface TechniqueSelectorProps {
  availableTechniques: Technique[];
  selectedSlugs: string[];
  onSelectionChange: (slugs: string[]) => void;
  maxSelections: number;
}

export function TechniqueSelector({
  availableTechniques,
  selectedSlugs,
  onSelectionChange,
  maxSelections,
}: TechniqueSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [filteredTechniques, setFilteredTechniques] = useState<Technique[]>([]);
  const { search, isLoading, isReady } = useFuseSearch();

  const selectedTechniques = useMemo(
    () => availableTechniques.filter((t) => selectedSlugs.includes(t.slug)),
    [availableTechniques, selectedSlugs]
  );

  // Filter techniques based on search
  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (searchValue.trim()) {
      const results = search(searchValue, 10);
      setFilteredTechniques(results.map((r) => r.item));
    } else {
      setFilteredTechniques(availableTechniques.slice(0, 10));
    }
  }, [searchValue, availableTechniques, search, isReady]);

  const handleSelect = (slug: string) => {
    if (selectedSlugs.includes(slug)) {
      // Deselect
      onSelectionChange(selectedSlugs.filter((s) => s !== slug));
    } else if (selectedSlugs.length < maxSelections) {
      // Select (if under limit)
      onSelectionChange([...selectedSlugs, slug]);
    }
  };

  const handleRemove = (slug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange(selectedSlugs.filter((s) => s !== slug));
  };

  const isAtLimit = selectedSlugs.length >= maxSelections;

  return (
    <div className="space-y-4">
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          {/* biome-ignore lint/a11y/useSemanticElements: This is a searchable select (combobox pattern), not a simple select */}
          <Button
            aria-expanded={open}
            className="w-full justify-between"
            disabled={isAtLimit}
            role="combobox"
            variant="outline"
          >
            {selectedSlugs.length === 0
              ? 'Select techniques to compare...'
              : `${selectedSlugs.length} technique${selectedSlugs.length > 1 ? 's' : ''} selected`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-full min-w-[400px] p-0">
          <div className="flex max-h-[400px] flex-col">
            {/* Search Input */}
            <div className="flex items-center gap-2 border-b p-3">
              <Search className="text-muted-foreground" size={16} />
              <input
                autoFocus
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search techniques..."
                type="text"
                value={searchValue}
              />
            </div>

            {/* Results */}
            <div className="overflow-y-auto">
              {isLoading && (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Loading search...
                </div>
              )}

              {!isLoading && filteredTechniques.length === 0 && (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No techniques found
                </div>
              )}

              {!isLoading && filteredTechniques.length > 0 && (
                <div className="py-1">
                  {filteredTechniques.map((technique) => {
                    const isSelected = selectedSlugs.includes(technique.slug);
                    const canSelect = !isAtLimit || isSelected;

                    return (
                      <button
                        className={`flex w-full items-start gap-3 px-3 py-2 text-left transition-colors hover:bg-secondary/50 ${
                          isSelected ? 'bg-secondary/30' : ''
                        } ${canSelect ? '' : 'cursor-not-allowed opacity-50'}`}
                        disabled={!canSelect}
                        key={technique.slug}
                        onClick={() =>
                          canSelect && handleSelect(technique.slug)
                        }
                        type="button"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm">
                            {technique.name}
                          </div>
                          <div className="truncate text-muted-foreground text-xs">
                            {technique.description.slice(0, 100)}...
                          </div>
                        </div>
                        {isSelected && (
                          <Badge className="mt-0.5" variant="secondary">
                            Selected
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {selectedTechniques.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTechniques.map((technique) => (
            <Badge
              className="pr-1 pl-3"
              key={technique.slug}
              variant="secondary"
            >
              {technique.name}
              <button
                className="ml-2 rounded-full p-0.5 hover:bg-secondary-foreground/20"
                onClick={(e) => handleRemove(technique.slug, e)}
                type="button"
              >
                <X className="h-3 w-3" />
                <span className="sr-only">Remove {technique.name}</span>
              </button>
            </Badge>
          ))}
        </div>
      )}

      {isAtLimit && (
        <p className="text-muted-foreground text-sm">
          Maximum of {maxSelections} techniques reached. Remove one to add
          another.
        </p>
      )}
    </div>
  );
}
