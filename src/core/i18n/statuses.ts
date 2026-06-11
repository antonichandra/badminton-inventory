import type { TranslationKey } from "./index";

export type UserStatusKey = "PENDING" | "APPROVED" | "REVOKED";
export type BusinessStatusKey = "ACTIVE" | "DELETE_REQUESTED";
export type StaffDisplayStatusKey =
  | "PENDING"
  | "APPROVED"
  | "REVOKED"
  | "EXPIRED";

const USER_STATUS_KEYS: Record<UserStatusKey, TranslationKey> = {
  PENDING: "statusUserPending",
  APPROVED: "statusUserApproved",
  REVOKED: "statusUserRevoked",
};

const BUSINESS_STATUS_KEYS: Record<BusinessStatusKey, TranslationKey> = {
  ACTIVE: "businessStatusActive",
  DELETE_REQUESTED: "businessStatusDeleteRequested",
};

const STAFF_STATUS_KEYS: Record<StaffDisplayStatusKey, TranslationKey> = {
  PENDING: "statusStaffPending",
  APPROVED: "statusStaffApproved",
  REVOKED: "statusStaffRevoked",
  EXPIRED: "statusStaffExpired",
};

export function translateUserStatus(
  translate: (key: TranslationKey) => string,
  status: UserStatusKey,
): string {
  return translate(USER_STATUS_KEYS[status]);
}

export function translateBusinessStatus(
  translate: (key: TranslationKey) => string,
  status: BusinessStatusKey,
): string {
  return translate(BUSINESS_STATUS_KEYS[status]);
}

export function translateStaffStatus(
  translate: (key: TranslationKey) => string,
  status: StaffDisplayStatusKey,
): string {
  return translate(STAFF_STATUS_KEYS[status]);
}

export function buildUserStatusOptions(
  translate: (key: TranslationKey) => string,
): { value: UserStatusKey; label: string }[] {
  return (Object.keys(USER_STATUS_KEYS) as UserStatusKey[]).map((status) => ({
    value: status,
    label: translateUserStatus(translate, status),
  }));
}

export function buildBusinessStatusOptions(
  translate: (key: TranslationKey) => string,
): { value: BusinessStatusKey; label: string }[] {
  return (Object.keys(BUSINESS_STATUS_KEYS) as BusinessStatusKey[]).map(
    (status) => ({
      value: status,
      label: translateBusinessStatus(translate, status),
    }),
  );
}
