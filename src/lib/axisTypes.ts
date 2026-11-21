import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Award,
  BookOpen,
  FileText,
  GraduationCap,
  UserCheck,
} from 'lucide-react';

export type TaskTypeKey =
  | 'ec'
  | 'test'
  | 'essay'
  | 'recommendation'
  | 'academic'
  | 'other';

export interface TaskTypePresentationItem {
  label: string;
  icon: LucideIcon;
}

export const TASK_TYPE_PRESENTATION: Record<TaskTypeKey, TaskTypePresentationItem> = {
  ec: { label: 'Внеучебные', icon: Activity },
  test: { label: 'Тесты', icon: BookOpen },
  essay: { label: 'Эссе', icon: FileText },
  recommendation: { label: 'Рекомендации', icon: UserCheck },
  academic: { label: 'Академические', icon: GraduationCap },
  other: { label: 'Прочее', icon: Award },
};
