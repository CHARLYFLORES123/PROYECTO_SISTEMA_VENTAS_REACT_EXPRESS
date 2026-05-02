import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useGetBusinessSettings } from "@workspace/api-client-react";

interface CurrencyContextType {
  currency: string;
  currencySymbol: string;
  setCurrency: (currency: string, symbol: string) => void;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState("BOB");
  const [currencySymbol, setCurrencySymbolState] = useState("Bs");

  const { data: settings } = useGetBusinessSettings();

  useEffect(() => {
    if (settings) {
      setCurrencyState(settings.currency || "BOB");
      setCurrencySymbolState(settings.currencySymbol || "Bs");
    }
  }, [settings]);

  const setCurrency = (c: string, symbol: string) => {
    setCurrencyState(c);
    setCurrencySymbolState(symbol);
  };

  return (
    <CurrencyContext.Provider value={{ currency, currencySymbol, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}

export function formatCurrency(amount: number, symbol: string) {
  return `${symbol} ${amount.toFixed(2)}`;
}
