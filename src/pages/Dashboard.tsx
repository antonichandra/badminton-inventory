import { BarChart3, Package, Shield, Users } from "lucide-react";
import { PageHeader } from "../core/components/PageHeader";
import { useAuth } from "../core/context/AuthContext";
import { useLanguage } from "../core/context/LanguageContext";
import type { TranslationKey } from "../core/i18n";

export function DashboardPage() {
  const { user, role } = useAuth();
  const { translate } = useLanguage();

  const stats: {
    id: string;
    labelKey: TranslationKey;
    value: string;
    icon: typeof Package;
    color: string;
  }[] = [
    {
      id: "statProducts",
      labelKey: "statProducts",
      value: translate("placeholderEmpty"),
      icon: Package,
      color: "bg-emerald-500",
    },
    {
      id: "statRoles",
      labelKey: "statRoles",
      value: role?.name ?? translate("placeholderEmpty"),
      icon: Shield,
      color: "bg-blue-500",
    },
    {
      id: "statAccounts",
      labelKey: "statAccounts",
      value: translate("placeholderEmpty"),
      icon: Users,
      color: "bg-violet-500",
    },
    {
      id: "statReports",
      labelKey: "statReports",
      value: translate("placeholderEmpty"),
      icon: BarChart3,
      color: "bg-amber-500",
    },
  ];

  return (
    <div>
      <PageHeader
        title={translate("dashboardTitle")}
        subtitle={translate("dashboardSubtitle")}
      />

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 sm:mb-8 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-base font-semibold text-slate-900 sm:text-lg dark:text-white">
          {translate("dashboardWelcome")}, {user?.name}!
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {translate("dashboardRoleLabel")}:{" "}
          <span className="font-medium text-emerald-600">{role?.name}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.id}
            className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.color} text-white`}
              >
                <stat.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                  {translate(stat.labelKey)}
                </p>
                <p className="truncate text-lg font-bold text-slate-900 sm:text-xl dark:text-white">
                  {stat.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
