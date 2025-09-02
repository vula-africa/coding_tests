/**
 * An interface representing a single funding application.
 * This ensures that any object we treat as a FundingApplication
 * will have these specific types, preventing common errors.
 */
export interface FundingApplication {
  id: string;
  borrowerName?: string;
  fundAmount: number;
}

/**
 * An interface for the summary object that our function will return.
 * Defining this helps ensure our function's output is always consistent.
 */
export interface Summary {
  totalApplications: number;
  flaggedApplications: number;
  averageAmount: number;
}

/**
 * Processes a batch of funding applications to generate a summary report.
 *
 * @param applications - An array of FundingApplication objects.
 * @returns A Summary object with statistics about the batch.
 * @throws An error if the input is not a valid array.
 */
export function processApplications(applications: FundingApplication[]): Summary {
  // Basic Error Handling: Check if the input is a usable array.
  if (!Array.isArray(applications)) {
    throw new Error("Invalid input: Expected an array of applications.");
  }

  const totalApplications = applications.length;

  // If the array is empty, we can return a zeroed-out summary
  // to avoid division by zero errors later.
  if (totalApplications === 0) {
    return {
      totalApplications: 0,
      flaggedApplications: 0,
      averageAmount: 0,
    };
  }

  let flaggedApplications = 0;
  let totalAmount = 0;

  // We loop through each application to check our conditions and sum the amounts.
  for (const app of applications) {
    // Flagging Condition 1: Missing borrower name.
    // We check for null, undefined, or an empty string.
    const isNameMissing = !app.borrowerName || app.borrowerName.trim() === '';

    // Flagging Condition 2: Funding amount is too high.
    const isAmountTooHigh = app.fundAmount > 50000;

    if (isNameMissing || isAmountTooHigh) {
      flaggedApplications++;
    }

    // We add the amount to our total for the average calculation.
    totalAmount += app.fundAmount;
  }

  // Calculate the average across ALL applications.
  const averageAmount = totalAmount / totalApplications;

  return {
    totalApplications,
    flaggedApplications,
    // It's good practice to round financial calculations to avoid floating point issues.
    averageAmount: Math.round(averageAmount * 100) / 100,
  };
}
