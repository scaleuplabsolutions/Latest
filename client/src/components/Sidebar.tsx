import React from 'react';
import { Link, useLocation } from 'wouter';
import { useSystemType } from '@/hooks/useSystemType';
import { useAuth } from '@/hooks/useAuth';
import { useSystemContext } from '@/context/SystemContext';

interface SidebarProps {
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const [location] = useLocation();
  const { getSystemName, getSystemIcon } = useSystemType();
  const { logout } = useAuth();
  const { username } = useSystemContext();

  const isActive = (path: string) => {
    return location === path;
  };

  const getNavItemClasses = (path: string) => {
    return isActive(path)
      ? 'bg-neutral-900 text-white group flex items-center px-2 py-2 text-sm font-medium rounded-md'
      : 'text-neutral-300 hover:bg-neutral-700 hover:text-white group flex items-center px-2 py-2 text-sm font-medium rounded-md';
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className={`flex flex-col w-64 ${className}`}>
      <div className="flex flex-col h-0 flex-1 bg-neutral-800">
        <div className="flex items-center h-16 flex-shrink-0 px-4 bg-neutral-900">
          <div className="text-white font-bold text-lg flex items-center">
            <span className="material-icons mr-2">{getSystemIcon()}</span>
            <span>{getSystemName()}</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col overflow-y-auto">
          <nav className="flex-1 px-2 py-4 space-y-1">
            <Link href="/dashboard">
              <a className={getNavItemClasses('/dashboard')}>
                <span className="material-icons mr-3 h-6 w-6">dashboard</span>
                Dashboard
              </a>
            </Link>
            <Link href="/inventory">
              <a className={getNavItemClasses('/inventory')}>
                <span className="material-icons mr-3 h-6 w-6">inventory</span>
                Inventory
              </a>
            </Link>
            <Link href="/container">
              <a className={getNavItemClasses('/container')}>
                <span className="material-icons mr-3 h-6 w-6">inventory_2</span>
                Container
              </a>
            </Link>
            <Link href="/expiry-alerts">
              <a className={getNavItemClasses('/expiry-alerts')}>
                <span className="material-icons mr-3 h-6 w-6">notifications</span>
                Expiry Alerts
              </a>
            </Link>
            <Link href="/reports">
              <a className={getNavItemClasses('/reports')}>
                <span className="material-icons mr-3 h-6 w-6">bar_chart</span>
                Reports
              </a>
            </Link>
            <Link href="/overview">
              <a className={getNavItemClasses('/overview')}>
                <span className="material-icons mr-3 h-6 w-6">visibility</span>
                Overview
              </a>
            </Link>
            <Link href="/stock-deduction">
              <a className={getNavItemClasses('/stock-deduction')}>
                <span className="material-icons mr-3 h-6 w-6">swap_horiz</span>
                Stock Deduction
              </a>
            </Link>
          </nav>
        </div>
        <div className="flex-shrink-0 flex border-t border-neutral-700 p-4">
          <div className="flex items-center w-full">
            <div className="flex-shrink-0">
              <span className="material-icons inline-block h-9 w-9 rounded-full p-1 bg-neutral-700 text-neutral-300">account_circle</span>
            </div>
            <div className="ml-3 w-full flex justify-between">
              <div>
                <p className="text-sm font-medium text-white">{username || 'User'}</p>
                <p className="text-xs font-medium text-neutral-400">Manager</p>
              </div>
              <button onClick={handleLogout} className="text-neutral-400 hover:text-white">
                <span className="material-icons">logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
