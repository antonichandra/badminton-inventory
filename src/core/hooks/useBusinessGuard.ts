import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "../context/AuthContext";
import { navigateWithTransition } from "../utils/viewTransition";

export function useBusinessGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionToken, isApproved } = useAuth();

  const accessContext = useQuery(
    api.businessAccess.getAccessContext,
    sessionToken && isApproved ? { sessionToken } : "skip",
  );

  const isLoading = sessionToken !== null && isApproved && accessContext === undefined;
  const isExemptPath = location.pathname === "/business/new";

  useEffect(() => {
    if (!accessContext || isExemptPath) return;

    if (accessContext.shouldRedirectToAddBusiness) {
      navigateWithTransition(navigate, "/business/new", { replace: true });
    }
  }, [accessContext, isExemptPath, navigate]);

  return {
    isLoading,
    accessContext: accessContext ?? null,
  };
}
