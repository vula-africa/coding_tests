## What components I'd create

- **Components** - Parent folder/top-level folder
- **Header** - page title + search bar
- **KPISection** - kpi metrics
- **PortfolioTable** - company list

## How they connect to each other

```
Components
    Header
    KPISection
        KPICard  - Highly resuable
    PortfolioTable
        TableRow - Highly reusable and recursive
```






