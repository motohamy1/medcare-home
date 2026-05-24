import React from 'react';
import { View, Text, Pressable, Image, ScrollView } from '@/tw';
import { router } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Linking, Alert } from 'react-native';

interface BookingConfirmationProps {
  doctorName: string;
  doctorImage: string;
  doctorSpecialty: string;
  date: string;
  time: string;
  onBookAnother?: () => void;
}

export function BookingConfirmation({
  doctorName,
  doctorImage,
  doctorSpecialty,
  date,
  time,
  onBookAnother,
}: BookingConfirmationProps) {
  const handleAddToCalendar = () => {
    Alert.alert(
      'Add to Calendar',
      `Added appointment with ${doctorName} on ${date} at ${time} to your calendar.`,
      [{ text: 'OK' }]
    );
  };

  const handleGetDirections = () => {
    Linking.openURL('https://maps.google.com/?q=Central+Clinic');
  };

  const handleViewBookings = () => {
    router.replace('/me');
  };

  return (
    <ScrollView className="flex-1" contentContainerClassName="pb-8 px-margin-mobile pt-6 gap-6">
      {/* SUCCESS Badge */}
      <Animated.View entering={FadeInUp.delay(100).duration(500)} className="self-center">
        <View className="bg-primary-container brutal-border brutal-shadow px-5 py-2.5 -rotate-2">
          <Text className="text-[24px] font-black text-on-surface uppercase tracking-tighter">
            SUCCESS!
          </Text>
        </View>
      </Animated.View>

      {/* Confirmation Card */}
      <Animated.View entering={FadeInUp.delay(200).duration(500)}>
        <View className="brutal-border rounded-xl bg-tertiary-container brutal-shadow p-6 flex-col items-center gap-4">
          {/* Checkmark Circle */}
          <View className="w-16 h-16 rounded-full bg-primary-container brutal-border brutal-shadow items-center justify-center">
            <Text className="text-on-surface text-2xl font-black">✓</Text>
          </View>

          <View className="items-center gap-1">
            <Text className="text-[20px] font-black text-on-surface uppercase tracking-tight text-center">
              BOOKING CONFIRMED
            </Text>
            <Text className="text-[14px] text-on-surface-variant font-bold text-center">
              Your appointment is locked in.
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Doctor Info Card */}
      <Animated.View entering={FadeInUp.delay(300).duration(500)}>
        <View className="brutal-border rounded-xl bg-surface-container-lowest brutal-shadow p-5 flex-col gap-4">
          {/* Doctor Header */}
          <View className="flex-row items-center gap-3">
            <View className="w-14 h-14 rounded-full overflow-hidden brutal-border bg-surface-variant shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Image
                className="w-full h-full object-cover"
                source={{ uri: doctorImage }}
              />
            </View>
            <View className="flex-1">
              <Text className="text-[18px] font-black text-on-surface">{doctorName}</Text>
              <View className="self-start bg-secondary px-3 py-1 rounded-full mt-1">
                <Text className="text-on-secondary text-[12px] font-bold uppercase tracking-widest">
                  {doctorSpecialty}
                </Text>
              </View>
            </View>
          </View>

          {/* Divider */}
          <View className="border-t-2 border-on-surface" />

          {/* Date & Time */}
          <View className="flex-row">
            <View className="flex-1 border-r-2 border-on-surface pr-4">
              <Text className="text-[12px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                DATE
              </Text>
              <Text className="text-[16px] font-black text-on-surface">{date}</Text>
            </View>
            <View className="flex-1 pl-4">
              <Text className="text-[12px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                TIME
              </Text>
              <Text className="text-[16px] font-black text-on-surface">{time}</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* What's Next? Actions */}
      <Animated.View entering={FadeInUp.delay(400).duration(500)} className="gap-4">
        <View className="border-b-2 border-on-surface pb-2 self-start">
          <Text className="text-[20px] font-black text-on-surface uppercase tracking-tight">
            WHAT'S NEXT?
          </Text>
        </View>

        {/* Add to Calendar */}
        <Pressable
          onPress={handleAddToCalendar}
          className="w-full brutal-border rounded-xl bg-primary-container py-4 px-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none flex-row items-center justify-between"
        >
          <View className="flex-row items-center gap-3">
            <Text className="text-on-surface text-xl">🗓️</Text>
            <Text className="text-on-surface font-black text-[14px] uppercase tracking-wider">
              ADD TO CALENDAR
            </Text>
          </View>
          <Text className="text-on-surface text-xl font-bold">→</Text>
        </Pressable>

        {/* Get Directions */}
        <Pressable
          onPress={handleGetDirections}
          className="w-full brutal-border rounded-xl bg-surface py-4 px-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none flex-row items-center justify-between"
        >
          <View className="flex-row items-center gap-3">
            <Text className="text-on-surface text-xl">🧭</Text>
            <Text className="text-on-surface font-black text-[14px] uppercase tracking-wider">
              GET DIRECTIONS
            </Text>
          </View>
          <Text className="text-on-surface text-xl font-bold">→</Text>
        </Pressable>

        {/* View My Bookings */}
        <Pressable
          onPress={handleViewBookings}
          className="w-full brutal-border rounded-xl bg-surface py-4 px-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none flex-row items-center justify-between"
        >
          <View className="flex-row items-center gap-3">
            <Text className="text-on-surface text-xl">📋</Text>
            <Text className="text-on-surface font-black text-[14px] uppercase tracking-wider">
              VIEW MY BOOKINGS
            </Text>
          </View>
          <Text className="text-on-surface text-xl font-bold">→</Text>
        </Pressable>

        {/* Book Another (optional) */}
        {onBookAnother && (
          <Pressable
            onPress={onBookAnother}
            className="w-full brutal-border rounded-xl bg-surface-container-highest py-4 px-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none flex-row items-center justify-center gap-2 mt-2"
          >
            <Text className="text-on-surface text-xl">🏥</Text>
            <Text className="text-on-surface font-black text-[14px] uppercase tracking-wider">
              BOOK ANOTHER APPOINTMENT
            </Text>
          </Pressable>
        )}
      </Animated.View>
    </ScrollView>
  );
}
