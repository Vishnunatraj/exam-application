import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth-context";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AppLayout from "./components/AppLayout";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import CreateTest from "./pages/teacher/CreateTest";
import TeacherResults from "./pages/teacher/TeacherResults";
import TeacherFeedback from "./pages/teacher/TeacherFeedback";
import TeacherAnalytics from "./pages/teacher/TeacherAnalytics";
import ManageTests from "./pages/teacher/ManageTests";
import EditTest from "./pages/teacher/EditTest";
import StudentDashboard from "./pages/student/StudentDashboard";
import AvailableTests from "./pages/student/AvailableTests";
import TakeTest from "./pages/student/TakeTest";
import MyResults from "./pages/student/MyResults";
import Analytics from "./pages/student/Analytics";
import Profile from "./pages/student/Profile";
import Dashboard from "./pages/Dashboard";
import Leaderboard from "./pages/Leaderboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              {/* Teacher routes */}
              <Route path="/tests/create" element={<CreateTest />} />
              <Route path="/tests/:testId/edit" element={<EditTest />} />
              <Route path="/manage-tests" element={<ManageTests />} />
              <Route path="/results" element={<TeacherResults />} />
              <Route path="/feedback" element={<TeacherFeedback />} />
              <Route path="/teacher-analytics" element={<TeacherAnalytics />} />
              {/* Student routes */}
              <Route path="/tests" element={<AvailableTests />} />
              <Route path="/tests/:testId/take" element={<TakeTest />} />
              <Route path="/my-results" element={<MyResults />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
