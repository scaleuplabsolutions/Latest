import { useState } from 'react';
import { useSystemContext } from '@/context/SystemContext';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type LoginCredentials = {
  username: string;
  password: string;
  systemType: 'store' | 'warehouse';
};

type RegisterCredentials = {
  username: string;
  password: string;
  systemType: 'store' | 'warehouse';
};

export const useAuth = () => {
  const [loading, setLoading] = useState(false);
  const { setIsAuthenticated, setSystemType, setUsername } = useSystemContext();
  const { toast } = useToast();

  const login = async (credentials: LoginCredentials) => {
    setLoading(true);
    try {
      const response = await apiRequest('POST', '/api/auth/login', credentials);
      const data = await response.json();
      
      setIsAuthenticated(true);
      setSystemType(credentials.systemType);
      setUsername(data.username);
      
      toast({
        title: "Login successful",
        description: `Welcome back, ${data.username}!`,
      });
      
      return true;
    } catch (error) {
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "Invalid credentials",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const register = async (credentials: RegisterCredentials) => {
    setLoading(true);
    try {
      const response = await apiRequest('POST', '/api/auth/register', credentials);
      const data = await response.json();
      
      toast({
        title: "Registration successful",
        description: "Your account has been created. You can now log in.",
      });
      
      return true;
    } catch (error) {
      toast({
        title: "Registration failed",
        description: error instanceof Error ? error.message : "Could not create account",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await apiRequest('POST', '/api/auth/logout');
      
      setIsAuthenticated(false);
      setSystemType(null);
      setUsername(null);
      
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
      
      return true;
    } catch (error) {
      toast({
        title: "Logout failed",
        description: error instanceof Error ? error.message : "Could not log out",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const checkAuth = async () => {
    try {
      const response = await apiRequest('GET', '/api/auth/me');
      const data = await response.json();
      
      setIsAuthenticated(true);
      setSystemType(data.systemType);
      setUsername(data.username);
      
      return true;
    } catch (error) {
      setIsAuthenticated(false);
      setSystemType(null);
      setUsername(null);
      return false;
    }
  };

  return {
    login,
    register,
    logout,
    checkAuth,
    loading
  };
};
