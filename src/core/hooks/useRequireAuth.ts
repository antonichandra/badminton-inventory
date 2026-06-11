import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { navigateWithTransition } from "../utils/viewTransition";

type AuthRequirement = "guest" | "pending" | "approved";

export function useRequireAuth(requirement: AuthRequirement) {
  const navigate = useNavigate();
  const { isLoading, isAuthenticated, isApproved, user } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (requirement === "guest") {
      if (isAuthenticated && isApproved) {
        navigateWithTransition(navigate, "/dashboard", { replace: true });
      } else if (isAuthenticated && user?.status === "PENDING") {
        navigateWithTransition(navigate, "/waiting-approval", { replace: true });
      }
      return;
    }

    if (!isAuthenticated) {
      navigateWithTransition(navigate, "/login", { replace: true });
      return;
    }

    if (user?.status === "REVOKED") {
      navigateWithTransition(navigate, "/login", { replace: true });
      return;
    }

    if (requirement === "pending" && isApproved) {
      navigateWithTransition(navigate, "/dashboard", { replace: true });
      return;
    }

    if (requirement === "approved" && !isApproved) {
      navigateWithTransition(navigate, "/waiting-approval", { replace: true });
    }
  }, [isLoading, isAuthenticated, isApproved, user, requirement, navigate]);

  return { isLoading, isAuthenticated, isApproved, user };
}
