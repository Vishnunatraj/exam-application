import { useAuth } from "@/lib/auth-context";
import { Navigate, Outlet, Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  GraduationCap, LayoutDashboard, Plus, BarChart3, LogOut, FileText, MessageSquare, TrendingUp, User, Settings, Trophy, Menu, X
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { useState } from "react";

const teacherLinks = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tests/create", label: "Create Test", icon: Plus },
  { to: "/manage-tests", label: "Manage Tests", icon: Settings },
  { to: "/results", label: "Results", icon: BarChart3 },
  { to: "/feedback", label: "Feedback", icon: MessageSquare },
  { to: "/teacher-analytics", label: "Analytics", icon: TrendingUp },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

const studentLinks = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tests", label: "Available Tests", icon: FileText },
  { to: "/my-results", label: "My Results", icon: BarChart3 },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/profile", label: "My Profile", icon: User },
];

const AppLayout = () => {
  const { user, role, loading, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const links = role === "teacher" ? teacherLinks : studentLinks;

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between border-b px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-bold leading-none">ExamFlow</h2>
            <p className="text-xs text-muted-foreground capitalize">{role}</p>
          </div>
        </div>
        <button className="md:hidden" onClick={() => setSidebarOpen(false)}>
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {links.map(link => {
          const active = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3 space-y-1">
        <ThemeToggle />
        <Button variant="ghost" className="w-full justify-start gap-3" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Mobile header */}
      <div className="fixed inset-x-0 top-0 z-50 flex h-14 items-center border-b bg-card px-4 md:hidden">
        <button onClick={() => setSidebarOpen(true)}>
          <Menu className="h-6 w-6" />
        </button>
        <span className="ml-3 font-bold">ExamFlow</span>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 md:hidden" onClick={() => setSidebarOpen(false)}>
          <aside className="fixed inset-y-0 left-0 flex w-64 flex-col bg-card shadow-xl" onClick={e => e.stopPropagation()}>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-card md:flex">
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 pt-20 md:ml-64 md:pt-8">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
