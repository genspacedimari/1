import { Outlet } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { SidebarNav, BottomNav } from './NavBar';

export function RootLayout() {
  return (
    <div className="flex min-h-screen">
      <SidebarNav />

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between px-5 py-4 md:px-8">
          <div className="md:hidden">
            <h1 className="font-display text-lg font-semibold">GENSPACE</h1>
            <p className="text-xs text-muted-foreground -mt-0.5">One Space for Everything.</p>
          </div>
          <div className="hidden md:block" />
          <ThemeToggle />
        </header>

        <main className="flex-1 px-5 pb-28 md:px-8 md:pb-8 animate-fade-in">
          <Outlet />
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
