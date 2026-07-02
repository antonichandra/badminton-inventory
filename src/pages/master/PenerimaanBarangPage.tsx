import { PageHeader } from "../../core/components/PageHeader";
import { PageTopSection } from "../../core/components/PageTopSection";
import { PermissionGuard } from "../../core/components/PermissionGuard";
import { useAuth } from "../../core/context/AuthContext";
import { useLanguage } from "../../core/context/LanguageContext";
import { SupplierReceiptsPanel } from "./suppliers/SupplierReceiptsPanel";

function isAdminRole(roleName: string | undefined): boolean {
  return roleName === "ADMIN" || roleName === "SUPER_ADMIN";
}

export function PenerimaanBarangPage() {
  const { translate } = useLanguage();
  const { sessionToken, role } = useAuth();
  const canManage = isAdminRole(role?.name);

  return (
    <PermissionGuard permissions={["master_produk", "kasir"]}>
      <PageTopSection>
        <PageHeader
          embedded
          title={translate("penerimaanBarangTitle")}
          subtitle={translate("penerimaanBarangSubtitle")}
        />
      </PageTopSection>

      {sessionToken ? (
        <SupplierReceiptsPanel
          sessionToken={sessionToken}
          canManage={canManage}
        />
      ) : null}
    </PermissionGuard>
  );
}
