import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { account, databases, ID, Query, Permission, Role, APPWRITE_CONFIG } from '@/lib/appwrite';
import type { Models } from 'react-native-appwrite';

// ─── Types ───────────────────────────────────────────────────────────────────
type User = Models.User<Models.Preferences>;

export interface PatientProfile {
  $id: string;
  auth_id: string;
  full_name: string;
  is_primary: boolean;
  relationship: 'self' | 'child' | 'spouse' | 'parent';
  date_of_birth?: string;
  gender?: 'male' | 'female';
  blood_type?: string;
  governorate?: string;
  district?: string;
}

interface AuthContextType {
  /** The currently authenticated Appwrite user, or null if logged out */
  user: User | null;
  /** The primary patient profile for the logged-in user */
  profile: PatientProfile | null;
  /** True while checking for an existing session on app launch */
  isLoading: boolean;
  /** Log in with email + password */
  login: (email: string, password: string) => Promise<void>;
  /** Register a new account + create a default patient profile */
  register: (email: string, password: string, fullName: string) => Promise<void>;
  /** End the current session and clear state */
  logout: () => Promise<void>;
  /** Force-refresh user + profile from the server */
  refresh: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch the primary patient profile for a given auth user ID
  const fetchProfile = useCallback(async (authId: string) => {
    try {
      const { documents } = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.patientProfiles,
        [Query.equal('auth_id', authId), Query.equal('is_primary', true), Query.limit(1)]
      );
      if (documents.length > 0) {
        setProfile(documents[0] as unknown as PatientProfile);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('[AuthContext] Failed to fetch patient profile:', err);
      setProfile(null);
    }
  }, []);

  // Check for an existing session on mount
  const checkSession = useCallback(async () => {
    try {
      const currentUser = await account.get();
      setUser(currentUser);
      await fetchProfile(currentUser.$id);
    } catch {
      // No active session — that's fine
      setUser(null);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfile]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // ── Auth Actions ─────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    await account.createEmailPasswordSession(email, password);
    const currentUser = await account.get();
    setUser(currentUser);
    await fetchProfile(currentUser.$id);
  }, [fetchProfile]);

  const register = useCallback(async (email: string, password: string, fullName: string) => {
    // 1. Create the auth account
    await account.create(ID.unique(), email, password, fullName);

    // 2. Log in immediately
    await account.createEmailPasswordSession(email, password);
    const currentUser = await account.get();
    setUser(currentUser);

    // 3. Create a default "self" patient profile with DLS permissions
    try {
      const newProfile = await databases.createDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.patientProfiles,
        ID.unique(),
        {
          auth_id: currentUser.$id,
          full_name: fullName,
          is_primary: true,
          relationship: 'self',
        },
        [
          Permission.read(Role.user(currentUser.$id)),
          Permission.update(Role.user(currentUser.$id)),
          Permission.delete(Role.user(currentUser.$id)),
        ]
      );
      setProfile(newProfile as unknown as PatientProfile);
    } catch (err) {
      console.error('[AuthContext] Failed to create patient profile:', err);
      // Auth succeeded but profile creation failed — user can retry from profile screen
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await account.deleteSession('current');
    } catch (err) {
      console.error('[AuthContext] Logout error:', err);
    }
    setUser(null);
    setProfile(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const currentUser = await account.get();
      setUser(currentUser);
      await fetchProfile(currentUser.$id);
    } catch {
      setUser(null);
      setProfile(null);
    }
  }, [fetchProfile]);

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an <AuthProvider>');
  }
  return ctx;
}
