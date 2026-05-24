import '../global.css';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { View, Text } from 'react-native';
import { ActivityIndicator } from 'react-native';

function AuthGate() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return; // Still checking session

    const inAuthScreen = segments[0] === 'login' || segments[0] === 'register';

    if (!user && !inAuthScreen) {
      // Not logged in and not on an auth screen → redirect to login
      router.replace('/login');
    } else if (user && inAuthScreen) {
      // Logged in but on an auth screen → redirect to home
      router.replace('/');
    }
  }, [user, isLoading, segments]);

  // Show loading splash while checking session
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f9f9f9', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <View style={{ 
          width: 80, height: 80, backgroundColor: '#ccff00', 
          borderWidth: 3, borderColor: 'black', 
          justifyContent: 'center', alignItems: 'center',
          transform: [{ rotate: '6deg' }],
          shadowColor: 'black', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0,
        }}>
          <Text style={{ fontSize: 36 }}>⚕️</Text>
        </View>
        <ActivityIndicator size="large" color="#4a5d00" />
        <Text style={{ fontWeight: '900', fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, color: '#6b7280' }}>
          Loading...
        </Text>
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
