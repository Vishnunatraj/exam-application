import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const TeacherResults = () => {
  const { user } = useAuth();
  interface Test { id: string; title: string; teacher_id: string; created_at: string }
  interface TestAttempt { id: string; test_id: string; student_id: string; score: number; earned_points: number; total_points: number; completed_at: string; profiles?: { full_name: string; email: string } }
  const [tests, setTests] = useState<Test[]>([]);
  const [selectedTest, setSelectedTest] = useState<string>("");
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("tests").select("*").eq("teacher_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => {
        setTests((data as Test[]) || []);
        if (data?.length) setSelectedTest(data[0].id);
      });
  }, [user]);

  useEffect(() => {
    if (!selectedTest) return;
    supabase
      .from("test_attempts")
      .select("*, profiles!test_attempts_student_id_fkey(full_name, email)")
      .eq("test_id", selectedTest)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .then(({ data }) => setAttempts((data as TestAttempt[]) || []));
  }, [selectedTest]);

  const chartData = attempts.map((a: TestAttempt) => ({
    name: a.profiles?.full_name?.split(" ")[0] || "Student",
    score: Number(a.score) || 0,
  }));

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Excellent</Badge>;
    if (score >= 60) return <Badge className="bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]">Good</Badge>;
    return <Badge variant="destructive">Needs Improvement</Badge>;
  };

  const exportCSV = () => {
    if (attempts.length === 0) return;
    const testTitle = tests.find(t => t.id === selectedTest)?.title || "results";
    const headers = ["Student Name", "Email", "Score (%)", "Earned Points", "Total Points", "Completed At"];
    const rows = attempts.map((a: TestAttempt) => [
      a.profiles?.full_name || "",
      a.profiles?.email || "",
      Number(a.score).toFixed(1),
      a.earned_points ?? 0,
      a.total_points ?? 0,
      a.completed_at ? new Date(a.completed_at).toLocaleString() : "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${testTitle.replace(/[^a-z0-9]/gi, "_")}_results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Student Results</h1>
          <p className="text-muted-foreground">View student performance on your tests</p>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={attempts.length === 0} className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Select value={selectedTest} onValueChange={setSelectedTest}>
        <SelectTrigger className="max-w-xs">
          <SelectValue placeholder="Select a test" />
        </SelectTrigger>
        <SelectContent>
          {tests.map(t => (
            <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Score Distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="score" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Individual Results</CardTitle></CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <p className="text-muted-foreground">No completed attempts for this test yet.</p>
          ) : (
            <div className="space-y-3">
              {attempts.map((a: TestAttempt) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">{a.profiles?.full_name}</p>
                    <p className="text-sm text-muted-foreground">{a.profiles?.email}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    {getScoreBadge(Number(a.score))}
                    <div className="text-right">
                      <p className="text-lg font-bold">{Number(a.score).toFixed(0)}%</p>
                      <p className="text-xs text-muted-foreground">{a.earned_points}/{a.total_points} pts</p>
                    </div>
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

export default TeacherResults;
