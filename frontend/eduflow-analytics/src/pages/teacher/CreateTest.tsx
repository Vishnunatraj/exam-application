import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Save, Eye } from "lucide-react";

interface Question {
  question_text: string;
  question_type: "mcq" | "true_false";
  options: string[];
  correct_answer: string;
  points: number;
}

const CreateTest = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState<number | "">(30);
  const [questions, setQuestions] = useState<Question[]>([
    { question_text: "", question_type: "mcq", options: ["", "", "", ""], correct_answer: "", points: 1 },
  ]);
  const [saving, setSaving] = useState(false);

  const addQuestion = () => {
    setQuestions(prev => [
      ...prev,
      { question_text: "", question_type: "mcq", options: ["", "", "", ""], correct_answer: "", points: 1 },
    ]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, field: string, value: string | string[]) => {
    setQuestions(prev => {
      const updated = [...prev];
      (updated[idx] as Record<string, unknown>)[field] = value;
      if (field === "question_type" && value === "true_false") {
        updated[idx].options = ["True", "False"];
        updated[idx].correct_answer = "";
      } else if (field === "question_type" && value === "mcq") {
        updated[idx].options = ["", "", "", ""];
        updated[idx].correct_answer = "";
      }
      return updated;
    });
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setQuestions(prev => {
      const updated = [...prev];
      updated[qIdx].options[oIdx] = value;
      return updated;
    });
  };

  const handleSave = async (publish: boolean) => {
    if (!user) return;
    if (!title.trim()) { toast.error("Title is required"); return; }
    if (questions.some(q => !q.question_text.trim() || !q.correct_answer)) {
      toast.error("All questions must have text and a correct answer");
      return;
    }

    setSaving(true);
    const { data: test, error } = await supabase
      .from("tests")
      .insert({
        teacher_id: user.id,
        title,
        description,
        duration_minutes: duration || null,
        is_published: publish,
      })
      .select()
      .single();

    if (error || !test) {
      toast.error("Failed to create test");
      setSaving(false);
      return;
    }

    const questionsToInsert = questions.map((q, i) => ({
      test_id: test.id,
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options.filter(o => o.trim()),
      correct_answer: q.correct_answer,
      points: q.points,
      sort_order: i,
    }));

    const { error: qError } = await supabase.from("questions").insert(questionsToInsert);
    setSaving(false);

    if (qError) {
      toast.error("Test created but failed to add questions");
      return;
    }

    toast.success(publish ? "Test published!" : "Test saved as draft!");
    navigate("/dashboard");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Test</h1>
        <p className="text-muted-foreground">Build a new test with questions</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Test Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Chapter 5 Quiz" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description…" />
          </div>
          <div className="space-y-2">
            <Label>Duration (minutes)</Label>
            <Input type="number" value={duration} onChange={e => setDuration(e.target.value ? Number(e.target.value) : "")} placeholder="30" />
          </div>
        </CardContent>
      </Card>

      {questions.map((q, idx) => (
        <Card key={idx}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Question {idx + 1}</CardTitle>
            {questions.length > 1 && (
              <Button variant="ghost" size="icon" onClick={() => removeQuestion(idx)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={q.question_type} onValueChange={v => updateQuestion(idx, "question_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mcq">Multiple Choice</SelectItem>
                    <SelectItem value="true_false">True / False</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Points</Label>
                <Input type="number" min={1} value={q.points} onChange={e => updateQuestion(idx, "points", Number(e.target.value))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Question</Label>
              <Textarea value={q.question_text} onChange={e => updateQuestion(idx, "question_text", e.target.value)} placeholder="Enter your question…" />
            </div>

            <div className="space-y-2">
              <Label>Options</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options.map((opt, oIdx) => (
                  <Input
                    key={oIdx}
                    value={opt}
                    onChange={e => updateOption(idx, oIdx, e.target.value)}
                    placeholder={q.question_type === "true_false" ? opt : `Option ${oIdx + 1}`}
                    disabled={q.question_type === "true_false"}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Correct Answer</Label>
              <Select value={q.correct_answer} onValueChange={v => updateQuestion(idx, "correct_answer", v)}>
                <SelectTrigger><SelectValue placeholder="Select correct answer" /></SelectTrigger>
                <SelectContent>
                  {q.options.filter(o => o.trim()).map((opt, i) => (
                    <SelectItem key={i} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" className="w-full" onClick={addQuestion}>
        <Plus className="mr-2 h-4 w-4" /> Add Question
      </Button>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={() => handleSave(false)} disabled={saving}>
          <Save className="mr-2 h-4 w-4" /> Save Draft
        </Button>
        <Button className="flex-1" onClick={() => handleSave(true)} disabled={saving}>
          <Eye className="mr-2 h-4 w-4" /> Publish
        </Button>
      </div>
    </div>
  );
};

export default CreateTest;
