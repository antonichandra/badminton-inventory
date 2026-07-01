export interface ShiftCashReconciliationInput {
  openingCash: number;
  closingCash: number;
  verifiedQris: number;
  cashIncome: number;
  expenses: number;
  deposits?: number;
  retailRevenue: number;
  rentalRevenue: number;
}

export interface ShiftCashReconciliationResult {
  totalSales: number;
  expectedCashInDrawer: number;
  cashVariance: number;
  totalExpected: number;
  totalActual: number;
  totalVariance: number;
  estimatedCashSales: number;
}

export function computeShiftCashReconciliation(
  input: ShiftCashReconciliationInput,
): ShiftCashReconciliationResult {
  const deposits = input.deposits ?? 0;
  const totalSales = input.retailRevenue + input.rentalRevenue;

  const expectedCashInDrawer =
    input.openingCash +
    totalSales +
    input.cashIncome -
    input.verifiedQris -
    input.expenses -
    deposits;

  const totalExpected =
    input.openingCash + totalSales + input.cashIncome - input.expenses - deposits;

  const totalActual = input.closingCash + input.verifiedQris;
  const cashVariance = input.closingCash - expectedCashInDrawer;
  const totalVariance = totalActual - totalExpected;
  const estimatedCashSales = Math.max(0, totalSales - input.verifiedQris);

  return {
    totalSales,
    expectedCashInDrawer,
    cashVariance,
    totalExpected,
    totalActual,
    totalVariance,
    estimatedCashSales,
  };
}
