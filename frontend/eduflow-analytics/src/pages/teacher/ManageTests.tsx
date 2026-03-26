import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const ManageTests = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  interface Test { id: string; title: string; is_published: boolean; created_at: string; teacher_id: string; questions?: { id: string }[] }
  const [tests, setTests] = useState<Test[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tests")
      .select("*, questions(id)")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });
    setTests((data as Test[]) || []);
  };

  useEffect(() => { load(); }, [user, load]);

  const togglePublish = async (test: Test) => {
    const { error } = await supabase
      .from("tests")
      .update({ is_published: !test.is_published })
      .eq("id", test.id);
    if (error) toast.error("Failed to update");
    else { toast.success(test.is_published ? "Unpublished" : "Published"); load(); }
  };

  const deleteTest = async (id: string) => {
    // Delete questions, then attempts/responses, then test
    await supabase.from("questions").delete().eq("test_id", id);
    const { data: attempts } = await supabase.from("test_attempts").select("id").eq("test_id", id);
    if (attempts?.length) {
      const attemptIds = attempts.map(a => a.id);
      await supabase.from("student_responses").delete().in("attempt_id", attemptIds);
      await supabase.from("feedback").delete().in("attempt_id", attemptIds);
      await supabase.from("test_attempts").delete().eq("test_id", id);
    }
    const { error } = await supabase.from("tests").delete().eq("id", id);
    if (error) toast.error("Failed to delete test");
    else { toast.success("Test deleted"); load(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage Tests</h1>
          <p className="text-muted-foreground">Edit, publish, or delete your tests</p>
        </div>
        <Button onClick={() => navigate("/tests/create")}>+ New Test</Button>
      </div>

      {tests.length === 0 ? (
        <Card><CardContent className="pt-6"><p className="text-muted-foreground">No tests created yet.</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {tests.map(test => (
            <Card key={test.id}>
              <CardContent className="flex items-center justify-between py-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-lg">{test.title}</p>
                    <Badge variant={test.is_published ? "default" : "secondary"}>
                      {test.is_published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {test.questions?.length || 0} questions · {test.duration_minutes ? `${test.duration_minutes} min` : "No time limit"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => togglePublish(test)} title={test.is_published ? "Unpublish" : "Publish"}>
                    {test.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => navigate(`/tests/${test.id}/edit`)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete "{test.title}"?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete the test, all questions, and student attempts. This cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteTest(test.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManageTests;
