import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import jobsortLight from '../assets/jobsort_light.png';
import jobsortDark from '../assets/jobsort_dark.png';

const navItems = [
  {
    label: 'Dashboard',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    to: '/',
  },
  {
    label: 'Job Board',
    icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2',
    to: '/board',
  },
  {
    label: 'Job Search',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    to: '/job-search',
  },
  {
    label: 'Analytics',
    icon: 'M2 13l6 6 4-4 8 8V3H2v10z',
    to: '/analytics',
  },
  {
    label: 'Gap Analyzer',
    icon: 'M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z',
    to: '/gap-analyzer',
  },
  {
    label: 'Interview Prep',
    icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
    to: '/interview-prep',
  },
];

export default function Sidebar({ open, setOpen }) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed top-4 left-4 z-30 rounded-md bg-[var(--geist-foreground)] p-2 text-[var(--geist-background)] lg:hidden"
        onClick={() => setOpen(!open)}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d={open ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
          />
        </svg>
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-20 flex flex-col bg-[var(--geist-background)] dark:bg-black
          shadow-[0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]
          transform transition-all duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:inset-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
          ${collapsed ? 'w-16' : 'w-60'}`}
      >
        {/* Logo */}
        <div
          className={`flex h-14 items-center px-4 ${
            collapsed ? 'justify-center' : 'justify-between'
          }`}
          style={{ boxShadow: '0 1px 0 0 rgba(0,0,0,0.06)' }}
        >
          <div className="flex items-center gap-3">
            <img
              src={dark ? jobsortDark : jobsortLight}
              alt="JobSort"
              className={collapsed ? 'h-7 w-7 object-cover' : 'h-7'}
            />
            {!collapsed && (
              <span className="text-base font-bold text-[var(--geist-foreground)] tracking-wide">
                JOBSORT
              </span>
            )}
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-md p-1.5 text-[var(--accents-4)] hover:bg-[var(--accents-1)] hover:text-[var(--geist-foreground)] transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d={
                  collapsed
                    ? 'M13 5l7 7-7 7M5 5l7 7-7 7'
                    : 'M11 19l-7-7 7-7m8 14l-7-7 7-7'
                }
              />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[var(--accents-1)] text-[var(--geist-foreground)]'
                    : 'text-[var(--accents-5)] hover:bg-[var(--accents-1)] hover:text-[var(--geist-foreground)]'
                } ${collapsed ? 'justify-center px-0' : ''}`
              }
              title={collapsed ? item.label : undefined}
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
              </svg>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="p-2 space-y-0.5" style={{ boxShadow: '0 -1px 0 0 rgba(0,0,0,0.06)' }}>
          {/* Theme toggle */}
          <button
            onClick={toggle}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[var(--accents-5)] hover:bg-[var(--accents-1)] hover:text-[var(--geist-foreground)] transition-colors ${
              collapsed ? 'justify-center px-0' : ''
            }`}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? (
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
            {!collapsed && <span>{dark ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

          {/* User info */}
          {!collapsed && (
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accents-1)] text-xs font-medium text-[var(--accents-5)]">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <span className="flex-1 truncate text-xs text-[var(--accents-4)]">{user?.name}</span>
            </div>
          )}

          {/* Profile link */}
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[var(--accents-1)] text-[var(--geist-foreground)]'
                  : 'text-[var(--accents-5)] hover:bg-[var(--accents-1)] hover:text-[var(--geist-foreground)]'
              } ${collapsed ? 'justify-center px-0' : ''}`
            }
            title={collapsed ? 'Profile' : undefined}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {!collapsed && <span>Profile</span>}
          </NavLink>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[var(--accents-5)] hover:bg-[var(--accents-1)] hover:text-[var(--geist-foreground)] transition-colors ${
              collapsed ? 'justify-center px-0' : ''
            }`}
            title="Logout"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
