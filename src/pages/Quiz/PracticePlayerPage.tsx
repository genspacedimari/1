import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, X, ChevronRight, Lightbulb, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { gradeLadderQuestion } from '@/features/quiz/ladderGrading';
import * as svc from '@/features/quiz/services';
import type { QuizQuestion } from '@/features/quiz/types';

// Built-in practice questions for each category/difficulty (fully offline)
const PRACTICE_BANK: Record<string, QuizQuestion[]> = {
  'PLC Basic': [
    { id: 'b1', type: 'multiple_choice', question: 'What does PLC stand for?', difficulty: 'easy', points: 10, explanation: 'PLC = Programmable Logic Controller, an industrial computer used for automation.', options: [
      { label: 'Programmable Logic Controller', isCorrect: true },
      { label: 'Program Logic Computer', isCorrect: false },
      { label: 'Power Line Control', isCorrect: false },
      { label: 'Process Logic Circuit', isCorrect: false },
    ], imageUrls: [] },
    { id: 'b2', type: 'multiple_choice', question: 'Which programming language is most commonly used for PLCs in ladder format?', difficulty: 'easy', points: 10, explanation: 'Ladder Logic (LD) is the most widely used PLC programming language, resembling relay logic diagrams.', options: [
      { label: 'Ladder Logic', isCorrect: true },
      { label: 'Python', isCorrect: false },
      { label: 'C++', isCorrect: false },
      { label: 'Java', isCorrect: false },
    ], imageUrls: [] },
    { id: 'b3', type: 'multiple_choice', question: 'What is the purpose of a PLC scan cycle?', difficulty: 'easy', points: 10, explanation: 'The scan cycle reads inputs, executes the ladder program, and updates outputs repeatedly.', options: [
      { label: 'Read inputs, execute logic, update outputs', isCorrect: true },
      { label: 'Display graphics, print reports', isCorrect: false },
      { label: 'Connect to internet, download updates', isCorrect: false },
      { label: 'Charge battery, cool down', isCorrect: false },
    ], imageUrls: [] },
  ],
  'PLC Intermediate': [
    { id: 'i1', type: 'multiple_choice', question: 'What is the difference between a NO (Normally Open) and NC (Normally Closed) contact?', difficulty: 'medium', points: 15, explanation: 'NO contact passes power when the input is ON. NC contact passes power when the input is OFF.', options: [
      { label: 'NO conducts when ON, NC conducts when OFF', isCorrect: true },
      { label: 'NO and NC are the same', isCorrect: false },
      { label: 'NO is for outputs, NC is for inputs', isCorrect: false },
      { label: 'NO is always on, NC is always off', isCorrect: false },
    ], imageUrls: [] },
    { id: 'i2', type: 'multiple_choice', question: 'What does a SET coil do in ladder logic?', difficulty: 'medium', points: 15, explanation: 'A SET coil latches the target bit ON when powered and it stays ON until a RESET coil turns it off.', options: [
      { label: 'Latches bit ON until RESET', isCorrect: true },
      { label: 'Turns bit OFF when powered', isCorrect: false },
      { label: 'Toggles bit every scan', isCorrect: false },
      { label: 'Only works with timers', isCorrect: false },
    ], imageUrls: [] },
  ],
  'Timer': [
    { id: 't1', type: 'multiple_choice', question: 'What does a TON (Timer On-Delay) do?', difficulty: 'medium', points: 15, explanation: 'TON starts timing when enabled. Its done bit turns ON after the preset time has elapsed.', options: [
      { label: 'Starts timing when enabled, done after preset', isCorrect: true },
      { label: 'Starts timing when disabled', isCorrect: false },
      { label: 'Counts pulses on an input', isCorrect: false },
      { label: 'Outputs immediately, delays off', isCorrect: false },
    ], imageUrls: [] },
    { id: 't2', type: 'multiple_choice', question: 'What happens to a TON timer accumulator when the enable input turns OFF?', difficulty: 'medium', points: 15, explanation: 'When enable is removed, TON resets its accumulator to 0 and the done bit turns OFF.', options: [
      { label: 'Resets to 0', isCorrect: true },
      { label: 'Keeps counting', isCorrect: false },
      { label: 'Holds last value', isCorrect: false },
      { label: 'Doubles the value', isCorrect: false },
    ], imageUrls: [] },
  ],
  'Counter': [
    { id: 'c1', type: 'multiple_choice', question: 'What does a CTU (Count Up) counter do?', difficulty: 'medium', points: 15, explanation: 'CTU increments its count value (CV) by 1 on each rising edge of the enable input.', options: [
      { label: 'Increments CV on rising edge', isCorrect: true },
      { label: 'Decrements CV on rising edge', isCorrect: false },
      { label: 'Sets CV to preset immediately', isCorrect: false },
      { label: 'Resets CV to 0 on rising edge', isCorrect: false },
    ], imageUrls: [] },
  ],
  'Memory': [
    { id: 'm1', type: 'multiple_choice', question: 'What is a memory bit (M bit) used for in PLC programming?', difficulty: 'medium', points: 15, explanation: 'Memory bits are internal storage flags used to hold intermediate logic states.', options: [
      { label: 'Internal storage for intermediate logic', isCorrect: true },
      { label: 'Physical output to a motor', isCorrect: false },
      { label: 'Timer preset value', isCorrect: false },
      { label: 'Network communication flag', isCorrect: false },
    ], imageUrls: [] },
  ],
  'Safety': [
    { id: 's1', type: 'multiple_choice', question: 'What is the purpose of an emergency stop (E-stop) in a PLC system?', difficulty: 'hard', points: 20, explanation: 'E-stop immediately removes power to all outputs regardless of PLC program logic, for safety.', options: [
      { label: 'Immediately cut power to outputs', isCorrect: true },
      { label: 'Send an email alert', isCorrect: false },
      { label: 'Log the event and continue running', isCorrect: false },
      { label: 'Reset the PLC program', isCorrect: false },
    ], imageUrls: [] },
  ],
  'Troubleshooting': [
    { id: 'tr1', type: 'multiple_choice', question: 'If a PLC output is not energizing but the logic shows it should be, what should you check first?', difficulty: 'hard', points: 20, explanation: 'Check the physical wiring and output module fuse first, then verify the ladder logic and input states.', options: [
      { label: 'Physical wiring and output module', isCorrect: true },
      { label: 'Reboot the PLC', isCorrect: false },
      { label: 'Rewrite the entire program', isCorrect: false },
      { label: 'Replace the PLC', isCorrect: false },
    ], imageUrls: [] },
  ],
};

function getPracticeQuestions(category: string, difficulty: string): QuizQuestion[] {
  if (category === 'Random') {
    const all = Object.values(PRACTICE_BANK).flat();
    return all.filter((q) => q.difficulty === difficulty || difficulty === 'easy');
  }
  const bank = PRACTICE_BANK[category] ?? PRACTICE_BANK['PLC Basic'];
  return bank.filter((q) => q.difficulty === difficulty || difficulty === 'easy');
}

export default function PracticePlayerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as { category: string; difficulty: string } | null) ?? { category: 'PLC Basic', difficulty: 'easy' };

  const questions = getPracticeQuestions(state.category, state.difficulty);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [ladderAnswer, setLadderAnswer] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [startTime] = useState(Date.now());
  const [finished, setFinished] = useState(false);

  const currentQ = questions[currentIndex];

  const handleAnswer = (index: number) => {
    if (showFeedback) return;
    setSelectedAnswer(index);
    const correct = currentQ.options[index]?.isCorrect ?? false;
    setIsCorrect(correct);
    if (correct) setCorrectCount((c) => c + 1);
    setShowFeedback(true);
  };

  const handleLadderAnswer = () => {
    if (showFeedback || !ladderAnswer.trim()) return;
    const correct = gradeLadderQuestion(currentQ, ladderAnswer);
    setIsCorrect(correct);
    if (correct) setCorrectCount((c) => c + 1);
    setShowFeedback(true);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setLadderAnswer('');
      setShowFeedback(false);
    } else {
      // Finished
      const score = Math.round((correctCount / questions.length) * 100);
      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
      svc.savePracticeAttempt({
        category: state.category,
        difficulty: state.difficulty,
        score,
        totalQuestions: questions.length,
        correctCount,
        durationSeconds,
      }).catch(() => {});
      setFinished(true);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">No practice questions available for this category/difficulty yet.</p>
            <Button onClick={() => navigate('/quiz/practice')}>Back to Practice</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (finished) {
    const score = Math.round((correctCount / questions.length) * 100);
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <Trophy size={36} className="text-primary" />
            </div>
            <p className="font-display text-4xl font-bold text-primary">{score}%</p>
            <p className="text-sm text-muted-foreground">{correctCount} of {questions.length} correct</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate('/quiz/practice')}>Practice Again</Button>
              <Button onClick={() => navigate('/quiz')}>Done</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => navigate('/quiz/practice')} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <span className="text-sm font-medium">Q{currentIndex + 1} / {questions.length}</span>
        <span className="text-xs text-muted-foreground">{state.category} · {state.difficulty}</span>
      </div>

      {/* Progress */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60 dark:bg-white/10">
        <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
      </div>

      {/* Question */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-medium capitalize text-primary">{currentQ.type.replace('_', ' ')}</span>
            <span className="text-xs text-muted-foreground">{currentQ.points} pts</span>
          </div>
          <p className="text-base font-medium">{currentQ.question}</p>

          {/* Images */}
          {currentQ.imageUrls.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {currentQ.imageUrls.map((url, i) => (
                <img key={i} src={url} alt={`Q ${i + 1}`} className="max-h-48 rounded-2xl" />
              ))}
            </div>
          )}

          {/* MC / Image options */}
          {(currentQ.type === 'multiple_choice' || currentQ.type === 'image') && (
            <div className="space-y-2">
              {currentQ.options.map((opt, i) => {
                const selected = selectedAnswer === i;
                const showCorrect = showFeedback && opt.isCorrect;
                const showWrong = showFeedback && selected && !opt.isCorrect;
                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(i)}
                    disabled={showFeedback}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl border p-4 text-left text-sm transition-all',
                      showCorrect ? 'border-emerald-500 bg-emerald-500/10' :
                      showWrong ? 'border-red-500 bg-red-500/10' :
                      selected ? 'border-primary bg-primary/10' :
                      'border-border hover:bg-muted/30 dark:border-border-dark dark:hover:bg-white/5'
                    )}
                    style={{ minHeight: 44 }}
                  >
                    <span className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-colors',
                      showCorrect ? 'bg-emerald-500 text-white' :
                      showWrong ? 'bg-red-500 text-white' :
                      'bg-muted/40 text-muted-foreground dark:bg-white/5'
                    )}>
                      {showCorrect ? <Check size={16} /> : showWrong ? <X size={16} /> : String.fromCharCode(65 + i)}
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Ladder question */}
          {currentQ.type === 'ladder' && (
            <div className="space-y-3">
              {currentQ.expectedOutput && (
                <div className="rounded-xl bg-primary/5 p-3 dark:bg-primary/10">
                  <p className="text-xs font-medium text-primary">Expected Output</p>
                  <p className="mt-1 text-sm">{currentQ.expectedOutput}</p>
                </div>
              )}
              <textarea
                value={ladderAnswer}
                onChange={(e) => setLadderAnswer(e.target.value)}
                disabled={showFeedback}
                rows={6}
                className="w-full rounded-2xl border border-border bg-surface px-4 py-3 font-mono text-xs outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                placeholder="Paste your ladder JSON here..."
              />
              {!showFeedback && (
                <Button onClick={handleLadderAnswer} disabled={!ladderAnswer.trim()} className="w-full">Submit Answer</Button>
              )}
            </div>
          )}

          {/* Feedback */}
          <AnimatePresence>
            {showFeedback && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={cn(
                  'rounded-2xl p-4',
                  isCorrect ? 'bg-emerald-500/10' : 'bg-red-500/10'
                )}
              >
                <div className="flex items-start gap-2">
                  {isCorrect ? <Check size={20} className="text-emerald-600 shrink-0 mt-0.5" /> : <X size={20} className="text-red-500 shrink-0 mt-0.5" />}
                  <div>
                    <p className={cn('text-sm font-semibold', isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                      {isCorrect ? 'Correct!' : 'Incorrect'}
                    </p>
                    {currentQ.explanation && (
                      <p className="mt-1 flex items-start gap-1 text-sm text-muted-foreground">
                        <Lightbulb size={14} className="shrink-0 mt-0.5" /> {currentQ.explanation}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {showFeedback && (
            <Button onClick={handleNext} className="w-full">
              {currentIndex < questions.length - 1 ? 'Next Question' : 'Finish'} <ChevronRight size={16} />
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
