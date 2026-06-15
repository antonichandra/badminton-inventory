import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const userStatus = v.union(
  v.literal("PENDING"),
  v.literal("APPROVED"),
  v.literal("REVOKED"),
);

export const themePreference = v.union(
  v.literal("light"),
  v.literal("dark"),
);

export const languagePreference = v.union(
  v.literal("ID"),
  v.literal("EN"),
);

export const businessMemberRole = v.union(
  v.literal("OWNER"),
  v.literal("STAFF"),
);

export const userPlanStatus = v.union(
  v.literal("ACTIVE"),
  v.literal("INACTIVE"),
);

export const staffInvitationStatus = v.union(
  v.literal("PENDING"),
  v.literal("ACCEPTED"),
  v.literal("EXPIRED"),
  v.literal("REVOKED"),
);

export const businessStatus = v.union(
  v.literal("ACTIVE"),
  v.literal("DELETE_REQUESTED"),
);

export const productType = v.union(v.literal("RETAIL"), v.literal("RENTAL"));

export const shiftStatus = v.union(
  v.literal("OPEN"),
  v.literal("CLOSE_PENDING"),
  v.literal("CLOSED"),
);

export const shiftCloseRequestStatus = v.union(
  v.literal("PENDING"),
  v.literal("APPROVED"),
  v.literal("REJECTED"),
);

export const shiftArchiveStatus = v.union(
  v.literal("ACTIVE"),
  v.literal("ARCHIVED"),
);

export const paymentStatus = v.union(v.literal("UNPAID"), v.literal("PAID"));

export const supplierPaymentStatus = v.union(
  v.literal("UNPAID"),
  v.literal("PAID"),
);

export const paymentMethod = v.union(v.literal("CASH"), v.literal("QRIS"));

export const cashEntryType = v.union(v.literal("EXPENSE"), v.literal("DEPOSIT"));

export const stockMovementType = v.union(
  v.literal("SALE"),
  v.literal("RECEIPT"),
  v.literal("WRITEOFF"),
  v.literal("OPENING"),
  v.literal("CLOSE_COUNT"),
  v.literal("CONSUMPTION"),
  v.literal("ADJUSTMENT"),
);

const priceTierEntry = v.object({
  productId: v.id("products"),
  productName: v.string(),
  unitPrice: v.number(),
  qty: v.number(),
  revenue: v.number(),
  productType: v.optional(productType),
  rentalHoursTotal: v.optional(v.number()),
  cogs: v.optional(v.number()),
  grossProfit: v.optional(v.number()),
});

const topProductEntry = v.object({
  productId: v.id("products"),
  productName: v.string(),
  qty: v.number(),
  revenue: v.number(),
  cogs: v.optional(v.number()),
  grossProfit: v.optional(v.number()),
});

const stockReconEntry = v.object({
  productId: v.id("products"),
  productName: v.string(),
  openingQty: v.number(),
  receivedQty: v.number(),
  soldQtyFromLines: v.number(),
  soldQtyFromStock: v.number(),
  closingQty: v.number(),
  writeOffQty: v.number(),
  qtyVariance: v.number(),
  overInputQty: v.number(),
  missInputQty: v.number(),
});

const closingStockEntry = v.object({
  productId: v.id("products"),
  qty: v.number(),
});

const rollupProductEntry = v.object({
  productId: v.id("products"),
  qty: v.number(),
  revenue: v.number(),
  cogs: v.number(),
});

export default defineSchema({
  roles: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    acl: v.array(v.string()),
    isSystem: v.boolean(),
  }).index("by_name", ["name"]),

  users: defineTable({
    email: v.string(),
    name: v.string(),
    picture: v.optional(v.string()),
    googleId: v.string(),
    status: userStatus,
    roleId: v.id("roles"),
    theme: themePreference,
    language: languagePreference,
    defaultBusinessId: v.optional(v.id("businesses")),
    activeBusinessId: v.optional(v.id("businesses")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_googleId", ["googleId"])
    .index("by_roleId", ["roleId"]),

  plans: defineTable({
    name: v.string(),
    maxBusiness: v.number(),
    maxStaff: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_name", ["name"]),

  userPlans: defineTable({
    userId: v.id("users"),
    planId: v.id("plans"),
    assignedBy: v.optional(v.id("users")),
    status: userPlanStatus,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"]),

  sports: defineTable({
    name: v.string(),
    slug: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
  }).index("by_slug", ["slug"]),

  businesses: defineTable({
    name: v.string(),
    sportId: v.id("sports"),
    phone: v.optional(v.string()),
    address: v.string(),
    ownerId: v.id("users"),
    status: v.optional(businessStatus),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_ownerId", ["ownerId"])
    .index("by_sportId", ["sportId"])
    .index("by_status", ["status"]),

  businessMembers: defineTable({
    businessId: v.id("businesses"),
    userId: v.id("users"),
    role: businessMemberRole,
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_businessId", ["businessId"])
    .index("by_business_and_user", ["businessId", "userId"]),

  staffInvitations: defineTable({
    businessId: v.id("businesses"),
    email: v.string(),
    token: v.string(),
    status: staffInvitationStatus,
    invitedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_businessId", ["businessId"])
    .index("by_email", ["email"])
    .index("by_token", ["token"])
    .index("by_business_and_email", ["businessId", "email"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),

  products: defineTable({
    businessId: v.id("businesses"),
    name: v.string(),
    type: productType,
    sellPrice: v.number(),
    rentalPricePerHour: v.optional(v.number()),
    unit: v.string(),
    trackExpiry: v.optional(v.boolean()),
    defaultUnitCost: v.optional(v.number()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_businessId", ["businessId"])
    .index("by_business_and_name", ["businessId", "name"]),

  sellPriceHistory: defineTable({
    productId: v.id("products"),
    businessId: v.id("businesses"),
    price: v.number(),
    effectiveAt: v.number(),
    changedBy: v.id("users"),
    priceKind: v.optional(v.union(v.literal("RETAIL"), v.literal("RENTAL"))),
    shiftId: v.optional(v.id("shifts")),
  })
    .index("by_productId", ["productId"])
    .index("by_businessId", ["businessId"]),

  suppliers: defineTable({
    businessId: v.id("businesses"),
    name: v.string(),
    description: v.optional(v.string()),
    contact: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_businessId", ["businessId"])
    .index("by_business_and_name", ["businessId", "name"]),

  shifts: defineTable({
    businessId: v.id("businesses"),
    status: shiftStatus,
    openedBy: v.id("users"),
    assignedStaffId: v.optional(v.id("users")),
    closedBy: v.optional(v.id("users")),
    openedAt: v.number(),
    closedAt: v.optional(v.number()),
    openingCash: v.number(),
    closingCash: v.optional(v.number()),
    closingQris: v.optional(v.number()),
    archiveStatus: v.optional(shiftArchiveStatus),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_businessId", ["businessId"])
    .index("by_business_and_status", ["businessId", "status"]),

  shiftStockSnapshots: defineTable({
    shiftId: v.id("shifts"),
    productId: v.id("products"),
    openingQty: v.number(),
    closingQty: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_shiftId", ["shiftId"])
    .index("by_shift_and_product", ["shiftId", "productId"]),

  saleLines: defineTable({
    shiftId: v.id("shifts"),
    businessId: v.id("businesses"),
    productId: v.id("products"),
    groupLabel: v.optional(v.string()),
    customerNote: v.optional(v.string()),
    rentalDescription: v.optional(v.string()),
    qty: v.number(),
    rentalHours: v.optional(v.number()),
    unitPrice: v.number(),
    lineTotal: v.number(),
    cogsTotal: v.optional(v.number()),
    paymentStatus: paymentStatus,
    paymentMethod: v.optional(paymentMethod),
    paymentBatchId: v.optional(v.string()),
    paidAt: v.optional(v.number()),
    recordedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_shiftId", ["shiftId"])
    .index("by_businessId", ["businessId"])
    .index("by_paymentBatchId", ["paymentBatchId"]),

  paymentBatches: defineTable({
    batchId: v.string(),
    shiftId: v.id("shifts"),
    businessId: v.id("businesses"),
    paymentMethod: paymentMethod,
    total: v.number(),
    amountReceived: v.optional(v.number()),
    changeAmount: v.optional(v.number()),
    paidAt: v.number(),
    recordedBy: v.id("users"),
  })
    .index("by_batchId", ["batchId"])
    .index("by_shiftId", ["shiftId"]),

  cashEntries: defineTable({
    shiftId: v.id("shifts"),
    businessId: v.id("businesses"),
    type: cashEntryType,
    amount: v.number(),
    note: v.string(),
    recordedBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_shiftId", ["shiftId"])
    .index("by_businessId", ["businessId"]),

  stockMovements: defineTable({
    shiftId: v.id("shifts"),
    businessId: v.id("businesses"),
    productId: v.id("products"),
    type: stockMovementType,
    qty: v.number(),
    note: v.optional(v.string()),
    refId: v.optional(v.string()),
    recordedBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_shiftId", ["shiftId"])
    .index("by_business_and_product", ["businessId", "productId"])
    .index("by_shift_and_product", ["shiftId", "productId"]),

  stockReceipts: defineTable({
    shiftId: v.id("shifts"),
    businessId: v.id("businesses"),
    supplierId: v.id("suppliers"),
    note: v.optional(v.string()),
    totalAmount: v.optional(v.number()),
    dueAt: v.optional(v.number()),
    supplierPaymentStatus: v.optional(supplierPaymentStatus),
    paidAt: v.optional(v.number()),
    markedPaidBy: v.optional(v.id("users")),
    recordedBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_shiftId", ["shiftId"])
    .index("by_businessId", ["businessId"])
    .index("by_business_and_paymentStatus", [
      "businessId",
      "supplierPaymentStatus",
    ]),

  stockReceiptItems: defineTable({
    receiptId: v.id("stockReceipts"),
    businessId: v.id("businesses"),
    productId: v.id("products"),
    supplierId: v.id("suppliers"),
    qty: v.number(),
    qtyRemaining: v.number(),
    unitCost: v.number(),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_receiptId", ["receiptId"])
    .index("by_businessId", ["businessId"])
    .index("by_business_and_product", ["businessId", "productId"]),

  supplierCostHistory: defineTable({
    productId: v.id("products"),
    businessId: v.id("businesses"),
    supplierId: v.id("suppliers"),
    unitCost: v.number(),
    qty: v.number(),
    receiptId: v.id("stockReceipts"),
    effectiveAt: v.number(),
  })
    .index("by_productId", ["productId"])
    .index("by_businessId", ["businessId"]),

  saleLineCostLots: defineTable({
    saleLineId: v.id("saleLines"),
    receiptItemId: v.id("stockReceiptItems"),
    qty: v.number(),
    unitCost: v.number(),
  }).index("by_saleLineId", ["saleLineId"]),

  shiftSummaries: defineTable({
    shiftId: v.id("shifts"),
    businessId: v.id("businesses"),
    closedAt: v.number(),
    totalRevenue: v.number(),
    totalCogs: v.number(),
    grossProfit: v.number(),
    cashSales: v.number(),
    qrisSales: v.number(),
    expenses: v.number(),
    deposits: v.number(),
    variance: v.number(),
    totalSales: v.optional(v.number()),
    verifiedQris: v.optional(v.number()),
    reportedCash: v.optional(v.number()),
    expectedCashInDrawer: v.optional(v.number()),
    cashVariance: v.optional(v.number()),
    totalVariance: v.optional(v.number()),
    overInputQtyTotal: v.optional(v.number()),
    missInputQtyTotal: v.optional(v.number()),
    recordedCashSales: v.optional(v.number()),
    recordedQrisSales: v.optional(v.number()),
    salesByPriceTier: v.array(priceTierEntry),
    topProducts: v.array(topProductEntry),
    stockReconciliation: v.array(stockReconEntry),
    createdAt: v.number(),
  })
    .index("by_shiftId", ["shiftId"])
    .index("by_businessId", ["businessId"]),

  shiftCloseRequests: defineTable({
    shiftId: v.id("shifts"),
    businessId: v.id("businesses"),
    status: shiftCloseRequestStatus,
    submittedBy: v.id("users"),
    submittedAt: v.number(),
    reportedCash: v.number(),
    closingStock: v.array(closingStockEntry),
    staffNote: v.optional(v.string()),
    verifiedQris: v.optional(v.number()),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    adminNote: v.optional(v.string()),
  })
    .index("by_shiftId", ["shiftId"])
    .index("by_business_and_status", ["businessId", "status"]),

  shiftCogsLots: defineTable({
    shiftId: v.id("shifts"),
    businessId: v.id("businesses"),
    productId: v.id("products"),
    receiptItemId: v.optional(v.id("stockReceiptItems")),
    qty: v.number(),
    unitCost: v.number(),
    isEstimated: v.boolean(),
  }).index("by_shiftId", ["shiftId"]),

  businessDailyRollups: defineTable({
    businessId: v.id("businesses"),
    date: v.string(),
    totalRevenue: v.number(),
    totalCogs: v.number(),
    grossProfit: v.number(),
    byProduct: v.array(rollupProductEntry),
    updatedAt: v.number(),
  })
    .index("by_businessId", ["businessId"])
    .index("by_business_and_date", ["businessId", "date"]),
});
