import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { applyOpeningStockToBook } from "./openingStockHelpers";

/**
 * Re-applies each snapshot openingQty to pre-shift book stock only.
 * Current-shift penerimaan is never modified. Safe to run repeatedly
 * (idempotent) — also corrects shifts opened with the old "add full
 * Saldo Awal" bug.
 */
export async function syncOpenShiftOpeningStock(
  ctx: MutationCtx,
  shift: Doc<"shifts">,
  recordedBy: Id<"users">,
) {
  if (shift.status !== "OPEN") {
    throw new Error("SHIFT_NOT_OPEN");
  }

  const snapshots = await ctx.db
    .query("shiftStockSnapshots")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shift._id))
    .collect();

  for (const snapshot of snapshots) {
    await applyOpeningStockToBook(ctx, {
      shiftId: shift._id,
      businessId: shift.businessId,
      productId: snapshot.productId,
      qty: snapshot.openingQty,
      recordedBy,
    });
  }

  return { syncedProducts: snapshots.length };
}
