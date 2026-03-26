import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { CheckCircle } from "lucide-react";

const TakeTest = () => {
  const { testId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  interface Test { id: string; title: string; duration_minutes: number }
  interface Question { id: string; test_id: string; question_text: string; question_type: string; options: string[]; correct_answer: string; points: number; sort_order: number }
  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; earned: number; total: number } | null>(null);

  useEffect(() => {
    if (!testId) return;
    const load = async () => {
      const { data: t } = await supabase.from("tests").select("*").eq("id", testId).maybeSingle();
      setTest((t as Test) || null);
      const { data: q } = await supabase.from("questions").select("*").eq("test_id", testId).order("sort_order");
      setQuestions((q as Question[]) || []);
    };
    load();
  }, [testId]);

  const handleSubmit = async () => {
    if (!user || !testId) return;
    const unanswered = questions.filter(q => !answers[q.id]);
    if (unanswered.length > 0) {
      toast.error(`Please answer all questions (${unanswered.length} remaining)`);
      return;
    }

    setSubmitting(true);

    // Create attempt
    const { data: attempt, error: attErr } = await supabase
      .from("test_attempts")
      .insert({ student_id: user.id, test_id: testId })
      .select()
      .single();

    if (attErr || !attempt) { toast.error("Failed to create attempt"); setSubmitting(false); return; }

    // Submit responses and calculate score
    let earned = 0;
    let total = 0;
    const responses = questions.map(q => {
      const isCorrect = answers[q.id] === q.correct_answer;
      if (isCorrect) earned += q.points;
      total += q.points;
      return {
        attempt_id: attempt.id,
        question_id: q.id,
        selected_answer: answers[q.id],
        is_correct: isCorrect,
      };
    });

    await supabase.from("student_responses").insert(responses);

    const score = total > 0 ? (earned / total) * 100 : 0;
    await supabase
      .from("test_attempts")
      .update({ score, earned_points: earned, total_points: total, completed_at: new Date().toISOString() })
      .eq("id", attempt.id);

    setResult({ score, earned, total });
    setSubmitting(false);
  };

  if (!test) return <div className="flex items-center justify-center p-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  if (result) {
    return (
      <div className="mx-auto max-w-lg space-y-6 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold">Test Complete!</h1>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <p className="text-5xl font-bold">{result.score.toFixed(0)}%</p>
            <p className="text-muted-foreground">{result.earned} / {result.total} points</p>
            <Progress value={result.score} className="h-3" />
          </CardContent>
        </Card>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => navigate("/my-results")}>View All Results</Button>
          <Button className="flex-1" onClick={() => navigate("/tests")}>More Tests</Button>
        </div>
      </div>
    );
  }

  const q = questions[currentQ];
  const progress = ((currentQ + 1) / questions.length) * 100;
  const options = Array.isArray(q?.options) ? q.options as string[] : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{test.title}</h1>
        <div className="mt-2 flex items-center gap-3">
          <Progress value={progress} className="flex-1 h-2" />
          <span className="text-sm text-muted-foreground">{currentQ + 1}/{questions.length}</span>
        </div>
      </div>

      {q && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Q{currentQ + 1}. {q.question_text}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{q.points} point{q.points > 1 ? "s" : ""}</p>
          </CardHeader>
          <CardContent>
            <RadioGroup value={answers[q.id] || ""} onValueChange={v => setAnswers(prev => ({ ...prev, [q.id]: v }))}>
              <div className="space-y-3">
                {options.map((opt: string, i: number) => (
                  <div key={i} className={`flex items-center space-x-3 rounded-lg border p-4 transition-colors ${answers[q.id] === opt ? "border-primary bg-primary/5" : "hover:bg-secondary"}`}>
                    <RadioGroupItem value={opt} id={`opt-${i}`} />
                    <Label htmlFor={`opt-${i}`} className="flex-1 cursor-pointer">{opt}</Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" disabled={currentQ === 0} onClick={() => setCurrentQ(prev => prev - 1)}>
          Previous
        </Button>
        {currentQ < questions.length - 1 ? (
          <Button onClick={() => setCurrentQ(prev => prev + 1)} disabled={!answers[q?.id]}>
            Next
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit Test"}
          </Button>
        )}
      </div>
    </div>
  );
};

export default TakeTest;
