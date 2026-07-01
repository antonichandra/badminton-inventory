export interface StockCardFormItem {
  productId: string;
  productName: string;
  categoryId?: string;
  categoryName: string;
  unit: string;
  openingQty: number;
  receivedQty: number;
  writeOffQty: number;
  soldQty: number;
  expectedQty: number;
}

export interface StockCardSnapshotItemResult extends StockCardFormItem {
  countedQty: number;
  variance: number;
  missInputQty: number;
  overInputQty: number;
}

export function computeStockCardItemResult(
  formItem: StockCardFormItem,
  countedQty: number,
): StockCardSnapshotItemResult {
  const soldFromStock = Math.max(
    0,
    formItem.openingQty +
      formItem.receivedQty -
      countedQty -
      formItem.writeOffQty,
  );
  const missInputQty = Math.max(0, soldFromStock - formItem.soldQty);
  const overInputQty = Math.max(0, formItem.soldQty - soldFromStock);

  return {
    ...formItem,
    countedQty,
    variance: countedQty - formItem.expectedQty,
    missInputQty,
    overInputQty,
  };
}
