import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, ScatterChart, Scatter,
} from "recharts";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const TeacherAnalytics = () => {
  const { user } = useAuth();
  interface Test { id: string; title: string; teacher_id: string }
  interface TestAttempt { id: string; test_id: string; student_id: string; score: number; completed_at: string; tests?: { title: string; teacher_id: string }; profiles?: { full_name: string; email: string } }
  interface Question { id: string; test_id: string; question_text: string; question_type: string; points: number; correct_answer: string; tests?: { teacher_id: string } }
  interface StudentResponse { id: string; question_id: string; student_answer: string; is_correct: boolean; questions?: { question_text: string; question_type: string; points: number; test_id: string; correct_answer: string } }
  const [tests, setTests] = useState<Test[]>([]);
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [responses, setResponses] = useState<StudentResponse[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      supabase.from("tests").select("*").eq("teacher_id", user.id),
      supabase
        .from("test_attempts")
        .select("*, tests!test_attempts_test_id_fkey(title, teacher_id), profiles!test_attempts_student_id_fkey(full_name, email)")
        .not("completed_at", "is", null),
      supabase
        .from("questions")
        .select("*, tests!questions_test_id_fkey(teacher_id)"),
      supabase
        .from("student_responses")
        .select("*, questions!student_responses_question_id_fkey(question_text, question_type, points, test_id, correct_answer)")
    ]).then(([tRes, aRes, qRes, rRes]) => {
      const myTests = (tRes.data as Test[]) || [];
      const myTestIds = new Set(myTests.map((t: Test) => t.id));
      setTests(myTests);
      setAttempts(((aRes.data as TestAttempt[]) || []).filter((a: TestAttempt) => myTestIds.has(a.test_id)));
      setQuestions(((qRes.data as Question[]) || []).filter((q: Question) => myTestIds.has(q.test_id)));
      setResponses(((rRes.data as StudentResponse[]) || []).filter((r: StudentResponse) => myTestIds.has(r.questions?.test_id || "")));
      setLoading(false);
    });
  }, [user]);

  // === Question Difficulty Index ===
  const difficultyData = useMemo(() => {
    const qStats: Record<string, { text: string; correct: number; total: number; type: string }> = {};
    responses.forEach((r: StudentResponse) => {
      const qId = r.question_id;
      if (!qStats[qId]) qStats[qId] = {
        text: r.questions?.question_text?.substring(0, 30) || "Q",
        correct: 0, total: 0,
        type: r.questions?.question_type || "mcq",
      };
      qStats[qId].total++;
      if (r.is_correct) qStats[qId].correct++;
    });
    return Object.entries(qStats)
      .map(([id, data]) => ({
        id,
        question: data.text,
        type: data.type,
        difficulty: Math.round(100 - (data.correct / data.total) * 100),
        successRate: Math.round((data.correct / data.total) * 100),
        attempts: data.total,
      }))
      .sort((a, b) => b.difficulty - a.difficulty);
  }, [responses]);

  // === Topic Failure Rate (by test) ===
  const topicFailureData = useMemo(() => {
    const testGroups: Record<string, { title: string; passed: number; failed: number }> = {};
    attempts.forEach((a: TestAttempt) => {
      const title = a.tests?.title || "Unknown";
      if (!testGroups[a.test_id]) testGroups[a.test_id] = { title, passed: 0, failed: 0 };
      if (Number(a.score) >= 50) testGroups[a.test_id].passed++;
      else testGroups[a.test_id].failed++;
    });
    return Object.values(testGroups).map(d => ({
      name: d.title.substring(0, 15),
      passed: d.passed,
      failed: d.failed,
      failRate: d.passed + d.failed > 0 ? Math.round((d.failed / (d.passed + d.failed)) * 100) : 0,
    }));
  }, [attempts]);

  // === Student Ranking Distribution ===
  const rankingData = useMemo(() => {
    const studentScores: Record<string, { name: string; scores: number[] }> = {};
    attempts.forEach((a: TestAttempt) => {
      const sid = a.student_id;
      if (!studentScores[sid]) studentScores[sid] = {
        name: a.profiles?.full_name || a.profiles?.email?.split("@")[0] || "Student",
        scores: [],
      };
      studentScores[sid].scores.push(Number(a.score) || 0);
    });

    const ranked = Object.entries(studentScores)
      .map(([id, data]) => ({
        name: data.name.substring(0, 12),
        avg: Math.round(data.scores.reduce((s, v) => s + v, 0) / data.scores.length),
        tests: data.scores.length,
      }))
      .sort((a, b) => b.avg - a.avg);

    return ranked;
  }, [attempts]);

  // Score distribution buckets
  const scoreBuckets = useMemo(() => {
    const buckets = [
      { range: "0-20", count: 0 },
      { range: "21-40", count: 0 },
      { range: "41-60", count: 0 },
      { range: "61-80", count: 0 },
      { range: "81-100", count: 0 },
    ];
    attempts.forEach((a: TestAttempt) => {
      const score = Number(a.score) || 0;
      if (score <= 20) buckets[0].count++;
      else if (score <= 40) buckets[1].count++;
      else if (score <= 60) buckets[2].count++;
      else if (score <= 80) buckets[3].count++;
      else buckets[4].count++;
    });
    return buckets;
  }, [attempts]);

  // === Avg Completion Time ===
  const completionTimeData = useMemo(() => {
    const testTimes: Record<string, { title: string; times: number[] }> = {};
    attempts.forEach((a: TestAttempt) => {
      if (!a.started_at || !a.completed_at) return;
      const mins = (new Date(a.completed_at).getTime() - new Date(a.started_at).getTime()) / 60000;
      if (!testTimes[a.test_id]) testTimes[a.test_id] = { title: a.tests?.title || "Test", times: [] };
      testTimes[a.test_id].times.push(mins);
    });
    return Object.values(testTimes).map(d => ({
      name: d.title.substring(0, 15),
      avgTime: Math.round((d.times.reduce((s, v) => s + v, 0) / d.times.length) * 10) / 10,
      minTime: Math.round(Math.min(...d.times) * 10) / 10,
      maxTime: Math.round(Math.max(...d.times) * 10) / 10,
    }));
  }, [attempts]);

  // === Pass/Fail Analytics ===
  const passFailData = useMemo(() => {
    const passed = attempts.filter(a => Number(a.score) >= 50).length;
    const failed = attempts.length - passed;
    return [
      { name: "Passed", value: passed },
      { name: "Failed", value: failed },
    ];
  }, [attempts]);

  const overallPassRate = attempts.length
    ? Math.round((attempts.filter((a: TestAttempt) => Number(a.score) >= 50).length / attempts.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Teaching Analytics</h1>
        <p className="text-muted-foreground">Insights into test performance and student progress</p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-4xl font-bold">{tests.length}</p>
            <p className="text-sm text-muted-foreground">Tests Created</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-4xl font-bold">{attempts.length}</p>
            <p className="text-sm text-muted-foreground">Total Attempts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-4xl font-bold">{overallPassRate}%</p>
            <p className="text-sm text-muted-foreground">Pass Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-4xl font-bold">{rankingData.length}</p>
            <p className="text-sm text-muted-foreground">Students</p>
          </CardContent>
        </Card>
      </div>

      {attempts.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No test attempts yet. Analytics will appear once students take your tests.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="difficulty" className="space-y-4">
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="difficulty">🧩 Difficulty</TabsTrigger>
            <TabsTrigger value="failure">❌ Failure Rate</TabsTrigger>
            <TabsTrigger value="ranking">🏆 Rankings</TabsTrigger>
            <TabsTrigger value="time">⏱️ Time</TabsTrigger>
            <TabsTrigger value="passfail">✅ Pass/Fail</TabsTrigger>
          </TabsList>

          {/* Question Difficulty Index */}
          <TabsContent value="difficulty">
            <Card>
              <CardHeader>
                <CardTitle>Question Difficulty Index</CardTitle>
                <p className="text-sm text-muted-foreground">Higher = harder (lower success rate)</p>
              </CardHeader>
              <CardContent>
                {difficultyData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No response data yet.</p>
                ) : (
                  <div className="space-y-3">
                    {difficultyData.slice(0, 15).map((q, i) => (
                      <div key={q.id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate max-w-[60%]">{q.question}…</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{q.type}</Badge>
                            <Badge variant={q.difficulty >= 70 ? "destructive" : q.difficulty >= 40 ? "secondary" : "default"}>
                              {q.difficulty}% hard
                            </Badge>
                          </div>
                        </div>
                        <Progress value={q.difficulty} className="h-2" />
                        <p className="text-xs text-muted-foreground">{q.successRate}% success rate • {q.attempts} attempts</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Topic Failure Rate */}
          <TabsContent value="failure">
            <Card>
              <CardHeader><CardTitle>Topic Failure Rate</CardTitle></CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topicFailureData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }} />
                      <Legend />
                      <Bar dataKey="passed" name="Passed" stackId="a" fill="hsl(var(--chart-5))" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="failed" name="Failed" stackId="a" fill="hsl(var(--chart-4))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {topicFailureData.map((t, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                      <span className="truncate">{t.name}</span>
                      <Badge variant={t.failRate >= 50 ? "destructive" : "secondary"}>{t.failRate}% fail</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Student Ranking */}
          <TabsContent value="ranking">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Student Rankings (by Avg Score)</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rankingData.slice(0, 10)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis type="number" domain={[0, 100]} />
                        <YAxis type="category" dataKey="name" width={80} className="text-xs" />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }} />
                        <Bar dataKey="avg" name="Avg Score" radius={[0, 6, 6, 0]}>
                          {rankingData.slice(0, 10).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Score Distribution</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={scoreBuckets}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="range" />
                        <YAxis />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }} />
                        <Bar dataKey="count" name="Students" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]}>
                          {scoreBuckets.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Average Completion Time */}
          <TabsContent value="time">
            <Card>
              <CardHeader>
                <CardTitle>Average Completion Time per Test</CardTitle>
                <p className="text-sm text-muted-foreground">Shows min, avg, and max times in minutes</p>
              </CardHeader>
              <CardContent>
                {completionTimeData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No timing data yet.</p>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={completionTimeData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis unit=" min" />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }} />
                        <Legend />
                        <Bar dataKey="minTime" name="Fastest" fill="hsl(var(--chart-5))" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="avgTime" name="Average" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="maxTime" name="Slowest" fill="hsl(var(--chart-4))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pass/Fail Analytics */}
          <TabsContent value="passfail">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Overall Pass/Fail Ratio</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={passFailData}
                          cx="50%" cy="50%"
                          innerRadius={60} outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                        >
                          <Cell fill="hsl(var(--chart-5))" />
                          <Cell fill="hsl(var(--chart-4))" />
                        </Pie>
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Pass/Fail by Test</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topicFailureData.map((t, i) => {
                      const total = t.passed + t.failed;
                      const passRate = total > 0 ? Math.round((t.passed / total) * 100) : 0;
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium truncate">{t.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">{t.passed}/{total}</span>
                              <Badge variant={passRate >= 70 ? "default" : passRate >= 50 ? "secondary" : "destructive"}>
                                {passRate}%
                              </Badge>
                            </div>
                          </div>
                          <Progress value={passRate} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default TeacherAnalytics;
