import { useEffect, useState } from "react";
import { cn } from "../utils/cn";

type AvatarSize = "sm" | "md" | "lg";

interface UserAvatarProps {
  name: string;
  picture?: string;
  size?: AvatarSize;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-sm",
  md: "h-9 w-9 text-xs",
  lg: "h-11 w-11 text-sm",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (
    parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}

export function UserAvatar({
  name,
  picture,
  size = "md",
  className,
}: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [picture]);

  const showImage = Boolean(picture?.trim()) && !imageFailed;

  if (showImage) {
    return (
      <img
        src={picture}
        alt={name}
        onError={() => setImageFailed(true)}
        className={cn(
          "shrink-0 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700",
          sizeClasses[size],
          className,
        )}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-emerald-600 font-bold text-white",
        sizeClasses[size],
        className,
      )}
    >
      {getInitials(name)}
    </div>
  );
}
