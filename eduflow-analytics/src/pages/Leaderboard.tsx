import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award } from "lucide-react";

interface LeaderboardEntry {
  student_id: string;
  full_name: string;
  avg_score: number;
  tests_taken: number;
  total_points: number;
}

const Leaderboard = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // Get all completed attempts with student profiles
      const { data } = await supabase
        .from("test_attempts")
        .select("student_id, score, earned_points, profiles!test_attempts_student_id_fkey(full_name)")
        .not("completed_at", "is", null);

      if (!data) {
        setLoading(false);
        return;
      }

      // Aggregate by student
      const map = new Map<string, { full_name: string; scores: number[]; points: number }>();
      data.forEach((a: { student_id: string; score: number; earned_points: number; profiles?: { full_name: string } }) => {
        const id = a.student_id;
        const name = a.profiles?.full_name || "Unknown";
        if (!map.has(id)) map.set(id, { full_name: name, scores: [], points: 0 });
        const entry = map.get(id)!;
        entry.scores.push(Number(a.score) || 0);
        entry.points += Number(a.earned_points) || 0;
      });

      const list: LeaderboardEntry[] = Array.from(map.entries()).map(([student_id, v]) => ({
        student_id,
        full_name: v.full_name,
        avg_score: Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length),
        tests_taken: v.scores.length,
        total_points: v.points,
      }));

      list.sort((a, b) => b.avg_score - a.avg_score || b.total_points - a.total_points);
      setEntries(list);
      setLoading(false);
    };
    load();
  }, []);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-6 w-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-gray-400" />;
    if (rank === 3) return <Award className="h-6 w-6 text-amber-600" />;
    return <span className="flex h-6 w-6 items-center justify-center text-sm font-bold text-muted-foreground">{rank}</span>;
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]";
    if (score >= 60) return "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]";
    return "bg-destructive text-destructive-foreground";
  };

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
        <h1 className="text-3xl font-bold">🏆 Leaderboard</h1>
        <p className="text-muted-foreground">Top-performing students across all tests</p>
      </div>

      {/* Top 3 Podium */}
      {entries.length >= 3 && (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 0, 2].map((idx) => {
            const e = entries[idx];
            const rank = idx + 1;
            const isFirst = rank === 1;
            return (
              <Card key={e.student_id} className={`text-center ${isFirst ? "border-yellow-500/50 shadow-lg md:order-first md:-mt-4" : ""}`}>
                <CardContent className="pt-6">
                  <div className="mb-2 flex justify-center">{getRankIcon(rank)}</div>
                  <h3 className={`font-bold ${isFirst ? "text-xl" : "text-lg"}`}>{e.full_name}</h3>
                  <Badge className={`mt-2 ${getScoreBadge(e.avg_score)}`}>{e.avg_score}% avg</Badge>
                  <div className="mt-3 flex justify-center gap-4 text-sm text-muted-foreground">
                    <span>{e.tests_taken} tests</span>
                    <span>{e.total_points} pts</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Full List */}
      <Card>
        <CardHeader><CardTitle>All Rankings</CardTitle></CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-center text-muted-foreground">No completed tests yet.</p>
          ) : (
            <div className="space-y-2">
              {entries.map((e, i) => (
                <div key={e.student_id} className="flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-secondary/50">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center">{getRankIcon(i + 1)}</div>
                  <div className="flex-1">
                    <p className="font-medium">{e.full_name}</p>
                    <p className="text-xs text-muted-foreground">{e.tests_taken} tests • {e.total_points} total points</p>
                  </div>
                  <Badge className={getScoreBadge(e.avg_score)}>{e.avg_score}%</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Leaderboard;
