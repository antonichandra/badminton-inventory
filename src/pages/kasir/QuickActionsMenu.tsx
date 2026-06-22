import { useState } from "react";
import { BottomSheet } from "../../core/components/ui/BottomSheet";
import { Button } from "../../core/components/ui/Button";
import { useLanguage } from "../../core/context/LanguageContext";
import { CashEntrySheet } from "./CashEntrySheet";
import { StockReceiptSheet } from "./StockReceiptSheet";
import { StockWriteOffSheet } from "./StockWriteOffSheet";

import type { Id } from "../../../convex/_generated/dataModel";

interface QuickActionsMenuProps {
  open: boolean;
  onClose: () => void;
  sessionToken: string;
  businessId: Id<"businesses">;
}

type ActionView = "menu" | "receipt" | "expense" | "deposit" | "income" | "writeoff";

export function QuickActionsMenu({
  open,
  onClose,
  sessionToken,
  businessId,
}: QuickActionsMenuProps) {
  const { translate } = useLanguage();
  const [view, setView] = useState<ActionView>("menu");

  const handleClose = () => {
    setView("menu");
    onClose();
  };

  if (view === "receipt") {
    return (
      <StockReceiptSheet
        open={open}
        onClose={handleClose}
        sessionToken={sessionToken}
        businessId={businessId}
        onBack={() => setView("menu")}
      />
    );
  }

  if (view === "expense") {
    return (
      <CashEntrySheet
        open={open}
        onClose={handleClose}
        sessionToken={sessionToken}
        type="EXPENSE"
        title={translate("kasirCashExpense")}
        onBack={() => setView("menu")}
      />
    );
  }

  if (view === "deposit") {
    return (
      <CashEntrySheet
        open={open}
        onClose={handleClose}
        sessionToken={sessionToken}
        type="DEPOSIT"
        title={translate("kasirCashDeposit")}
        onBack={() => setView("menu")}
      />
    );
  }

  if (view === "income") {
    return (
      <CashEntrySheet
        open={open}
        onClose={handleClose}
        sessionToken={sessionToken}
        type="INCOME"
        title={translate("kasirCashIncome")}
        onBack={() => setView("menu")}
      />
    );
  }

  if (view === "writeoff") {
    return (
      <StockWriteOffSheet
        open={open}
        onClose={handleClose}
        sessionToken={sessionToken}
        businessId={businessId}
        onBack={() => setView("menu")}
      />
    );
  }

  return (
    <BottomSheet open={open} onClose={handleClose} title={translate("kasirActions")}>
      <div className="grid gap-2">
        <Button variant="outline" onClick={() => setView("receipt")}>
          {translate("kasirStockReceipt")}
        </Button>
        <Button variant="outline" onClick={() => setView("expense")}>
          {translate("kasirCashExpense")}
        </Button>
        <Button variant="outline" onClick={() => setView("income")}>
          {translate("kasirCashIncome")}
        </Button>
        <Button variant="outline" onClick={() => setView("deposit")}>
          {translate("kasirCashDeposit")}
        </Button>
        <Button variant="outline" onClick={() => setView("writeoff")}>
          {translate("kasirStockWriteOff")}
        </Button>
      </div>
    </BottomSheet>
  );
}
