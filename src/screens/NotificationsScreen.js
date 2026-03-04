import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, 
  ActivityIndicator, StatusBar, Image, Platform 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { 
  collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, setDoc, getDoc 
} from 'firebase/firestore'; 
import { db, auth } from '../firebaseConfig';
import colors from '../colors';

export default function NotificationsScreen({ navigation }) {
  const user = auth.currentUser;
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openingNotif, setOpeningNotif] = useState(null); // Track which item is loading

  // 1. Listen for ALL Notifications
  useEffect(() => {
    const q = query(
      collection(db, 'users', user.uid, 'notifications'), 
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // 2. Accept Invite Logic
  const handleAccept = async (invite) => {
    try {
      const moduleRef = doc(db, 'users', invite.ownerId, 'modules', invite.moduleId);
      await updateDoc(moduleRef, {
        [`members.${user.uid}`]: {
          email: user.email,
          permissions: { canEditModule: false, canDeleteRecords: false, canEditRecords: true },
          joinedAt: new Date(),
          role: 'member'
        }
      });
      await setDoc(doc(db, 'users', user.uid, 'shared_modules', invite.moduleId), {
        targetPath: `users/${invite.ownerId}/modules/${invite.moduleId}`,
        name: invite.moduleName,
        ownerName: invite.fromName,
        ownerId: invite.ownerId,
        joinedAt: new Date()
      });
      await deleteDoc(doc(db, 'users', user.uid, 'notifications', invite.id));
      Alert.alert("Welcome Aboard!", `You have successfully joined ${invite.moduleName}`);
      navigation.goBack();
    } catch (error) {
      if (error.code === 'not-found') {
         Alert.alert("Expired", "This project no longer exists.");
         await deleteDoc(doc(db, 'users', user.uid, 'notifications', invite.id));
      } else {
         Alert.alert("Error", error.message);
      }
    }
  };

  // 3. Handle Reminder Click (Navigation)
  const handleReminderClick = async (item) => {
    setOpeningNotif(item.id);
    try {
      const ownerId = item.ownerId || user.uid; // Fallback to self
      
      // A. Fetch Module Config (to get fields)
      const moduleSnap = await getDoc(doc(db, 'users', ownerId, 'modules', item.moduleId));
      if (!moduleSnap.exists()) throw new Error("Module no longer exists");
      const moduleData = { id: moduleSnap.id, ...moduleSnap.data() };

      // B. Fetch Record Data
      const recordSnap = await getDoc(doc(db, 'users', ownerId, 'modules', item.moduleId, 'records', item.recordId));
      if (!recordSnap.exists()) throw new Error("Record was deleted");
      const recordData = { id: recordSnap.id, ...recordSnap.data() };

      // C. Navigate
      navigation.navigate('RecordDetail', { moduleData, recordData, ownerId });
    } catch (error) {
      Alert.alert("Error", "Could not open details.\n" + error.message);
      // Optional: Delete if invalid?
    } finally {
      setOpeningNotif(null);
    }
  };

  const deleteNotification = async (id) => {
    await deleteDoc(doc(db, 'users', user.uid, 'notifications', id));
  };

  // --- RENDER COMPONENT ---
  const renderNotification = ({ item }) => {
    const isInvite = item.type === 'invite';
    
    return (
      <TouchableOpacity 
        style={styles.card}
        activeOpacity={isInvite ? 1 : 0.7} // Only clickable for Reminders
        onPress={() => !isInvite && handleReminderClick(item)}
      >
        {/* Accent Bar */}
        <View style={[styles.accentBar, { backgroundColor: isInvite ? colors.primary : '#F57C00' }]} />
        
        <View style={styles.cardContent}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: isInvite ? '#E3F2FD' : '#FFF3E0' }]}>
              {openingNotif === item.id ? (
                <ActivityIndicator size="small" color={isInvite ? colors.primary : '#F57C00'} />
              ) : (
                <MaterialCommunityIcons 
                  name={isInvite ? "account-group" : "clock-alert-outline"} 
                  size={20} 
                  color={isInvite ? colors.primary : '#F57C00'} 
                />
              )}
            </View>
            <View style={{flex: 1, marginLeft: 10}}>
               <Text style={[styles.typeLabel, { color: isInvite ? '#999' : '#F57C00' }]}>
                  {isInvite ? 'PROJECT INVITE' : 'TASK REMINDER'}
               </Text>
               <Text style={styles.dateLabel}>
                  {item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
               </Text>
            </View>
            <TouchableOpacity onPress={() => deleteNotification(item.id)} style={{padding: 5}}>
               <Ionicons name="close" size={18} color="#ccc" />
            </TouchableOpacity>
          </View>

          {/* Message Body */}
          {isInvite ? (
            <Text style={styles.message}>
              <Text style={styles.boldText}>{item.fromName}</Text> invited you to collaborate on the <Text style={styles.projectText}>{item.moduleName}</Text> project.
            </Text>
          ) : (
             <View>
                <Text style={styles.message}>{item.message}</Text>
                <Text style={styles.subMessage}>in {item.moduleName} • Tap to view</Text>
             </View>
          )}

          {/* Action Buttons (Only for Invites) */}
          {isInvite && (
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => deleteNotification(item.id)}>
                <Text style={styles.rejectText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item)}>
                <Text style={styles.acceptText}>Join Project</Text>
                <Ionicons name="arrow-forward" size={16} color="white" style={{marginLeft: 5}} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>
      <View style={styles.body}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={i => i.id}
            renderItem={renderNotification}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/4076/4076478.png' }} style={{ width: 100, height: 100, opacity: 0.5, marginBottom: 20 }} />
                <Text style={styles.emptyTitle}>All caught up!</Text>
                <Text style={styles.emptyText}>No new notifications.</Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 50 : 60, paddingBottom: 15, backgroundColor: '#F5F7FA' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#333', marginLeft: 15, flex: 1 },
  backBtn: { padding: 5 },
  body: { flex: 1 },
  listContent: { padding: 20 },
  card: { flexDirection: 'row', backgroundColor: 'white', borderRadius: 16, marginBottom: 20, overflow: 'hidden', shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  accentBar: { width: 6 },
  cardContent: { flex: 1, padding: 20 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  typeLabel: { fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  dateLabel: { fontSize: 12, fontWeight: '600', color: '#555', marginTop: 2 },
  message: { fontSize: 16, color: '#444', lineHeight: 24 },
  subMessage: { fontSize: 12, color: '#999', marginTop: 4, fontStyle: 'italic' },
  boldText: { fontWeight: 'bold', color: '#333' },
  projectText: { fontWeight: 'bold', color: colors.primary },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 },
  rejectBtn: { paddingVertical: 10, paddingHorizontal: 20, marginRight: 10, borderRadius: 10, backgroundColor: '#F5F5F5' },
  rejectText: { color: '#666', fontWeight: '600' },
  acceptBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, backgroundColor: colors.primary },
  acceptText: { color: 'white', fontWeight: 'bold' },
  emptyState: { alignItems: 'center', marginTop: 100, opacity: 0.8 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  emptyText: { fontSize: 16, color: '#999' }
});