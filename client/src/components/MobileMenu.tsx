import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useSystemType } from '@/hooks/useSystemType';
import { useAuth } from '@/hooks/useAuth';
import { useSystemContext } from '@/context/SystemContext';
import { Menu, X } from 'lucide-react';

interface MobileMenuProps {
  className?: string;
}

const MobileMenu: React.FC<MobileMenuProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();
  const { getSystemName, getSystemIcon } = useSystemType();
  const { logout } = useAuth();
  const { username } = useSystemContext();

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  const handleLogout = () => {
    logout();
    closeMenu();
  };

  const isActive = (path: string) => {
    return location === path;
  };

  const getNavItemClasses = (path: string) => {
    return isActive(path)
      ? 'block py-2 px-4 rounded text-neutral-100 bg-neutral-700'
      : 'block py-2 px-4 rounded text-neutral-100 hover:bg-neutral-700';
  };

  return (
    <>
      {/* Mobile Header */}
      <div className={`md:hidden bg-neutral-800 text-white p-4 flex justify-between items-center ${className}`}>
        <div className="flex items-center">
          <span className="material-icons mr-2">{getSystemIcon()}</span>
          <span>{getSystemName()}</span>
        </div>
        <button
          type="button"
          onClick={toggleMenu}
          className="text-neutral-200 hover:text-white focus:outline-none"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-neutral-800 bg-opacity-90">
          <div className="p-4 flex justify-end">
            <button
              type="button"
              onClick={closeMenu}
              className="text-neutral-200 hover:text-white focus:outline-none"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="px-4 py-2 space-y-3">
            <Link href="/dashboard">
              <a className={getNavItemClasses('/dashboard')} onClick={closeMenu}>Dashboard</a>
            </Link>
            <Link href="/inventory">
              <a className={getNavItemClasses('/inventory')} onClick={closeMenu}>Inventory</a>
            </Link>
            <Link href="/container">
              <a className={getNavItemClasses('/container')} onClick={closeMenu}>Container</a>
            </Link>
            <Link href="/expiry-alerts">
              <a className={getNavItemClasses('/expiry-alerts')} onClick={closeMenu}>Expiry Alerts</a>
            </Link>
            <Link href="/reports">
              <a className={getNavItemClasses('/reports')} onClick={closeMenu}>Reports</a>
            </Link>
            <Link href="/overview">
              <a className={getNavItemClasses('/overview')} onClick={closeMenu}>Overview</a>
            </Link>
            <Link href="/stock-deduction">
              <a className={getNavItemClasses('/stock-deduction')} onClick={closeMenu}>Stock Deduction</a>
            </Link>
          </nav>
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-neutral-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="material-icons h-9 w-9 rounded-full p-1 bg-neutral-700 text-neutral-300">account_circle</span>
                <div className="ml-3">
                  <p className="text-sm font-medium text-white">{username || 'User'}</p>
                  <p className="text-xs font-medium text-neutral-400">Manager</p>
                </div>
              </div>
              <button onClick={handleLogout} className="text-neutral-400 hover:text-white">
                <span className="material-icons">logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MobileMenu;
