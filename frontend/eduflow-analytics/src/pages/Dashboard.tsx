import { useAuth } from "@/lib/auth-context";
import TeacherDashboard from "./teacher/TeacherDashboard";
import StudentDashboard from "./student/StudentDashboard";

const Dashboard = () => {
  const { role } = useAuth();

  if (role === "teacher") return <TeacherDashboard />;
  return <StudentDashboard />;
};

export default Dashboard;
