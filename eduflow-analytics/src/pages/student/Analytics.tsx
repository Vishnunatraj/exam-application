import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, Cell, Legend, Area, AreaChart,
} from "recharts";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const Analytics = () => {
  const { user } = useAuth();
  interface TestAttempt { id: string; student_id: string; score: number; completed_at: string; started_at: string; test_id: string; tests?: { title: string; duration_minutes: number } }
  interface StudentResponse { id: string; attempt_id: string; question_id: string; student_answer: string; questions?: { question_text: string; question_type: string; points: number; correct_answer: string; test_id: string }; test_attempts?: { student_id: string; completed_at: string; started_at: string; test_id: string } }
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [responses, setResponses] = useState<StudentResponse[]>([]);
  const [classAttempts, setClassAttempts] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      supabase
        .from("test_attempts")
        .select("*, tests!test_attempts_test_id_fkey(title, duration_minutes)")
        .eq("student_id", user.id)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: true }),
      supabase
        .from("student_responses")
        .select("*, questions!student_responses_question_id_fkey(question_text, question_type, points, correct_answer, test_id), test_attempts!student_responses_attempt_id_fkey(student_id, completed_at, started_at, test_id)")
        .eq("test_attempts.student_id", user.id),
      supabase
        .from("test_attempts")
        .select("score, test_id, tests!test_attempts_test_id_fkey(title)")
        .not("completed_at", "is", null),
    ]).then(([attRes, respRes, classRes]) => {
      setAttempts((attRes.data as TestAttempt[]) || []);
      setResponses((respRes.data as StudentResponse[])?.filter((r) => r.test_attempts) || []);
      setClassAttempts((classRes.data as TestAttempt[]) || []);
      setLoading(false);
    });
  }, [user]);

  // === Performance Trend ===
  const trendData = useMemo(() => attempts.map((a: TestAttempt, i: number) => ({
    attempt: i + 1,
    name: a.tests?.title?.substring(0, 12) || `#${i + 1}`,
    score: Number(a.score) || 0,
    date: new Date(a.completed_at).toLocaleDateString(),
  })), [attempts]);

  // === Moving average for trend ===
  const trendWithAvg = useMemo(() => {
    let sum = 0;
    return trendData.map((d, i) => {
      sum += d.score;
      return { ...d, avg: Math.round(sum / (i + 1)) };
    });
  }, [trendData]);

  // === Topic-wise Heatmap (grouped by test) ===
  const topicData = useMemo(() => {
    const testGroups: Record<string, { correct: number; total: number }> = {};
    responses.forEach((r: StudentResponse) => {
      const testTitle = r.questions?.test_id;
      if (!testTitle) return;
      if (!testGroups[testTitle]) testGroups[testTitle] = { correct: 0, total: 0 };
      testGroups[testTitle].total++;
      if (r.is_correct) testGroups[testTitle].correct++;
    });

    // Map test_id to title from attempts
    const testIdToTitle: Record<string, string> = {};
    attempts.forEach((a: TestAttempt) => {
      if (a.test_id && a.tests?.title) testIdToTitle[a.test_id] = a.tests.title;
    });

    return Object.entries(testGroups).map(([testId, data]) => ({
      topic: (testIdToTitle[testId] || testId).substring(0, 15),
      accuracy: Math.round((data.correct / data.total) * 100),
      total: data.total,
      correct: data.correct,
    })).sort((a, b) => a.accuracy - b.accuracy);
  }, [responses, attempts]);

  // === Strength & Weakness ===
  const strengthWeakness = useMemo(() => {
    if (topicData.length === 0) return { strengths: [], weaknesses: [] };
    const sorted = [...topicData].sort((a, b) => b.accuracy - a.accuracy);
    return {
      strengths: sorted.filter(t => t.accuracy >= 70).slice(0, 3),
      weaknesses: sorted.filter(t => t.accuracy < 70).slice(0, 3),
    };
  }, [topicData]);

  // === Radar chart for strength/weakness ===
  const radarData = useMemo(() => topicData.map(t => ({
    subject: t.topic,
    score: t.accuracy,
    fullMark: 100,
  })), [topicData]);

  // === Time per question analysis ===
  const timeData = useMemo(() => {
    const attemptTimes: { name: string; avgTime: number; score: number }[] = [];
    attempts.forEach((a: TestAttempt) => {
      if (!a.started_at || !a.completed_at) return;
      const start = new Date(a.started_at).getTime();
      const end = new Date(a.completed_at).getTime();
      const totalMinutes = (end - start) / 60000;
      const questionCount = responses.filter((r: StudentResponse) => r.test_attempts?.test_id === a.test_id).length || 1;
      attemptTimes.push({
        name: a.tests?.title?.substring(0, 12) || "Test",
        avgTime: Math.round((totalMinutes / questionCount) * 10) / 10,
        score: Number(a.score) || 0,
      });
    });
    return attemptTimes;
  }, [attempts, responses]);

  // === Class Comparison ===
  const classComparisonData = useMemo(() => {
    const testGroups: Record<string, { scores: number[]; title: string }> = {};
    classAttempts.forEach((a: TestAttempt) => {
      const id = a.test_id;
      if (!testGroups[id]) testGroups[id] = { scores: [], title: a.tests?.title || "Unknown" };
      testGroups[id].scores.push(Number(a.score) || 0);
    });

    return Object.entries(testGroups).map(([testId, data]) => {
      const myAttempt = attempts.find((a: TestAttempt) => a.test_id === testId);
      const myScore = myAttempt ? Number(myAttempt.score) || 0 : null;
      const classAvg = Math.round(data.scores.reduce((s, v) => s + v, 0) / data.scores.length);
      const classMax = Math.max(...data.scores);
      return {
        name: data.title.substring(0, 15),
        you: myScore,
        classAvg,
        classMax,
      };
    }).filter(d => d.you !== null);
  }, [classAttempts, attempts]);

  // === AI Prediction ===
  const prediction = useMemo(() => {
    if (trendData.length < 3) return null;
    const recent = trendData.slice(-5);
    const slope = recent.length > 1
      ? (recent[recent.length - 1].score - recent[0].score) / (recent.length - 1)
      : 0;
    const lastScore = trendData[trendData.length - 1].score;
    const predicted = Math.min(100, Math.max(0, Math.round(lastScore + slope * 2)));
    const trend = slope > 1 ? "improving" : slope < -1 ? "declining" : "stable";
    const consistency = trendData.length > 2
      ? Math.round(100 - (trendData.reduce((s, d) => {
          const avg = trendData.reduce((a, b) => a + b.score, 0) / trendData.length;
          return s + Math.abs(d.score - avg);
        }, 0) / trendData.length))
      : 50;
    return { predicted, trend, consistency, slope: Math.round(slope * 10) / 10 };
  }, [trendData]);

  const avgScore = attempts.length
    ? Math.round(attempts.reduce((s, a) => s + (Number(a.score) || 0), 0) / attempts.length)
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
        <h1 className="text-3xl font-bold">Performance Analytics</h1>
        <p className="text-muted-foreground">Deep insights into your learning journey</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-4xl font-bold">{attempts.length}</p>
            <p className="text-sm text-muted-foreground">Tests Taken</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-4xl font-bold">{avgScore}%</p>
            <p className="text-sm text-muted-foreground">Average Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-4xl font-bold">
              {attempts.length ? Math.max(...attempts.map(a => Number(a.score) || 0)) : 0}%
            </p>
            <p className="text-sm text-muted-foreground">Best Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className={`text-4xl font-bold ${prediction?.trend === "improving" ? "text-[hsl(var(--success))]" : prediction?.trend === "declining" ? "text-destructive" : "text-[hsl(var(--warning))]"}`}>
              {prediction ? `${prediction.predicted}%` : "—"}
            </p>
            <p className="text-sm text-muted-foreground">Predicted Next</p>
          </CardContent>
        </Card>
      </div>

      {attempts.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Complete some tests to see your analytics here.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="trend" className="space-y-4">
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="trend">📈 Trend</TabsTrigger>
            <TabsTrigger value="topics">🎯 Topics</TabsTrigger>
            <TabsTrigger value="strengths">💪 Strengths</TabsTrigger>
            <TabsTrigger value="time">⏱️ Time</TabsTrigger>
            <TabsTrigger value="class">👥 Class</TabsTrigger>
            <TabsTrigger value="predict">🤖 Prediction</TabsTrigger>
          </TabsList>

          {/* Performance Trend */}
          <TabsContent value="trend">
            <Card>
              <CardHeader><CardTitle>Score Progression & Moving Average</CardTitle></CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendWithAvg}>
                      <defs>
                        <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Legend />
                      <Area type="monotone" dataKey="score" name="Score" stroke="hsl(var(--chart-1))" fill="url(#scoreGradient)" strokeWidth={2} dot={{ fill: "hsl(var(--chart-1))", r: 4 }} />
                      <Line type="monotone" dataKey="avg" name="Running Avg" stroke="hsl(var(--chart-3))" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Topic-wise Heatmap */}
          <TabsContent value="topics">
            <Card>
              <CardHeader><CardTitle>Topic-wise Accuracy Heatmap</CardTitle></CardHeader>
              <CardContent>
                {topicData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Not enough data for topic analysis yet.</p>
                ) : (
                  <div className="space-y-3">
                    {topicData.map((t, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{t.topic}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{t.correct}/{t.total} correct</span>
                            <Badge variant={t.accuracy >= 80 ? "default" : t.accuracy >= 50 ? "secondary" : "destructive"}>
                              {t.accuracy}%
                            </Badge>
                          </div>
                        </div>
                        <Progress
                          value={t.accuracy}
                          className="h-3"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Strength & Weakness */}
          <TabsContent value="strengths">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-[hsl(var(--success))]">💪 Strengths</CardTitle></CardHeader>
                <CardContent>
                  {strengthWeakness.strengths.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Keep practicing to identify strengths!</p>
                  ) : (
                    <div className="space-y-3">
                      {strengthWeakness.strengths.map((s, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                          <span className="font-medium">{s.topic}</span>
                          <Badge variant="default">{s.accuracy}%</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-destructive">⚠️ Areas to Improve</CardTitle></CardHeader>
                <CardContent>
                  {strengthWeakness.weaknesses.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Great job — no weak areas detected!</p>
                  ) : (
                    <div className="space-y-3">
                      {strengthWeakness.weaknesses.map((w, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                          <span className="font-medium">{w.topic}</span>
                          <Badge variant="destructive">{w.accuracy}%</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            {radarData.length >= 3 && (
              <Card className="mt-4">
                <CardHeader><CardTitle>Skill Radar</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid className="stroke-border" />
                        <PolarAngleAxis dataKey="subject" className="text-xs" />
                        <PolarRadiusAxis domain={[0, 100]} />
                        <Radar name="Accuracy" dataKey="score" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.3} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Time per Question */}
          <TabsContent value="time">
            <Card>
              <CardHeader>
                <CardTitle>Time per Question vs Score</CardTitle>
                <p className="text-sm text-muted-foreground">Bubble size represents score — find your optimal pace</p>
              </CardHeader>
              <CardContent>
                {timeData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Not enough timing data yet.</p>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="avgTime" name="Avg Min/Q" unit=" min" />
                        <YAxis dataKey="score" name="Score" domain={[0, 100]} unit="%" />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }}
                          formatter={(value: number | string, name: string) => [name === "score" ? `${value}%` : `${value} min`, name === "score" ? "Score" : "Time/Q"]}
                        />
                        <Scatter data={timeData} name="Tests">
                          {timeData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {timeData.length > 0 && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {timeData.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                        <div className="h-3 w-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="truncate">{t.name}</span>
                        <span className="ml-auto text-muted-foreground">{t.avgTime}m</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Class Comparison */}
          <TabsContent value="class">
            <Card>
              <CardHeader>
                <CardTitle>Your Score vs Class</CardTitle>
                <p className="text-sm text-muted-foreground">See how you compare to the class average and top scorer</p>
              </CardHeader>
              <CardContent>
                {classComparisonData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Not enough class data yet.</p>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={classComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }} />
                        <Legend />
                        <Bar dataKey="you" name="You" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="classAvg" name="Class Avg" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="classMax" name="Top Score" fill="hsl(var(--chart-5))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Prediction */}
          <TabsContent value="predict">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>🤖 AI Performance Prediction</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  {!prediction ? (
                    <p className="text-muted-foreground">Need at least 3 test attempts for predictions.</p>
                  ) : (
                    <>
                      <div className="text-center">
                        <p className="text-6xl font-bold text-primary">{prediction.predicted}%</p>
                        <p className="text-sm text-muted-foreground mt-1">Predicted next test score</p>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Trend</span>
                          <Badge variant={prediction.trend === "improving" ? "default" : prediction.trend === "declining" ? "destructive" : "secondary"}>
                            {prediction.trend === "improving" ? "📈 Improving" : prediction.trend === "declining" ? "📉 Declining" : "➡️ Stable"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Score Change Rate</span>
                          <span className="text-sm text-muted-foreground">{prediction.slope > 0 ? "+" : ""}{prediction.slope} pts/test</span>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">Consistency</span>
                            <span className="text-sm text-muted-foreground">{prediction.consistency}%</span>
                          </div>
                          <Progress value={prediction.consistency} className="h-2" />
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Recommendations</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    {strengthWeakness.weaknesses.length > 0 && (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                        <p className="font-medium text-destructive">Focus Area</p>
                        <p className="text-muted-foreground mt-1">
                          Revisit <strong>{strengthWeakness.weaknesses[0]?.topic}</strong> — your accuracy is {strengthWeakness.weaknesses[0]?.accuracy}%.
                        </p>
                      </div>
                    )}
                    {prediction?.trend === "declining" && (
                      <div className="rounded-lg border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/5 p-3">
                        <p className="font-medium text-[hsl(var(--warning))]">Score Declining</p>
                        <p className="text-muted-foreground mt-1">Your scores have been dropping. Consider reviewing recent material.</p>
                      </div>
                    )}
                    {prediction?.consistency && prediction.consistency < 60 && (
                      <div className="rounded-lg border p-3">
                        <p className="font-medium">Consistency Tip</p>
                        <p className="text-muted-foreground mt-1">Your scores vary a lot. Try consistent study sessions for more stable results.</p>
                      </div>
                    )}
                    {strengthWeakness.strengths.length > 0 && (
                      <div className="rounded-lg border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5 p-3">
                        <p className="font-medium text-[hsl(var(--success))]">Keep It Up</p>
                        <p className="text-muted-foreground mt-1">
                          You're doing great in <strong>{strengthWeakness.strengths[0]?.topic}</strong> ({strengthWeakness.strengths[0]?.accuracy}%)!
                        </p>
                      </div>
                    )}
                    {attempts.length < 5 && (
                      <div className="rounded-lg border p-3">
                        <p className="font-medium">Take More Tests</p>
                        <p className="text-muted-foreground mt-1">More data means better predictions. Keep taking tests!</p>
                      </div>
                    )}
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

export default Analytics;
