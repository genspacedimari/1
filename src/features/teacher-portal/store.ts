import { create } from 'zustand';
import type {
  QuestionCategory,
  QuestionSet,
  Question,
  Exam,
  Class,
  ClassStudent,
  ExamResult,
  StudentSummary,
  StudentDetail,
  ResultDetail,
} from './types';
import * as svc from './services';

interface TeacherPortalState {
  categories: QuestionCategory[];
  questionSets: QuestionSet[];
  questions: Question[];
  archivedQuestions: Question[];
  exams: Exam[];
  classes: Class[];
  results: ExamResult[];
  students: StudentSummary[];
  loading: boolean;
  error: string | null;

  loadCategories: () => Promise<void>;
  loadQuestionSets: () => Promise<void>;
  createQuestionSet: (name: string) => Promise<QuestionSet>;
  deleteQuestionSet: (id: string) => Promise<void>;
  createCategory: (name: string, color?: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  loadQuestions: (archived?: boolean) => Promise<void>;
  createQuestion: (input: Parameters<typeof svc.createQuestion>[0]) => Promise<Question>;
  updateQuestion: (id: string, input: Parameters<typeof svc.updateQuestion>[1]) => Promise<void>;
  duplicateQuestion: (id: string) => Promise<void>;
  archiveQuestion: (id: string, archived: boolean) => Promise<void>;
  deleteQuestion: (id: string) => Promise<void>;

  loadExams: () => Promise<void>;
  createExam: (input: Parameters<typeof svc.createExam>[0]) => Promise<Exam>;
  updateExam: (id: string, input: Parameters<typeof svc.updateExam>[1]) => Promise<void>;
  deleteExam: (id: string) => Promise<void>;
  duplicateExam: (id: string) => Promise<void>;
  setExamQuestions: (examId: string, questionIds: string[], questionSetId?: string | null, questionSelectionMode?: 'all' | 'specific' | null) => Promise<void>;

  loadClasses: () => Promise<void>;
  createClass: (name: string) => Promise<void>;
  renameClass: (id: string, name: string) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  fetchClassStudents: (classId: string) => Promise<ClassStudent[]>;

  loadResults: () => Promise<void>;
  loadStudents: () => Promise<void>;
  fetchStudentDetail: (studentId: string) => Promise<StudentDetail | null>;
  fetchResultDetail: (attemptId: string) => Promise<ResultDetail | null>;
  clear: () => void;
}

export const useTeacherStore = create<TeacherPortalState>((set, get) => ({
  categories: [],
  questionSets: [],
  questions: [],
  archivedQuestions: [],
  exams: [],
  classes: [],
  results: [],
  students: [],
  loading: false,
  error: null,

  loadCategories: async () => {
    try {
      const categories = await svc.fetchCategories();
      set({ categories });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load categories' });
    }
  },
  createCategory: async (name, color) => {
    await svc.createCategory(name, color);
    await get().loadCategories();
  },
  loadQuestionSets: async () => {
    try {
      const questionSets = await svc.fetchQuestionSets();
      set({ questionSets });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load question sets' });
    }
  },
  createQuestionSet: async (name) => {
    const created = await svc.createQuestionSet(name);
    await get().loadQuestionSets();
    return created;
  },
  deleteQuestionSet: async (id) => {
    await svc.deleteQuestionSet(id);
    await Promise.all([get().loadQuestionSets(), get().loadQuestions()]);
  },
  deleteCategory: async (id) => {
    await svc.deleteCategory(id);
    await get().loadCategories();
  },

  loadQuestions: async (archived = false) => {
    set({ loading: true, error: null });
    try {
      const questions = await svc.fetchQuestions(archived);
      if (archived) set({ archivedQuestions: questions });
      else set({ questions });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load questions' });
    } finally {
      set({ loading: false });
    }
  },
  createQuestion: async (input) => {
    const created = await svc.createQuestion(input);
    await get().loadQuestions();
    return created;
  },
  updateQuestion: async (id, input) => {
    await svc.updateQuestion(id, input);
    await get().loadQuestions();
  },
  duplicateQuestion: async (id) => {
    await svc.duplicateQuestion(id);
    await get().loadQuestions();
  },
  archiveQuestion: async (id, archived) => {
    await svc.archiveQuestion(id, archived);
    await get().loadQuestions();
    await get().loadQuestions(true);
  },
  deleteQuestion: async (id) => {
    await svc.deleteQuestion(id);
    await get().loadQuestions();
  },

  loadExams: async () => {
    try {
      const exams = await svc.fetchExams();
      set({ exams });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load exams' });
    }
  },
  createExam: async (input) => {
    const created = await svc.createExam(input);
    await get().loadExams();
    return created;
  },
  updateExam: async (id, input) => {
    await svc.updateExam(id, input);
    await get().loadExams();
  },
  deleteExam: async (id) => {
    await svc.deleteExam(id);
    await get().loadExams();
  },
  duplicateExam: async (id) => {
    await svc.duplicateExam(id);
    await get().loadExams();
  },
  setExamQuestions: async (examId, questionIds, questionSetId = null, questionSelectionMode = null) => {
    await svc.setExamQuestions(examId, questionIds, questionSetId, questionSelectionMode);
    await get().loadExams();
  },

  loadClasses: async () => {
    try {
      const classes = await svc.fetchClasses();
      set({ classes, error: null });
    } catch (err) {
      console.error('Failed to load classes:', err);
      set({ error: err instanceof Error ? err.message : 'Failed to load classes' });
    }
  },
  createClass: async (name) => {
    set({ error: null });
    try {
      await svc.createClass(name);
      await get().loadClasses();
    } catch (err) {
      console.error('Failed to create class:', err);
      const message = err instanceof Error ? err.message : 'Failed to create class';
      set({ error: message });
      // Re-throw so the page can show a toast — never fail silently.
      throw err;
    }
  },
  renameClass: async (id, name) => {
    try {
      await svc.renameClass(id, name);
      await get().loadClasses();
    } catch (err) {
      console.error('Failed to rename class:', err);
      set({ error: err instanceof Error ? err.message : 'Failed to rename class' });
      throw err;
    }
  },
  deleteClass: async (id) => {
    try {
      await svc.deleteClass(id);
      await get().loadClasses();
    } catch (err) {
      console.error('Failed to delete class:', err);
      set({ error: err instanceof Error ? err.message : 'Failed to delete class' });
      throw err;
    }
  },
  fetchClassStudents: async (classId) => {
    return svc.fetchClassStudents(classId);
  },

  loadResults: async () => {
    try {
      const results = await svc.fetchExamResults();
      set({ results });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load results' });
    }
  },

  loadStudents: async () => {
    try {
      const students = await svc.fetchStudents();
      set({ students });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load students' });
    }
  },

  fetchStudentDetail: async (studentId: string) => {
    return svc.fetchStudentDetail(studentId);
  },

  fetchResultDetail: async (attemptId: string) => {
    return svc.fetchResultDetail(attemptId);
  },

  clear: () => set({ categories: [], questions: [], archivedQuestions: [], exams: [], classes: [], results: [], students: [], error: null }),
}));
