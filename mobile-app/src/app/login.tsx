import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from '@/tw';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/');
    } catch (err: any) {
      const msg = err?.message || 'Login failed. Please try again.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          className="flex-1 bg-background" 
          contentContainerClassName="flex-1 justify-center px-margin-mobile py-8"
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo + Title */}
          <View className="items-center gap-6 mb-12">
            <View className="w-24 h-24 bg-primary-container brutal-border brutal-shadow-lg items-center justify-center rotate-6">
              <Text className="text-5xl">⚕️</Text>
            </View>
            <View className="items-center gap-2">
              <View className="bg-primary-container px-4 py-2 brutal-border brutal-shadow-lg -rotate-2">
                <Text className="text-[32px] font-black text-on-surface uppercase tracking-tighter">
                  MEDCAREHOME
                </Text>
              </View>
              <View className="bg-surface-container-highest px-3 py-1 brutal-border mt-2">
                <Text className="text-[12px] font-bold text-on-surface-variant uppercase tracking-widest">
                  Your Health, Simplified
                </Text>
              </View>
            </View>
          </View>

          {/* Login Form */}
          <View className="bg-surface-container-lowest brutal-border brutal-shadow-lg p-6 gap-5">
            <View className="border-b-4 border-on-surface pb-2 self-start pr-8">
              <Text className="text-[24px] font-black text-on-surface uppercase">Sign In</Text>
            </View>

            <View className="gap-2">
              <Text className="text-[12px] font-bold uppercase text-on-surface-variant tracking-wider">
                Email Address
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                className="bg-surface brutal-border p-4 text-base font-bold text-on-surface"
                placeholder="you@email.com"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View className="gap-2">
              <Text className="text-[12px] font-bold uppercase text-on-surface-variant tracking-wider">
                Password
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                className="bg-surface brutal-border p-4 text-base font-bold text-on-surface"
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <Pressable
              onPress={handleLogin}
              disabled={loading}
              className="bg-primary brutal-border brutal-shadow p-4 items-center active:scale-95 mt-2"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-[16px] font-black text-on-primary uppercase tracking-widest">
                  Log In →
                </Text>
              )}
            </Pressable>
          </View>

          {/* Register CTA */}
          <View className="flex-row items-center justify-center gap-2 mt-8">
            <Text className="text-on-surface-variant font-bold text-[14px]">
              Don't have an account?
            </Text>
            <Pressable
              onPress={() => router.push('/register')}
              className="bg-secondary-container px-3 py-1.5 brutal-border active:scale-95"
            >
              <Text className="text-on-secondary font-black text-[14px] uppercase">
                Sign Up
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
