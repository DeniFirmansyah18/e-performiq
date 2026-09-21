'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '@/types';
import { DUMMY_USERS } from '@/lib/dummy-data';

interface AuthContextType {
  currentUser: User;
  activeRole: UserRole;
  activePeriod: string;
  setActivePeriod: (period: string) => void;
  switchRole: (role: UserRole) => void;
  loginAs: (role: UserRole) => void;
  loginWithCredentials: (email: string, pass: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Default to BOD or stored role
  const [currentUser, setCurrentUser] = useState<User>(DUMMY_USERS[0]);
  const [activeRole, setActiveRole] = useState<UserRole>('BOD');
  const [activePeriod, setActivePeriod] = useState<string>('2026-Q3');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);

  useEffect(() => {
    // Sync with localStorage if client side
    if (typeof window !== 'undefined') {
      const savedRole = localStorage.getItem('eperformiq_active_role') as UserRole;
      if (savedRole) {
        const found = DUMMY_USERS.find((u) => u.role === savedRole);
        if (found) {
          setCurrentUser(found);
          setActiveRole(found.role);
        }
      }
    }
  }, []);

  const switchRole = (role: UserRole) => {
    const target = DUMMY_USERS.find((u) => u.role === role);
    if (target) {
      setCurrentUser(target);
      setActiveRole(role);
      setIsAuthenticated(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('eperformiq_active_role', role);
      }
    }
  };

  const loginAs = (role: UserRole) => {
    switchRole(role);
  };

  const loginWithCredentials = (email: string, _pass: string): boolean => {
    const user = DUMMY_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (user) {
      setCurrentUser(user);
      setActiveRole(user.role);
      setIsAuthenticated(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('eperformiq_active_role', user.role);
      }
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('eperformiq_active_role');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        activeRole,
        activePeriod,
        setActivePeriod,
        switchRole,
        loginAs,
        loginWithCredentials,
        logout,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
