import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from '@/tw';
import { TopAppBar } from '@/components/TopAppBar';
import { BottomNavBar } from '@/components/BottomNavBar';
import { BentoCard } from '@/components/BentoCard';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function VitalScreen() {
  const [showLogModal, setShowLogModal] = useState(false);
  const [heartRate, setHeartRate] = useState('72');
  const [bloodPressure, setBloodPressure] = useState('120/80');
  const [oxygen, setOxygen] = useState('99');
  
  const [vitalsHistory, setVitalsHistory] = useState([
    { id: 1, type: '❤️ Heart Rate', value: '72 BPM', time: '10 mins ago', status: 'Normal', color: 'bg-primary-container' },
    { id: 2, type: '🩺 Blood Pressure', value: '118/79 mmHg', time: '2 hours ago', status: 'Optimal', color: 'bg-secondary-container' },
    { id: 3, type: '💧 Blood Oxygen', value: '98%', time: '4 hours ago', status: 'Excellent', color: 'bg-surface-container-highest' },
    { id: 4, type: '🌡️ Temperature', value: '98.6 °F', time: 'Yesterday', status: 'Normal', color: 'bg-primary-container' },
  ]);

  const handleAddVital = () => {
    if (!heartRate || !bloodPressure || !oxygen) return;
    
    const newVitals = [
      { id: Date.now(), type: '❤️ Heart Rate', value: `${heartRate} BPM`, time: 'Just now', status: 'Normal', color: 'bg-primary-container' },
      { id: Date.now() + 1, type: '🩺 Blood Pressure', value: `${bloodPressure} mmHg`, time: 'Just now', status: 'Normal', color: 'bg-secondary-container' },
      { id: Date.now() + 2, type: '💧 Blood Oxygen', value: `${oxygen}%`, time: 'Just now', status: 'Excellent', color: 'bg-surface-container-highest' },
    ];

    setVitalsHistory([...newVitals, ...vitalsHistory]);
    setShowLogModal(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }} edges={['top', 'left', 'right']}>
      <View className="flex-1 bg-background">
        <TopAppBar />
        
        <ScrollView className="flex-1" contentContainerClassName="pb-8 px-margin-mobile pt-8 gap-container-gap">
          {/* Header Badge */}
          <View className="items-start gap-2">
            <View className="bg-secondary-container px-4 py-1 brutal-border brutal-shadow-lg rotate-1">
              <Text className="text-[28px] font-bold text-on-secondary uppercase tracking-tight">
                My Vitals
              </Text>
            </View>
            <View className="bg-surface-container-highest px-3 py-1 brutal-border mt-1">
              <Text className="text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">
                📶 Last Synced: 2 Mins Ago
              </Text>
            </View>
          </View>

          {/* Vitals Summary Grid */}
          <View className="flex-row flex-wrap gap-4 mt-2">
            {/* Heart Rate Card */}
            <BentoCard className="w-full bg-primary-container p-4 flex-row items-center justify-between overflow-hidden">
              <View className="flex-col justify-between flex-1">
                <Text className="text-[12px] font-bold text-on-primary-container uppercase tracking-widest mb-1">
                  ❤️ Heart Rate
                </Text>
                <Text className="text-[36px] font-bold text-on-surface leading-none">
                  {heartRate} <Text className="text-[18px] font-medium">BPM</Text>
                </Text>
                <Text className="text-[12px] font-bold text-on-surface-variant mt-2 uppercase">
                  🟢 Normal (60-100)
                </Text>
              </View>
              <View className="w-20 h-20 rounded-full border-4 border-on-surface items-center justify-center bg-surface rotate-6 brutal-shadow-lg relative">
                <Text className="text-4xl animate-pulse">💓</Text>
              </View>
            </BentoCard>

            {/* Blood Pressure Card */}
            <BentoCard className="flex-1 bg-secondary-container aspect-square min-w-[40%] justify-between p-4">
              <View className="flex-col">
                <Text className="text-[12px] font-bold text-on-secondary uppercase mb-1">🩺 Blood Pressure</Text>
                <Text className="text-[26px] font-bold text-on-secondary leading-tight mt-2">{bloodPressure}</Text>
                <Text className="text-[12px] font-semibold text-on-secondary opacity-90 mt-1">mmHg</Text>
              </View>
              <View className="mt-auto">
                <View className="bg-surface brutal-border px-2 py-0.5 self-start">
                  <Text className="text-[11px] font-bold text-on-surface uppercase">Optimal</Text>
                </View>
              </View>
            </BentoCard>

            {/* Blood Oxygen Card */}
            <BentoCard className="flex-1 bg-surface-container-lowest aspect-square min-w-[40%] justify-between p-4">
              <View className="flex-col">
                <Text className="text-[12px] font-bold text-on-surface-variant uppercase mb-1">💧 Blood Oxygen</Text>
                <Text className="text-[32px] font-bold text-on-surface leading-tight mt-2">{oxygen}%</Text>
                <Text className="text-[12px] font-semibold text-on-surface-variant mt-1">SpO2</Text>
              </View>
              <View className="mt-auto">
                <View className="bg-primary px-2 py-0.5 self-start brutal-border brutal-shadow">
                  <Text className="text-[11px] font-bold text-on-primary uppercase">Excellent</Text>
                </View>
              </View>
            </BentoCard>
          </View>

          {/* Log Vitals Button */}
          <Pressable 
            onPress={() => setShowLogModal(!showLogModal)}
            className="bg-primary-container brutal-border brutal-shadow p-4 flex-row items-center justify-center gap-3 active:scale-95 mt-2"
          >
            <Text className="text-[16px] font-black text-on-surface uppercase tracking-wider">
              {showLogModal ? '✖ Close Logger' : '➕ Log New Vitals'}
            </Text>
          </Pressable>

          {/* Quick Log Form */}
          {showLogModal && (
            <View className="bg-surface-container-lowest brutal-border brutal-shadow-lg p-5 gap-4">
              <Text className="text-xl font-bold uppercase tracking-tight text-on-surface border-b-2 border-on-surface pb-2">
                Log New Readings
              </Text>
              
              <View className="gap-2">
                <Text className="text-[12px] font-bold uppercase text-on-surface-variant">Heart Rate (BPM)</Text>
                <TextInput
                  value={heartRate}
                  onChangeText={setHeartRate}
                  keyboardType="numeric"
                  className="bg-surface brutal-border p-3 text-lg font-bold text-on-surface"
                  placeholder="e.g. 72"
                />
              </View>

              <View className="gap-2">
                <Text className="text-[12px] font-bold uppercase text-on-surface-variant">Blood Pressure (SYS/DIA)</Text>
                <TextInput
                  value={bloodPressure}
                  onChangeText={setBloodPressure}
                  className="bg-surface brutal-border p-3 text-lg font-bold text-on-surface"
                  placeholder="e.g. 120/80"
                />
              </View>

              <View className="gap-2">
                <Text className="text-[12px] font-bold uppercase text-on-surface-variant">Blood Oxygen (SpO2 %)</Text>
                <TextInput
                  value={oxygen}
                  onChangeText={setOxygen}
                  keyboardType="numeric"
                  className="bg-surface brutal-border p-3 text-lg font-bold text-on-surface"
                  placeholder="e.g. 98"
                />
              </View>

              <Pressable 
                onPress={handleAddVital}
                className="bg-primary brutal-border brutal-shadow p-4 items-center active:scale-95 mt-2"
              >
                <Text className="text-[14px] font-black text-on-primary uppercase tracking-widest">
                  Save Readings
                </Text>
              </Pressable>
            </View>
          )}

          {/* Vitals History Log */}
          <View className="gap-4 mt-4">
            <View className="border-b-4 border-on-surface pb-2 self-start pr-8">
              <Text className="text-[24px] font-bold text-on-surface uppercase">Reading Log</Text>
            </View>

            <View className="gap-3">
              {vitalsHistory.map((item) => (
                <View key={item.id} className="bg-surface-container-lowest brutal-border brutal-shadow p-4 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <View className={`w-12 h-12 ${item.color} items-center justify-center brutal-border brutal-shadow`}>
                      <Text className="text-xl">🩺</Text>
                    </View>
                    <View>
                      <Text className="text-[14px] font-bold text-on-surface uppercase">{item.type}</Text>
                      <Text className="text-[16px] font-black text-on-surface mt-1">{item.value}</Text>
                    </View>
                  </View>
                  <View className="items-end gap-1">
                    <Text className="text-[12px] text-on-surface-variant font-bold">{item.time}</Text>
                    <View className="bg-surface px-2 py-0.5 brutal-border">
                      <Text className="text-[10px] font-black text-on-surface uppercase">{item.status}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
        
        <BottomNavBar />
      </View>
    </SafeAreaView>
  );
}
