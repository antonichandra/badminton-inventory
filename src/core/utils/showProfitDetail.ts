export function showProfitDetail(role?: { name?: string } | null): boolean {
  return role?.name === "ADMIN" || role?.name === "SUPER_ADMIN";
}
