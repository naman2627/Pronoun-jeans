import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Package,
  IndianRupee, FileText, LogOut,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

const NAV_ITEMS = [
  { to: '/agent',                end: true,  icon: LayoutDashboard, label: 'Dashboard'     },
  { to: '/agent/buyers',                     icon: Users,           label: 'My Buyers'     },
  { to: '/agent/orders',                     icon: Package,         label: 'Orders'        },
  { to: '/agent/commissions',                icon: IndianRupee,     label: 'Commissions'   },
  { to: '/agent/samples',                    icon: FileText,        label: 'Sample Orders' },
];

const AgentSidebar = ({ onClose }) => {
  const { user, logout } = useAuthStore();

  return (
    <aside className="flex flex-col h-full bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-white/5 w-60 shrink-0">

      {/* Brand */}
      <div className="px-5 py-5 border-b border-gray-100 dark:border-white/5">
        <img
          src="https://res.cloudinary.com/dvs95yf9s/image/upload/v1779774242/Screenshot_2026-05-26_at_11.12.34_AM-removebg-preview_ukte3f.png"
          alt="Pronoun Jeans"
          className="h-10 w-auto dark:[filter:brightness(0)_invert(1)]"
        />
        <p className="text-xs text-accent font-bold uppercase tracking-widest mt-1.5">Agent Portal</p>
      </div>

      {/* Agent info */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5">
        <p className="text-xs text-gray-400 dark:text-zinc-500 leading-none mb-0.5">Signed in as</p>
        <p className="text-sm font-bold text-gray-900 dark:text-zinc-100 truncate">{user?.email || 'Agent'}</p>
        {user?.agent_code && (
          <span className="inline-block mt-1.5 text-xs font-bold text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-full">
            {user.agent_code}
          </span>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, end, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-red-50 dark:bg-accent/10 text-accent'
                  : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-50 dark:hover:bg-white/5'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-gray-100 dark:border-white/5">
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default AgentSidebar;