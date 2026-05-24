import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Image, TextInput } from '@/tw';
import { TopAppBar } from '@/components/TopAppBar';
import { BottomNavBar } from '@/components/BottomNavBar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { getDoctorById, type Doctor } from '@/services/doctorService';
import {
  getAvailableSlots,
  bookAppointment,
  groupSlotsByDate,
  formatSlotTime,
  type ScheduleSlot,
} from '@/services/bookingService';
import { Alert, ActivityIndicator } from 'react-native';

export default function BookingScreen() {
  const { doctorId } = useLocalSearchParams<{ doctorId?: string }>();
  const { profile } = useAuth();

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<ScheduleSlot | null>(null);
  const [symptomsNotes, setSymptomsNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  const fetchBookingData = useCallback(async () => {
    if (!doctorId) {
      setLoading(false);
      return;
    }
    try {
      const [doc, availableSlots] = await Promise.all([
        getDoctorById(doctorId),
        getAvailableSlots(doctorId),
      ]);
      setDoctor(doc);
      setSlots(availableSlots);
    } catch (err) {
      console.error('[BookingScreen] Failed to load data:', err);
      Alert.alert('Error', 'Failed to load doctor information.');
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    fetchBookingData();
  }, [fetchBookingData]);

  const handleConfirmBooking = async () => {
    if (!doctor) {
      Alert.alert('Error', 'Doctor information is missing. Please go back and try again.');
      return;
    }
    if (!profile) {
      Alert.alert('Not Logged In', 'Please log in to book an appointment.');
      return;
    }
    if (!selectedSlot) {
      Alert.alert('Missing Selection', 'Please select a time slot first.');
      return;
    }

    setBooking(true);
    try {
      const result = await bookAppointment({
        slotId: selectedSlot.$id,
        doctorId: doctor.$id,
        patientProfileId: profile.$id,
        symptomsNotes,
      });

      if (result.success) {
        Alert.alert(
          'Booked ✓',
          `Appointment confirmed with ${doctor.full_name}!`,
          [{ text: 'OK', onPress: () => router.replace('/') }]
        );
      } else {
        Alert.alert('Booking Failed', result.error || 'The slot may no longer be available.');
        // Refresh slots in case they changed
        await fetchBookingData();
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Booking failed. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  // Group slots by date for display
  const groupedSlots = groupSlotsByDate(slots);
  const dateKeys = Array.from(groupedSlots.keys()).sort();

  // Fallback for no doctorId (navigated directly)
  if (!doctorId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }} edges={['top', 'left', 'right']}>
        <View className="flex-1 bg-background">
          <TopAppBar />
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-4xl mb-4">🔍</Text>
            <Text className="text-on-surface font-bold text-center text-lg">
              Please select a doctor from the Home screen first.
            </Text>
            <Pressable
              onPress={() => router.replace('/')}
              className="bg-primary brutal-border brutal-shadow px-6 py-3 mt-6 active:scale-95"
            >
              <Text className="text-on-primary font-black uppercase">Go to Home</Text>
            </Pressable>
          </View>
          <BottomNavBar />
        </View>
      </SafeAreaView>
    );
  }

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

          {loading ? (
            <View className="items-center py-20">
              <ActivityIndicator size="large" color="#4a5d00" />
              <Text className="text-on-surface-variant font-bold mt-4 uppercase text-[12px]">Loading doctor...</Text>
            </View>
          ) : doctor ? (
            <>
              {/* Doctor Profile Bento */}
              <View className="brutal-border rounded-xl bg-tertiary-container brutal-shadow p-6 flex-col items-center gap-4">
                <View className="w-28 h-28 rounded-full overflow-hidden brutal-border bg-surface-variant shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] items-center justify-center">
                  <Text style={{ fontSize: 48 }}>
                    {doctor.major_field === 'physician' ? '🩺' : doctor.major_field === 'dentist' ? '🦷' : '🧘'}
                  </Text>
                </View>
                <View className="items-center">
                  <Text className="text-[24px] font-black text-on-surface mb-2">{doctor.full_name}</Text>
                  <Text className="text-label-md text-on-surface-variant uppercase tracking-widest mb-3 bg-surface-container-lowest px-3 py-1 brutal-border rounded-full font-bold">
                    {doctor.sub_specialty || doctor.major_field}
                  </Text>
                  <View className="flex-row gap-2 mt-1">
                    <View className="bg-primary-container text-on-primary-container px-2 py-1 brutal-border rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex-row items-center gap-1">
                      <Text className="text-on-surface text-[12px] font-bold">
                        ⭐ {doctor.google_rating?.toFixed(1) || '—'} Rating
                      </Text>
                    </View>
                    <View className="bg-surface-container-lowest text-on-surface px-2 py-1 brutal-border rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex-row items-center gap-1">
                      <Text className="text-on-surface text-[12px] font-bold">
                        📍 {doctor.clinic_district || 'Clinic'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Available Slots */}
              <View className="brutal-border rounded-xl bg-surface-container-lowest brutal-shadow p-5">
                <View className="flex-row items-center gap-2 border-b-2 border-on-surface pb-3 mb-4">
                  <View className="bg-primary-container p-1 brutal-border rounded">
                    <Text className="text-lg">📅</Text>
                  </View>
                  <Text className="text-[20px] font-black text-on-surface uppercase tracking-tight">
                    Available Slots
                  </Text>
                </View>

                {dateKeys.length === 0 ? (
                  <View className="items-center py-6">
                    <Text className="text-4xl mb-2">📭</Text>
                    <Text className="text-on-surface-variant font-bold text-center">
                      No available slots for this doctor right now.
                    </Text>
                  </View>
                ) : (
                  dateKeys.map((dateKey) => {
                    const daySlots = groupedSlots.get(dateKey) || [];
                    const dateLabel = new Date(dateKey).toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric',
                    });

                    return (
                      <View key={dateKey} className="mb-4">
                        <Text className="text-[14px] font-black text-on-surface uppercase tracking-wider mb-2">
                          {dateLabel}
                        </Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{ gap: 12 }}
                        >
                          {daySlots.map((slot) => {
                            const isSelected = selectedSlot?.$id === slot.$id;
                            return (
                              <Pressable
                                key={slot.$id}
                                onPress={() => setSelectedSlot(slot)}
                                className={`brutal-border rounded-lg px-5 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none flex flex-col items-center min-w-[100px] ${
                                  isSelected ? 'bg-secondary' : 'bg-surface'
                                }`}
                              >
                                <Text className={`text-[18px] font-black uppercase ${isSelected ? 'text-on-secondary' : 'text-on-surface'}`}>
                                  {formatSlotTime(slot.start_time).split(' ')[0]}
                                </Text>
                                <Text className={`text-[12px] font-bold ${isSelected ? 'text-on-secondary' : 'text-on-surface'}`}>
                                  {formatSlotTime(slot.start_time).split(' ')[1]}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Symptoms Notes */}
              <View className="brutal-border rounded-xl bg-surface-container-lowest brutal-shadow p-5">
                <View className="flex-row items-center gap-2 border-b-2 border-on-surface pb-3 mb-4">
                  <View className="bg-secondary-container p-1 brutal-border rounded">
                    <Text className="text-lg">📝</Text>
                  </View>
                  <Text className="text-[20px] font-black text-on-surface uppercase tracking-tight">
                    Notes (Optional)
                  </Text>
                </View>
                <TextInput
                  value={symptomsNotes}
                  onChangeText={setSymptomsNotes}
                  multiline
                  numberOfLines={3}
                  className="bg-surface brutal-border p-4 text-base font-bold text-on-surface"
                  placeholder="Describe your symptoms or reason for visit..."
                  placeholderTextColor="#9ca3af"
                  style={{ minHeight: 80, textAlignVertical: 'top' }}
                />
              </View>

              {/* Summary & Action */}
              <View className="brutal-border rounded-xl bg-primary-container brutal-shadow p-6 flex-col justify-between">
                <View className="mb-4">
                  <Text className="text-[14px] font-black text-on-surface uppercase tracking-wider mb-2">Booking Summary</Text>
                  <View className="bg-surface brutal-border p-4 rounded-lg">
                    <Text className="text-[16px] text-on-surface font-black">
                      {selectedSlot
                        ? new Date(selectedSlot.start_time).toLocaleDateString('en-US', {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                          })
                        : 'Select a time slot above'}
                    </Text>
                    <Text className="text-[16px] text-on-surface font-bold mt-1">
                      {selectedSlot ? formatSlotTime(selectedSlot.start_time) : '—'}
                    </Text>
                    <View className="border-t border-dashed border-on-surface mt-3 pt-3">
                      <Text className="text-[12px] text-on-surface-variant font-bold uppercase tracking-wider">
                        Consultation Fee: EGP {doctor.consultation_fee || '—'}
                      </Text>
                    </View>
                  </View>
                </View>

                <Pressable
                  onPress={handleConfirmBooking}
                  disabled={!selectedSlot || !profile || booking}
                  className={`w-full brutal-border rounded-xl py-4 px-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none items-center justify-center ${
                    selectedSlot && profile ? 'bg-primary' : 'bg-surface-variant'
                  }`}
                >
                  {booking ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className={`font-black text-[16px] uppercase tracking-wider ${selectedSlot && profile ? 'text-on-primary' : 'text-on-surface-variant'}`}>
                      {!profile ? 'Log In to Book' : selectedSlot ? 'Confirm Booking' : 'Select a Slot First'}
                    </Text>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <View className="items-center py-20">
              <Text className="text-4xl mb-4">❌</Text>
              <Text className="text-on-surface font-bold text-center text-lg">Doctor not found</Text>
            </View>
          )}
        </ScrollView>

        <BottomNavBar />
      </View>
    </SafeAreaView>
  );
}
