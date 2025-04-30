import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Warehouse, Store } from 'lucide-react';

const Auth: React.FC = () => {
  const [systemType, setSystemType] = useState<'store' | 'warehouse' | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading } = useAuth();

  const handleSelectSystemType = (type: 'store' | 'warehouse') => {
    setSystemType(type);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!systemType) {
      alert('Please select a system type');
      return;
    }
    
    await login({
      username,
      password,
      systemType
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-md w-full space-y-8">
        <CardContent className="pt-6">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-neutral-900">
              Expiry Date Tracking System
            </h2>
            <p className="mt-2 text-center text-sm text-neutral-600">
              Please select your system type to continue
            </p>
          </div>
          
          <div className="mt-8">
            <RadioGroup 
              value={systemType || ''} 
              onValueChange={(value) => handleSelectSystemType(value as 'store' | 'warehouse')}
              className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4"
            >
              <div className={`relative flex-1 flex justify-center py-8 px-4 border border-transparent rounded-md ${
                systemType === 'store' 
                  ? 'bg-primary text-white' 
                  : 'bg-neutral-100 text-neutral-700'
              } hover:bg-primary/80 hover:text-white transition-colors cursor-pointer`}>
                <Label
                  htmlFor="store"
                  className="relative flex justify-center items-center cursor-pointer"
                >
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <Store className="h-5 w-5" />
                  </span>
                  <RadioGroupItem value="store" id="store" className="sr-only" />
                  <span className="font-medium text-sm">Store System</span>
                </Label>
              </div>
              
              <div className={`relative flex-1 flex justify-center py-8 px-4 border border-transparent rounded-md ${
                systemType === 'warehouse' 
                  ? 'bg-secondary text-white' 
                  : 'bg-neutral-100 text-neutral-700'
              } hover:bg-secondary/80 hover:text-white transition-colors cursor-pointer`}>
                <Label
                  htmlFor="warehouse"
                  className="relative flex justify-center items-center cursor-pointer"
                >
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <Warehouse className="h-5 w-5" />
                  </span>
                  <RadioGroupItem value="warehouse" id="warehouse" className="sr-only" />
                  <span className="font-medium text-sm">Warehouse System</span>
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="mt-8">
            <div className="relative">
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-neutral-50 text-neutral-500">
                  Enter your credentials to login
                </span>
              </div>
            </div>
            
            <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
              <input type="hidden" name="system_type" value={systemType || ''} />
              
              <div>
                <Label htmlFor="username" className="block text-sm font-medium text-neutral-700">
                  Username
                </Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="password" className="block text-sm font-medium text-neutral-700">
                  Password
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Button
                  type="submit"
                  className="group relative w-full"
                  disabled={!systemType || loading}
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </Button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
