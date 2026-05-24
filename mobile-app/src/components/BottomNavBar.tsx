import React from 'react';
import { View, Text, Pressable } from '@/tw';
import { router, usePathname } from 'expo-router';

export function BottomNavBar() {
  const pathname = usePathname();

  // Helper to determine if a tab is active
  const isActive = (route: string) => {
    if (route === '/' && pathname === '/') return true;
    if (route !== '/' && pathname.startsWith(route)) return true;
    return false;
  };

  return (
    <View className="flex-row justify-around items-center bg-surface px-4 py-3 pb-8 border-t-4 border-on-surface shadow-[0px_-4px_0px_0px_rgba(0,0,0,1)]">
      {/* HOME */}
      <Pressable 
        onPress={() => router.replace('/')}
        className={
          isActive('/')
            ? "flex-col items-center justify-center bg-primary border-2 border-on-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] px-4 py-1 active:scale-90 w-20"
            : "flex-col items-center justify-center active:scale-90 w-20"
        }
      >
        <Text className={isActive('/') ? "text-on-primary text-2xl mb-1" : "text-on-surface-variant text-2xl mb-1"}>🏠</Text>
        <Text className={isActive('/') ? "text-on-primary text-[12px] font-bold uppercase" : "text-on-surface-variant text-[12px] font-bold uppercase"}>HOME</Text>
      </Pressable>
      
      {/* VITAL */}
      <Pressable 
        onPress={() => router.replace('/vital')}
        className={
          isActive('/vital')
            ? "flex-col items-center justify-center bg-primary border-2 border-on-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] px-4 py-1 active:scale-90 w-20"
            : "flex-col items-center justify-center active:scale-90 w-20"
        }
      >
        <Text className={isActive('/vital') ? "text-on-primary text-2xl mb-1" : "text-on-surface-variant text-2xl mb-1"}>❤️</Text>
        <Text className={isActive('/vital') ? "text-on-primary text-[12px] font-bold uppercase" : "text-on-surface-variant text-[12px] font-bold uppercase"}>VITAL</Text>
      </Pressable>
      
      {/* ME */}
      <Pressable 
        onPress={() => router.replace('/me')}
        className={
          isActive('/me')
            ? "flex-col items-center justify-center bg-primary border-2 border-on-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] px-4 py-1 active:scale-90 w-20"
            : "flex-col items-center justify-center active:scale-90 w-20"
        }
      >
        <Text className={isActive('/me') ? "text-on-primary text-2xl mb-1" : "text-on-surface-variant text-2xl mb-1"}>👤</Text>
        <Text className={isActive('/me') ? "text-on-primary text-[12px] font-bold uppercase" : "text-on-surface-variant text-[12px] font-bold uppercase"}>ME</Text>
      </Pressable>
    </View>
  );
}

