# UI Breakdown: Portfolio Overview

This document outlines the component structure for the Portfolio Overview page mockup. A detailed explanation of the trade-offs and state management strategy is provided in the Loom video linked in the main solutions README.

## Component Hierarchy

The page is broken down into a hierarchy of reusable and container components.

* **`PortfolioOverviewPage`** (Top-level container)
    * **`PageHeader`**: Contains the title and the `GlobalSearch` component.
    * **`ShareButton`**: A reusable button component.
    * **`StatsGrid`**: A layout container for the KPI cards.
        * **`KpiCard`** (Reusable): A card to display a single metric (e.g., "Total Applications"). It accepts props for title, value, and trend.
    * **`PortfolioTable`**: The main data table.
        * `TableHeader`
        * `TableBody`
            * `GroupRow` (e.g., "Rural Agri 1")
            * `SubgroupRow` (e.g., "Post-investment")
            * `CompanyRow`
                * **Reusable Cells:** `NameCell`, `MoneyCell`, `PercentCell`, `StatusBadge`, `DateCell`, `MetricCell`, `RiskFlagCell`.

## State Management

A React Context, **`PortfolioProvider`**, will act as a single source of truth, managing the shared state (like the search query and filtered data) and providing it to the `PageHeader`, `StatsGrid`, and `PortfolioTable` to keep them in sync.

