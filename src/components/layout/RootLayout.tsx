import { Outlet } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { SidebarNav, BottomNav } from './NavBar';

export function RootLayout() {
  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-hidden">
      <SidebarNav />

      <div className="flex flex-1 flex-col min-w-0 max-w-full overflow-x-hidden">
        <header className="flex items-center justify-between px-4 sm:px-6 md:px-8 py-3.5 md:py-4">
          <div className="md:hidden">
            <h1 className="font-display text-lg font-semibold leading-tight">GENSPACE</h1>
            <p className="text-xs text-muted-foreground -mt-0.5">One Space for Everything.</p>
          </div>
          <div className="hidden md:block" />
          <ThemeToggle />
        </header>

        <main className="flex-1 min-w-0 w-full max-w-full px-4 sm:px-6 md:px-8 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-8 animate-fade-in">
          <Outlet />
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
