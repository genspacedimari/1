import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Award, KeyRound, ArrowRight, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useQuizStore } from '@/features/quiz/store';

export default function QuizPage() {
  const navigate = useNavigate();
  const loadOfficialQuizzes = useQuizStore((s) => s.loadOfficialQuizzes);

  const cards = [
    {
      title: 'GENSPACE Official Quiz',
      subtitle: 'Official quizzes provided by GENSPACE.',
      button: 'Browse Quiz',
      icon: Award,
      color: '#0891B2',
      onClick: () => {
        loadOfficialQuizzes();
        navigate('/quiz/official');
      },
    },
    {
      title: 'Teacher Exam',
      subtitle: 'Join classroom examination using Exam Code.',
      button: 'Join Exam',
      icon: KeyRound,
      color: '#059669',
      onClick: () => navigate('/quiz/join'),
    },
    {
      title: 'Join Class',
      subtitle: 'Enter a class code to join your teacher\'s class.',
      button: 'Join Class',
      icon: Users,
      color: '#D97706',
      onClick: () => navigate('/quiz/join-class'),
    },
  ];

  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
  const itemVar = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="mx-auto max-w-md">
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
        {cards.map((card) => (
          <motion.div key={card.title} variants={itemVar}>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: `${card.color}15`, color: card.color }}
                  >
                    <card.icon size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-base font-semibold">{card.title}</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">{card.subtitle}</p>
                    <button
                      onClick={card.onClick}
                      className="mt-3 flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                      style={{ backgroundColor: card.color, minHeight: 44 }}
                    >
                      {card.button} <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
