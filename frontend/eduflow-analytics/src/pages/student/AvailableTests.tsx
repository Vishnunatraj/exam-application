import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { Clock, FileText, Search } from "lucide-react";

const AvailableTests = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  interface Test { id: string; title: string; description: string; duration_minutes: number; is_published: boolean; created_at: string; teacher_id: string; profiles?: { full_name: string } }
  const [tests, setTests] = useState<Test[]>([]);
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("tests")
        .select("*, profiles!tests_teacher_id_fkey(full_name)")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      setTests((data as Test[]) || []);

      const { data: attempts } = await supabase
        .from("test_attempts")
        .select("test_id")
        .eq("student_id", user.id)
        .not("completed_at", "is", null);

      const counts: Record<string, number> = {};
      (attempts || []).forEach(a => { counts[a.test_id] = (counts[a.test_id] || 0) + 1; });
      setAttemptCounts(counts);
    };
    load();
  }, [user]);

  const teachers = useMemo(() => {
    const names = new Set<string>();
    tests.forEach(t => { if (t.profiles?.full_name) names.add(t.profiles.full_name); });
    return Array.from(names).sort();
  }, [tests]);

  const filtered = useMemo(() => {
    return tests.filter(t => {
      const matchSearch = !search ||
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        (t.description || "").toLowerCase().includes(search.toLowerCase());
      const matchTeacher = teacherFilter === "all" || t.profiles?.full_name === teacherFilter;
      const matchStatus = statusFilter === "all" ||
        (statusFilter === "completed" && attemptCounts[t.id]) ||
        (statusFilter === "pending" && !attemptCounts[t.id]);
      return matchSearch && matchTeacher && matchStatus;
    });
  }, [tests, search, teacherFilter, statusFilter, attemptCounts]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Available Tests</h1>
        <p className="text-muted-foreground">Browse and take published tests</p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title or description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={teacherFilter} onValueChange={setTeacherFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Teacher" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teachers</SelectItem>
            {teachers.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Not Attempted</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} test{filtered.length !== 1 ? "s" : ""} found</p>

      {filtered.length === 0 ? (
        <Card><CardContent className="pt-6"><p className="text-muted-foreground">No tests match your search.</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map(test => (
            <Card key={test.id} className="transition-shadow hover:shadow-lg">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{test.title}</CardTitle>
                  {attemptCounts[test.id] && (
                    <Badge variant="secondary">{attemptCounts[test.id]}x attempted</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {test.description && <p className="text-sm text-muted-foreground">{test.description}</p>}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><FileText className="h-4 w-4" /> By {test.profiles?.full_name || "Teacher"}</span>
                  {test.duration_minutes && (
                    <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {test.duration_minutes} min</span>
                  )}
                </div>
                {attemptCounts[test.id] ? (
                  <Button className="w-full" variant="secondary" disabled>Completed</Button>
                ) : (
                  <Button className="w-full" onClick={() => navigate(`/tests/${test.id}/take`)}>Start Test</Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AvailableTests;
