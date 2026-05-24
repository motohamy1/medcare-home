import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, Pressable } from '@/tw';
import { TopAppBar } from '@/components/TopAppBar';
import { BottomNavBar } from '@/components/BottomNavBar';
import { BentoCard } from '@/components/BentoCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { getTotalAppointments, getConditions } from '@/services/profileService';
import { Alert } from 'react-native';

export default function ProfileScreen() {
  const { user, profile, logout } = useAuth();
  const [totalVisits, setTotalVisits] = useState(0);
  const [conditionCount, setConditionCount] = useState(0);

  useEffect(() => {
    if (!profile) return;
    // Fetch stats in parallel
    Promise.allSettled([
      getTotalAppointments(profile.$id),
      getConditions(profile.$id),
    ]).then(([visitsResult, conditionsResult]) => {
      if (visitsResult.status === 'fulfilled') setTotalVisits(visitsResult.value);
      if (conditionsResult.status === 'fulfilled') setConditionCount(conditionsResult.value.length);
    });
  }, [profile]);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  // Derive display values
  const displayName = profile?.full_name || user?.name || 'User';
  const displayId = profile?.$id ? `VTP-${profile.$id.substring(0, 5).toUpperCase()}` : '—';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }} edges={['top', 'left', 'right']}>
      <View className="flex-1 bg-background">
        <TopAppBar />
        
        <ScrollView className="flex-1" contentContainerClassName="pb-8 px-margin-mobile pt-8 gap-container-gap">
          {/* Profile Header */}
          <View className="items-center gap-4 z-10">
            <View className="w-32 h-32 rounded-full overflow-hidden brutal-border brutal-shadow-lg bg-primary-container z-10 items-center justify-center">
              <Text className="text-6xl">{displayName.charAt(0).toUpperCase()}</Text>
            </View>
            <View className="absolute bg-secondary-container w-10 h-10 rounded-full brutal-border items-center justify-center z-20 brutal-shadow rotate-12" style={{ top: 100, marginLeft: 80 }}>
              <Text className="text-on-secondary text-xl font-bold">✓</Text>
            </View>
            
            <View className="items-center gap-1 mt-2">
              <View className="bg-primary-container px-3 py-1 brutal-border brutal-shadow-lg -rotate-1">
                <Text className="text-[28px] font-bold text-on-surface uppercase tracking-tight">
                  {displayName}
                </Text>
              </View>
              <View className="bg-surface-container-highest px-2 py-1 brutal-border mt-2">
                <Text className="text-[14px] font-bold text-on-surface-variant uppercase tracking-widest">
                  ID: {displayId}
                </Text>
              </View>
              {user?.email && (
                <Text className="text-[12px] text-on-surface-variant font-bold mt-1">
                  {user.email}
                </Text>
              )}
            </View>
          </View>

          {/* Bento Summary Cards */}
          <View className="flex-row flex-wrap gap-4 mt-4">
            {/* Health Score */}
            <BentoCard className="w-full bg-primary-container flex-row items-center justify-between overflow-hidden">
              <View className="flex-col z-10">
                <Text className="text-[12px] font-bold text-on-primary-container uppercase tracking-widest mb-1">
                  ❤️ Health Score
                </Text>
                <Text className="text-[48px] font-bold text-on-surface leading-none">
                  {conditionCount === 0 ? '98' : '—'}<Text className="text-[24px]">/100</Text>
                </Text>
              </View>
              <View className="w-16 h-16 rounded-full border-4 border-on-surface items-center justify-center bg-surface rotate-12 brutal-shadow">
                <Text className="text-on-surface text-3xl font-bold">↗</Text>
              </View>
            </BentoCard>

            {/* Total Visits */}
            <BentoCard className="flex-1 bg-surface-container-lowest aspect-square min-w-[40%] justify-between">
              <View className="flex-row justify-between items-start">
                <Text className="text-[12px] font-bold text-on-surface-variant uppercase">Visits</Text>
                <Text className="text-secondary-container">📅</Text>
              </View>
              <View className="mt-auto">
                <Text className="text-[28px] font-bold text-on-surface leading-none">{totalVisits}</Text>
                <Text className="text-[16px] text-on-surface-variant mt-1">Total Booked</Text>
              </View>
            </BentoCard>

            {/* Conditions */}
            <BentoCard className="flex-1 bg-secondary-container aspect-square min-w-[40%] justify-between">
              <View className="flex-row justify-between items-start z-10">
                <Text className="text-[12px] font-bold text-on-secondary uppercase">Conditions</Text>
                <Text className="text-on-secondary">🩺</Text>
              </View>
              <View className="mt-auto z-10">
                <Text className="text-[28px] font-bold text-on-secondary uppercase tracking-tighter leading-none">
                  {conditionCount}
                </Text>
                <Text className="text-[16px] text-on-secondary opacity-80 mt-1">
                  {conditionCount === 0 ? 'None tracked' : 'Active'}
                </Text>
              </View>
            </BentoCard>
          </View>

          {/* Actions & Activity */}
          <View className="gap-4 mt-2">
            <View className="border-b-4 border-on-surface pb-2 self-start pr-8">
              <Text className="text-[24px] font-bold text-on-surface uppercase">Actions</Text>
            </View>

            <View className="gap-3">
              {/* Recent Activity */}
              <Pressable className="bg-surface-container-lowest brutal-border brutal-shadow p-4 flex-row items-center justify-between active:scale-95">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 bg-primary rounded-full items-center justify-center brutal-border">
                    <Text className="text-on-primary">🕒</Text>
                  </View>
                  <View>
                    <Text className="text-[14px] font-bold text-on-surface uppercase">Recent Activity</Text>
                    <Text className="text-[16px] text-on-surface-variant">View past records</Text>
                  </View>
                </View>
                <Text className="text-on-surface-variant text-xl font-bold">→</Text>
              </Pressable>

              {/* Settings */}
              <Pressable className="bg-surface-container-lowest brutal-border brutal-shadow p-4 flex-row items-center justify-between active:scale-95">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 bg-surface-variant rounded-full items-center justify-center brutal-border">
                    <Text className="text-on-surface">⚙️</Text>
                  </View>
                  <View>
                    <Text className="text-[14px] font-bold text-on-surface uppercase">Settings</Text>
                    <Text className="text-[16px] text-on-surface-variant">Preferences & Privacy</Text>
                  </View>
                </View>
                <Text className="text-on-surface-variant text-xl font-bold">→</Text>
              </Pressable>

              {/* Log Out */}
              <Pressable 
                onPress={handleLogout}
                className="bg-inverse-surface brutal-border brutal-shadow p-4 flex-row items-center justify-center gap-2 active:scale-95 mt-2"
              >
                <Text className="text-[14px] font-bold text-on-primary uppercase tracking-wider">Log Out</Text>
                <Text className="text-on-primary">🚪</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
        
        <BottomNavBar />
      </View>
    </SafeAreaView>
  );
}
