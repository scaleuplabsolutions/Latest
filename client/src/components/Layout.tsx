import React, { ReactNode, useEffect } from 'react';
import { useLocation } from 'wouter';
import Sidebar from './Sidebar';
import MobileMenu from './MobileMenu';
import { useSystemContext } from '@/context/SystemContext';
import { useAuth } from '@/hooks/useAuth';
import Auth from './Auth';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isAuthenticated } = useSystemContext();
  const { checkAuth } = useAuth();
  const [location, setLocation] = useLocation();

  // Check authentication status on initial load
  useEffect(() => {
    const verifyAuth = async () => {
      const isAuth = await checkAuth();
      if (!isAuth && location !== '/') {
        setLocation('/');
      }
    };
    
    verifyAuth();
  }, []);

  if (!isAuthenticated) {
    return <Auth />;
  }

  return (
    <div className="flex h-screen bg-neutral-100 overflow-hidden">
      {/* Sidebar for desktop */}
      <Sidebar className="hidden md:flex md:flex-shrink-0" />
      
      {/* Mobile header and menu */}
      <MobileMenu />
      
      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6 px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
