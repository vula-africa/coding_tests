# Breakdown UI Challenge

## Component Breakdown – Portfolio Overview

### Page Layout 
- **AppLayout** (Acts as the global shell for the page)
  - **TopBar**
    - **BrandNav**
    - **PageActions** (like the 'Share' button)  
  - **PageHeader**
    - **PageTitle** ("Rural Agri Overview")  
    - **GlobalSearch** (filters all data)  

### KPI Section
- **KpiGrid** (Handles grid layout for KPI cards)
  - **KpiCard**
    - **Title**  
    - **Value**  
    - **Trend/Delta info**  
    - **Visual** checkmark / status tag  

### Portfolio Table
- **PortfolioTableSection**
  - **TableHeader** (Table Header titles: Name, Actual ROI, Projected ROI, Total Disbursed,...)  
  - **PortfolioGroupRow** (Group Row titles: Rural Agri 1, 10.4%, 10.5%, $3,305,000,...)  
    - **PortfolioSubgroupRow** (Subgroup Row title: Post-investment / Pre-investment)  
      - **CompanyRow**
        - **CellName**  
        - **CellPercent** (Actual / Projected ROI)  
        - **CellCurrency** (Disbursed / Outstanding)  
        - **CellStatus** ('Lending' / 'Completed')  
        - **CellDate** (End Date)  
        - **CellNumber** (Jobs Created, Children Educated, etc.)  
        - **CellMass** (CO₂, Tonnes Recycled)  
        - **CellFlag** (Risk Indicator)  


### How They Connect
- **GlobalSearch → PortfolioDataProvider**  
  Search input updates a shared state (context or parent). Both **KpiGrid** and **PortfolioTableSection** subscribe to this state, so filtered results stay consistent across KPIs and table.  

- **KpiGrid ↔ PortfolioTableSection**  
  KPIs are recalculated from the same filtered dataset the table displays. When rows change (search/filter), the KPI values update in sync.  

- **Group/Subgroup Rows ↔ CompanyRows**  
  Aggregated values in **PortfolioGroupRow** and **PortfolioSubgroupRow** are computed directly from their child **CompanyRow** items. This ensures group totals always reflect the companies inside them.  

- **Cells as Formatting Atoms**  
  Each column (ROI, currency, status, dates, numbers) is rendered through a reusable Cell. The same components are used in company rows and group summaries, guaranteeing consistent formatting.  

- **Edge States**  
  The **PortfolioDataProvider** also manages loading, empty, and error states. These flow down to render skeleton UIs, friendly empty states, or error messages in both KPIs and the table.  


### Reusability Highlights I've Noticed
- **KpiCard** → single reusable component for all metric boxes (slot-based, can include sparkline or status).  
- **CompanyRow** → schema-driven row; same structure for all companies, making column changes trivial.  
- **Cells** → atomic building blocks for formatting (currency, percent, date, status, risk flag, etc.)—shared across detail rows and group summaries. 
- **Group/Subgroup rows** → collapsible containers that aggregate child rows; can be reused for other grouped datasets.  
- **TableHeader** → schema-backed header ensures alignment, column reordering, and consistent formatting.  
- **AppLayout** → global wrapper ensures consistency across different pages, not just this one.  
- **Edge States** → handled by the shared data context (PortfolioDataProvider):  
  - Loading → KPI/Table skeletons  
  - Empty → “No results” + clear filters action  
  - Error → error banner with retry option  
