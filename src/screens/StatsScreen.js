import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions, TouchableOpacity 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PieChart, LineChart } from 'react-native-chart-kit';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import colors from '../colors';

const screenWidth = Dimensions.get('window').width;

export default function StatsScreen({ route, navigation }) {
  const { moduleData, ownerId } = route.params;
  const user = auth.currentUser;

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ numbers: {}, dropdowns: {}, history: [] });

  // 1. Fetch Records
  useEffect(() => {
    const targetOwnerId = ownerId || user.uid;
    const recordsRef = collection(db, 'users', targetOwnerId, 'modules', moduleData.id, 'records');
    
    const unsubscribe = onSnapshot(recordsRef, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecords(fetched);
      processMetrics(fetched);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // 2. Process Data for Widgets
  const processMetrics = (data) => {
    const numberStats = {};
    const dropdownStats = {};
    const dailyCounts = {};

    // Initialize Last 7 Days for Line Chart
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dailyCounts[dateStr] = 0;
    }

    data.forEach(record => {
      // A. Process Line Chart (Activity)
      if (record.createdAt?.seconds) {
        const d = new Date(record.createdAt.seconds * 1000);
        const dateStr = d.toISOString().split('T')[0];
        if (dailyCounts[dateStr] !== undefined) {
          dailyCounts[dateStr]++;
        }
      }

      moduleData.fields.forEach(field => {
        const val = record[field.name];

        // B. Process Number Fields (Sum & Avg)
        if (field.type === 'number' && val) {
          if (!numberStats[field.name]) numberStats[field.name] = { sum: 0, count: 0 };
          numberStats[field.name].sum += parseFloat(val);
          numberStats[field.name].count++;
        }

        // C. Process Dropdowns (Pie Counts)
        if (field.type === 'dropdown' && val) {
          if (!dropdownStats[field.name]) dropdownStats[field.name] = {};
          if (!dropdownStats[field.name][val]) dropdownStats[field.name][val] = 0;
          dropdownStats[field.name][val]++;
        }
      });
    });

    setMetrics({
      numbers: numberStats,
      dropdowns: dropdownStats,
      history: Object.keys(dailyCounts).map(k => ({ date: k, count: dailyCounts[k] }))
    });
  };

  // --- WIDGET RENDERERS ---

  const renderNumberCard = (fieldName, stats) => (
    <View key={fieldName} style={styles.metricCard}>
      <View style={styles.metricHeader}>
        <Ionicons name="calculator-outline" size={20} color={colors.primary} />
        <Text style={styles.metricTitle}>{fieldName}</Text>
      </View>
      <View style={styles.metricRow}>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{stats.sum.toLocaleString()}</Text>
          <Text style={styles.metricLabel}>Total</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{(stats.sum / stats.count).toFixed(1)}</Text>
          <Text style={styles.metricLabel}>Average</Text>
        </View>
      </View>
    </View>
  );

  const renderPieChart = (fieldName, counts) => {
    // Convert counts object to Array format expected by ChartKit
    const data = Object.keys(counts).map((key, index) => ({
      name: key,
      population: counts[key],
      color: [colors.primary, '#FF9800', '#2196F3', '#4CAF50', '#9C27B0'][index % 5],
      legendFontColor: "#7F7F7F",
      legendFontSize: 12
    }));

    return (
      <View key={fieldName} style={styles.chartCard}>
        <Text style={styles.chartTitle}>By {fieldName}</Text>
        <PieChart
          data={data}
          width={screenWidth - 60}
          height={200}
          chartConfig={{
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          }}
          accessor={"population"}
          backgroundColor={"transparent"}
          paddingLeft={"15"}
          absolute // Shows numbers instead of percentages on the pie
        />
      </View>
    );
  };

  const renderHistoryChart = () => {
    const labels = metrics.history.map(h => h.date.split('-')[2]); // Just the day number
    const dataPoints = metrics.history.map(h => h.count);

    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>New Records (Last 7 Days)</Text>
        <LineChart
          data={{
            labels: labels,
            datasets: [{ data: dataPoints }]
          }}
          width={screenWidth - 60} 
          height={220}
          yAxisInterval={1} 
          chartConfig={{
            backgroundColor: "#fff",
            backgroundGradientFrom: "#fff",
            backgroundGradientTo: "#fff",
            decimalPlaces: 0, 
            color: (opacity = 1) => colors.primary,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: { borderRadius: 16 },
            propsForDots: { r: "5", strokeWidth: "2", stroke: colors.primary }
          }}
          bezier
          style={{ marginVertical: 8, borderRadius: 16 }}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
           <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{moduleData.name} Analytics</Text>
        <View style={{width: 24}} /> 
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{marginTop: 50}} />
        ) : (
          <>
            {/* 1. Activity Line Chart */}
            {renderHistoryChart()}

            {/* 2. Number Cards */}
            <View style={styles.sectionHeader}>
               <Text style={styles.sectionTitle}>Key Metrics</Text>
            </View>
            {Object.keys(metrics.numbers).length > 0 ? (
              Object.keys(metrics.numbers).map(key => renderNumberCard(key, metrics.numbers[key]))
            ) : (
              <Text style={styles.emptyText}>No number fields to analyze.</Text>
            )}

            {/* 3. Pie Charts */}
            <View style={styles.sectionHeader}>
               <Text style={styles.sectionTitle}>Distributions</Text>
            </View>
            {Object.keys(metrics.dropdowns).length > 0 ? (
              Object.keys(metrics.dropdowns).map(key => renderPieChart(key, metrics.dropdowns[key]))
            ) : (
               <Text style={styles.emptyText}>No dropdown fields to analyze.</Text>
            )}
            
            <View style={{height: 50}} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20, backgroundColor: 'white',
    borderBottomWidth: 1, borderBottomColor: '#eee'
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  backBtn: { padding: 5 },
  scrollContent: { padding: 20 },

  sectionHeader: { marginTop: 25, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#555' },
  emptyText: { color: '#999', fontStyle: 'italic', marginBottom: 10 },

  // METRIC CARD
  metricCard: {
    backgroundColor: 'white', borderRadius: 16, padding: 20, marginBottom: 15,
    shadowColor: "#000", shadowOpacity: 0.05, elevation: 2
  },
  metricHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  metricTitle: { fontSize: 16, fontWeight: 'bold', marginLeft: 8, color: '#333' },
  metricRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  metricItem: { alignItems: 'center' },
  metricValue: { fontSize: 22, fontWeight: 'bold', color: colors.primary },
  metricLabel: { fontSize: 12, color: '#999', marginTop: 2 },
  divider: { width: 1, height: 40, backgroundColor: '#eee' },

  // CHART CARD
  chartCard: {
    backgroundColor: 'white', borderRadius: 16, padding: 15, marginBottom: 20,
    alignItems: 'center', shadowColor: "#000", shadowOpacity: 0.05, elevation: 2
  },
  chartTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, alignSelf: 'flex-start', color: '#333' }
});