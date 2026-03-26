import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Trophy, TrendingUp, MessageSquare, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ActivityItem {
  id: string;
  type: "test_completed" | "feedback_received";
  message: string;
  time: string;
}

const StudentDashboard = () => {
  const { user } = useAuth();
  interface TestAttempt { id: string; student_id: string; score: number; completed_at: string; tests?: { title: string } }
  interface FeedbackItem { id: string; attempt_id: string; created_at: string; test_attempts?: { tests?: { title: string } } }
  const [stats, setStats] = useState({ testsCompleted: 0, avgScore: 0, bestScore: 0, feedbackCount: 0 });
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: att } = await supabase
        .from("test_attempts")
        .select("*, tests!test_attempts_test_id_fkey(title)")
        .eq("student_id", user.id)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false });
      const completed = (att as TestAttempt[]) || [];
      setAttempts(completed);

      const attemptIds = completed.map(a => a.id);
      let fb: FeedbackItem[] = [];
      if (attemptIds.length > 0) {
        const { data } = await supabase
          .from("feedback")
          .select("*, test_attempts!feedback_attempt_id_fkey(tests!test_attempts_test_id_fkey(title))")
          .in("attempt_id", attemptIds)
          .order("created_at", { ascending: false })
          .limit(5);
        fb = (data as FeedbackItem[]) || [];
      }
      setFeedback(fb);

      // Build activity feed
      const feed: ActivityItem[] = [];
      completed.slice(0, 5).forEach(a => {
        feed.push({
          id: `att-${a.id}`,
          type: "test_completed",
          message: `Completed "${a.tests?.title}" with ${Number(a.score).toFixed(0)}%`,
          time: a.completed_at,
        });
      });
      fb.slice(0, 5).forEach((f: FeedbackItem) => {
        feed.push({
          id: `fb-${f.id}`,
          type: "feedback_received",
          message: `Received feedback on "${f.test_attempts?.tests?.title || "a test"}"`,
          time: f.created_at,
        });
      });
      feed.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setActivityFeed(feed.slice(0, 8));

      const scores = completed.map(a => Number(a.score) || 0);
      setStats({
        testsCompleted: completed.length,
        avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
        bestScore: scores.length ? Math.round(Math.max(...scores)) : 0,
        feedbackCount: fb.length,
      });
    };
    load();
  }, [user]);

  const chartData = attempts.slice(0, 10).reverse().map((a: TestAttempt, i: number) => ({
    name: a.tests?.title?.substring(0, 15) || `Test ${i + 1}`,
    score: Number(a.score) || 0,
  }));

  const formatTime = (t: string) => {
    const diff = Date.now() - new Date(t).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Student Dashboard</h1>
        <p className="text-muted-foreground">Track your academic progress</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Tests Completed", value: stats.testsCompleted, icon: FileText, color: "text-primary" },
          { label: "Average Score", value: `${stats.avgScore}%`, icon: TrendingUp, color: "text-accent" },
          { label: "Best Score", value: `${stats.bestScore}%`, icon: Trophy, color: "text-chart-3" },
          { label: "Feedback", value: stats.feedbackCount, icon: MessageSquare, color: "text-chart-4" },
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

      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Score Progression</CardTitle></CardHeader>
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

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activityFeed.length === 0 ? (
            <p className="text-muted-foreground">No recent activity yet.</p>
          ) : (
            <div className="space-y-3">
              {activityFeed.map(item => (
                <div key={item.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <span className="text-lg">{item.type === "test_completed" ? "📝" : "💬"}</span>
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

      {feedback.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Recent Feedback</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {feedback.map((f: FeedbackItem) => (
              <div key={f.id} className="rounded-lg border p-4">
                <p className="text-sm">{f.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {f.test_attempts?.tests?.title}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {attempts.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">No tests completed yet.</p>
            <Link to="/tests" className="text-primary underline">Browse available tests</Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StudentDashboard;
