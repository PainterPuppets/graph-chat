"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const API_KEY_STORAGE_KEY = "api-auth-key";

type ApiKeyContextType = {
  apiKey: string;
  setApiKey: (key: string) => void;
  isConfigOpen: boolean;
  openConfig: () => void;
  closeConfig: () => void;
};

const ApiKeyContext = createContext<ApiKeyContextType | undefined>(undefined);

export function ApiKeyProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState("");
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY) ?? "";
    setApiKeyState(storedKey);
    setIsInitialized(true);
  }, []);

  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key);
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
  }, []);

  const openConfig = useCallback(() => setIsConfigOpen(true), []);
  const closeConfig = useCallback(() => setIsConfigOpen(false), []);

  if (!isInitialized) {
    return null;
  }

  return (
    <ApiKeyContext.Provider
      value={{ apiKey, setApiKey, isConfigOpen, openConfig, closeConfig }}
    >
      {children}
    </ApiKeyContext.Provider>
  );
}

export function useApiKey() {
  const context = useContext(ApiKeyContext);
  if (!context) {
    throw new Error("useApiKey must be used within an ApiKeyProvider");
  }
  return context;
}

export function getApiKeyHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const key = localStorage.getItem(API_KEY_STORAGE_KEY);
  return key ? { "x-api-key": key } : {};
}
