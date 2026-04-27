import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";

export default function Layout() {
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
