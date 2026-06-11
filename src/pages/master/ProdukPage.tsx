import { PageHeader } from "../../core/components/PageHeader";
import { PermissionGuard } from "../../core/components/PermissionGuard";
import { useLanguage } from "../../core/context/LanguageContext";

export function ProdukPage() {
  const { translate } = useLanguage();

  return (
    <PermissionGuard permission="master_produk">
      <PageHeader
        title={translate("pageProdukTitle")}
        subtitle={translate("pageProdukSubtitle")}
      />
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center sm:p-12 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-slate-500 dark:text-slate-400">
          {translate("comingSoon")}
        </p>
      </div>
    </PermissionGuard>
  );
}
