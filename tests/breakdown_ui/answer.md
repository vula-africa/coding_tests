## Sections on the Breakdown UI page

1. **Header**: Title (Rural Agri Overview), search bar, and share button.
2. **KPI Cards**: Display key performance indicators relevant to the company, with trends or charts where applicable.
3. **Table**: Presents detailed data in a structured, grouped format with expandable sections.

### 1. Header

The header displays the title "Rural Agri Overview", includes a search bar for filtering/querying data, and a share button for exporting or sharing the view.

### 2. KPI Cards

The KPI cards display key performance indicators relevant to the company, providing insights into important metrics. Cards can include backdrop charts to show trends over time.

### 3. Table

The table presents detailed data in a structured, hierarchical format with grouping:

- Grouped rows (e.g., "Rural Agri 1") that appear expandable/collapsible.
- Sub-group headers (e.g., "Post-Investment") that categorize child rows without data.
- Individual company rows (e.g., "Sevi") with data across columns.

## Components

Here are the components I would create.

- `PortfolioOverview`: The top-level page component. Serves as the container that fetches data and passes it down to children. Renders Header, KpiContainer, and PortfolioTable. Not reusable as it is page-specific.
- `Header`: Displays the title, search bar, and share button. Passes (updates) search input to parent for filtering. Reusable across dashboard pages with props for title and actions.
  - `Title`: Simple text display for the page title.
  - `SearchBar`: Input field for searches/questions, with event handlers for filtering.
  - `ShareButton`: Button for sharing/exporting.
- `KpiContainer`: A responsive grid container for laying out multiple KPI cards. Receives array of KPI data from parent and maps to KpiCard. Reusable for any grid of cards.
  - `KpiCard`: Individual card displaying a metric (title, value, subtitle, optional chart, change with previous period, icons). Receives props for data and variant. Reusable for dashboards or reports.
- `PortfolioTable`: The main table component handling structure and state (e.g., expansion, sorting). Receives filtered data from parent(Portfolio Overview). Reusable for similar data tables with grouping.
  - `TableHeader`: Renders the column headers in a fixed row. Static or with sortable props.
  - `TableBody`: Container for all rows, handling mapping over grouped data.
    - `GroupRow`: Represents top-level expandable groups (e.g., "Rural Agri 1"). Manages collapse state and renders children (SubGroupRow or CompanyRow). Receives group data and children. 
    - `SubGroupRow`: Simple row for sub-headers (e.g., "Post-Investment") without data cells, just the name. Receives label and children.
    - `CompanyRow`: Standard row for individual companies, rendering cells for each column. Receives row data.
      - `TableCell`: Cell component for rendering content (text, icons, colors). Used within rows. Highly reusable.

## Hierarchy Diagram

```
PortfolioOverview
├── Header
│   ├── Title
│   ├── SearchBar
│   └── ShareButton
├── KpiContainer
│   └── KpiCard (multiple instances)
└── PortfolioTable
    ├── TableHeader
    └── TableBody
        ├── GroupRow (e.g., "Rural Agri 1")
            ├── SubGroupRow (e.g., "Post-Investment", "Pre-Investment")
            │   └── CompanyRow (e.g., "Sevi", "Vetstark", etc.)
            └── SubGroupRow     
```