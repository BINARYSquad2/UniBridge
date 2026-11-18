import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Inbox,
  Users,
  Map,
  GraduationCap,
  BookOpen,
  Kanban,
} from 'lucide-react'
import { useSession } from '../lib/session'
import '../styles/CabinetNav.css'
export function CabinetNav() {
  const { user } = useSession()
  const mentor = user?.role === 'mentor'

  const links = [
    {
      to: '/profile',
      label: 'Мой профиль',
      Icon: LayoutDashboard,
    },
    ...(mentor
      ? [
          {
            to: '/requests',
            label: 'Запросы учеников',
            Icon: Inbox,
          },
          {
            to: '/kanban',
            label: 'Kanban',
            Icon: Kanban,
          },
        ]
      : [
          {
            to: '/mentorslist',
            label: 'Менторы',
            Icon: Users,
          },
          {
            to: '/requests',
            label: 'Мои заявки',
            Icon: Inbox,
          },
          {
            to: '/roadmap',
            label: 'Roadmap',
            Icon: Map,
          },
          {
            to: '/kanban',
            label: 'Kanban',
            Icon: Kanban,
          },
        ]),
  ]

  return (
    <aside className="cabinet-sidebar">
      <div className="cabinet-identity">
        <span className="cabinet-avatar">
          {user?.full_name.slice(0, 1).toUpperCase()}
        </span>

        <strong>{user?.full_name}</strong>
        <small>{mentor ? 'Ментор' : 'Ученик'}</small>
      </div>

      <p className="cabinet-menu-label">Личный кабинет</p>

      <nav aria-label="Личный кабинет">
        {links.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              'cabinet-nav-link' + (isActive ? ' active' : '')
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {mentor && (
        <div className="cabinet-planned">
          <p className="cabinet-menu-label">Позже появятся</p>

          <div className="cabinet-nav-placeholder">
            <Users size={18} />
            <span>Мои ученики</span>
          </div>

          <div className="cabinet-nav-placeholder">
            <GraduationCap size={18} />
            <span>Занятия</span>
          </div>

          <div className="cabinet-nav-placeholder">
            <BookOpen size={18} />
            <span>Материалы</span>
          </div>
        </div>
      )}
    </aside>
  )
}