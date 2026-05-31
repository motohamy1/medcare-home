import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Image, TextInput } from '@/tw';
import { TopAppBar } from '@/components/TopAppBar';
import { BottomNavBar } from '@/components/BottomNavBar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { getSuggestedDoctors, getDoctorsByField, displayDoctorName, type Doctor } from '@/services/doctorService';
import { getUpcomingAppointmentsCount } from '@/services/bookingService';
import { ActivityIndicator, Alert } from 'react-native';

export default function HomeScreen() {
  const { profile } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchHomeData = useCallback(async () => {
    try {
      const [suggestedDoctors, upcoming] = await Promise.all([
        getSuggestedDoctors(5),
        profile ? getUpcomingAppointmentsCount(profile.$id) : Promise.resolve(0),
      ]);
      setDoctors(suggestedDoctors);
      setUpcomingCount(upcoming);
    } catch (err) {
      console.error('[HomeScreen] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchHomeData();
  }, [fetchHomeData]);

  const handleCategoryTap = async (field: 'physician' | 'dentist' | 'physiotherapy') => {
    try {
      const results = await getDoctorsByField(field);
      setDoctors(results);
    } catch (err) {
      console.error('[HomeScreen] Category filter failed:', err);
    }
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push({ pathname: '/search', params: { q: searchQuery } });
    }
  };

  // Emoji for major field
  const fieldEmoji = (field: string) => {
    switch (field) {
      case 'physician': return '🩺';
      case 'dentist': return '🦷';
      case 'physiotherapy': return '🧘';
      default: return '⚕️';
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }} edges={['top', 'left', 'right']}>
      <View className="flex-1 bg-background flex-col relative">
        <TopAppBar />
        
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="pb-6 pt-3 gap-3">
          
          {/* Search Bar */}
          <View className="px-4">
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderWidth: 3, borderColor: 'black', borderRadius: 16, shadowColor: 'black', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4, paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text style={{ fontSize: 18 }}>🔍</Text>
              <TextInput 
                style={{ flex: 1, backgroundColor: 'transparent', fontSize: 14, marginLeft: 8, padding: 0 }}
                placeholder="Find doctors, symptoms, clini"
                placeholderTextColor="#9ca3af"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              <Pressable 
                onPress={handleSearch}
                style={{ backgroundColor: '#ccff00', borderWidth: 2, borderColor: 'black', borderRadius: 8, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 14 }}>⚙️</Text>
              </Pressable>
            </View>
          </View>

            {/* Categories */}
            <View className="px-4 mt-1 mb-2">
              <View className="flex-row justify-around items-center">
                <View className="items-center" style={{ gap: 6 }}>
                  <Pressable 
                    onPress={() => handleCategoryTap('physician')}
                    style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#4a5d00', borderWidth: 3, borderColor: 'black', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: 20 }}>🩺</Text>
                  </Pressable>
                  <Text style={{ fontSize: 9, fontWeight: 'bold', color: 'black', textTransform: 'uppercase' }}>PHYSICIANS</Text>
                </View>

                <View className="items-center" style={{ gap: 6 }}>
                  <Pressable 
                    onPress={() => handleCategoryTap('physiotherapy')}
                    style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#ff00ff', borderWidth: 3, borderColor: 'black', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: 20 }}>🧘</Text>
                  </Pressable>
                  <Text style={{ fontSize: 9, fontWeight: 'bold', color: 'black', textTransform: 'uppercase' }}>PHYSIOTHERAPY</Text>
                </View>

                <View className="items-center" style={{ gap: 6 }}>
                  <Pressable 
                    onPress={() => handleCategoryTap('dentist')}
                    style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#7fffff', borderWidth: 3, borderColor: 'black', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: 20 }}>🦷</Text>
                  </Pressable>
                  <Text style={{ fontSize: 9, fontWeight: 'bold', color: 'black', textTransform: 'uppercase' }}>DENTISTS</Text>
                </View>
              </View>
            </View>

            {/* Upcoming Appointments + MedCare AI Assistant + Annual Checkup */}
            <View className="px-4 mb-3">
              {/* Upcoming Appointments */}
              <View style={{ backgroundColor: '#7fffff', borderWidth: 3, borderColor: 'black', borderRadius: 16, padding: 14, marginBottom: 12 }}>
                <View style={{ backgroundColor: 'white', width: 36, height: 36, borderWidth: 2, borderColor: 'black', borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 14 }}>📅</Text>
                </View>
                <View style={{ marginTop: 10 }}>
                  <Text style={{ fontSize: 8, fontWeight: '900', color: 'black', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>UPCOMING</Text>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: 'black', lineHeight: 18 }}>
                    {upcomingCount} Appt{upcomingCount !== 1 ? 's' : ''}
                  </Text>
                  <Text style={{ color: '#4a5d00', fontSize: 13, fontWeight: 'bold' }}>Scheduled</Text>
                </View>
              </View>

              {/* Annual Checkup CTA */}
              <View style={{ backgroundColor: '#ccff00', borderWidth: 3, borderColor: 'black', borderRadius: 16, padding: 16, minHeight: 98, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: 'black', lineHeight: 20, textTransform: 'uppercase' }}>Annual{'\n'}Checkup</Text>
                  <Text style={{ fontSize: 10, color: 'black', fontWeight: '500', lineHeight: 14, marginTop: 4 }}>Don't wait. Secure your{'\n'}health baseline today.</Text>
                </View>
                <Pressable 
                  onPress={() => Alert.alert('Coming Soon', 'Annual checkup scheduling will be available soon!')}
                  style={{ backgroundColor: 'black', paddingHorizontal: 16, paddingVertical: 10, borderWidth: 2, borderColor: 'black', borderRadius: 8 }}
                >
                  <Text style={{ color: 'white', fontWeight: '900', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>Schedule</Text>
                </Pressable>
              </View>
            </View>

           {/* Section Title */}
           <View className="px-4 mt-1">
             <Text style={{ fontSize: 20, fontWeight: '900', color: 'black' }}>Suggested for You</Text>
             <View style={{ height: 3, backgroundColor: 'black', width: 160, marginTop: 4 }} />
           </View>

           {/* Doctor Cards */}
           <View className="px-4" style={{ gap: 12 }}>
             {loading ? (
               <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                 <ActivityIndicator size="large" color="#4a5d00" />
               </View>
             ) : doctors.length === 0 ? (
               <View style={{ backgroundColor: 'white', borderWidth: 3, borderColor: 'black', borderRadius: 16, padding: 24, alignItems: 'center' }}>
                 <Text style={{ fontSize: 40, marginBottom: 8 }}>🔍</Text>
                 <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#6b7280', textAlign: 'center' }}>
                   No doctors found. Try another category!
                 </Text>
               </View>
             ) : (
               doctors.map((doctor) => (
                 <View 
                   key={doctor.$id} 
                   style={{ backgroundColor: 'white', borderWidth: 3, borderColor: 'black', borderRadius: 16, padding: 16, position: 'relative' }}
                 >
                   {/* Rating Badge */}
                   <View style={{ position: 'absolute', top: 12, right: 12, backgroundColor: '#ff00ff', paddingHorizontal: 8, paddingVertical: 2, borderWidth: 2, borderColor: 'black', borderRadius: 4, flexDirection: 'row', alignItems: 'center', gap: 2, zIndex: 10 }}>
                     <Text style={{ fontSize: 10 }}>⭐</Text>
                     <Text style={{ fontSize: 10, fontWeight: 'bold', color: 'black' }}>
                       {doctor.google_rating?.toFixed(1) || '—'}
                     </Text>
                   </View>
                   
                   <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                     {/* Doctor Avatar */}
                     <View style={{ width: 56, height: 56, borderRadius: 8, borderWidth: 2, borderColor: 'black', overflow: 'hidden', backgroundColor: '#ccff00', alignItems: 'center', justifyContent: 'center' }}>
                       <Text style={{ fontSize: 24 }}>{fieldEmoji(doctor.major_field)}</Text>
                     </View>
                     <View style={{ flex: 1 }}>
                       <Text style={{ fontSize: 15, fontWeight: '900', color: 'black', lineHeight: 18 }}>
                         {doctor.full_name}
                       </Text>
                       <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2, textTransform: 'capitalize' }}>
                         {doctor.sub_specialty || doctor.major_field}
                       </Text>
                       {doctor.clinic_governorate && (
                         <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>
                           📍 {doctor.clinic_district}, {doctor.clinic_governorate}
                         </Text>
                       )}
                     </View>
                   </View>

                   <Pressable 
                     onPress={() => router.push({ pathname: '/booking', params: { doctorId: doctor.$id } })}
                     style={{ width: '100%', backgroundColor: '#4a5d00', paddingVertical: 10, borderWidth: 2, borderColor: 'black', borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}
                   >
                     <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>BOOK APPOINTMENT</Text>
                     <Text style={{ color: 'white', fontSize: 12 }}>→</Text>
                   </Pressable>
                 </View>
               ))
             )}
           </View>
        </ScrollView>
        
        {/* Floating Action Button */}
        <Pressable 
          onPress={() => Alert.alert('AI Bot', 'AI health assistant coming soon!')}
          style={{ position: 'absolute', bottom: 80, right: 16, width: 48, height: 48, backgroundColor: '#ff00ff', borderWidth: 3, borderColor: 'black', borderRadius: 24, alignItems: 'center', justifyContent: 'center', zIndex: 40 }}
        >
          <Text style={{ fontSize: 18 }}>⚕️</Text>
        </Pressable>

        <BottomNavBar />
      </View>
    </SafeAreaView>
  );
}
