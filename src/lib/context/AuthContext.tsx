'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '@/types';
import { DUMMY_USERS } from '@/lib/dummy-data';

interface AuthContextType {
  currentUser: User;
  activeRole: UserRole;
  activePeriod: string;
  setActivePeriod: (period: string) => void;
  switchRole: (role: UserRole) => void;
  loginAs: (role: UserRole) => Promise<boolean>;
  loginWithCredentials: (email: string, pass: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const ROLE_EMAILS: Record<UserRole, string> = {
  BOD: 'hendra.gunawan@eperformiq.co.id',
  HR_MANAGER: 'siti.nurhaliza@eperformiq.co.id',
  PEOPLE_MANAGER: 'danu.tech@eperformiq.co.id',
  EMPLOYEE: 'budi.pratama@eperformiq.co.id',
  AUDITOR: 'bambang.audit@eperformiq.co.id',
  SUPER_ADMIN: 'admin@eperformiq.co.id',
  ASSESSOR: 'aris.assessor@eperformiq.co.id',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User>(DUMMY_USERS[0]);
  const [activeRole, setActiveRole] = useState<UserRole>('BOD');
  const [activePeriod, setActivePeriod] = useState<string>('2026-Q3');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sync session on mount from API
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/v1/auth/me');
        if (res.ok) {
          const json = await res.json();
          if (json.data?.user) {
            const u = json.data.user;
            const formatted: User = {
              id: u.id,
              employeeId: u.employee_id || u.employeeId || '',
              email: u.email,
              name: u.name,
              role: u.role,
              department: u.department || 'Corporate',
              position: u.position || u.role,
              avatarUrl: u.avatar_url || u.avatarUrl,
            };
            setCurrentUser(formatted);
            setActiveRole(u.role);
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      }
    }
    checkSession();
  }, []);

  const loginWithCredentials = async (email: string, pass: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });

      if (!res.ok) {
        setIsLoading(false);
        return false;
      }

      const json = await res.json();
      const u = json.data.user;
      const formatted: User = {
        id: u.id,
        employeeId: u.employee_id,
        email: u.email,
        name: u.name,
        role: u.role,
        department: u.department,
        position: u.position,
        avatarUrl: u.avatar_url,
      };

      setCurrentUser(formatted);
      setActiveRole(u.role);
      setIsAuthenticated(true);
      setIsLoading(false);
      return true;
    } catch {
      setIsLoading(false);
      return false;
    }
  };

  const loginAs = async (role: UserRole): Promise<boolean> => {
    const email = ROLE_EMAILS[role];
    if (!email) return false;
    return loginWithCredentials(email, 'enterprise2026');
  };

  const switchRole = (role: UserRole) => {
    loginAs(role);
  };

  const logout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('eperformiq_active_role');
      window.location.href = '/login';
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
        isLoading,
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
