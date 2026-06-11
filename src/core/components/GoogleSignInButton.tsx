import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useRef } from "react";
import { useLanguage } from "../context/LanguageContext";
import { Button } from "./ui/Button";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface GoogleSignInButtonProps {
  onSuccess: (response: CredentialResponse) => void;
  onError: () => void;
  loading?: boolean;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  fullWidth?: boolean;
}

export function GoogleSignInButton({
  onSuccess,
  onError,
  loading = false,
  label,
  variant = "outline",
  size = "lg",
  className = "",
  fullWidth = true,
}: GoogleSignInButtonProps) {
  const { translate } = useLanguage();
  const hiddenContainerRef = useRef<HTMLDivElement>(null);

  const handleClick = () => {
    const googleButton = hiddenContainerRef.current?.querySelector(
      'div[role="button"]',
    ) as HTMLElement | null;
    googleButton?.click();
  };

  return (
    <div className={fullWidth ? "w-full" : ""}>
      <div
        ref={hiddenContainerRef}
        className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
        aria-hidden="true"
      >
        <GoogleLogin
          onSuccess={onSuccess}
          onError={onError}
          auto_select={false}
          theme="outline"
          size="large"
          text="signup_with"
          shape="rectangular"
          width="320"
        />
      </div>

      <Button
        variant={variant}
        size={size}
        className={`${fullWidth ? "w-full" : ""} ${className}`.trim()}
        onClick={handleClick}
        loading={loading}
        leftIcon={!loading ? <GoogleIcon /> : undefined}
      >
        {label ?? translate("loginButton")}
      </Button>
    </div>
  );
}
