import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./core/context/AuthContext";
import { LanguageProvider } from "./core/context/LanguageContext";
import { ThemeProvider } from "./core/context/ThemeContext";
import { ToastProvider } from "./core/context/ToastContext";
import { ErrorBoundary } from "./core/components/ErrorBoundary";
import "./index.css";
import App from "./App.tsx";

document.documentElement.classList.remove("dark");

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <GoogleOAuthProvider clientId={googleClientId}>
        <AuthProvider>
          <LanguageProvider>
            <ThemeProvider>
              <ToastProvider>
                <ErrorBoundary>
                  <App />
                </ErrorBoundary>
              </ToastProvider>
            </ThemeProvider>
          </LanguageProvider>
        </AuthProvider>
      </GoogleOAuthProvider>
    </ConvexProvider>
  </StrictMode>,
);
