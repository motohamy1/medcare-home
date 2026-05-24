import React from 'react';
import { View, Text, Pressable, Image } from '@/tw';

export function TopAppBar() {
  return (
    <View className="bg-surface border-b-4 border-on-surface flex-row justify-between items-center w-full px-margin-mobile py-3 shadow-[0px_4px_0px_0px_rgba(0,0,0,1)] z-50">
      <Pressable className="w-10 h-10 flex items-center justify-center rounded-full brutal-border brutal-shadow bg-surface-container-lowest active:translate-y-1 active:shadow-none">
        <Text className="text-on-surface font-bold">☰</Text>
      </Pressable>
      
      <View className="flex-1 flex-row justify-center px-2">
        <View className="border-2 border-on-surface bg-primary-container px-3 py-1.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <Text className="text-[22px] leading-none font-black text-on-surface uppercase tracking-tighter">
            MEDCAREHOME
          </Text>
        </View>
      </View>
      
      <Pressable className="w-10 h-10 rounded-full overflow-hidden brutal-border brutal-shadow bg-surface-container active:translate-y-1 active:shadow-none">
        <Image 
          className="w-full h-full object-cover" 
          source={{ uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuBG3csrKpo-lMOYmLSF_z8TCrJV9VJO0LWL3PgZH87-u5Nx7jEtGrgmd7YGCkNjdBAfqYSIrDWW04ksV7RHCytdRBjyDWUgbohGrywirYdpHOOHA7AItkGiqTGL95LYOC37kd_qi8mDxVFSyMTgq_dAUal9C4CzdxeGxuLEoxZstdHPWs8PEzMU7VT9TvHEBN-IepocJPqgOxr8ONLxAvoaJ6HN9RfVg0cPbffXjtfUnC9d1WjlAqfEa_SX677LIRPGbJpVGdQsGQ" }} 
        />
      </Pressable>
    </View>
  );
}
