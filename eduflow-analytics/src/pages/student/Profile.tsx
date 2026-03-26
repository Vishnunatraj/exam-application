import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { User, Building2, BookOpen, GraduationCap, Save } from "lucide-react";

const Profile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    college_name: "",
    department: "",
    cgpa: 0,
    current_year: 1,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (data) {
        interface ProfileData { full_name: string; email: string; college_name?: string; department?: string; cgpa?: number; current_year?: number }
        const profileData = data as ProfileData;
        setProfile({
          full_name: profileData.full_name || "",
          email: profileData.email || "",
          college_name: profileData.college_name || "",
          department: profileData.department || "",
          cgpa: Number(profileData.cgpa) || 0,
          current_year: Number(profileData.current_year) || 1,
        });
      }
    };
    load();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    type UpdateProfile = { full_name: string; college_name: string; department: string; cgpa: number; current_year: number }
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        college_name: profile.college_name,
        department: profile.department,
        cgpa: profile.cgpa,
        current_year: profile.current_year,
      } as UpdateProfile)
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error("Failed to save profile");
    else toast.success("Profile updated!");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Profile</h1>
        <p className="text-muted-foreground">Manage your personal and academic details</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={profile.full_name} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile.email} disabled className="bg-muted" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" /> Academic Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> College Name</Label>
              <Input value={profile.college_name} onChange={e => setProfile(p => ({ ...p, college_name: e.target.value }))} placeholder="Enter college name" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> Department</Label>
              <Input value={profile.department} onChange={e => setProfile(p => ({ ...p, department: e.target.value }))} placeholder="e.g. Computer Science" />
            </div>
            <div className="space-y-2">
              <Label>CGPA</Label>
              <Input type="number" min={0} max={10} step={0.01} value={profile.cgpa} onChange={e => setProfile(p => ({ ...p, cgpa: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-2">
              <Label>Current Year</Label>
              <Select value={String(profile.current_year)} onValueChange={v => setProfile(p => ({ ...p, current_year: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(y => (
                    <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
        <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Profile"}
      </Button>
    </div>
  );
};

export default Profile;
