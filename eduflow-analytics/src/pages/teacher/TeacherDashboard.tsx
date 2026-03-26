import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Users, BarChart3, CheckCircle, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

interface ActivityItem {
  id: string;
  type: "attempt" | "feedback" | "test_created";
  message: string;
  time: string;
}

const TeacherDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ tests: 0, published: 0, drafts: 0, totalStudents: 0, attempts: 0, avgScore: 0, feedbackCount: 0, passRate: 0 });
  interface RecentAttempt { id: string; student_id: string; test_id: string; score: number; completed_at: string; profiles?: { full_name: string; email: string }; tests?: { title: string } }
  interface TestBreakdown { title: string; attempts: number; avg: number }
  interface RecentFeedback { id: string; message: string; created_at: string; test_attempts?: { tests?: { title: string } } }
  const [recentAttempts, setRecentAttempts] = useState<RecentAttempt[]>([]);
  const [testBreakdown, setTestBreakdown] = useState<TestBreakdown[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: tests } = await supabase.from("tests").select("id, title, is_published, created_at").eq("teacher_id", user.id).order("created_at", { ascending: false });
      const allTests = tests || [];
      const testIds = allTests.map(t => t.id);
      const published = allTests.filter(t => t.is_published).length;

      let attempts: RecentAttempt[] = [];
      let feedbackCount = 0;
      const uniqueStudents = new Set<string>();
      const feed: ActivityItem[] = [];

      // Add recent test creations to feed
      allTests.slice(0, 3).forEach(t => {
        feed.push({ id: `test-${t.id}`, type: "test_created", message: `Created test "${t.title}"`, time: t.created_at });
      });

      if (testIds.length > 0) {
        const { data: att } = await supabase
          .from("test_attempts")
          .select("*, profiles!test_attempts_student_id_fkey(full_name, email), tests!test_attempts_test_id_fkey(title)")
          .in("test_id", testIds)
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false });
        attempts = att || [];
        attempts.forEach(a => uniqueStudents.add(a.student_id));

        // Add recent attempts to feed
        attempts.slice(0, 5).forEach(a => {
          feed.push({
            id: `att-${a.id}`,
            type: "attempt",
            message: `${a.profiles?.full_name || "Student"} scored ${Number(a.score).toFixed(0)}% on "${a.tests?.title}"`,
            time: a.completed_at,
          });
        });

        const { count } = await supabase
          .from("feedback")
          .select("id", { count: "exact", head: true })
          .eq("teacher_id", user.id);
        feedbackCount = count || 0;

        // Recent feedback
        const { data: recentFb } = await supabase
          .from("feedback")
          .select("id, message, created_at, test_attempts!feedback_attempt_id_fkey(tests!test_attempts_test_id_fkey(title))")
          .eq("teacher_id", user.id)
          .order("created_at", { ascending: false })
          .limit(3);
        (recentFb || []).forEach((f: RecentFeedback) => {
          feed.push({
            id: `fb-${f.id}`,
            type: "feedback",
            message: `Sent feedback on "${f.test_attempts?.tests?.title || "a test"}"`,
            time: f.created_at,
          });
        });
      }

      // Sort feed by time
      feed.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setActivityFeed(feed.slice(0, 8));

      const scores = attempts.map(a => Number(a.score) || 0);
      const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const passRate = scores.length ? Math.round((scores.filter(s => s >= 50).length / scores.length) * 100) : 0;

      const breakdown: Record<string, TestBreakdown> = {};
      attempts.forEach(a => {
        if (!breakdown[a.test_id]) breakdown[a.test_id] = { title: a.tests?.title || "Test", attempts: 0, avg: 0 };
        breakdown[a.test_id].attempts++;
        breakdown[a.test_id].avg += Number(a.score) || 0;
      });
      Object.values(breakdown).forEach(b => { b.avg = Math.round(b.avg / b.attempts); });

      setStats({ tests: allTests.length, published, drafts: allTests.length - published, totalStudents: uniqueStudents.size, attempts: attempts.length, avgScore, feedbackCount, passRate });
      setRecentAttempts(attempts.slice(0, 10));
      setTestBreakdown(Object.values(breakdown));
    };
    load();
  }, [user]);

  const chartData = recentAttempts.map((a: RecentAttempt) => ({
    name: a.profiles?.full_name?.split(" ")[0] || "Student",
    score: Number(a.score) || 0,
  }));

  const pieData = [
    { name: "Published", value: stats.published },
    { name: "Drafts", value: stats.drafts },
  ].filter(d => d.value > 0);

  const formatTime = (t: string) => {
    const diff = Date.now() - new Date(t).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const activityIcon = (type: string) => {
    if (type === "attempt") return "📝";
    if (type === "feedback") return "💬";
    return "📋";
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Teacher Dashboard</h1>
        <p className="text-muted-foreground">Overview of your tests, students, and performance</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Tests", value: stats.tests, icon: FileText, color: "text-primary" },
          { label: "Total Students", value: stats.totalStudents, icon: Users, color: "text-accent" },
          { label: "Avg Score", value: `${stats.avgScore}%`, icon: BarChart3, color: "text-chart-3" },
          { label: "Pass Rate", value: `${stats.passRate}%`, icon: CheckCircle, color: "text-chart-4" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className={`rounded-xl bg-secondary p-3 ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {chartData.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Recent Scores</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="score" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {pieData.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Test Status</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activityFeed.length === 0 ? (
            <p className="text-muted-foreground">No recent activity.</p>
          ) : (
            <div className="space-y-3">
              {activityFeed.map(item => (
                <div key={item.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <span className="text-lg">{activityIcon(item.type)}</span>
                  <div className="flex-1">
                    <p className="text-sm">{item.message}</p>
                    <p className="text-xs text-muted-foreground">{formatTime(item.time)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {testBreakdown.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Per-Test Performance</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {testBreakdown.map((t, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">{t.title}</p>
                    <p className="text-sm text-muted-foreground">{t.attempts} attempt{t.attempts !== 1 ? "s" : ""}</p>
                  </div>
                  <Badge variant={t.avg >= 70 ? "default" : t.avg >= 50 ? "secondary" : "destructive"}>
                    Avg: {t.avg}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Recent Attempts</CardTitle></CardHeader>
        <CardContent>
          {recentAttempts.length === 0 ? (
            <p className="text-muted-foreground">No test attempts yet. <Link to="/tests/create" className="text-primary underline">Create a test</Link> to get started.</p>
          ) : (
            <div className="space-y-3">
              {recentAttempts.map((a: RecentAttempt) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">{a.profiles?.full_name || "Student"}</p>
                    <p className="text-sm text-muted-foreground">{a.tests?.title}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{Number(a.score).toFixed(0)}%</p>
                    <p className="text-xs text-muted-foreground">{a.earned_points}/{a.total_points} pts</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TeacherDashboard;
