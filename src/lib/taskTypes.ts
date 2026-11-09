const TASK_TYPE_LABELS: Record<string, string> = {
  academic: 'Академическая задача',
  ec: 'Внеучебная активность',
  essay: 'Эссе',
  recommendation: 'Рекомендация',
  test: 'Тест',
  other: 'Другое',
};

export function taskTypeLabel(taskType: string | undefined): string {
  const normalizedType = taskType?.trim().toLowerCase() ?? '';
  return TASK_TYPE_LABELS[normalizedType] ?? (normalizedType || TASK_TYPE_LABELS.other);
}
