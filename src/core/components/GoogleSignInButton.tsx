import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useEffect, useRef, useState } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const googleLayerRef = useRef<HTMLDivElement>(null);
  const [buttonWidth, setButtonWidth] = useState(320);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    console.log("[GoogleSignIn] mount", {
      hasClientId: Boolean(clientId),
      clientIdPrefix: clientId ? `${clientId.slice(0, 12)}...` : "missing",
      origin: window.location.origin,
    });

    if (!clientId) {
      console.error(
        "[GoogleSignIn] VITE_GOOGLE_CLIENT_ID is missing — Google login will not work.",
      );
    }
  }, [clientId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const width = Math.max(container.offsetWidth, 200);
      setButtonWidth(width);
      console.log("[GoogleSignIn] button width updated", width);
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (loading) return;

    const layer = googleLayerRef.current;
    if (!layer) return;

    const detectGoogleButton = () => {
      const googleButton = layer.querySelector(
        'div[role="button"], iframe',
      ) as HTMLElement | null;

      if (googleButton) {
        console.log("[GoogleSignIn] Google button rendered", {
          tag: googleButton.tagName,
          role: googleButton.getAttribute("role"),
        });
        return true;
      }

      return false;
    };

    if (detectGoogleButton()) return;

    console.log("[GoogleSignIn] waiting for Google button to render...");

    const observer = new MutationObserver(() => {
      detectGoogleButton();
    });

    observer.observe(layer, { childList: true, subtree: true });

    const timeout = window.setTimeout(() => {
      if (!detectGoogleButton()) {
        console.warn(
          "[GoogleSignIn] Google button not found after 5s — check client_id, origin, or ad blockers.",
        );
      }
    }, 5000);

    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
    };
  }, [loading, buttonWidth]);

  const handleSuccess = (response: CredentialResponse) => {
    console.log("[GoogleSignIn] credential received", {
      hasCredential: Boolean(response.credential),
    });
    onSuccess(response);
  };

  const handleError = () => {
    console.error("[GoogleSignIn] GoogleLogin onError fired");
    onError();
  };

  const buttonLabel = label ?? translate("loginButton");

  return (
    <div
      ref={containerRef}
      className={`relative ${fullWidth ? "w-full" : "inline-block"}`}
    >
      {/* Visual layer — same styling as before, not disabled */}
      <Button
        variant={variant}
        size={size}
        className={`pointer-events-none select-none ${fullWidth ? "w-full" : ""} ${className}`.trim()}
        loading={loading}
        leftIcon={!loading ? <GoogleIcon /> : undefined}
        type="button"
        tabIndex={-1}
        aria-hidden="true"
      >
        {buttonLabel}
      </Button>

      {/* Invisible click target — receives all pointer events */}
      {!loading && clientId && (
        <div
          ref={googleLayerRef}
          className="absolute inset-0 z-10 cursor-pointer overflow-hidden opacity-0"
          aria-label={buttonLabel}
        >
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={handleError}
            auto_select={false}
            theme="outline"
            size="large"
            text="continue_with"
            shape="rectangular"
            width={buttonWidth}
          />
        </div>
      )}
    </div>
  );
}
