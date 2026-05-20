import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import KlayLauncher from "../components/KlayLauncher";

export default function Layout() {
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <Outlet />
      </main>
      <KlayLauncher />
    </div>
  );
}
