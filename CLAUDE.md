# TEA Techniques - Claude Code Project Guide

Interactive web app for exploring AI assurance techniques that support argument-based assurance. Fully static Next.js 14 application optimized for GitHub Pages.

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
- **Structure:** 7 Assurance Goals, 92 Techniques, 184 Filter combinations

### Tech Stack

- **Next.js 14** with static export
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

When adding new routes, verify which layout is used and add navigation to the correct component.

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
/app/                   # Next.js 14 app directory (file-based routing)
/.claude/               # Claude Code infrastructure
  ├── skills/           # Reusable patterns (auto-activated)
  ├── commands/         # Custom slash commands
  ├── agents/           # Specialized subagents
  └── hooks/            # Event-driven automation
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

## Custom Slash Commands

- `/prime` - Understand codebase structure
- `/load_ai_docs` - Load AI documentation from websites
- `/research_docs` - Fetch documentation based on queries

## Specialized Agents

- `docs-scraper` - Documentation fetching specialist
- `research-docs-fetcher` - Research and documentation gathering

## Prompt Templates

Reusable patterns for consistent agent/skill/command development. Located in `.claude/templates/`:

### Available Templates

- **agent-initialization.md** - Structure for agent/skill setup (purpose, variables, activation)
- **result-reporting.md** - Consistent success/failure reporting format
- **error-handling.md** - Error detection and reporting patterns
- **workflow-structure.md** - Multi-step process patterns (Research → Process → Save → Report)
- **review-checklist.md** - Tiered quality checklists (🔴 Critical, 🟡 Important, 🟢 Nice-to-have)

### Usage

Reference templates in agents/skills using `@.claude/templates/`:

```markdown
## Workflow

See @.claude/templates/workflow-structure.md for workflow patterns.

1. **Step 1:** Fetch content
2. **Step 2:** Process data
3. **Step 3:** Save results
4. **Step 4:** Report outcome

## Report Format

See @.claude/templates/result-reporting.md

- ✅ Success: file_path - description
- ❌ Failure: error_message
```

Templates ensure consistency, reduce duplication, and provide proven patterns for common scenarios.

## Skills (Auto-Activated)

Skills automatically activate based on your request context:

### feature-planning
Translates PM requirements ("I want users to...") into technical plans with three synchronized dev docs (pm-overview, implementation, tasks).

**Auto-activates on:**
- "I want users to..."
- "Add feature..."
- "Plan for..."
- "How would we build..."

### nextjs-development-standards
Next.js 14 static export patterns, shadcn/ui conventions, data loading best practices.

**Auto-activates on:**
- "Implement..."
- "Build..."
- "Create component..."
- "How do I..."
- "What's the pattern for..."

### code-quality-checklist
Quality standards and completion criteria with tiered requirements (🔴 Critical, 🟡 Important, 🟢 Nice-to-have).

**Auto-activates on:**
- "Review..."
- "Is this complete..."
- "Ready to ship..."
- "Does this meet standards..."

## Development Workflow

### PM → Planning → Development

1. **PM requests feature:** "I want users to [do something]"
   - `feature-planning` skill auto-activates
2. **Planning agent:** Creates dev docs in `dev/active/[feature-name]/`
   - `[feature-name]-pm-overview.md` - Functional description (PM reviews)
   - `[feature-name]-implementation.md` - Technical details (Claude uses)
   - `[feature-name]-tasks.md` - Shared checklist
3. **PM reviews:** pm-overview.md (no code, functional only)
4. **Development agent:** Implements from implementation.md
   - `nextjs-development-standards` skill auto-activates
5. **Both track:** tasks.md checklist progress
6. **Quality check:** Before deployment
   - `code-quality-checklist` skill auto-activates

### Dev Docs Structure

For each feature in `dev/active/[feature-name]/`:
- **pm-overview.md** - Functional description, user flows, success criteria (no code)
- **implementation.md** - Current vs new code, file paths, technical notes (with code)
- **tasks.md** - Synchronized Phase → Task checklist

All three files use identical Phase → Task structure for synchronization.

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

### Hooks
- **UserPromptSubmit:** Haiku-based skill auto-activation
- **PostToolUse:** Auto-format on Write/Edit (Biome ultracite)

## Data Loading Patterns

Core functions from `lib/data.ts`:

```typescript
// All techniques (full data, 1.2MB)
await getAllTechniques()

// Metadata only (72% smaller, 340KB)
await getAllTechniquesMetadata()

// Single technique
await getTechnique(slug)

// Assurance goals
await getAssuranceGoals()

// Tags
await getTags()

// Pre-filtered data
await getCategoryData(goalSlug)
await getFilterData(category, tagSlug)
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

For comprehensive implementation guides:
- `.claude/skills/feature-planning/` - Planning workflow and templates
- `.claude/skills/nextjs-development-standards/` - Next.js patterns and examples
- `.claude/skills/code-quality-checklist/` - Quality standards and checklists

---

**Project Repository:** https://github.com/alan-turing-institute/tea-techniques
**Documentation:** This file + `.claude/skills/` + `CLAUDE.local.md`
**Last Updated:** 2025-11-13
