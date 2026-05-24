import React from 'react';
import { View, Text, ScrollView, Pressable, Image, TextInput } from '@/tw';
import { TopAppBar } from '@/components/TopAppBar';
import { BottomNavBar } from '@/components/BottomNavBar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export default function HomeScreen() {
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
              />
              <Pressable style={{ backgroundColor: '#ccff00', borderWidth: 2, borderColor: 'black', borderRadius: 8, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 14 }}>⚙️</Text>
              </Pressable>
            </View>
          </View>

          {/* Categories */}
          <View className="flex-row justify-around items-center px-4 mt-1">
            <View className="items-center" style={{ gap: 6 }}>
              <Pressable style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#4a5d00', borderWidth: 3, borderColor: 'black', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 20 }}>🩺</Text>
              </Pressable>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: 'black', textTransform: 'uppercase' }}>PHYSICIANS</Text>
            </View>

            <View className="items-center" style={{ gap: 6 }}>
              <Pressable style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#ff00ff', borderWidth: 3, borderColor: 'black', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 20 }}>🧘</Text>
              </Pressable>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: 'black', textTransform: 'uppercase' }}>PHYSIOTHERAPY</Text>
            </View>

            <View className="items-center" style={{ gap: 6 }}>
              <Pressable style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#7fffff', borderWidth: 3, borderColor: 'black', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 20 }}>🦷</Text>
              </Pressable>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: 'black', textTransform: 'uppercase' }}>DENTISTS</Text>
            </View>
          </View>

          {/* Section Title */}
          <View className="px-4 mt-1">
            <Text style={{ fontSize: 20, fontWeight: '900', color: 'black' }}>Suggested for You</Text>
            <View style={{ height: 3, backgroundColor: 'black', width: 160, marginTop: 4 }} />
          </View>

          {/* Cards */}
          <View className="px-4" style={{ gap: 12 }}>
            
            {/* Dr. Marcus Vance */}
            <View style={{ backgroundColor: 'white', borderWidth: 3, borderColor: 'black', borderRadius: 16, padding: 16, position: 'relative' }}>
              <View style={{ position: 'absolute', top: 12, right: 12, backgroundColor: '#ff00ff', paddingHorizontal: 8, paddingVertical: 2, borderWidth: 2, borderColor: 'black', borderRadius: 4, flexDirection: 'row', alignItems: 'center', gap: 2, zIndex: 10 }}>
                <Text style={{ fontSize: 10 }}>⭐</Text>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: 'black' }}>4.9</Text>
              </View>
              
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <View style={{ width: 56, height: 56, borderRadius: 8, borderWidth: 2, borderColor: 'black', overflow: 'hidden', backgroundColor: '#ccff00' }}>
                  <Image 
                    style={{ width: '100%', height: '100%' }}
                    source={{ uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuCIIxdh-kgzk3qxX4d7ggMTgLgEECwAJDKQ19-FX6vWXALh8yJAqsNOrRY7QNAkgNQZXrh07Kx7mXsp5YH3RwnwHJMnJky2NlAbAxZrUMzgBE3tAshZ7U8s9CtE3K5fO0S0ONK2xLnaJEid9-N0odP1499dPl0megER-XsbMv2m7x2kIDUV2MB3iYg9aYnMG1IeUZ2f3l6bHSVntvCHcSzAhygz_9YJSB5rabWQq6Il3-4osPtmPgUuqPjijyrlgJSiZzHCoESkuQ" }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: 'black', lineHeight: 18 }}>Dr. Marcus{'\n'}Vance</Text>
                  <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Cardiology</Text>
                </View>
              </View>

              <Pressable 
                onPress={() => router.push('/booking')}
                style={{ width: '100%', backgroundColor: '#4a5d00', paddingVertical: 10, borderWidth: 2, borderColor: 'black', borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>BOOK APPOINTMENT</Text>
                <Text style={{ color: 'white', fontSize: 12 }}>→</Text>
              </Pressable>
            </View>

            {/* Two Small Cards */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {/* Next Slot */}
              <View style={{ flex: 1, backgroundColor: '#7fffff', borderWidth: 3, borderColor: 'black', borderRadius: 16, padding: 14, flexDirection: 'column' }}>
                <View style={{ backgroundColor: 'white', width: 36, height: 36, borderWidth: 2, borderColor: 'black', borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 14 }}>📅</Text>
                </View>
                <View style={{ marginTop: 10 }}>
                  <Text style={{ fontSize: 8, fontWeight: '900', color: 'black', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>NEXT SLOT</Text>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: 'black', lineHeight: 18 }}>Today</Text>
                  <Text style={{ color: '#4a5d00', fontSize: 13, fontWeight: 'bold' }}>2:00 PM</Text>
                </View>
              </View>

              {/* Dr. E. Lee */}
              <View style={{ flex: 1, backgroundColor: 'white', borderWidth: 3, borderColor: 'black', borderRadius: 16, alignItems: 'center', position: 'relative', overflow: 'hidden', paddingTop: 20, paddingBottom: 12 }}>
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 14, backgroundColor: '#ccff00', borderBottomWidth: 2, borderBottomColor: 'black' }} />
                <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: 'black', overflow: 'hidden', backgroundColor: '#ff00ff' }}>
                  <Image 
                    style={{ width: '100%', height: '100%' }}
                    source={{ uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuB6-acmulJIrDA1YgdHiO8d_io_oyaeWKzp5yqhRrE9KidwYsGt97wttq-evKOzykdddyYOPYaHVykgOGp-jGmyTksw3lGH3l-hFJww-mr61k_-1UL-FDV-SkKAnDiTMwxzn8Oh7sGDqTzmZYkEmUEwyZByEgniZkaOS-NhNFSQRSoPS9lFvojZZDmQfrOsGOs_PiLW4q7YFCGLZ2Wovdtu4SAyNok5-rNA3J35BlnBZgOVHYRIpRfXlxzipueKf6PPBJLjllQzgQ" }}
                  />
                </View>
                <Text style={{ fontWeight: 'bold', fontSize: 12, color: 'black', marginTop: 6 }}>Dr. E. Lee</Text>
                <Text style={{ fontSize: 9, color: '#6b7280', fontWeight: '500', textTransform: 'uppercase' }}>Dentistry</Text>
              </View>
            </View>

            {/* Annual Checkup */}
            <View style={{ backgroundColor: '#ccff00', borderWidth: 3, borderColor: 'black', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: 'black', lineHeight: 20, textTransform: 'uppercase' }}>Annual{'\n'}Checkup</Text>
                <Text style={{ fontSize: 10, color: 'black', fontWeight: '500', lineHeight: 14, marginTop: 4 }}>Don't wait. Secure your{'\n'}health baseline today.</Text>
              </View>
              <Pressable 
                onPress={() => alert('Scheduling Annual Checkup!')}
                style={{ backgroundColor: 'black', paddingHorizontal: 16, paddingVertical: 10, borderWidth: 2, borderColor: 'black', borderRadius: 8 }}
              >
                <Text style={{ color: 'white', fontWeight: '900', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>Schedule</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
        
        {/* Floating Action Button */}
        <Pressable 
          onPress={() => alert('AI Bot Chat active!')}
          style={{ position: 'absolute', bottom: 80, right: 16, width: 48, height: 48, backgroundColor: '#ff00ff', borderWidth: 3, borderColor: 'black', borderRadius: 24, alignItems: 'center', justifyContent: 'center', zIndex: 40 }}
        >
          <Text style={{ fontSize: 18 }}>⚕️</Text>
        </Pressable>

        <BottomNavBar />
      </View>
    </SafeAreaView>
  );
}
