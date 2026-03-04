import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, 
  Dimensions, Platform, Linking 
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import colors from '../colors';

const { width, height } = Dimensions.get('window');

export default function MapViewScreen({ route, navigation }) {
  const { moduleData, ownerId } = route.params;
  const user = auth.currentUser;

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);

  // 1. Fetch Records and filter those with valid locations
  useEffect(() => {
    const targetOwnerId = ownerId || user.uid;
    const recordsRef = collection(db, 'users', targetOwnerId, 'modules', moduleData.id, 'records');
    
    const unsubscribe = onSnapshot(recordsRef, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter records that have a location field containing actual coordinates (lat, lng)
      const validPoints = fetched.filter(r => {
        const locField = moduleData.fields.find(f => f.type === 'location');
        return locField && r[locField.name] && r[locField.name].includes(',');
      });

      setRecords(validPoints);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // 2. Navigation Helper
  const openInMaps = (coords, label) => {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const url = Platform.select({
      ios: `${scheme}${label}@${coords}`,
      android: `${scheme}${coords}(${label})`
    });
    Linking.openURL(url);
  };

  const getCoords = (record) => {
    const locField = moduleData.fields.find(f => f.type === 'location');
    const parts = record[locField.name].split(',');
    return {
      latitude: parseFloat(parts[0]),
      longitude: parseFloat(parts[1]),
    };
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{moduleData.name} Map</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: records.length > 0 ? getCoords(records[0]).latitude : 20.5937,
            longitude: records.length > 0 ? getCoords(records[0]).longitude : 78.9629,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
        >
          {records.map((record) => (
            <Marker
              key={record.id}
              coordinate={getCoords(record)}
              onPress={() => setSelectedRecord(record)}
              pinColor={colors.primary}
            >
              <Callout tooltip onPress={() => navigation.navigate('RecordDetail', { moduleData, recordData: record, ownerId })}>
                <View style={styles.calloutBox}>
                  <Text style={styles.calloutTitle}>{record[moduleData.fields[0].name] || 'Record'}</Text>
                  <Text style={styles.calloutSub}>Tap to view details</Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>
      )}

      {/* QUICK INFO CARD */}
      {selectedRecord && (
        <View style={styles.infoCard}>
          <View style={styles.cardRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{selectedRecord[moduleData.fields[0].name]}</Text>
              <Text style={styles.cardSub}>
                {moduleData.fields.filter(f => f.isSummary).map(f => selectedRecord[f.name]).join(' • ')}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.navBtn}
              onPress={() => openInMaps(selectedRecord[moduleData.fields.find(f => f.type === 'location').name], selectedRecord[moduleData.fields[0].name])}
            >
              <MaterialCommunityIcons name="directions" size={24} color="white" />
              <Text style={styles.navText}>Go</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={styles.closeCard} 
            onPress={() => setSelectedRecord(null)}
          >
            <Ionicons name="close-circle" size={24} color="#ccc" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20, backgroundColor: 'white',
    zIndex: 10, borderBottomWidth: 1, borderBottomColor: '#eee'
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  map: { width: width, height: height },
  
  // Callout
  calloutBox: { backgroundColor: 'white', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#eee', width: 150 },
  calloutTitle: { fontWeight: 'bold', fontSize: 14, color: colors.text },
  calloutSub: { fontSize: 10, color: '#999', marginTop: 2 },

  // Info Card
  infoCard: { 
    position: 'absolute', bottom: 40, left: 20, right: 20, 
    backgroundColor: 'white', borderRadius: 20, padding: 20,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 5
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  cardSub: { fontSize: 12, color: '#888', marginTop: 4 },
  navBtn: { backgroundColor: colors.primary, padding: 12, borderRadius: 15, alignItems: 'center', minWidth: 60 },
  navText: { color: 'white', fontWeight: 'bold', fontSize: 12, marginTop: 2 },
  closeCard: { position: 'absolute', top: -10, right: -10 }
});