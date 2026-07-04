import { createContext, useContext, useMemo, useState } from "react";
import { USERS, PERMISSION_MATRIX, LEVELS, MODULES } from "../data/seed/roles";

// Who is "logged in" for the prototype. A visible persona switcher (sidebar)
// flips this so a demo can show how the app changes per role. Everything that
// gates UI reads from here, deriving the effective permission per module from
// PERMISSION_MATRIX (the union of the user's roles, taking the highest level).

const CurrentUserContext = createContext(null);

// Highest level per module across all of a user's roles. Returns
// { moduleKey: levelKey } covering every module (default "none").
export function accessibleModules(roleKeys = []) {
  const acc = {};
  for (const m of MODULES) acc[m.key] = "none";
  for (const rk of roleKeys) {
    const row = PERMISSION_MATRIX[rk] || {};
    for (const m of MODULES) {
      const lvl = row[m.key] || "none";
      if ((LEVELS[lvl]?.rank ?? 0) > (LEVELS[acc[m.key]]?.rank ?? 0)) acc[m.key] = lvl;
    }
  }
  return acc;
}

// Representative demo personas — one Active user per role (plus an operational
// multi-role holder). Order roughly mirrors seniority for the switcher list.
const PERSONA_IDS = ["U001", "U002", "U003", "U004", "U011", "U005", "U006", "U007"];
export const PERSONAS = PERSONA_IDS
  .map((id) => USERS.find((u) => u.id === id))
  .filter(Boolean);

const DEFAULT_USER_ID = "U001"; // Admin — full access on first load

// Route prefix → module it belongs to. A route not listed here is ungated
// (always reachable). Order matters: first matching prefix wins.
const ROUTE_MODULE = [
  ["/bills", "ap"],
  ["/ap/close", "ap"],
  ["/ap-aging", "ap"],
  ["/vendors", "ap"],
  ["/invoices", "ar"],
  ["/customers", "ar"],
  ["/general-ledger", "gl"],
  ["/journal-entry", "gl"],
  ["/bank-reconciliation", "gl"],
  ["/trial-balance", "reports"],
  ["/chart-of-accounts", "settings"],
  ["/bank-accounts", "settings"],
  ["/dimensions", "settings"],
  ["/users", "settings"],
  ["/access-policy", "settings"],
];

export function moduleForPath(pathname) {
  const hit = ROUTE_MODULE.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix + "/"));
  return hit ? hit[1] : null;
}

// Ordered landing candidates. The user is sent to the first page their role can
// reach; Reports is the universal fallback (every role has at least view).
const LANDING_CANDIDATES = [
  ["/journal-entry", "gl"],
  ["/bills", "ap"],
  ["/invoices", "ar"],
  ["/trial-balance", "reports"],
];

export function CurrentUserProvider({ children }) {
  const [userId, setUserId] = useState(DEFAULT_USER_ID);
  const user = useMemo(
    () => USERS.find((u) => u.id === userId) || PERSONAS[0],
    [userId],
  );
  const modules = useMemo(() => accessibleModules(user.roleKeys), [user]);

  const value = useMemo(() => {
    const can = (m) => !m || (modules[m] && modules[m] !== "none");
    const landingPath =
      (LANDING_CANDIDATES.find(([, m]) => can(m)) || ["/trial-balance"])[0];
    return {
      user,
      setUserId,
      modules,
      can,
      level: (m) => modules[m] || "none",
      // True when the user's effective level on module m is at least req
      // (by ordinal rank). Drives per-action gating, e.g. hasLevel("ap","approve+post").
      hasLevel: (m, req) =>
        (LEVELS[modules[m]]?.rank ?? 0) >= (LEVELS[req]?.rank ?? 0),
      moduleForPath,
      landingPath,
    };
  }, [user, modules]);

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) throw new Error("useCurrentUser must be used within CurrentUserProvider");
  return ctx;
}
