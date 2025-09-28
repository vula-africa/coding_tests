## Reusable Components

### 1. Button
* Props  
  * Name
  * Icon
### 2. SearchBar
* Props 
  * Placeholder
  * Icon
### 3. Metrics Card
* Props
    * Title
    * Subtitle
    * Number or Percentage
    * Comparsion with previous data
    * Dataset - For the trend graph
### 4. Portfolio Table
* Table Header
  * Props Needed
    * Column Names - []
* Table Body
  * Props Needed
    * Children - Group Rows []
* Group Rows
  * Props Needed 
    * Children - Subgroup Rows []
    * Group Name 
    * AggregatedData - Must match the column names
* Subgroup Rows
  * Props Needed
    * Children - DataRow []
    * Subgroup Name
* DataRow
  * Props Needed
      * Values - Must match those of the columns of the table header
      * DataRow Name
* Data Cell
  * Props Needed
    * Font size, colors 



## Portfolio Overview Page

### Section 1 - Header

* Title
  * Rural Agri Overview
* SearchBar
  * props 
    * Placeholder - Search or ask question
    * Icon - Search Icon
* Button 
  * props
    * Icon - share
    * Name - Share
### Section 2 - KPI Section
* KPI Card ( which is metrics card)
  * props ( 1 example)
    * Title - Total Funding Applications
    * Number - 178 ( Direction can be determined from this value)
    * Subtitle - applications received
    * Comparsion with previous data - +8% vs last quarter
    * Dataset
### Section 3 - Table
* Table Header
  * props needed
    * columns : [Name, Actual ROI, .... , Currency Risk Flag]
* Table Body
  * props needed
    * children : [ { name: "Rural Agri1" }, children: [{name:Post Investment, ....]]



## Tree Structure
```

Portfolio Overview Page
├── Header
│   ├── Title
│   ├── SearchBar
│   └── Button
├── Kpi Section
│   └── Metrics Cards 
└── PortfolioTable
    ├── Table Header
    └── Table Body
        ├── Group Rows (e.g., "Rural Agri 1")
        │   ├── Subgroup Rows (e.g., "Post-Investment", ...")
        │   │   └── DataRow (e.g., "Sevi",...)
        │   └── SubGroupRow 
        └── GroupRow ..       
```

### One Tradeoff made
- Choose to have Group, Subgroup and DataRows, instead of single component
- This increases number of components, and complexity (for small data) but it is going to be scalable, and its going to be easier to read

