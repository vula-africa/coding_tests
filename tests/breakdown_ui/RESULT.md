# Portfolio Overview - Component Breakdown (Atomic Design)

## Component Hierarchy Diagram

```
PortfolioOverviewPage (Page)
│
└── DashboardTemplate (Template)
    │
    ├── Header (Organism)
    │   ├── Text (Atom) ← Page title
    │   ├── Input (Atom) ← Search input with leftIcon & rightElement
    │   └── Button (Atom) ← Share button with icon
    │
    ├── KPISection (Organism)
    │   └── KPICard (Molecule) x7
    │       ├── Sparkline (Atom)
    │       ├── Text (Atom) x3 (title, value, label)
    │       └── TrendIndicator (Atom)
    │
    └── PortfolioTable (Organism)
        ├── TableHeader (Molecule)
        │   └── TableCell (Atom) x[columns] + Text (Atom) + Lucide Icon (sort indicator)
        │
        └── GroupRow (Molecule) x[groups]
            │
            ├── SubGroupRow (Molecule) x[subgroups]
            │   │
            │   └── CompanyRow (Molecule) x[companies]
            │       ├── Text (Atom) ← Company name
            │       ├── TableCell (Atom) x[columns]
            │       ├── StatusBadge (Atom)
            │       └── Lucide Icon (Flag/AlertTriangle) ← Direct import, not atom
            │
            └── CompanyRow (Molecule) x[companies] ← Can also be direct child
```

---

## Folder Structure

```
src/
├── components/
│   ├── atoms/
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   └── index.ts
│   │   ├── Input/
│   │   │   ├── Input.tsx
│   │   │   └── index.ts
│   │   ├── Text/
│   │   │   ├── Text.tsx
│   │   │   └── index.ts
│   │   ├── Sparkline/
│   │   │   ├── Sparkline.tsx
│   │   │   └── index.ts
│   │   ├── StatusBadge/
│   │   │   ├── StatusBadge.tsx
│   │   │   └── index.ts
│   │   ├── TableCell/
│   │   │   ├── TableCell.tsx
│   │   │   └── index.ts
│   │   └── TrendIndicator/
│   │       ├── TrendIndicator.tsx
│   │       └── index.ts
│   │
│   ├── molecules/
│   │   ├── KPICard/
│   │   │   ├── KPICard.tsx
│   │   │   └── index.ts
│   │   ├── TableHeader/
│   │   │   ├── TableHeader.tsx
│   │   │   └── index.ts
│   │   ├── GroupRow/
│   │   │   ├── GroupRow.tsx
│   │   │   └── index.ts
│   │   ├── SubGroupRow/
│   │   │   ├── SubGroupRow.tsx
│   │   │   └── index.ts
│   │   └── CompanyRow/
│   │       ├── CompanyRow.tsx
│   │       └── index.ts
│   │
│   ├── organisms/
│   │   ├── Header/
│   │   │   ├── Header.tsx
│   │   │   └── index.ts
│   │   ├── KPISection/
│   │   │   ├── KPISection.tsx
│   │   │   └── index.ts
│   │   └── PortfolioTable/
│   │       ├── PortfolioTable.tsx
│   │       └── index.ts
│   │
│   └── templates/
│       └── DashboardTemplate/
│           ├── DashboardTemplate.tsx
│           └── index.ts
│
└── pages/
    └── PortfolioOverviewPage/
        ├── PortfolioOverviewPage.tsx
        └── index.ts
```

## Key Design Decisions

### 1. Single KPICard Component

- All 7 KPI cards use the same structure
- Only data and optional `status` prop differ
- Single source of truth for styling

### 2. Flexible Input Atom

- Accepts `leftIcon` and `rightElement` as props
- No separate SearchInput molecule needed
- Works for search, forms, and filters

### 3. Hierarchical Table Rows

- `GroupRow` contains `SubGroupRow[]` or `CompanyRow[]` as children
- `SubGroupRow` contains `CompanyRow[]` as children
- Clear parent-child relationships match visual hierarchy

### 4. Direct Icon Usage

- Lucide icons (Flag, AlertTriangle, etc.) imported directly
- No wrapper atoms for simple icons
- Reduces component count and complexity

---
