import { Outlet, useLocation, Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import KlayLauncher from "../components/KlayLauncher";
import { useCurrentUser } from "../state/CurrentUserContext";
import { MODULES } from "../data/seed/roles";

export function NoAccess({ moduleKey, title, body }) {
  const { user, landingPath } = useCurrentUser();
  const moduleLabel = MODULES.find((m) => m.key === moduleKey)?.label || moduleKey;
  return (
    <div className="no-access">
      <div className="no-access-card">
        <div className="no-access-ico" aria-hidden>
          <svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
        </div>
        <h2 className="no-access-title">{title || `No access to ${moduleLabel}`}</h2>
        <p className="no-access-body">
          {body || (
            <>
              You're viewing as <strong>{user.name}</strong>, who doesn't have permission for the
              {" "}{moduleLabel} module. Switch persona from the profile menu, or head back to a page you can open.
            </>
          )}
        </p>
        <Link to={landingPath} className="no-access-btn">Go to my workspace</Link>
      </div>
    </div>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const { can, moduleForPath } = useCurrentUser();
  const moduleKey = moduleForPath(pathname);
  const blocked = moduleKey && !can(moduleKey);

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        {blocked ? <NoAccess moduleKey={moduleKey} /> : <Outlet />}
      </main>
      <KlayLauncher />
    </div>
  );
}
