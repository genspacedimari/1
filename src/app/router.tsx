import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from '@/components/layout/RootLayout';
import { RequireAuth, RedirectIfAuthed } from '@/components/auth/RequireAuth';
import { TeacherPortalLayout } from '@/features/teacher-portal/TeacherPortalLayout';

const HomePage = lazy(() => import('@/pages/Home'));
const ProjectManagerPage = lazy(() => import('@/pages/ProjectManager'));
const PlcSimulatorPage = lazy(() => import('@/pages/PlcSimulator'));
const QuizPage = lazy(() => import('@/pages/Quiz'));
const PracticePickerPage = lazy(() => import('@/pages/Quiz/PracticePickerPage'));
const PracticePlayerPage = lazy(() => import('@/pages/Quiz/PracticePlayerPage'));
const OfficialQuizPage = lazy(() => import('@/pages/Quiz/OfficialQuizPage'));
const OfficialQuizPlayerPage = lazy(() => import('@/pages/Quiz/OfficialQuizPlayerPage'));
const JoinExamPage = lazy(() => import('@/pages/Quiz/JoinExamPage'));
const JoinClassPage = lazy(() => import('@/pages/Quiz/JoinClassPage'));
const ExamPlayerPage = lazy(() => import('@/pages/Quiz/ExamPlayerPage'));
const QuizResultPage = lazy(() => import('@/pages/Quiz/QuizResultPage'));
const QuizReviewPage = lazy(() => import('@/pages/Quiz/QuizReviewPage'));
const QuizHistoryPage = lazy(() => import('@/pages/Quiz/QuizHistoryPage'));
const LeaderboardPage = lazy(() => import('@/pages/Quiz/LeaderboardPage'));
const StudentClassDetailPage = lazy(() => import('@/pages/Quiz/StudentClassDetailPage'));
const MaterialsPage = lazy(() => import('@/pages/Materials'));
const ProfilePage = lazy(() => import('@/pages/Profile'));
const RankingPage = lazy(() => import('@/pages/Ranking'));
const SettingsPage = lazy(() => import('@/pages/Settings'));
const AdminDashboardPage = lazy(() => import('@/pages/AdminDashboard'));
const AdminQuizContentPage = lazy(() => import('@/pages/AdminDashboard/QuizContentPage'));
const AdminCompetitionPage = lazy(() => import('@/pages/AdminDashboard/CompetitionPage'));
const LoginPage = lazy(() => import('@/pages/Login'));
const RegisterPage = lazy(() => import('@/pages/Register'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPassword'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPassword'));
const WelcomeWizardPage = lazy(() => import('@/pages/WelcomeWizard'));
const JoinCommunityPage = lazy(() => import('@/pages/JoinCommunity'));
const CommunityViewPage = lazy(() => import('@/pages/Community'));

const TeacherDashboard = lazy(() =>
  import('@/features/teacher-portal/pages/TeacherDashboard').then((m) => ({ default: m.TeacherDashboard })),
);
const QuestionBankPage = lazy(() =>
  import('@/features/teacher-portal/pages/QuestionBankPage').then((m) => ({ default: m.QuestionBankPage })),
);
const QuestionEditorPage = lazy(() =>
  import('@/features/teacher-portal/pages/QuestionEditorPage').then((m) => ({ default: m.QuestionEditorPage })),
);
const QuestionPreviewPage = lazy(() =>
  import('@/features/teacher-portal/pages/QuestionPreviewPage').then((m) => ({ default: m.QuestionPreviewPage })),
);
const QuestionSetPage = lazy(() =>
  import('@/features/teacher-portal/pages/QuestionSetPage').then((m) => ({ default: m.QuestionSetPage })),
);
const QuestionImportPage = lazy(() =>
  import('@/features/teacher-portal/pages/QuestionImportPage').then((m) => ({ default: m.QuestionImportPage })),
);
const ExamsPage = lazy(() =>
  import('@/features/teacher-portal/pages/ExamsPage').then((m) => ({ default: m.ExamsPage })),
);
const ExamEditorPage = lazy(() =>
  import('@/features/teacher-portal/pages/ExamEditorPage').then((m) => ({ default: m.ExamEditorPage })),
);
const ExamPreviewPage = lazy(() =>
  import('@/features/teacher-portal/pages/ExamPreviewPage').then((m) => ({ default: m.ExamPreviewPage })),
);
const ExamResultsPage = lazy(() =>
  import('@/features/teacher-portal/pages/ExamResultsPage').then((m) => ({ default: m.ExamResultsPage })),
);
const ClassesPage = lazy(() =>
  import('@/features/teacher-portal/pages/ClassesPage').then((m) => ({ default: m.ClassesPage })),
);
const TeacherClassDetailPage = lazy(() =>
  import('@/features/teacher-portal/pages/TeacherClassDetailPage').then((m) => ({ default: m.TeacherClassDetailPage })),
);
const StudentsPage = lazy(() =>
  import('@/features/teacher-portal/pages/StudentsPage').then((m) => ({ default: m.StudentsPage })),
);
const StudentDetailPage = lazy(() =>
  import('@/features/teacher-portal/pages/StudentDetailPage').then((m) => ({ default: m.StudentDetailPage })),
);
const ResultsPage = lazy(() =>
  import('@/features/teacher-portal/pages/ResultsPage').then((m) => ({ default: m.ResultsPage })),
);
const ResultDetailPage = lazy(() =>
  import('@/features/teacher-portal/pages/ResultDetailPage').then((m) => ({ default: m.ResultDetailPage })),
);
const TeacherSettingsPage = lazy(() =>
  import('@/features/teacher-portal/pages/TeacherSettingsPage').then((m) => ({ default: m.TeacherSettingsPage })),
);
const CommunityPage = lazy(() =>
  import('@/features/teacher-portal/pages/CommunityPage').then((m) => ({ default: m.CommunityPage })),
);

function PageLoader() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60" />
    </div>
  );
}

function withSuspense(element: React.ReactNode) {
  return <Suspense fallback={<PageLoader />}>{element}</Suspense>;
}

/**
 * Route tree.
 *
 * Auth screens (login, register, forgot/reset password) live OUTSIDE
 * RootLayout — they are full-screen and redirect authenticated users away.
 *
 * App screens live INSIDE RootLayout behind RequireAuth. Role-specific
 * routes (teacher, admin) pass an allowed-roles list so a student hitting
 * /teacher is bounced to their own dashboard.
 *
 * Teacher Portal is a self-contained layout with its own sidebar/bottom
 * nav, mounted under /teacher/* and guarded by RequireAuth with roles
 * ['teacher', 'admin'].
 */
export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <RedirectIfAuthed>
        {withSuspense(<LoginPage />)}
      </RedirectIfAuthed>
    ),
  },
  {
    path: '/register',
    element: (
      <RedirectIfAuthed>
        {withSuspense(<RegisterPage />)}
      </RedirectIfAuthed>
    ),
  },
  {
    path: '/forgot-password',
    element: (
      <RedirectIfAuthed>
        {withSuspense(<ForgotPasswordPage />)}
      </RedirectIfAuthed>
    ),
  },
  {
    path: '/reset-password',
    element: (
      <RedirectIfAuthed>
        {withSuspense(<ResetPasswordPage />)}
      </RedirectIfAuthed>
    ),
  },
  {
    path: '/welcome',
    element: (
      <RequireAuth>
        {withSuspense(<WelcomeWizardPage />)}
      </RequireAuth>
    ),
  },
  {
    path: '/join-community',
    element: (
      <RequireAuth>
        {withSuspense(<JoinCommunityPage />)}
      </RequireAuth>
    ),
  },
  {
    path: '/join/:code',
    element: (
      <RequireAuth>
        {withSuspense(<JoinCommunityPage />)}
      </RequireAuth>
    ),
  },
  {
    path: '/teacher',
    element: (
      <RequireAuth roles={['teacher', 'admin']}>
        <TeacherPortalLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: withSuspense(<TeacherDashboard />) },
      { path: 'community', element: withSuspense(<CommunityPage />) },
      { path: 'questions', element: withSuspense(<QuestionBankPage />) },
      { path: 'questions/new', element: withSuspense(<QuestionEditorPage />) },
      { path: 'questions/import', element: withSuspense(<QuestionImportPage />) },
      { path: 'questions/sets/:id', element: withSuspense(<QuestionSetPage />) },
      { path: 'questions/:id/edit', element: withSuspense(<QuestionEditorPage />) },
      { path: 'questions/:id/preview', element: withSuspense(<QuestionPreviewPage />) },
      { path: 'exams', element: withSuspense(<ExamsPage />) },
      { path: 'exams/new', element: withSuspense(<ExamEditorPage />) },
      { path: 'exams/:id/edit', element: withSuspense(<ExamEditorPage />) },
      { path: 'exams/:id/preview', element: withSuspense(<ExamPreviewPage />) },
      { path: 'exams/:id/results', element: withSuspense(<ExamResultsPage />) },
      { path: 'classes', element: withSuspense(<ClassesPage />) },
      { path: 'classes/:classId', element: withSuspense(<TeacherClassDetailPage />) },
      { path: 'students', element: withSuspense(<StudentsPage />) },
      { path: 'students/:id', element: withSuspense(<StudentDetailPage />) },
      { path: 'results', element: withSuspense(<ResultsPage />) },
      { path: 'results/:id', element: withSuspense(<ResultDetailPage />) },
      { path: 'settings', element: withSuspense(<TeacherSettingsPage />) },
    ],
  },
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: withSuspense(<HomePage />) },
      { path: 'simulator', element: withSuspense(<ProjectManagerPage />) },
      { path: 'simulator/editor/:projectId', element: withSuspense(<PlcSimulatorPage />) },
      { path: 'quiz', element: withSuspense(<QuizPage />) },
      { path: 'quiz/practice', element: withSuspense(<PracticePickerPage />) },
      { path: 'quiz/practice/player', element: withSuspense(<PracticePlayerPage />) },
      { path: 'quiz/official', element: withSuspense(<OfficialQuizPage />) },
      { path: 'quiz/official/:id', element: withSuspense(<OfficialQuizPlayerPage />) },
      { path: 'quiz/join', element: withSuspense(<JoinExamPage />) },
      { path: 'quiz/join-class', element: withSuspense(<JoinClassPage />) },
      {
        path: 'quiz/exam/player',
        element: (
          <RequireAuth>
            {withSuspense(<ExamPlayerPage />)}
          </RequireAuth>
        ),
      },
      { path: 'quiz/result', element: withSuspense(<QuizResultPage />) },
      { path: 'quiz/review', element: withSuspense(<QuizReviewPage />) },
      { path: 'quiz/history', element: withSuspense(<QuizHistoryPage />) },
      { path: 'quiz/leaderboard', element: withSuspense(<LeaderboardPage />) },
      {
        path: 'class/:classId',
        element: (
          <RequireAuth>
            {withSuspense(<StudentClassDetailPage />)}
          </RequireAuth>
        ),
      },
      { path: 'materials', element: withSuspense(<MaterialsPage />) },
      {
        path: 'community',
        element: (
          <RequireAuth>
            {withSuspense(<CommunityViewPage />)}
          </RequireAuth>
        ),
      },
      {
        path: 'profile',
        element: (
          <RequireAuth>
            {withSuspense(<ProfilePage />)}
          </RequireAuth>
        ),
      },
      { path: 'ranking', element: withSuspense(<RankingPage />) },
      {
        path: 'admin',
        element: (
          <RequireAuth roles={['admin']}>
            {withSuspense(<AdminDashboardPage />)}
          </RequireAuth>
        ),
      },
      { path: 'admin/practice', element: <RequireAuth roles={['admin']}>{withSuspense(<AdminQuizContentPage kind="practice" />)}</RequireAuth> },
      { path: 'admin/official', element: <RequireAuth roles={['admin']}>{withSuspense(<AdminQuizContentPage kind="official" />)}</RequireAuth> },
      { path: 'admin/competition', element: <RequireAuth roles={['admin']}>{withSuspense(<AdminCompetitionPage />)}</RequireAuth> },
      { path: 'settings', element: withSuspense(<SettingsPage />) },
    ],
  },
]);
