import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send } from "lucide-react";

const PRESET_MESSAGES = ["Excellent work!", "Good job!", "Keep improving!", "Needs more practice", "Well done!"];

const TeacherFeedback = () => {
  const { user } = useAuth();
  interface Test { id: string; title: string; teacher_id: string; created_at: string }
  interface TestAttempt { id: string; test_id: string; student_id: string; score: number; completed_at: string; profiles?: { full_name: string } }
  interface Feedback { id: string; attempt_id: string; teacher_id: string; message: string; is_preset: boolean }
  const [tests, setTests] = useState<Test[]>([]);
  const [selectedTest, setSelectedTest] = useState("");
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});
  const [existingFeedback, setExistingFeedback] = useState<Feedback[]>([]);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("tests").select("*").eq("teacher_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => {
        setTests((data as Test[]) || []);
        if (data?.length) setSelectedTest(data[0].id);
      });
  }, [user]);

  useEffect(() => {
    if (!selectedTest || !user) return;
    const load = async () => {
      const { data: att } = await supabase
        .from("test_attempts")
        .select("*, profiles!test_attempts_student_id_fkey(full_name)")
        .eq("test_id", selectedTest)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false });
      setAttempts((att as TestAttempt[]) || []);

      const attemptIds = ((att as TestAttempt[]) || []).map(a => a.id);
      if (attemptIds.length > 0) {
        const { data: fb } = await supabase
          .from("feedback")
          .select("*")
          .in("attempt_id", attemptIds)
          .order("created_at", { ascending: false });
        setExistingFeedback((fb as Feedback[]) || []);
      }
    };
    load();
  }, [selectedTest, user]);

  const sendFeedback = async (attemptId: string) => {
    if (!user) return;
    const message = feedbackMap[attemptId];
    if (!message?.trim()) { toast.error("Enter a message"); return; }

    setSending(attemptId);
    const isPreset = PRESET_MESSAGES.includes(message);
    const { error } = await supabase.from("feedback").insert({
      attempt_id: attemptId,
      teacher_id: user.id,
      message,
      is_preset: isPreset,
    });
    setSending(null);

    if (error) { toast.error("Failed to send feedback"); return; }
    toast.success("Feedback sent!");
    setFeedbackMap(prev => ({ ...prev, [attemptId]: "" }));
    // Refresh feedback
    const { data: fb } = await supabase.from("feedback").select("*").eq("attempt_id", attemptId);
    setExistingFeedback(prev => [...prev.filter(f => f.attempt_id !== attemptId), ...(fb || [])]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Student Feedback</h1>
        <p className="text-muted-foreground">Send feedback to students on their test performance</p>
      </div>

      <Select value={selectedTest} onValueChange={setSelectedTest}>
        <SelectTrigger className="max-w-xs"><SelectValue placeholder="Select a test" /></SelectTrigger>
        <SelectContent>
          {tests.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
        </SelectContent>
      </Select>

      {attempts.length === 0 ? (
        <Card><CardContent className="pt-6"><p className="text-muted-foreground">No completed attempts for this test.</p></CardContent></Card>
      ) : (
      (attempts as TestAttempt[]).map((a: TestAttempt) => {
          const fb = existingFeedback.filter(f => f.attempt_id === a.id);
          return (
            <Card key={a.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{a.profiles?.full_name || "Student"}</CardTitle>
                  <Badge variant="outline">{Number(a.score).toFixed(0)}%</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {fb.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Previous feedback:</p>
                    {fb.map(f => (
                      <div key={f.id} className="rounded-lg bg-secondary p-3 text-sm">
                        {f.message}
                        {f.is_preset && <Badge variant="outline" className="ml-2 text-xs">Preset</Badge>}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {PRESET_MESSAGES.map(msg => (
                    <Button
                      key={msg}
                      variant="outline"
                      size="sm"
                      onClick={() => setFeedbackMap(prev => ({ ...prev, [a.id]: msg }))}
                    >
                      {msg}
                    </Button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Textarea
                    value={feedbackMap[a.id] || ""}
                    onChange={e => setFeedbackMap(prev => ({ ...prev, [a.id]: e.target.value }))}
                    placeholder="Write custom feedback…"
                    className="flex-1"
                  />
                  <Button onClick={() => sendFeedback(a.id)} disabled={sending === a.id}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
};

export default TeacherFeedback;
