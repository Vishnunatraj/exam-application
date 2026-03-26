import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MyResults = () => {
  const { user } = useAuth();
  interface TestAttempt { id: string; student_id: string; score: number; completed_at: string; started_at: string; test_id: string; tests?: { title: string } }
  interface Feedback { id: string; attempt_id: string; question_id: string; feedback_text: string; severity: string }
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [feedback, setFeedback] = useState<Record<string, Feedback[]>>({});

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("test_attempts")
        .select("*, tests!test_attempts_test_id_fkey(title)")
        .eq("student_id", user.id)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false });
      setAttempts((data as TestAttempt[]) || []);

      const ids = ((data as TestAttempt[]) || []).map(a => a.id);
      if (ids.length > 0) {
        const { data: fb } = await supabase.from("feedback").select("*").in("attempt_id", ids);
        const map: Record<string, Feedback[]> = {};
        ((fb as Feedback[]) || []).forEach(f => {
          if (!map[f.attempt_id]) map[f.attempt_id] = [];
          map[f.attempt_id].push(f);
        });
        setFeedback(map);
      }
    };
    load();
  }, [user]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]";
    if (score >= 60) return "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]";
    return "bg-destructive text-destructive-foreground";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Results</h1>
        <p className="text-muted-foreground">Review your test performance and feedback</p>
      </div>

      {attempts.length === 0 ? (
        <Card><CardContent className="pt-6"><p className="text-muted-foreground">No completed tests yet.</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {attempts.map((a: TestAttempt) => (
            <Card key={a.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{a.tests?.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(a.completed_at).toLocaleDateString()} • {a.earned_points}/{a.total_points} pts
                    </p>
                  </div>
                  <Badge className={getScoreColor(Number(a.score))}>
                    {Number(a.score).toFixed(0)}%
                  </Badge>
                </div>
                {feedback[a.id]?.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {feedback[a.id].map(f => (
                      <div key={f.id} className="rounded-lg bg-secondary p-3 text-sm">
                        💬 {f.message}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyResults;
