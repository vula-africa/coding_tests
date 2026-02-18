# Challenge: Clean up issues in task

## Issues and the fixes
### 1. Date calculation bug.
It was calculating seconds instead of milliseconds. I multiplied it by 1000 to convert it to milliseconds.

### 2. Logical error on dates
It was fetching records from between the 6th and 7th day. I made it fetch records that are older than 7 days as specified.

### 3. Foreign Key Constraint Issues
From the code new_corpus is a child of entity and could also be referencing publicFormsTokens therefore deleting publicFormsTokens before new_corpus will cause deletion failure. I moved new_corpus to be deleted before publicFormsTokens to respect child -> parent deletion policy.

### 4. For Loop N+1 Query Problem 
The for loop looping through the queryTokens will introduce a N+1 query problem as the system scales to tens of thousands of records. So I refactored it use the in-built SQL clause *WHERE IN* that handles bulk process for findMany and deleteMany 

### 5. Latency and Timeout risks when handling large Datasets
Handling large datasets (locking the table) to process all expired tokens in one cycle will lead to read-write issues, heavy CPU usage and potential crashes. So I introduced a chunking to handle 2000 records at a go.

### 6. Duplicate IDs in Queries
I expect the table *publicFormsTokens* to be many-to-many and therefore the query will return duplicate tokens and productIds. I introduced a Set to autofilter the productIds, entityIds and tokens.