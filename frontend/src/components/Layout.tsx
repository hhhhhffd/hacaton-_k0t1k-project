import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

/** Корневой layout рабочего кабинета. */
export default function Layout() {
  return (
    <div className="workspace-shell flex min-h-screen w-full flex-col">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
