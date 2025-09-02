// We still use "type" here because it's good practice under "strict" mode.
import { processApplications, type FundingApplication } from './batchProcessor';

// Sample data that matches the problem description
const sampleApplications: FundingApplication[] = [
  { id: 'app-001', borrowerName: 'Fitsum Tola', fundAmount: 25000 },
  { id: 'app-002', fundAmount: 60000 },
  { id: 'app-003', borrowerName: 'Kokou Elvis', fundAmount: 40000 },
  { id: 'app-004', borrowerName: '   ', fundAmount: 30000 },
  { id: 'app-005', borrowerName: 'Ermias Hiwot', fundAmount: 90000 },
];

console.log("Processing batch of applications...");

try {
  const summary = processApplications(sampleApplications);

  console.log("\n--- Processing Summary ---");
  console.log(`Total Applications: ${summary.totalApplications}`);
  console.log(`Flagged Applications: ${summary.flaggedApplications}`);
  console.log(`Average Fund Amount: $${summary.averageAmount.toFixed(2)}`);
  console.log("------------------------\n");

} catch (error) {
  // Check if the error is a real Error object before accessing .message
  if (error instanceof Error) {
    console.error("An error occurred:", error.message);
  } else {
    console.error("An unexpected error occurred:", error);
  }
}

// Test with empty array which could be one of the edge case!
console.log("Processing an empty batch...");
const emptySummary = processApplications([]);
console.log("Empty batch summary:", emptySummary);

