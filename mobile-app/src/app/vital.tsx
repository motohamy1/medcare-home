import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from '@/tw';
import { TopAppBar } from '@/components/TopAppBar';
import { BottomNavBar } from '@/components/BottomNavBar';
import { BentoCard } from '@/components/BentoCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import {
  logVital,
  getRecentVitals,
  getLatestVitals,
  formatVitalValue,
  getVitalStatus,
  getRelativeTime,
  VITAL_DISPLAY,
  type HealthMetric,
  type VitalCategory,
} from '@/services/healthService';
import { Alert, ActivityIndicator, Modal } from 'react-native';

export default function VitalScreen() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'status' | 'regimen'>('status');
  const [showLogModal, setShowLogModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Expanded Tip Detail Modals
  const [showTipDetail, setShowTipDetail] = useState(false);
  const [tipLogged, setTipLogged] = useState(false);
  const [complianceRates, setComplianceRates] = useState([80, 50, 90, 100, 70, 30, 0]);

  // Regimen State (View 2)
  const [regimen, setRegimen] = useState([
    { id: 'lisinopril', time: 'MORNING', name: 'Lisinopril 10mg', dose: '1 Pill • with food', icon: '☀️', bg: 'bg-[#7fffff]', completed: true },
    { id: 'vitD', time: 'AFTERNOON', name: 'Vitamin D3', dose: '1 Capsule', icon: '🌤️', bg: 'bg-white', completed: false },
    { id: 'magnesium', time: 'EVENING', name: 'Magnesium', dose: '2 Pills • before bed', icon: '🌙', bg: 'bg-[#ffc2eb]', completed: false }
  ]);
  const [refillRequested, setRefillRequested] = useState(false);
  const [showAddMedModal, setShowAddMedModal] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDose, setNewMedDose] = useState('');
  const [newMedTime, setNewMedTime] = useState<'MORNING' | 'AFTERNOON' | 'EVENING'>('MORNING');

  // Investigation checkable items
  const [investigations, setInvestigations] = useState([
    { id: 'cbc', name: 'Complete Blood Count (CBC)', desc: 'Due Oct 28 at Central Lab', completed: false },
    { id: 'lipid', name: 'Lipid Panel', desc: 'Completed Oct 20 at City Hospital', completed: true }
  ]);

  // Form inputs for Vitals Logger
  const [heartRate, setHeartRate] = useState('');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [glucose, setGlucose] = useState('');

  // Real data from backend
  const [latestVitals, setLatestVitals] = useState<Partial<Record<VitalCategory, HealthMetric>>>({});
  const [vitalsHistory, setVitalsHistory] = useState<HealthMetric[]>([]);

  const fetchVitals = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [latest, history] = await Promise.all([
        getLatestVitals(profile.$id),
        getRecentVitals(profile.$id, 20),
      ]);
      setLatestVitals(latest);
      setVitalsHistory(history);
    } catch (err) {
      console.error('[VitalScreen] Failed to load vitals:', err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchVitals();
  }, [fetchVitals]);

  const handleAddVital = async () => {
    if (!profile || !user) return;

    if (!heartRate && !systolic && !glucose) {
      Alert.alert('No Data', 'Please enter at least one vital reading.');
      return;
    }

    setSaving(true);
    try {
      const promises: Promise<any>[] = [];

      if (heartRate) {
        promises.push(
          logVital({
            patientProfileId: profile.$id,
            authId: user.$id,
            category: 'heart_rate',
            valuePrimary: parseInt(heartRate),
            unit: 'BPM',
          })
        );
      }

      if (systolic && diastolic) {
        promises.push(
          logVital({
            patientProfileId: profile.$id,
            authId: user.$id,
            category: 'bp',
            valuePrimary: parseInt(systolic),
            valueSecondary: parseInt(diastolic),
            unit: 'mmHg',
          })
        );
      }

      if (glucose) {
        promises.push(
          logVital({
            patientProfileId: profile.$id,
            authId: user.$id,
            category: 'glucose',
            valuePrimary: parseInt(glucose),
            unit: 'mg/dL',
          })
        );
      }

      await Promise.all(promises);

      setHeartRate('');
      setSystolic('');
      setDiastolic('');
      setGlucose('');
      setShowLogModal(false);
      await fetchVitals();

      Alert.alert('Saved ✓', 'Your vitals have been recorded.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save vitals.');
    } finally {
      setSaving(false);
    }
  };

  // Toggle checklist
  const toggleInvestigation = (id: string) => {
    setInvestigations(prev => prev.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  // Toggle regimen item completed state
  const toggleRegimen = (id: string) => {
    setRegimen(prev => prev.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  // Add custom medication
  const handleAddMedication = () => {
    if (!newMedName) {
      Alert.alert('Error', 'Please enter a medication name.');
      return;
    }
    const timeBg = newMedTime === 'MORNING' ? 'bg-[#7fffff]' : newMedTime === 'AFTERNOON' ? 'bg-white' : 'bg-[#ffc2eb]';
    const timeIcon = newMedTime === 'MORNING' ? '☀️' : newMedTime === 'AFTERNOON' ? '🌤️' : '🌙';
    
    setRegimen(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        time: newMedTime,
        name: newMedName,
        dose: newMedDose || '1 Pill',
        icon: timeIcon,
        bg: timeBg,
        completed: false
      }
    ]);

    setNewMedName('');
    setNewMedDose('');
    setNewMedTime('MORNING');
    setShowAddMedModal(false);
    Alert.alert('Success ✓', 'New medication added to your regimen!');
  };

  // Quick Action Hydration Logger in Modal
  const logHydrationTip = () => {
    setTipLogged(true);
    setComplianceRates(prev => {
      const next = [...prev];
      next[4] = 100; // Complete Friday
      return next;
    });
    Alert.alert('Hydrated! 💧', '250ml water added to your daily intake tracker.');
  };

  // Display metrics
  const hrMetric = latestVitals.heart_rate;
  const bpMetric = latestVitals.bp;

  // Regimen progress math
  const completedRegimenCount = regimen.filter(r => r.completed).length;
  const totalRegimenCount = regimen.length;
  const progressPercent = totalRegimenCount > 0 ? Math.round((completedRegimenCount / totalRegimenCount) * 100) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }} edges={['top', 'left', 'right']}>
      <View className="flex-1 bg-background relative">
        <TopAppBar />

        {/* NEO-BRUTALIST SEGMENTED TOGGLE SWITCH */}
        <View className="flex-row mx-4 my-3 bg-[#f0f0f0] border-3 border-black rounded-xl overflow-hidden p-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <Pressable 
            onPress={() => setActiveTab('status')}
            className={`flex-1 py-2.5 items-center rounded-lg ${activeTab === 'status' ? 'bg-[#ccff00] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-transparent'}`}
          >
            <Text className="font-black text-[11px] uppercase tracking-wider text-black">🏥 Health Status</Text>
          </Pressable>
          <Pressable 
            onPress={() => setActiveTab('regimen')}
            className={`flex-1 py-2.5 items-center rounded-lg ${activeTab === 'regimen' ? 'bg-[#ccff00] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-transparent'}`}
          >
            <Text className="font-black text-[11px] uppercase tracking-wider text-black">📋 Today's Regimen</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="pb-10 px-4 pt-1">
          {loading ? (
            <View className="items-center py-12">
              <ActivityIndicator size="large" color="#4a5d00" />
            </View>
          ) : activeTab === 'status' ? (
            /* VIEW 1: CURRENT HEALTH STATUS */
            <View className="gap-5">
              {/* CURRENT HEALTH STATUS CARD */}
              <View className="bg-[#ccff00] border-3 border-black rounded-2xl p-5 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="font-black text-sm uppercase tracking-wider text-black">CURRENT HEALTH STATUS</Text>
                  <View className="bg-white border-2 border-black px-3 py-0.5 rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                    <Text className="text-[10px] leading-[16px] font-black text-black">STABLE</Text>
                  </View>
                </View>

                {/* HEART RATE & BP CARDS */}
                <View className="flex-row gap-3">
                  {/* Heart Rate Card */}
                  <View className="bg-white border-2 border-black rounded-xl p-3 flex-1 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] justify-between">
                    <View>
                      <Text className="text-[10px] leading-[16px] font-black text-gray-500 uppercase tracking-widest">❤️ HEART RATE</Text>
                      <View className="flex-row items-baseline mt-1">
                        <Text className="text-2xl font-black text-black">
                          {hrMetric ? formatVitalValue(hrMetric) : '72'}
                        </Text>
                        <Text className="text-[10px] leading-[16px] font-bold text-gray-700 ml-1">BPM</Text>
                      </View>
                    </View>
                    
                    {/* Sparkline wave */}
                    <View className="flex-row items-end gap-1.5 h-6 mt-3">
                      <View className="w-1.5 bg-[#4a5d00] rounded-sm" style={{ height: 8 }} />
                      <View className="w-1.5 bg-[#4a5d00] rounded-sm" style={{ height: 16 }} />
                      <View className="w-1.5 bg-[#4a5d00] rounded-sm" style={{ height: 12 }} />
                      <View className="w-1.5 bg-[#4a5d00] rounded-sm" style={{ height: 22 }} />
                      <View className="w-1.5 bg-[#4a5d00] rounded-sm" style={{ height: 14 }} />
                      <View className="w-1.5 bg-[#4a5d00] rounded-sm" style={{ height: 18 }} />
                      <View className="w-1.5 bg-[#4a5d00] rounded-sm" style={{ height: 24 }} />
                    </View>
                  </View>

                  {/* Blood Pressure Card */}
                  <View className="bg-white border-2 border-black rounded-xl p-3 flex-1 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] justify-between">
                    <View>
                      <Text className="text-[10px] leading-[16px] font-black text-gray-500 uppercase tracking-widest">🩺 BLOOD PRESS.</Text>
                      <View className="flex-row items-baseline mt-1">
                        <Text className="text-2xl font-black text-black">
                          {bpMetric ? formatVitalValue(bpMetric) : '118/75'}
                        </Text>
                        <Text className="text-[10px] leading-[16px] font-bold text-gray-700 ml-1">mmHg</Text>
                      </View>
                    </View>

                    <View className="bg-[#e2fce6] px-2 py-1 border border-black rounded self-start mt-4">
                      <Text className="text-[10px] leading-[16px] font-black text-green-800 tracking-wider">🟢 OPTIMAL</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* DAILY AI HEALTH TIP CARD */}
              <Pressable 
                onPress={() => setShowTipDetail(true)}
                className="bg-[#00e5ff] border-3 border-black rounded-2xl p-5 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] active:scale-[0.98]"
              >
                <View className="flex-row items-center gap-2">
                  <Text className="text-lg">🤖</Text>
                  <Text className="font-black text-xs text-black uppercase tracking-wider">DAILY AI HEALTH TIP</Text>
                </View>
                <Text className="text-xs font-bold text-black mt-2.5 leading-relaxed">
                  Your sleep data suggests a mild deficit. Try a 20-minute power nap between 1 PM and 3 PM today to boost cognitive function.
                </Text>
                <Pressable 
                  onPress={() => setShowTipDetail(true)}
                  className="bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] py-2.5 rounded-xl items-center mt-4 active:scale-95"
                >
                  <Text className="font-black text-[10px] leading-[16px] uppercase text-black tracking-wider">ACKNOWLEDGE</Text>
                </Pressable>
              </Pressable>

              {/* PENDING INVESTIGATIONS */}
              <View className="bg-white border-3 border-black rounded-2xl p-5 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                <Text className="font-black text-xs text-black uppercase tracking-wider border-b-2 border-black pb-2 mb-3">
                  PENDING INVESTIGATIONS
                </Text>
                <View className="gap-3">
                  {investigations.map((item) => {
                    const isCompleted = item.completed;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => toggleInvestigation(item.id)}
                        className={`border-2 border-black p-3.5 rounded-xl flex-row items-center transition-all ${
                          isCompleted ? 'bg-[#ccff00] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        }`}
                      >
                        <View className={`w-6 h-6 border-2 border-black rounded mr-3 items-center justify-center ${
                          isCompleted ? 'bg-black' : 'bg-white'
                        }`}>
                          {isCompleted && <Text className="text-white text-xs font-bold">✓</Text>}
                        </View>
                        <View className="flex-1">
                          <Text className={`font-black text-xs text-black ${isCompleted ? 'line-through text-opacity-70' : ''}`}>
                            {item.name}
                          </Text>
                          <Text className="text-[10px] leading-[16px] font-bold text-gray-600 mt-0.5">{item.desc}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* MEDCAREHOME AI SUGGESTIONS (Hot Pink) */}
              <View className="bg-[#ff00ff] border-3 border-black rounded-2xl p-5 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                <View className="flex-row items-center gap-1.5 mb-3">
                  <Text className="text-sm">⚡</Text>
                  <Text className="font-black text-xs text-black uppercase tracking-wider">MEDCAREHOME AI SUGGESTIONS</Text>
                </View>

                <View className="flex-row gap-3">
                  {/* Suggestion 1: Hydration */}
                  <Pressable 
                    onPress={() => setShowTipDetail(true)}
                    className="bg-white border-2 border-black rounded-xl p-3 flex-1 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] justify-between active:scale-95"
                  >
                    <View>
                      <Text className="text-[10px] leading-[16px] font-black text-black">💧 HYDRATION ALERT</Text>
                      <Text className="text-[10px] leading-[16px] font-bold text-black mt-1.5">
                        Based on activity, drink 16oz of water now.
                      </Text>
                    </View>
                    <Text className="text-[10px] leading-[16px] font-black text-[#ff00ff] mt-2.5">VIEW DETAIL →</Text>
                  </Pressable>

                  {/* Suggestion 2: Activity */}
                  <View className="bg-white border-2 border-black rounded-xl p-3 flex-1 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] justify-between">
                    <View>
                      <Text className="text-[10px] leading-[16px] font-black text-black">🏃 ACTIVITY GAP</Text>
                      <Text className="text-[10px] leading-[16px] font-bold text-black mt-1.5">
                        You are 2,000 steps behind your Tuesday average.
                      </Text>
                    </View>
                    <Text className="text-[10px] leading-[16px] font-black text-gray-500 mt-2.5">LOG WALK</Text>
                  </View>
                </View>
              </View>

              {/* MEDICAL HISTORY TIMELINE */}
              <View className="gap-3 mt-1.5">
                <View className="border-b-3 border-black pb-1.5 self-start pr-6 mb-2">
                  <Text className="text-lg font-black text-black uppercase tracking-tight">MEDICAL HISTORY</Text>
                </View>

                <View className="relative pl-7 pb-2 gap-4">
                  {/* Timeline vertical bar */}
                  <View className="absolute left-2.5 top-2 bottom-2 w-1.5 bg-black" />

                  {/* Timeline Node 1 */}
                  <View className="flex-row items-start relative">
                    <View className="absolute -left-[24px] top-1.5 w-[14px] h-[14px] rounded-full bg-[#7fffff] border-2 border-black z-10" />
                    <View className="bg-white border-2 border-black rounded-xl p-3.5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex-1">
                      <Text className="text-[10px] leading-[16px] font-black text-gray-500">SEP 12, 2023</Text>
                      <Text className="text-xs font-bold text-black mt-1 leading-[18px]">
                        ANNUAL PHYSICAL: <Text className="font-black">Dr. Jenkins</Text> - All clear.
                      </Text>
                    </View>
                  </View>

                  {/* Timeline Node 2 */}
                  <View className="flex-row items-start relative">
                    <View className="absolute -left-[24px] top-1.5 w-[14px] h-[14px] rounded-full bg-white border-2 border-black z-10" />
                    <View className="bg-white border-2 border-black rounded-xl p-3.5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex-1">
                      <Text className="text-[10px] leading-[16px] font-black text-gray-500">JUL 04, 2023</Text>
                      <Text className="text-xs font-bold text-black mt-1 leading-[18px]">
                        PRESCRIPTION UPDATE: <Text className="font-black">Lisinopril 10mg</Text> refilled.
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* LOGGER EXPANSION TRAY */}
              <View className="mt-2">
                <Pressable 
                  onPress={() => setShowLogModal(!showLogModal)}
                  className="bg-[#ccff00] brutal-border brutal-shadow p-3.5 flex-row items-center justify-center gap-3 active:scale-95"
                >
                  <Text className="text-xs font-black text-black uppercase tracking-wider">
                    {showLogModal ? '✖ CLOSE VITALS LOGGER' : '➕ LOG CUSTOM READINGS'}
                  </Text>
                </Pressable>

                {showLogModal && (
                  <View className="bg-white border-3 border-black rounded-b-2xl p-5 gap-4 border-t-0 -mt-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <View className="gap-1.5">
                      <Text className="text-[10px] leading-[16px] font-black uppercase text-black">Heart Rate (BPM)</Text>
                      <TextInput
                        value={heartRate}
                        onChangeText={setHeartRate}
                        keyboardType="numeric"
                        className="bg-[#fcfcfc] border-2 border-black p-2.5 text-sm font-bold text-black rounded-lg"
                        placeholder="e.g. 72"
                      />
                    </View>

                    <View className="gap-1.5">
                      <Text className="text-[10px] leading-[16px] font-black uppercase text-black">Blood Pressure (SYS / DIA)</Text>
                      <View className="flex-row gap-2.5">
                        <TextInput
                          value={systolic}
                          onChangeText={setSystolic}
                          keyboardType="numeric"
                          className="bg-[#fcfcfc] border-2 border-black p-2.5 text-sm font-bold text-black rounded-lg flex-1"
                          placeholder="120"
                        />
                        <Text className="text-black text-xl font-black self-center">/</Text>
                        <TextInput
                          value={diastolic}
                          onChangeText={setDiastolic}
                          keyboardType="numeric"
                          className="bg-[#fcfcfc] border-2 border-black p-2.5 text-sm font-bold text-black rounded-lg flex-1"
                          placeholder="80"
                        />
                      </View>
                    </View>

                    <View className="gap-1.5">
                      <Text className="text-[10px] leading-[16px] font-black uppercase text-black">Blood Glucose (mg/dL)</Text>
                      <TextInput
                        value={glucose}
                        onChangeText={setGlucose}
                        keyboardType="numeric"
                        className="bg-[#fcfcfc] border-2 border-black p-2.5 text-sm font-bold text-black rounded-lg"
                        placeholder="e.g. 95"
                      />
                    </View>

                    <Pressable 
                      onPress={handleAddVital}
                      disabled={saving}
                      className="bg-black border-2 border-black p-3.5 items-center active:scale-95 mt-1.5 rounded-xl"
                    >
                      {saving ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <Text className="text-xs font-black text-white uppercase tracking-widest">
                          Save Readings
                        </Text>
                      )}
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          ) : (
            /* VIEW 2: TODAY'S REGIMEN */
            <View className="gap-5">
              {/* HEADER INFORMATION */}
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-xl font-black text-black uppercase tracking-tight">TODAY'S REGIMEN</Text>
                <View className="bg-[#ccff00] border-2 border-black px-3.5 py-1 rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <Text className="text-[10px] leading-[16px] font-black text-black">OCT 24</Text>
                </View>
              </View>

              {/* PROGRESS CARD */}
              <View className="bg-white border-3 border-black rounded-2xl p-5 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                <View className="flex-row items-center gap-1.5 mb-3">
                  <Text className="text-xs">🔄</Text>
                  <Text className="font-black text-xs text-black uppercase tracking-wider">PROGRESS</Text>
                </View>

                {/* Circular Progress Wheel */}
                <View className="items-center py-4">
                  <View className="w-32 h-32 rounded-full border-[10px] border-[#f0f0f0] items-center justify-center relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] bg-[#fcfcfc] border-t-[#ccff00] border-r-[#ccff00]">
                    {/* Visual brutalist gauge border overlay */}
                    <View className="absolute inset-0 rounded-full border-2 border-black" />
                    
                    <Text className="text-3xl font-black text-black leading-none">{progressPercent}%</Text>
                    <Text className="text-[10px] leading-[16px] font-black text-gray-500 uppercase mt-1">
                      {completedRegimenCount} of {totalRegimenCount} taken
                    </Text>
                  </View>
                </View>
              </View>

              {/* REFILL LOW WARNING ALERT */}
              {refillRequested ? (
                <View className="bg-[#e2fce6] border-3 border-black rounded-2xl p-4 flex-row items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base">✓</Text>
                    <View>
                      <Text className="font-black text-xs text-green-900">REFILL REQUESTED</Text>
                      <Text className="text-[10px] leading-[16px] font-bold text-green-700 mt-0.5">Order sent to Pharmacy</Text>
                    </View>
                  </View>
                  <View className="bg-white border border-black px-2 py-0.5 rounded">
                    <Text className="text-[8px] font-black text-black">PENDING</Text>
                  </View>
                </View>
              ) : (
                <View className="bg-[#ffccd2] border-3 border-black rounded-2xl p-4 flex-row items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <View className="flex-1 pr-2">
                    <Text className="font-black text-xs text-red-900">⚠️ ALERT: Lisinopril running low</Text>
                    <Text className="text-[10px] leading-[16px] font-bold text-red-700 mt-0.5">3 days left (Refill Recommended)</Text>
                  </View>
                  <Pressable 
                    onPress={() => {
                      setRefillRequested(true);
                      Alert.alert('Requested ✓', 'Refill order for Lisinopril 10mg submitted.');
                    }}
                    className="bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] px-3 py-1.5 rounded-xl active:scale-95"
                  >
                    <Text className="text-[10px] leading-[16px] font-black text-black uppercase">REFILL SOON</Text>
                  </Pressable>
                </View>
              )}

              {/* SCHEDULED REGIMEN ITEMS */}
              <View className="gap-3">
                {regimen.map((item) => {
                  return (
                    <View 
                      key={item.id} 
                      className={`${item.bg} border-3 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}
                    >
                      <View className="flex-row justify-between items-start">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-base">{item.icon}</Text>
                          <Text className="font-black text-[10px] leading-[16px] text-black tracking-wider">{item.time}</Text>
                        </View>
                        {item.completed && (
                          <View className="bg-black border border-black px-2 py-0.5 rounded">
                            <Text className="text-[8px] font-black text-white uppercase">✓ COMPLETED</Text>
                          </View>
                        )}
                      </View>

                      <Text className="font-black text-sm text-black mt-2">{item.name}</Text>
                      <Text className="text-[10px] leading-[16px] font-bold text-gray-700 mt-0.5">{item.dose}</Text>

                      {/* Action toggle button */}
                      <Pressable 
                        onPress={() => toggleRegimen(item.id)}
                        className={`border-2 border-black py-2.5 rounded-xl items-center mt-4 transition-all active:scale-98 ${
                          item.completed 
                            ? 'bg-[#ccff00] shadow-none' 
                            : 'bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        }`}
                      >
                        <Text className="font-black text-[10px] leading-[16px] text-black uppercase tracking-wider">
                          {item.completed ? '✓ TAKEN' : '✓ TAKE NOW'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>

              {/* ADD MEDICATION BUTTON */}
              <Pressable 
                onPress={() => setShowAddMedModal(true)}
                className="bg-[#ff00ff] border-3 border-black rounded-2xl p-4 flex-row items-center justify-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:scale-95 mt-2"
              >
                <Text className="font-black text-xs text-black uppercase tracking-wider">+ ADD NEW MEDICATION</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        <BottomNavBar />

        {/* VIEW 3: DETAIL EXPANDED MODAL (AI TIP) */}
        <Modal
          visible={showTipDetail}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowTipDetail(false)}
        >
          <View className="flex-1 bg-black/60 justify-center p-4">
            <View className="bg-white border-3 border-black rounded-2xl p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] max-h-[85%]">
              
              {/* Modal Header */}
              <View className="flex-row justify-between items-start border-b-2 border-black pb-3 mb-4">
                <View className="flex-1">
                  <Text className="text-[10px] leading-[16px] font-black text-gray-500 uppercase tracking-widest">MEDCAREHOME AI INSIGHT</Text>
                  <Text className="text-xl font-black text-black leading-tight mt-1">Hydration & Cognitive Peak</Text>
                </View>
                <Pressable 
                  onPress={() => setShowTipDetail(false)}
                  className="w-8 h-8 rounded-full border-2 border-black bg-[#f0f0f0] items-center justify-center active:scale-90 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                >
                  <Text className="font-black text-sm text-black">✕</Text>
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} className="flex-col gap-4">
                {/* Pill tag */}
                <View className="bg-[#ccff00] border-2 border-black px-3.5 py-1 rounded-full self-start mb-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <Text className="text-[10px] leading-[16px] font-black text-black">🔥 HIGH IMPACT</Text>
                </View>

                {/* The Science Card */}
                <View className="bg-[#ffc2eb] border-2 border-black rounded-xl p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] mb-3">
                  <View className="flex-row items-center gap-1 mb-1.5">
                    <Text className="text-base">🧪</Text>
                    <Text className="font-black text-[10px] leading-[16px] text-black uppercase tracking-wider">THE SCIENCE</Text>
                  </View>
                  <Text className="text-xs font-bold text-black leading-relaxed">
                    Dehydration by just 2% impairs cognitive performance, attention, and memory recall. Keeping cell hydration optimal ensures maximum neurotransmitter efficiency.
                  </Text>
                </View>

                {/* Did you know badge */}
                <View className="bg-[#7fffff] border-2 border-black rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mb-3">
                  <Text className="text-xs font-bold text-black">
                    💡 <Text className="font-black">DID YOU KNOW?</Text> 75% of your brain is water.
                  </Text>
                </View>

                {/* QUICK ACTION BUTTON */}
                <Pressable 
                  onPress={logHydrationTip}
                  disabled={tipLogged}
                  className={`border-3 border-black rounded-xl p-4 items-center mb-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:scale-95 ${
                    tipLogged ? 'bg-[#ccff00]' : 'bg-white'
                  }`}
                >
                  <Text className="font-black text-xs text-black uppercase tracking-wider">
                    {tipLogged ? '💧 WATER LOGGED! ✓ (+250ml)' : '💧 DRINK 250ML NOW'}
                  </Text>
                </Pressable>

                {/* COMPLIANCE CHART */}
                <View className="bg-white border-2 border-black rounded-xl p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] mb-4">
                  <Text className="font-black text-[10px] leading-[16px] text-black uppercase tracking-wider mb-3">
                    📅 TIP COMPLIANCE THIS WEEK
                  </Text>

                  {/* Horizontal row of vertical bar columns */}
                  <View className="flex-row justify-between items-end h-[80px] px-1">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => {
                      const rate = complianceRates[idx];
                      const barHeight = Math.max(2, (rate / 100) * 60);
                      const barBg = idx === 4 && tipLogged 
                        ? 'bg-[#ccff00]' 
                        : rate >= 80 
                        ? 'bg-[#7fffff]' 
                        : rate >= 50 
                        ? 'bg-[#ffc2eb]' 
                        : 'bg-gray-300';
                      return (
                        <View key={idx} className="items-center gap-1.5">
                          <View className={`w-4 border border-black rounded-t ${barBg}`} style={{ height: barHeight }} />
                          <Text className="text-[10px] leading-[16px] font-black text-black">{day}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>

              {/* Modal Actions */}
              <View className="flex-row gap-3 border-t-2 border-black pt-4 mt-2">
                <Pressable 
                  onPress={() => setShowTipDetail(false)}
                  className="bg-[#f0f0f0] border-2 border-black px-4 py-3 rounded-xl flex-1 items-center active:scale-95 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  <Text className="font-black text-xs text-black">DISMISS</Text>
                </Pressable>
                <Pressable 
                  onPress={() => {
                    Alert.alert('Saved ✓', 'Tip bookmarked and saved to your health locker.');
                    setShowTipDetail(false);
                  }}
                  className="bg-[#00e5ff] border-2 border-black px-4 py-3 rounded-xl flex-1 items-center active:scale-95 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  <Text className="font-black text-xs text-black">SAVE TIP</Text>
                </Pressable>
              </View>

            </View>
          </View>
        </Modal>

        {/* MODAL: ADD NEW MEDICATION */}
        <Modal
          visible={showAddMedModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowAddMedModal(false)}
        >
          <View className="flex-1 bg-black/60 justify-center p-4">
            <View className="bg-white border-3 border-black rounded-2xl p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] gap-4">
              
              <View className="flex-row justify-between items-center border-b-2 border-black pb-2">
                <Text className="text-base font-black text-black uppercase tracking-tight">ADD NEW MEDICATION</Text>
                <Pressable 
                  onPress={() => setShowAddMedModal(false)}
                  className="w-8 h-8 rounded-full border-2 border-black bg-[#f0f0f0] items-center justify-center active:scale-90 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                >
                  <Text className="font-black text-sm text-black">✕</Text>
                </Pressable>
              </View>

              {/* Form Input fields */}
              <View className="gap-1.5">
                <Text className="text-[10px] leading-[16px] font-black uppercase text-black">Medication Name</Text>
                <TextInput
                  value={newMedName}
                  onChangeText={setNewMedName}
                  className="bg-[#fcfcfc] border-2 border-black p-2.5 text-sm font-bold text-black rounded-lg"
                  placeholder="e.g. Paracetamol"
                />
              </View>

              <View className="gap-1.5">
                <Text className="text-[10px] leading-[16px] font-black uppercase text-black">Dosage / Details</Text>
                <TextInput
                  value={newMedDose}
                  onChangeText={setNewMedDose}
                  className="bg-[#fcfcfc] border-2 border-black p-2.5 text-sm font-bold text-black rounded-lg"
                  placeholder="e.g. 500mg - 1 Pill • with food"
                />
              </View>

              <View className="gap-1.5">
                <Text className="text-[10px] leading-[16px] font-black uppercase text-black">Time of Day</Text>
                <View className="flex-row gap-2">
                  {/* Morning */}
                  <Pressable 
                    onPress={() => setNewMedTime('MORNING')}
                    className={`flex-1 p-2 border-2 border-black rounded-lg items-center ${
                      newMedTime === 'MORNING' ? 'bg-[#7fffff] shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]' : 'bg-white'
                    }`}
                  >
                    <Text className="text-[10px] leading-[16px] font-black text-black">☀️ MORNING</Text>
                  </Pressable>
                  {/* Afternoon */}
                  <Pressable 
                    onPress={() => setNewMedTime('AFTERNOON')}
                    className={`flex-1 p-2 border-2 border-black rounded-lg items-center ${
                      newMedTime === 'AFTERNOON' ? 'bg-[#ccff00] shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]' : 'bg-white'
                    }`}
                  >
                    <Text className="text-[10px] leading-[16px] font-black text-black">🌤️ AFTER</Text>
                  </Pressable>
                  {/* Evening */}
                  <Pressable 
                    onPress={() => setNewMedTime('EVENING')}
                    className={`flex-1 p-2 border-2 border-black rounded-lg items-center ${
                      newMedTime === 'EVENING' ? 'bg-[#ffc2eb] shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]' : 'bg-white'
                    }`}
                  >
                    <Text className="text-[10px] leading-[16px] font-black text-black">🌙 NIGHT</Text>
                  </Pressable>
                </View>
              </View>

              <Pressable 
                onPress={handleAddMedication}
                className="bg-[#ff00ff] border-2 border-black p-3.5 items-center active:scale-95 mt-2 rounded-xl"
              >
                <Text className="text-xs font-black text-black uppercase tracking-widest">
                  ADD TO REGIMEN ✓
                </Text>
              </Pressable>

            </View>
          </View>
        </Modal>

      </View>
    </SafeAreaView>
  );
}
