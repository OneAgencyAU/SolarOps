import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { supabase } from '../lib/supabase';

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface AuthContextValue {
  user: FirebaseUser | null;
  tenant: Tenant | null;
  firstName: string | null;
  lastName: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        const [membershipResult, userResult] = await Promise.all([
          supabase
            .from('tenant_memberships')
            .select('tenant_id, tenants(id, name, slug)')
            .eq('user_id', firebaseUser.uid)
            .maybeSingle(),
          supabase
            .from('users')
            .select('first_name, last_name')
            .eq('id', firebaseUser.uid)
            .maybeSingle(),
        ]);

        if (membershipResult.data?.tenants) {
          const t = membershipResult.data.tenants as unknown as Tenant;
          setTenant(t);
        } else {
          setTenant(null);
        }

        if (userResult.data) {
          setFirstName(userResult.data.first_name ?? null);
          setLastName(userResult.data.last_name ?? null);
        } else {
          setFirstName(null);
          setLastName(null);
        }
      } else {
        setTenant(null);
        setFirstName(null);
        setLastName(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setTenant(null);
    setFirstName(null);
    setLastName(null);
  };

  return (
    <AuthContext.Provider value={{ user, tenant, firstName, lastName, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
