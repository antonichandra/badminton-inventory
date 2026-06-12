import { formatRoleName, roleBadgeVariant } from "../utils/formatRoleName";
import { Badge } from "./table/Badge";
import { UserAvatar } from "./UserAvatar";
import { cn } from "../utils/cn";

interface UserInfoRowProps {
  name: string;
  email?: string;
  picture?: string;
  roleName?: string;
  size?: "sm" | "md";
  className?: string;
}

export function UserInfoRow({
  name,
  email,
  picture,
  roleName,
  size = "md",
  className,
}: UserInfoRowProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <UserAvatar name={name} picture={picture} size={size} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
          {name}
        </p>
        {email && (
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {email}
          </p>
        )}
        {roleName && (
          <Badge variant={roleBadgeVariant(roleName)} className="mt-1">
            {formatRoleName(roleName)}
          </Badge>
        )}
      </div>
    </div>
  );
}
