import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuth } from "./AuthContext";

interface SwitcherBusiness {
  _id: Id<"businesses">;
  name: string;
  isDefault: boolean;
}

interface BusinessContextValue {
  businesses: SwitcherBusiness[];
  activeBusinessId: Id<"businesses"> | null;
  defaultBusinessId: Id<"businesses"> | null;
  activeBusiness: SwitcherBusiness | null;
  isLoading: boolean;
  showSwitcher: boolean;
  setActiveBusiness: (businessId: Id<"businesses">) => Promise<void>;
}

const BusinessContext = createContext<BusinessContextValue | null>(null);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { sessionToken, isApproved } = useAuth();
  const setActiveBusinessMutation = useMutation(api.businesses.setActiveBusiness);

  const switcherContext = useQuery(
    api.businesses.getSwitcherContext,
    sessionToken && isApproved ? { sessionToken } : "skip",
  );

  const setActiveBusiness = useCallback(
    async (businessId: Id<"businesses">) => {
      if (!sessionToken) return;
      await setActiveBusinessMutation({ sessionToken, businessId });
    },
    [sessionToken, setActiveBusinessMutation],
  );

  const businesses = switcherContext?.businesses ?? [];
  const activeBusinessId = switcherContext?.activeBusinessId ?? null;
  const activeBusiness =
    businesses.find((business) => business._id === activeBusinessId) ?? null;

  const value = useMemo<BusinessContextValue>(
    () => ({
      businesses,
      activeBusinessId,
      defaultBusinessId: switcherContext?.defaultBusinessId ?? null,
      activeBusiness,
      isLoading: sessionToken !== null && isApproved && switcherContext === undefined,
      showSwitcher: businesses.length > 1,
      setActiveBusiness,
    }),
    [
      businesses,
      activeBusinessId,
      switcherContext?.defaultBusinessId,
      activeBusiness,
      sessionToken,
      isApproved,
      switcherContext,
      setActiveBusiness,
    ],
  );

  return (
    <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error("useBusiness must be used within BusinessProvider");
  }
  return context;
}
