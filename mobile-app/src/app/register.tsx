import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from '@/tw';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await register(email.trim(), password, fullName.trim());
      router.replace('/');
    } catch (err: any) {
      const msg = err?.message || 'Registration failed. Please try again.';
      Alert.alert('Registration Failed', msg);
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
          contentContainerClassName="justify-center px-margin-mobile py-8"
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="items-center gap-4 mb-10">
            <View className="w-20 h-20 bg-secondary-container brutal-border brutal-shadow-lg items-center justify-center -rotate-6">
              <Text className="text-4xl">🩺</Text>
            </View>
            <View className="bg-secondary-container px-4 py-2 brutal-border brutal-shadow-lg rotate-1">
              <Text className="text-[28px] font-black text-on-secondary uppercase tracking-tighter">
                Join MedCare
              </Text>
            </View>
          </View>

          {/* Registration Form */}
          <View className="bg-surface-container-lowest brutal-border brutal-shadow-lg p-6 gap-5">
            <View className="border-b-4 border-on-surface pb-2 self-start pr-8">
              <Text className="text-[24px] font-black text-on-surface uppercase">Create Account</Text>
            </View>

            <View className="gap-2">
              <Text className="text-[12px] font-bold uppercase text-on-surface-variant tracking-wider">
                Full Name *
              </Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                className="bg-surface brutal-border p-4 text-base font-bold text-on-surface"
                placeholder="Dr. Ahmed Hassan"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View className="gap-2">
              <Text className="text-[12px] font-bold uppercase text-on-surface-variant tracking-wider">
                Email Address *
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
                Password * (min 8 chars)
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

            <View className="gap-2">
              <Text className="text-[12px] font-bold uppercase text-on-surface-variant tracking-wider">
                Confirm Password *
              </Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                className="bg-surface brutal-border p-4 text-base font-bold text-on-surface"
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <Pressable
              onPress={handleRegister}
              disabled={loading}
              className="bg-primary brutal-border brutal-shadow p-4 items-center active:scale-95 mt-2"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-[16px] font-black text-on-primary uppercase tracking-widest">
                  Create Account →
                </Text>
              )}
            </Pressable>
          </View>

          {/* Login CTA */}
          <View className="flex-row items-center justify-center gap-2 mt-8">
            <Text className="text-on-surface-variant font-bold text-[14px]">
              Already have an account?
            </Text>
            <Pressable
              onPress={() => router.back()}
              className="bg-primary-container px-3 py-1.5 brutal-border active:scale-95"
            >
              <Text className="text-on-surface font-black text-[14px] uppercase">
                Sign In
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
