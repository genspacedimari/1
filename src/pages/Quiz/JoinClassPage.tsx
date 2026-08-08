import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, KeyRound, CircleAlert as AlertCircle, Users, User, FileText, Building2, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/services/supabaseClient';
import { useAuthStore } from '@/stores/authStore';

interface ClassPreview {
  classId: string;
  className: string;
  teacherName: string;
  schoolName: string | null;
  studentCount: number;
  examCount: number;
  joinCode: string;
}

export default function JoinClassPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ClassPreview | null>(null);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  const handleValidate = async () => {
    setError(null);
    setPreview(null);
    if (code.trim().length < 5) {
      setError('Enter a valid class code');
      return;
    }
    setLoading(true);
    try {
      const { data: classRow, error: qErr } = await supabase
        .from('classes')
        .select('id, name, teacher_id, join_code')
        .eq('join_code', code.trim().toUpperCase())
        .maybeSingle();
      if (qErr || !classRow) {
        setError('Class not found. Check the code and try again.');
        return;
      }

      // Fetch teacher name
      const { data: teacher } = await supabase
        .from('profiles')
        .select('full_name, school_id')
        .eq('id', (classRow as { teacher_id: string }).teacher_id)
        .maybeSingle();
      const teacherName = (teacher as { full_name: string } | null)?.full_name ?? 'Unknown';

      // Fetch school name
      let schoolName: string | null = null;
      const teacherSchoolId = (teacher as { school_id: string | null } | null)?.school_id;
      if (teacherSchoolId) {
        const { data: school } = await supabase
          .from('schools')
          .select('name')
          .eq('id', teacherSchoolId)
          .maybeSingle();
        schoolName = (school as { name: string } | null)?.name ?? null;
      }

      // Count students
      const { count: studentCount } = await supabase
        .from('class_students')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', (classRow as { id: string }).id);

      // Count exams by this teacher
      const { count: examCount } = await supabase
        .from('exams')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', (classRow as { teacher_id: string }).teacher_id)
        .eq('status', 'published');

      setPreview({
        classId: (classRow as { id: string }).id,
        className: (classRow as { name: string }).name,
        teacherName,
        schoolName,
        studentCount: studentCount ?? 0,
        examCount: examCount ?? 0,
        joinCode: (classRow as { join_code: string }).join_code,
      });
    } catch {
      setError('Failed to validate class code.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!preview || !user) return;
    setJoining(true);
    setError(null);
    try {
      // Check if already a member
      const { data: existing } = await supabase
        .from('class_students')
        .select('id')
        .eq('class_id', preview.classId)
        .eq('student_id', user.id)
        .maybeSingle();
      if (existing) {
        setError('You are already a member of this class.');
        return;
      }
      const { error: insertErr } = await supabase
        .from('class_students')
        .insert({ class_id: preview.classId, student_id: user.id });
      if (insertErr) throw insertErr;
      setJoined(true);
      setTimeout(() => navigate(`/class/${preview.classId}`), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join class.');
    } finally {
      setJoining(false);
    }
  };

  const inputClass = 'w-full rounded-2xl border border-border bg-surface px-4 py-3 text-center font-mono text-lg tracking-wider outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark';

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/community')} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-xl font-semibold">Join Class</h1>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-center pb-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <KeyRound size={28} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Class Code</label>
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); setPreview(null); }}
              onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
              placeholder="PLC-CLASS-XXXX"
              className={inputClass}
              maxLength={20}
              style={{ minHeight: 44 }}
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <Button onClick={handleValidate} disabled={loading} className="w-full" size="lg">
            {loading ? 'Validating...' : 'Validate Code'}
          </Button>
        </CardContent>
      </Card>

      <AnimatePresence>
        {preview && !joined && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card>
              <CardContent className="space-y-4 p-5">
                <div>
                  <h2 className="font-display text-lg font-semibold">{preview.className}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Review the class details before joining.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <InfoRow icon={User} label="Teacher" value={preview.teacherName} />
                  <InfoRow icon={Building2} label="School" value={preview.schoolName ?? 'Not set'} />
                  <InfoRow icon={Users} label="Students" value={`${preview.studentCount}`} />
                  <InfoRow icon={FileText} label="Exams" value={`${preview.examCount}`} />
                </div>

                <div className="rounded-2xl bg-muted/30 p-3 text-center dark:bg-white/5">
                  <p className="text-xs text-muted-foreground">Join Code</p>
                  <p className="font-mono text-lg font-semibold text-primary">{preview.joinCode}</p>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setPreview(null); setCode(''); }} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={handleJoin} disabled={joining} className="flex-1">
                    {joining ? 'Joining...' : 'Join'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {joined && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <Card>
              <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <Check size={28} />
                </div>
                <p className="text-sm font-medium">Successfully joined {preview?.className}!</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={16} className="shrink-0 text-muted-foreground" />
      <div>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
