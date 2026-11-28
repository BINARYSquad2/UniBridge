export type Request = {
  id: string
  student_id: string
  mentor_id: string
  student_name: string
  mentor_name: string
  message: string
  status: string
  school_grade: number
  interests: string[]
  created_at: string
}

export const REQUEST_STATUSES: Record<string, string> = {
  pending: 'Ожидает ответа',
  accepted: 'Принята',
  rejected: 'Отклонена',
  cancelled: 'Отменена',
}