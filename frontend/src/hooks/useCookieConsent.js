import { useEffect, useState } from "react";

const STORAGE_KEY = "cas_cookie_preferences";
const TWELVE_MONTHS_IN_MS = 365 * 24 * 60 * 60 * 1000;

function getInitialConsentState() {
  const fallback = {
    hasConsent: false,
    strictlyNecessary: true,
    analyticsAllowed: false,
    marketingAllowed: false,
    timestamp: null,
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed?.timestamp || Date.now() - parsed.timestamp > TWELVE_MONTHS_IN_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return fallback;
    }
    return parsed;
  } catch (error) {
    console.error("Error parsing stored consent preferences:", error);
    return fallback;
  }
}

export function useCookieConsent() {
  const [consentState, setConsentState] = useState(getInitialConsentState);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("cas-cookie-consent-updated", { detail: consentState }),
    );
  }, [consentState]);

  const savePreferences = (analytics, marketing) => {
    const newState = {
      hasConsent: true,
      strictlyNecessary: true,
      analyticsAllowed: analytics,
      marketingAllowed: marketing,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    setConsentState(newState);
  };

  return {
    consentState,
    savePreferences,
    hasConsent: consentState.hasConsent,
    analyticsAllowed: consentState.analyticsAllowed,
    marketingAllowed: consentState.marketingAllowed,
    canLoadNonEssentialScripts:
      consentState.hasConsent &&
      (consentState.analyticsAllowed || consentState.marketingAllowed),
  };
}
