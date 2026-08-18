import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Play } from 'lucide-react';
import { useQuizStore } from '@/features/quiz/store';
import { LadderEditorScreen } from '@/features/plc-simulator/components/LadderEditorScreen';
import { gradeLadderProgram } from '@/features/quiz/ladderGrading';
import type { LadderProject } from '@/simulator/types/ladder';

/**
 * Full-screen "Jawab dengan Simulator" flow for ladder questions: the
 * student reads the question in ExamPlayerPage, taps a button, lands here
 * on the real editor, builds/edits the program, then taps Terapkan to send
 * the result back as their answer. activeExam/answers/timer all live in
 * useQuizStore (not component state), so they survive this navigation —
 * returning to the exam player resumes exactly where the student left off.
 */
export default function LadderAnswerPage() {
  const navigate = useNavigate();
  const { questionId } = useParams<{ questionId: string }>();
  const activeExam = useQuizStore((s) => s.activeExam);
  const answers = useQuizStore((s) => s.answers);
  const answerQuestion = useQuizStore((s) => s.answerQuestion);

  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ passed: number; total: number; percent: number; failed: string[] } | null>(null);
  const [justApplied, setJustApplied] = useState(false);

  const question = useMemo(
    () => activeExam?.questions.find((q) => q.id === questionId) ?? null,
    [activeExam, questionId],
  );

  const initialJson = (answers[questionId ?? ''] as string | undefined) ?? question?.starterProgramJson ?? null;
  const project = useMemo((): LadderProject | null => {
    if (!initialJson) return null;
    try {
      const parsed = JSON.parse(initialJson) as LadderProject;
      return parsed && Array.isArray(parsed.rungs) && parsed.meta ? parsed : null;
    } catch {
      return null;
    }
  }, [initialJson]);

  const goBack = () => navigate('/quiz/exam/player');

  if (!activeExam || !question) {
    return createPortal(
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#1B1B1B' }}>
        <p style={{ color: '#FFF6EE', fontFamily: 'Inter', fontSize: 16, fontWeight: 600 }}>Soal tidak ditemukan</p>
        <button
          onClick={goBack}
          style={{ backgroundColor: '#F26B3A', border: 'none', borderRadius: 10, padding: '10px 20px', color: '#fff', fontFamily: 'Inter', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
        >
          Kembali ke Ujian
        </button>
      </div>,
      document.body,
    );
  }

  const currentDraft = (answers[question.id] as string | undefined) ?? null;

  // Applying doesn't leave the editor — the student can keep iterating
  // (edit, apply, test, edit again) and go back whenever they're done.
  // Each apply immediately updates the exam answer in the store.
  const handleApply = (ladderJson: string) => {
    answerQuestion(question.id, ladderJson);
    setJustApplied(true);
    setTimeout(() => setJustApplied(false), 2000);
  };

  const handleTest = async () => {
    if (!currentDraft || !question.testCases?.length) return;
    setTesting(true);
    try {
      setResult(await gradeLadderProgram(currentDraft, question.testCases));
    } finally {
      setTesting(false);
    }
  };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', backgroundColor: '#1B1B1B' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
          <button
            onClick={goBack}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#FFF6EE', cursor: 'pointer', flexShrink: 0 }}
            title="Kembali ke ujian"
          >
            <ArrowLeft size={16} />
          </button>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: '#F26B3A', fontFamily: 'Inter', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {question.ladderChallengeType === 'modify' ? 'Modifikasi Program' : question.ladderChallengeType === 'debug' ? 'Debug Program' : 'Buat Program'}
            </p>
            <p style={{ color: '#FFF6EE', fontFamily: 'Inter', fontSize: 13, marginTop: 2, maxWidth: 520, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
              {question.question}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {justApplied && (
            <span style={{ color: '#4ADE80', fontFamily: 'Inter', fontSize: 12, fontWeight: 600 }}>Jawaban diterapkan ✓</span>
          )}
          {result && (
            <span style={{ color: '#FFF6EE', fontFamily: 'Inter', fontSize: 12, fontWeight: 600 }}>
              {result.passed}/{result.total} passed · {result.percent}%
            </span>
          )}
          {question.testCases && question.testCases.length > 0 && (
            <button
              onClick={handleTest}
              disabled={testing || !currentDraft}
              style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#FFF6EE', padding: '8px 12px', fontFamily: 'Inter', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: testing || !currentDraft ? 0.5 : 1 }}
            >
              <Play size={13} /> {testing ? 'Testing...' : 'Test Program'}
            </button>
          )}
        </div>
      </div>

      {question.expectedOutput && (
        <div style={{ margin: '10px 16px 0', padding: '10px 14px', borderRadius: 12, backgroundColor: 'rgba(242,107,58,0.08)' }}>
          <p style={{ color: '#F26B3A', fontFamily: 'Inter', fontSize: 11, fontWeight: 700 }}>EXPECTED BEHAVIOR</p>
          <p style={{ color: '#FFF6EE', fontFamily: 'Inter', fontSize: 13, marginTop: 2 }}>{question.expectedOutput}</p>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, padding: 12 }}>
        <LadderEditorScreen
          key={initialJson ? initialJson.slice(0, 32) : 'empty'}
          initialProject={project}
          onSaveLadder={handleApply}
          saveLabel="Terapkan Jawaban"
        />
      </div>

      {result?.failed.length ? (
        <div style={{ margin: '0 16px 12px', padding: '10px 14px', borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.08)', color: '#FCA5A5', fontFamily: 'Inter', fontSize: 12 }}>
          Test gagal: {result.failed.join(', ')}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
