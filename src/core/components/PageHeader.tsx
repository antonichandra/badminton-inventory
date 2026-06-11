interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="mb-5 sm:mb-8">
      <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      )}
    </div>
  );
}
