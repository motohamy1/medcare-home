import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Image } from '@/tw';
import { TopAppBar } from '@/components/TopAppBar';
import { BottomNavBar } from '@/components/BottomNavBar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export default function BookingScreen() {
  const [selectedDay, setSelectedDay] = useState<number>(4); // Default to 4th
  const [selectedTime, setSelectedTime] = useState<string>('10:30 AM'); // Default to 10:30 AM

  // Time slots matching design
  const timeSlots = [
    { label: 'Morning', time: '9:00 AM' },
    { label: 'Morning', time: '10:30 AM' },
    { label: 'Afternoon', time: '2:00 PM' },
    { label: 'Afternoon', time: '3:45 PM' },
  ];

  // Calendar dates matching October 2024 grid in design
  const daysInMonth = [
    { num: 1, disabled: true },
    { num: 2, disabled: false },
    { num: 3, disabled: false },
    { num: 4, disabled: false },
    { num: 5, disabled: false },
    { num: 6, disabled: false },
    { num: 7, disabled: false },
    { num: 8, disabled: false },
    { num: 9, disabled: false },
    { num: 10, disabled: false },
    { num: 11, disabled: false },
    { num: 12, disabled: false },
    { num: 13, disabled: true },
    { num: 14, disabled: true },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }} edges={['top', 'left', 'right']}>
      <View className="flex-1 bg-background flex-col relative">
        <TopAppBar />

        <ScrollView className="flex-1" contentContainerClassName="pb-8 px-margin-mobile pt-6 gap-6">
          {/* Header Back Button */}
          <Pressable 
            onPress={() => router.back()}
            className="flex-row items-center gap-2 self-start bg-surface brutal-border brutal-shadow px-3 py-1.5 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none"
          >
            <Text className="text-on-surface font-bold">← Back to Home</Text>
          </Pressable>

          {/* Doctor Profile Bento */}
          <View className="brutal-border rounded-xl bg-tertiary-container brutal-shadow p-6 flex-col items-center gap-4">
            <View className="w-28 h-28 rounded-full overflow-hidden brutal-border bg-surface-variant shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Image 
                className="w-full h-full object-cover"
                source={{ uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuCoLx2fnxRT1bA-ZZuMhnvL_siv-UWRRPWJFpzn-s9Ahd5IZzQm8bQ2shnSFBri6UhbHztGazKiwgceljJHMKn95PSCd1XLwem9rS7_GASPVm8RkJ1Fbhbi-KMxsekFt9vIx1FVW2R2wXyD1y-GadDwpblG24esUU2-msj9XpjLDLWFCLTwXHQ7w0f20HBCHwy48TKqm1hZ7hIAtctjW7FIfRee_xXDu6V8wxgDe0OC_cA33FVyGqB8VRoGbAknxQWGkbkWzxCBRw" }}
              />
            </View>
            <View className="items-center">
              <Text className="text-[24px] font-black text-on-surface mb-2">Dr. Marcus Vance</Text>
              <Text className="text-label-md text-on-surface-variant uppercase tracking-widest mb-3 bg-surface-container-lowest px-3 py-1 brutal-border rounded-full font-bold">
                Cardiology
              </Text>
              <View className="flex-row gap-2 mt-1">
                <View className="bg-primary-container text-on-primary-container px-2 py-1 brutal-border rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex-row items-center gap-1">
                  <Text className="text-on-surface text-[12px] font-bold">⭐ 4.9 Rating</Text>
                </View>
                <View className="bg-surface-container-lowest text-on-surface px-2 py-1 brutal-border rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex-row items-center gap-1">
                  <Text className="text-on-surface text-[12px] font-bold">📍 Central Clinic</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Select Date Widget */}
          <View className="brutal-border rounded-xl bg-surface-container-lowest brutal-shadow p-5">
            <View className="flex-row items-center gap-2 border-b-2 border-on-surface pb-3 mb-4">
              <View className="bg-primary-container p-1 brutal-border rounded">
                <Text className="text-lg">📅</Text>
              </View>
              <Text className="text-[20px] font-black text-on-surface uppercase tracking-tight">Select Date</Text>
            </View>

            {/* Simple Brutalist Calendar Header */}
            <View className="grid grid-cols-7 gap-2 text-center mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                <Text key={idx} className="font-bold text-[12px] text-on-surface-variant uppercase">{day}</Text>
              ))}
            </View>

            {/* Simple Brutalist Calendar Grid */}
            <View className="grid grid-cols-7 gap-2">
              {/* Empty offsets for alignment */}
              <View />
              <View />

              {daysInMonth.map((day) => {
                const isSelected = selectedDay === day.num;
                return (
                  <Pressable
                    key={day.num}
                    disabled={day.disabled}
                    onPress={() => setSelectedDay(day.num)}
                    className={`aspect-square flex items-center justify-center brutal-border rounded-md ${
                      day.disabled 
                        ? 'bg-surface-variant opacity-40' 
                        : isSelected 
                          ? 'bg-primary text-on-primary shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' 
                          : 'bg-surface hover:bg-primary-container active:scale-95'
                    }`}
                  >
                    <Text className={`font-bold text-[14px] ${isSelected && !day.disabled ? 'text-on-primary' : 'text-on-surface'}`}>
                      {day.num}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Select Time Widget */}
          <View className="brutal-border rounded-xl bg-surface-container-lowest brutal-shadow p-5">
            <View className="flex-row items-center gap-2 border-b-2 border-on-surface pb-3 mb-4">
              <View className="bg-secondary-container p-1 brutal-border rounded">
                <Text className="text-lg">⏰</Text>
              </View>
              <Text className="text-[20px] font-black text-on-surface uppercase tracking-tight">Select Time</Text>
            </View>

            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-4 pb-2"
            >
              {timeSlots.map((slot, index) => {
                const isSelected = selectedTime === slot.time;
                return (
                  <Pressable
                    key={index}
                    onPress={() => setSelectedTime(slot.time)}
                    className={`brutal-border rounded-lg px-5 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none flex flex-col items-center min-w-[100px] ${
                      isSelected ? 'bg-secondary text-on-secondary' : 'bg-surface hover:bg-secondary-container'
                    }`}
                  >
                    <Text className={`text-[12px] font-medium mb-0.5 ${isSelected ? 'text-on-secondary opacity-90' : 'text-on-surface-variant'}`}>
                      {slot.label}
                    </Text>
                    <Text className={`text-[18px] font-black uppercase ${isSelected ? 'text-on-secondary' : 'text-on-surface'}`}>
                      {slot.time.split(' ')[0]}
                    </Text>
                    <Text className={`text-[12px] font-bold ${isSelected ? 'text-on-secondary' : 'text-on-surface'}`}>
                      {slot.time.split(' ')[1]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Summary & Action */}
          <View className="brutal-border rounded-xl bg-primary-container brutal-shadow p-6 flex-col justify-between">
            <View className="mb-4">
              <Text className="text-[14px] font-black text-on-surface uppercase tracking-wider mb-2">Booking Summary</Text>
              <View className="bg-surface brutal-border p-4 rounded-lg">
                <Text className="text-[16px] text-on-surface font-black">October {selectedDay}th, 2026</Text>
                <Text className="text-[16px] text-on-surface font-bold mt-1">{selectedTime}</Text>
                <View className="border-t border-dashed border-on-surface mt-3 pt-3">
                  <Text className="text-[12px] text-on-surface-variant font-bold uppercase tracking-wider">
                    Consultation Fee: $150
                  </Text>
                </View>
              </View>
            </View>

            <Pressable
              onPress={() => alert(`Appointment confirmed for Oct ${selectedDay}th at ${selectedTime} with Dr. Vance!`)}
              className="w-full brutal-border rounded-xl bg-primary text-on-primary py-4 px-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none items-center justify-center"
            >
              <Text className="text-on-primary font-black text-[16px] uppercase tracking-wider">
                Confirm Booking
              </Text>
            </Pressable>
          </View>
        </ScrollView>

        <BottomNavBar />
      </View>
    </SafeAreaView>
  );
}
