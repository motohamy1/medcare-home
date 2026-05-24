import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from '@/tw';
import { Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import {
  searchDoctors,
  type UnifiedDoctorResult,
  type SearchIntent,
} from '@/services/doctorService';
import { getCurrentLocation, formatDistance, type LatLng } from '@/lib/location';
import { ActivityIndicator } from 'react-native';

export default function SearchScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [searchQuery, setSearchQuery] = useState(q || '');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<UnifiedDoctorResult[]>([]);
  const [intent, setIntent] = useState<SearchIntent | null>(null);
  const [externalCount, setExternalCount] = useState(0);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [locationStatus, setLocationStatus] = useState<'loading' | 'granted' | 'denied'>('loading');

  // Request location on first mount
  useEffect(() => {
    (async () => {
      const result = await getCurrentLocation();
      if (result.granted && result.location) {
        setUserLocation(result.location);
        setLocationStatus('granted');
      } else {
        setLocationStatus('denied');
      }
    })();
  }, []);

  const performSearch = useCallback(
    async (queryStr: string) => {
      if (!queryStr.trim()) return;
      setLoading(true);
      try {
        const res = await searchDoctors(queryStr, userLocation ?? undefined);
        setResults(res.results);
        setIntent(res.intent);
        setExternalCount(res.externalCount);
      } catch (err) {
        console.error('[SearchScreen] Search failed:', err);
      } finally {
        setLoading(false);
      }
    },
    [userLocation]
  );

  // Run search when arriving with a query param
  useEffect(() => {
    if (q) {
      setSearchQuery(q);
      performSearch(q);
    }
  }, [q, performSearch]);

  const handleSearchSubmit = () => {
    performSearch(searchQuery);
  };

  const fieldEmoji = (field: string) => {
    switch (field) {
      case 'physician': return '🩺';
      case 'dentist': return '🦷';
      case 'physiotherapy': return '🧘';
      default: return '⚕️';
    }
  };

  const handleEnableLocation = async () => {
    setLocationStatus('loading');
    const result = await getCurrentLocation();
    if (result.granted && result.location) {
      setUserLocation(result.location);
      setLocationStatus('granted');
      if (searchQuery.trim()) {
        performSearch(searchQuery);
      }
    } else {
      setLocationStatus('denied');
    }
  };

  const openMap = (lat: number, lon: number, label: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}&query_place_id=${encodeURIComponent(label)}`;
    Linking.openURL(url).catch(() => {});
  };

  const bookableCount = results.filter((r) => r.isBookable).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }} edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-1 bg-background flex-col relative px-4 pt-3 pb-6">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 44, height: 44, backgroundColor: 'white', borderWidth: 3, borderColor: 'black',
              borderRadius: 12, shadowColor: 'black', shadowOffset: { width: 3, height: 3 },
              shadowOpacity: 1, shadowRadius: 0, elevation: 3, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: 'bold' }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: '900', color: 'black', textTransform: 'uppercase' }}>
            AI Health Search
          </Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Search Input */}
        <View className="mb-4">
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderWidth: 3,
              borderColor: 'black', borderRadius: 16, shadowColor: 'black',
              shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4,
              paddingHorizontal: 12, paddingVertical: 8,
            }}
          >
            <Text style={{ fontSize: 18 }}>🔍</Text>
            <TextInput
              style={{ flex: 1, backgroundColor: 'transparent', fontSize: 14, marginLeft: 8, padding: 0, color: 'black' }}
              placeholder="Doctor name, specialty, symptom..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
            {searchQuery.trim().length > 0 ? (
              <Pressable
                onPress={handleSearchSubmit}
                style={{ backgroundColor: '#ccff00', borderWidth: 2, borderColor: 'black', borderRadius: 8, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 14, fontWeight: 'bold' }}>GO</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Location Status Banner */}
        {locationStatus === 'denied' && (
          <Pressable
            onPress={handleEnableLocation}
            style={{
              backgroundColor: '#ff00ff', borderWidth: 2, borderColor: 'black', borderRadius: 12,
              padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Text style={{ fontSize: 16 }}>📍</Text>
            <Text style={{ fontSize: 12, fontWeight: '900', color: 'black' }}>ENABLE LOCATION FOR LIVE RESULTS</Text>
          </Pressable>
        )}
        {locationStatus === 'granted' && (
          <View
            style={{
              backgroundColor: '#ccff00', borderWidth: 2, borderColor: 'black', borderRadius: 12,
              padding: 8, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Text style={{ fontSize: 14 }}>🌍</Text>
            <Text style={{ fontSize: 11, fontWeight: '900', color: 'black' }}>LIVE INTERNET + MEDCARE RESULTS</Text>
          </View>
        )}

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="pb-6 gap-4">
          {loading ? (
            <View style={{ paddingVertical: 80, alignItems: 'center', gap: 16 }}>
              <ActivityIndicator size="large" color="#4a5d00" />
              <Text style={{ fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, color: '#6b7280' }}>
                {locationStatus === 'granted'
                  ? 'Scanning Live Map & Database...'
                  : 'Consulting Medical Model...'}
              </Text>
            </View>
          ) : (
            <>
              {/* AI Intent Card */}
              {intent && (
                <View
                  style={{
                    backgroundColor: '#ccff00', borderWidth: 3, borderColor: 'black', borderRadius: 16,
                    padding: 16, shadowColor: 'black', shadowOffset: { width: 4, height: 4 },
                    shadowOpacity: 1, shadowRadius: 0, elevation: 4,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Text style={{ fontSize: 20 }}>🧠</Text>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: 'black', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      AI Query Diagnostics
                    </Text>
                  </View>
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'black', paddingBottom: 6 }}>
                      <Text style={{ fontSize: 12, color: 'black', fontWeight: 'bold' }}>Category:</Text>
                      <Text style={{ fontSize: 12, color: 'black', fontWeight: '900', textTransform: 'uppercase' }}>
                        {intent.major_field || 'General Practice'}
                      </Text>
                    </View>
                    {intent.specialty && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'black', paddingBottom: 6 }}>
                        <Text style={{ fontSize: 12, color: 'black', fontWeight: 'bold' }}>Specialty:</Text>
                        <Text style={{ fontSize: 12, color: 'black', fontWeight: '900', textTransform: 'capitalize' }}>{intent.specialty}</Text>
                      </View>
                    )}
                    {intent.doctor_name && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'black', paddingBottom: 6 }}>
                        <Text style={{ fontSize: 12, color: 'black', fontWeight: 'bold' }}>Name Match:</Text>
                        <Text style={{ fontSize: 12, color: 'black', fontWeight: '900', textTransform: 'capitalize' }}>{intent.doctor_name}</Text>
                      </View>
                    )}
                    {intent.symptoms && intent.symptoms.length > 0 ? (
                      <View>
                        <Text style={{ fontSize: 12, color: 'black', fontWeight: 'bold', marginBottom: 6 }}>Symptoms:</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {intent.symptoms.map((symptom, idx) => (
                            <View key={idx} style={{ backgroundColor: 'white', borderWidth: 2, borderColor: 'black', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                              <Text style={{ fontSize: 10, fontWeight: 'bold', color: 'black' }}>{symptom}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : null}
                  </View>
                </View>
              )}

              {/* Results Header */}
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <View>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: 'black' }}>
                      {results.length} Result{results.length !== 1 ? 's' : ''}
                    </Text>
                    {externalCount > 0 && (
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#6b7280', marginTop: 2 }}>
                        {bookableCount} on MedCare · {externalCount} from OpenStreetMap
                      </Text>
                    )}
                  </View>
                  {locationStatus === 'granted' && (
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#6b7280' }}>Sorted: Near + Rated</Text>
                  )}
                </View>

                <View style={{ gap: 12 }}>
                  {results.length === 0 ? (
                    <View style={{ backgroundColor: 'white', borderWidth: 3, borderColor: 'black', borderRadius: 16, padding: 32, alignItems: 'center' }}>
                      <Text style={{ fontSize: 48, marginBottom: 12 }}>🔍</Text>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#6b7280', textAlign: 'center', lineHeight: 20 }}>
                        No doctors found nearby. Try broadening your search or enable location for live map results!
                      </Text>
                    </View>
                  ) : (
                    results.map((item) => (
                      <View
                        key={item.id}
                        style={{
                          backgroundColor: 'white', borderWidth: 3, borderColor: 'black', borderRadius: 16,
                          padding: 16, position: 'relative', shadowColor: 'black',
                          shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4,
                        }}
                      >
                        {/* Top-right badges */}
                        <View style={{ position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 6 }}>
                          {/* Distance badge */}
                          {typeof item.distance_km === 'number' && (
                            <View
                              style={{
                                backgroundColor: item.distance_km < 3 ? '#ccff00' : '#e5e7eb',
                                paddingHorizontal: 8, paddingVertical: 2, borderWidth: 2, borderColor: 'black',
                                borderRadius: 4, flexDirection: 'row', alignItems: 'center', gap: 2,
                              }}
                            >
                              <Text style={{ fontSize: 10 }}>📍</Text>
                              <Text style={{ fontSize: 10, fontWeight: 'bold', color: 'black' }}>{formatDistance(item.distance_km)}</Text>
                            </View>
                          )}
                          {/* Rating badge (only for bookable/internal results) */}
                          {item.isBookable && item.google_rating > 0 && (
                            <View
                              style={{
                                backgroundColor: '#ff00ff', paddingHorizontal: 8, paddingVertical: 2,
                                borderWidth: 2, borderColor: 'black', borderRadius: 4,
                                flexDirection: 'row', alignItems: 'center', gap: 2,
                              }}
                            >
                              <Text style={{ fontSize: 10 }}>⭐</Text>
                              <Text style={{ fontSize: 10, fontWeight: 'bold', color: 'black' }}>{item.google_rating.toFixed(1)}</Text>
                            </View>
                          )}
                          {/* External source badge */}
                          {!item.isBookable && (
                            <View
                              style={{
                                backgroundColor: '#7fffff', paddingHorizontal: 8, paddingVertical: 2,
                                borderWidth: 2, borderColor: 'black', borderRadius: 4,
                                flexDirection: 'row', alignItems: 'center', gap: 2,
                              }}
                            >
                              <Text style={{ fontSize: 10 }}>🌍</Text>
                              <Text style={{ fontSize: 10, fontWeight: 'bold', color: 'black' }}>LIVE</Text>
                            </View>
                          )}
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                          <View
                            style={{
                              width: 56, height: 56, borderRadius: 8, borderWidth: 2, borderColor: 'black',
                              overflow: 'hidden', backgroundColor: item.isBookable ? '#ccff00' : '#ff00ff',
                              alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <Text style={{ fontSize: 24 }}>{fieldEmoji(item.major_field)}</Text>
                          </View>
                          <View style={{ flex: 1, paddingRight: 80 }}>
                            <Text style={{ fontSize: 15, fontWeight: '900', color: 'black', lineHeight: 18 }}>
                              {item.full_name}
                            </Text>
                            <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2, textTransform: 'capitalize' }}>
                              {item.sub_specialty || item.major_field}
                            </Text>
                            <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>
                              📍 {item.location_text}
                            </Text>
                          </View>
                        </View>

                        {/* Action button */}
                        {item.isBookable ? (
                          <Pressable
                            onPress={() => router.push({ pathname: '/booking', params: { doctorId: item.id } })}
                            style={{
                              width: '100%', backgroundColor: '#4a5d00', paddingVertical: 10,
                              borderWidth: 2, borderColor: 'black', borderRadius: 12,
                              flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4,
                            }}
                          >
                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              BOOK APPOINTMENT
                            </Text>
                            <Text style={{ color: 'white', fontSize: 12 }}>→</Text>
                          </Pressable>
                        ) : (
                          <Pressable
                            onPress={() => {
                              if (item.externalData) {
                                openMap(item.externalData.latitude, item.externalData.longitude, item.full_name);
                              }
                            }}
                            style={{
                              width: '100%', backgroundColor: '#7fffff', paddingVertical: 10,
                              borderWidth: 2, borderColor: 'black', borderRadius: 12,
                              flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4,
                            }}
                          >
                            <Text style={{ color: 'black', fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              VIEW ON MAP
                            </Text>
                            <Text style={{ color: 'black', fontSize: 12 }}>🗺️</Text>
                          </Pressable>
                        )}
                      </View>
                    ))
                  )}
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
