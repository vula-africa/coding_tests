# Portfolio Overview - Component Breakdown

## Component Hierarchy

```
PortfolioOverviewPage
├── Header
│   ├── PageTitle
│   └── SearchBar
├── KPISection
│   └── KPICard (reusable)
├── PortfolioTable
│   ├── TableHeader
│   ├── GroupRow (reusable)
│   └── CompanyRow (reusable)
└── LoadingSpinner (conditional)
```

## Component Details

### **1. PortfolioOverviewPage** (Container)
- **Purpose**: Main page container, manages state and data fetching
- **Props**: None (top-level component)
- **State**: `companies[]`, `kpis[]`, `searchTerm`, `loading`
- **Responsibilities**: 
  - Fetch portfolio data
  - Handle search filtering
  - Pass data down to child components

### **2. Header** (Layout)
- **Purpose**: Top section with title and search
- **Props**: `searchTerm`, `onSearchChange`
- **Children**: PageTitle, SearchBar

### **3. PageTitle** (Presentational)
- **Purpose**: Display "Portfolio Overview" heading
- **Props**: `title` (string)
- **Reusable**: Yes - could be used across different pages

### **4. SearchBar** (Interactive)
- **Purpose**: Filter all portfolio data
- **Props**: `value`, `onChange`, `placeholder`
- **Reusable**: Yes - standard input component
- **Features**: Real-time filtering, clear button

### **5. KPISection** (Container)
- **Purpose**: Display key metrics in a row
- **Props**: `kpis[]`
- **Children**: Multiple KPICard components

### **6. KPICard** (Reusable)
- **Purpose**: Display individual metric
- **Props**: `title`, `value`, `change`, `trend`
- **Reusable**: Yes - used for each KPI metric
- **Variants**: Could support different value types (currency, percentage, count)

### **7. PortfolioTable** (Complex Container)
- **Purpose**: Main data display with companies and groups
- **Props**: `companies[]`, `searchTerm`
- **Children**: TableHeader, GroupRow[], CompanyRow[]
- **Features**: 
  - Grouping logic
  - Sorting capabilities
  - Responsive design

### **8. TableHeader** (Layout)
- **Purpose**: Column headers with sorting
- **Props**: `columns[]`, `sortBy`, `onSort`
- **Features**: Sortable columns, proper accessibility

### **9. GroupRow** (Reusable)
- **Purpose**: Aggregated data for company groups
- **Props**: `groupName`, `totalInvestment`, `companyCount`, `avgMetrics`
- **Reusable**: Yes - any grouped data display
- **Features**: Expand/collapse functionality

### **10. CompanyRow** (Reusable)
- **Purpose**: Individual company data
- **Props**: `company` (object with name, investment, metrics)
- **Reusable**: Yes - could be used in other company lists
- **Features**: Action buttons, status indicators

## Key Reusability Patterns

### **1. Data Display Components**
- `KPICard` - Any metric display across the app
- `CompanyRow` - Any company listing feature
- `SearchBar` - Any search functionality

### **2. Layout Components**
- `Header` - Consistent page headers
- `PageTitle` - Standardized page titles
- `TableHeader` - Any data table implementation

### **3. Utility Components**
- `LoadingSpinner` - Any loading state
- `GroupRow` - Any grouped data visualization

## Trade-offs Made

### **Chosen: Separate SearchBar vs. Integrated Header Search**
**Decision**: Created separate `SearchBar` component instead of building search into `Header`

**Why**: 
- **Reusability**: SearchBar can be used in other contexts (modal searches, filters)
- **Testing**: Easier to unit test search logic in isolation
- **Flexibility**: Can easily move search position without restructuring Header

**Trade-off**: Slightly more props drilling, but gains modularity and reusability

### **Component Granularity**
**Decision**: Split into smaller, focused components rather than fewer large ones

**Benefits**: Better reusability, easier testing, clearer responsibilities
**Cost**: More props drilling, slightly more complexity

This structure balances reusability with simplicity while maintaining clear separation of concerns.
