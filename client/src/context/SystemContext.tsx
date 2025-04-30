import React, { createContext, useContext, useState, useEffect } from 'react';

type SystemType = 'store' | 'warehouse' | null;

interface SystemContextType {
  systemType: SystemType;
  setSystemType: (type: SystemType) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (value: boolean) => void;
  username: string | null;
  setUsername: (username: string | null) => void;
}

const SystemContext = createContext<SystemContextType>({
  systemType: null,
  setSystemType: () => {},
  isAuthenticated: false,
  setIsAuthenticated: () => {},
  username: null,
  setUsername: () => {},
});

export const SystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [systemType, setSystemType] = useState<SystemType>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [username, setUsername] = useState<string | null>(null);

  // Check local storage on initial load
  useEffect(() => {
    const storedSystemType = localStorage.getItem('systemType') as SystemType;
    const storedUsername = localStorage.getItem('username');
    
    if (storedSystemType) {
      setSystemType(storedSystemType);
    }
    
    if (storedUsername) {
      setUsername(storedUsername);
      setIsAuthenticated(true);
    }
  }, []);

  // Update local storage when systemType changes
  useEffect(() => {
    if (systemType) {
      localStorage.setItem('systemType', systemType);
    } else {
      localStorage.removeItem('systemType');
    }
  }, [systemType]);

  // Update local storage when authentication changes
  useEffect(() => {
    if (isAuthenticated && username) {
      localStorage.setItem('username', username);
    } else {
      localStorage.removeItem('username');
    }
  }, [isAuthenticated, username]);

  return (
    <SystemContext.Provider value={{ 
      systemType, 
      setSystemType, 
      isAuthenticated, 
      setIsAuthenticated,
      username,
      setUsername
    }}>
      {children}
    </SystemContext.Provider>
  );
};

export const useSystemContext = () => useContext(SystemContext);
