import { PageHeader } from "../../core/components/PageHeader";
import { PermissionGuard } from "../../core/components/PermissionGuard";
import { useLanguage } from "../../core/context/LanguageContext";

export function RolePage() {
  const { translate } = useLanguage();

  return (
    <PermissionGuard permission="master_role">
      <PageHeader
        title={translate("pageRoleTitle")}
        subtitle={translate("pageRoleSubtitle")}
      />
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center sm:p-12 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-slate-500 dark:text-slate-400">
          {translate("comingSoon")}
        </p>
      </div>
    </PermissionGuard>
  );
}
