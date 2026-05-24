import React from 'react';
import { View } from '@/tw';

export function BentoCard({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <View className={`brutal-border brutal-shadow rounded-xl p-4 flex-col justify-between ${className}`}>
      {children}
    </View>
  );
}
