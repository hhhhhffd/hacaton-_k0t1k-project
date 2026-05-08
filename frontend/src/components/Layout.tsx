import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

/** Корневой layout: боковая панель + основной контент */
export default function Layout() {
  return (
    <div className="flex h-screen w-full bg-white overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
