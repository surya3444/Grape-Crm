import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, StatusBar, Modal, Dimensions, Alert 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import colors from '../colors';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = width * 0.8;

export default function KanbanBoardScreen({ route, navigation }) {
  const { moduleData, ownerId } = route.params;
  const user = auth.currentUser;

  // State
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeField, setActiveField] = useState(moduleData.fields.filter(f => f.type === 'dropdown')[0]);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  
  // Drag and Drop State
  const [draggingRecord, setDraggingRecord] = useState(null);

  useEffect(() => {
    const targetOwnerId = ownerId || user.uid;
    const recordsRef = collection(db, 'users', targetOwnerId, 'modules', moduleData.id, 'records');
    
    const unsubscribe = onSnapshot(recordsRef, (snapshot) => {
      setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return unsubscribe;
  }, [moduleData, ownerId]);

  // MOVE RECORD LOGIC
  const moveRecord = async (targetStatus) => {
    if (!draggingRecord) return;
    
    const recId = draggingRecord.id;
    setDraggingRecord(null); // Reset UI immediately

    try {
      const targetOwnerId = ownerId || user.uid;
      const docRef = doc(db, 'users', targetOwnerId, 'modules', moduleData.id, 'records', recId);
      
      await updateDoc(docRef, {
        [activeField.name]: targetStatus,
        lastModifiedBy: user.uid,
        updatedAt: new Date()
      });
    } catch (error) {
      Alert.alert("Move Failed", error.message);
    }
  };

  // RENDER CARD WITH SUMMARY FIELDS
  const renderCard = (item) => {
    const isDraggingThis = draggingRecord?.id === item.id;
    const summaryFields = moduleData.fields.filter(f => f.isSummary);

    return (
      <TouchableOpacity 
        key={item.id} 
        style={[styles.kanbanCard, isDraggingThis && styles.draggingCard]}
        onLongPress={() => setDraggingRecord(item)}
        onPress={() => draggingRecord ? setDraggingRecord(null) : navigation.navigate('RecordDetail', { moduleData, recordData: item, ownerId })}
      >
        {isDraggingThis && (
            <View style={styles.dragBadge}>
                <Text style={styles.dragBadgeText}>SELECT TARGET COLUMN</Text>
            </View>
        )}
        
        {summaryFields.map((field, idx) => {
            const val = item[field.name];
            if (!val) return null;

            // First field is Title
            if (idx === 0) return <Text key={field.id} style={styles.cardTitle}>{val}</Text>;

            // Others are details
            return (
                <View key={field.id} style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>{field.name}: </Text>
                    <Text style={styles.fieldValue} numberOfLines={1}>{val}</Text>
                </View>
            );
        })}

        <View style={styles.cardFooter}>
           <Text style={styles.cardId}>#{item.id.substring(0,6).toUpperCase()}</Text>
           <Ionicons name="finger-print" size={12} color={colors.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderColumn = (option) => {
    const label = typeof option === 'object' ? option.label : option;
    const color = typeof option === 'object' ? option.color : colors.primary;
    const columnRecords = records.filter(r => r[activeField.name] === label);

    return (
      <View key={label || 'unassigned'} style={styles.columnContainer}>
        {/* COLUMN HEADER (TAP HERE TO DROP) */}
        <TouchableOpacity 
            style={[styles.columnHeader, draggingRecord && styles.dropZoneActive]} 
            disabled={!draggingRecord}
            onPress={() => moveRecord(label)}
        >
          <View style={[styles.statusDot, { backgroundColor: color }]} />
          <Text style={styles.columnTitle}>{label || 'Unassigned'}</Text>
          <View style={styles.countBadge}>
             <Text style={styles.countText}>{columnRecords.length}</Text>
          </View>
          {draggingRecord && <Ionicons name="download-outline" size={20} color={colors.primary} />}
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.columnScroll}>
          {columnRecords.map(renderCard)}
          {columnRecords.length === 0 && (
            <View style={styles.emptyColumn}>
               <Text style={styles.emptyText}>No items here</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  if (!activeField) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        
        <View style={{alignItems: 'center'}}>
          <Text style={styles.headerTitle}>Board View</Text>
          <TouchableOpacity style={styles.selectorBtn} onPress={() => setShowFieldPicker(true)}>
            <Text style={styles.selectorText}>Grouping: {activeField.name}</Text>
            <Ionicons name="chevron-down" size={12} color={colors.primary} style={{marginLeft: 4}} />
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity onPress={() => setDraggingRecord(null)} disabled={!draggingRecord}>
            <Ionicons name="refresh-circle" size={28} color={draggingRecord ? colors.error : '#eee'} />
        </TouchableOpacity>
      </View>

      {draggingRecord && (
          <View style={styles.instructionBanner}>
              <Text style={styles.instructionText}>Hold active: Tap a column header to move card</Text>
          </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{marginTop: 50}} />
      ) : (
        <ScrollView 
          horizontal 
          snapToInterval={COLUMN_WIDTH + 20}
          decelerationRate="fast"
          contentContainerStyle={styles.boardPadding}
        >
          {activeField.options.map(renderColumn)}
          {renderColumn({ label: undefined, color: '#ccc' })}
        </ScrollView>
      )}

      <Modal visible={showFieldPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowFieldPicker(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Choose Grouping Field</Text>
            {moduleData.fields.filter(f => f.type === 'dropdown').map((f, i) => (
              <TouchableOpacity 
                key={i} 
                style={styles.modalOption}
                onPress={() => { setActiveField(f); setShowFieldPicker(false); }}
              >
                <Text style={[styles.optionText, activeField.name === f.name && {color: colors.primary, fontWeight: 'bold'}]}>{f.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 50, paddingBottom: 10, paddingHorizontal: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  selectorBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F8FF', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 10, marginTop: 2 },
  selectorText: { fontSize: 11, color: colors.primary, fontWeight: 'bold' },
  iconBtn: { padding: 5 },

  instructionBanner: { backgroundColor: colors.primary, padding: 8, alignItems: 'center' },
  instructionText: { color: 'white', fontSize: 11, fontWeight: 'bold' },

  boardPadding: { paddingHorizontal: 15, paddingTop: 15 },
  columnContainer: { width: COLUMN_WIDTH, marginRight: 20, height: '100%' },
  columnHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, padding: 12, backgroundColor: 'white', borderRadius: 12, elevation: 2 },
  dropZoneActive: { borderWidth: 2, borderColor: colors.primary, backgroundColor: '#E3F2FD', borderStyle: 'dashed' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  columnTitle: { fontSize: 15, fontWeight: 'bold', color: '#333', flex: 1 },
  countBadge: { backgroundColor: '#eee', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginRight: 5 },
  countText: { fontSize: 11, fontWeight: 'bold', color: '#666' },

  columnScroll: { paddingBottom: 150 },
  kanbanCard: { backgroundColor: 'white', borderRadius: 15, padding: 16, marginBottom: 12, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
  draggingCard: { opacity: 0.5, borderColor: colors.primary, borderWidth: 1 },
  dragBadge: { backgroundColor: colors.primary, padding: 4, borderRadius: 4, marginBottom: 8, alignItems: 'center' },
  dragBadgeText: { color: 'white', fontSize: 9, fontWeight: 'bold' },

  cardTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 8 },
  fieldRow: { flexDirection: 'row', marginBottom: 4, alignItems: 'center' },
  fieldLabel: { fontSize: 11, color: '#999', fontWeight: '600' },
  fieldValue: { fontSize: 12, color: '#555', fontWeight: '500', flex: 1 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f5f5f5', paddingTop: 10, marginTop: 5 },
  cardId: { fontSize: 10, color: '#ccc', fontWeight: '800' },

  emptyColumn: { alignItems: 'center', marginTop: 40, opacity: 0.3 },
  emptyText: { color: '#999', fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: '80%', backgroundColor: 'white', borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  modalOption: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  optionText: { fontSize: 16, textAlign: 'center' }
});