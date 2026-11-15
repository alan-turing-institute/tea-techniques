# TEA Techniques - Claude Code Project Guide

Interactive web app for exploring AI assurance techniques that support
argument-based assurance. Fully static Next.js 15 application optimised for
GitHub Pages.

## Quick Start

```bash
# Development
docker compose -f docker-compose.development.yml up -d

# Type checking
pnpm type-check

# Linting (Biome with ultracite config)
pnpm lint

# Format
pnpm format

# Data Generation (runs automatically in prebuild)
pnpm generate-data
pnpm generate-sitemap

# Build (requires NODE_ENV=production)
NODE_ENV=production pnpm build
```

## Architecture Overview

### Data System

- **Source:** `/public/data/techniques.json` (ground truth)
- **Generated:** ~280+ JSON files for optimal performance
- **Structure:** 8 assurance goals, 162 techniques, generated filter files for
  every tag

### Tech Stack

- **Next.js 15** with static export
- **TypeScript** (strict mode)
- **Tailwind CSS** + **shadcn/ui** (New York style, 22 components)
- **next-themes** for dark/light mode
- **Fuse.js** for client-side search
- **XState** for wizard state machine

### Navigation Architecture

The site uses different navigation components based on route:

- **`nav-main.tsx`** - Sidebar navigation (most pages via SidebarLayout)
- **`header.tsx`** - Top navigation (some docs/about pages via PageLayout)
- **`homepage-header.tsx`** - Homepage only

When adding new routes, verify which layout is used and add navigation to the
correct component.

### Static Export Requirements

- Everything pre-computed at build time
- No runtime data fetching
- Image optimization disabled
- Trailing slashes enabled
- Output: 'export' (production only)

## Key Directories

```
/public/data/           # Source data (techniques.json) + generated files
/lib/data.ts            # Data loading utilities (getTechniques, etc.)
/components/ui/         # shadcn/ui components (New York style)
/components/            # Custom components organized by feature
/app/                   # Next.js 15 app directory (file-based routing)
```

## Development Guidelines

### Data Updates

1. Modify `/public/data/techniques.json`
2. Run `pnpm generate-data` (auto-runs in prebuild)
3. Verify: `pnpm type-check && pnpm lint`

### Component Patterns

- Follow shadcn/ui (New York) conventions
- Use existing components before creating new ones
- Server components by default, `'use client'` only when needed
- Organize custom components by feature: `/components/[feature]/`

### Static Export Patterns

- Use `export const dynamic = 'force-static'` on dynamic routes
- Implement `generateStaticParams()` for all dynamic routes
- Await params before accessing: `const { slug } = await params;`
- No runtime data fetching (all data loaded at build time)
- Pre-generate filtered data (categories, filters)

### Type Safety

- Strict TypeScript mode enabled
- Always use `@/` import alias
- No `any` types (use specific types or `unknown`)
- Handle null/undefined explicitly
- Define interfaces for all component props

### Testing Changes

Always verify before committing:

```bash
pnpm type-check  # TypeScript checking
pnpm lint        # Biome linting (ultracite config)
pnpm build       # Build succeeds
```

## Configuration Notes

### TypeScript

- Strict mode with null checks
- Path alias: `@/*` → project root
- ES2017 target, ESNext modules

### Styling & Linting

- Tailwind CSS with CSS variables for theming
- Biome with "ultracite" configuration
- Pre-commit hooks: lint, format, type-check

### Build

- Requires `NODE_ENV=production` for static exports
- Prebuild: data generation + validation + sitemap
- Output: Static HTML in `/out/` directory

## Data Loading Patterns

Core functions from `lib/data.ts`:

```typescript
// All techniques (full data, 1.2MB)
await getAllTechniques();

// Metadata only (72% smaller, 340KB)
await getAllTechniquesMetadata();

// Single technique
await getTechnique(slug);

// Assurance goals
await getAssuranceGoals();

// Tags
await getTags();

// Pre-filtered data
await getCategoryData(goalSlug);
await getFilterData(category, tagSlug);
```

**Performance tips:**

- Use metadata for lists (cards, search results)
- Use full data only for detail pages
- Use pre-filtered data when available
- All functions cached during build

## Common Patterns

### Dynamic Route with Static Generation

```typescript
// app/techniques/[slug]/page.tsx
export const dynamic = 'force-static';

export async function generateStaticParams() {
  const techniques = await getAllTechniques();
  return techniques.map(t => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const technique = await getTechnique(slug);
  return { title: `${technique.name} - TEA Techniques` };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const technique = await getTechnique(slug);
  return <TechniqueDetail technique={technique} />;
}
```

### Server → Client Component Pattern

```typescript
// app/feature/page.tsx (server)
export const dynamic = 'force-static';

export default async function Page() {
  const data = await getData();
  return <ClientWrapper data={data} />;
}

// components/feature/client-wrapper.tsx (client)
'use client';

export function ClientWrapper({ data }: Props) {
  const [state, setState] = useState();
  // Interactive logic
}
```

## Troubleshooting

### Build Issues

```bash
# TypeScript errors
pnpm type-check

# Missing data files
pnpm generate-data

# Static export fails
NODE_ENV=production pnpm build
```

### Common Fixes

- **Import errors:** Use `@/` alias consistently
- **Type errors:** No `any` types, handle null/undefined
- **Build fails:** Check `generateStaticParams()` on dynamic routes
- **404 on deployment:** Ensure trailing slashes enabled

## Additional Documentation

For detailed personal instructions and local configuration:

- See `CLAUDE.local.md` (not checked in, your private notes)

---

**Project Repository:** https://github.com/alan-turing-institute/tea-techniques
**Documentation:** This file + `CLAUDE.local.md`
