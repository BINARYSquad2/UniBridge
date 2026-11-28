const TASK_TYPE_LABELS: Record<string, string> = {
  academic: 'Академическая задача',
  ec: 'Внеучебная активность',
  essay: 'Эссе',
  recommendation: 'Рекомендация',
  test: 'Тест',
  other: 'Другое',
};

export const TASK_TYPE_OPTIONS = [
  { value: 'academic', label: TASK_TYPE_LABELS.academic },
  { value: 'ec', label: TASK_TYPE_LABELS.ec },
  { value: 'essay', label: TASK_TYPE_LABELS.essay },
  { value: 'recommendation', label: TASK_TYPE_LABELS.recommendation },
  { value: 'test', label: TASK_TYPE_LABELS.test },
  { value: 'other', label: TASK_TYPE_LABELS.other },
] as const;

export function taskTypeLabel(taskType: string | undefined): string {
  const normalizedType = taskType?.trim().toLowerCase() ?? '';
  return TASK_TYPE_LABELS[normalizedType] ?? (normalizedType || TASK_TYPE_LABELS.other);
}
