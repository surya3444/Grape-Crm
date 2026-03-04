import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import colors from '../colors';

export default function NotificationCenter({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = auth.currentUser;

  useEffect(() => {
    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      where('status', '==', 'unread'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const markAsRead = async (id) => {
    await deleteDoc(doc(db, 'users', user.uid, 'notifications', id));
  };

  const handleReply = (item) => {
    markAsRead(item.id);
    // Navigate to chat with the required params
    navigation.navigate('RecordChat', { 
      recordData: { id: item.recordId, [item.moduleName]: item.recordName }, 
      moduleData: { id: item.moduleId, name: item.moduleName, fields: [{name: item.moduleName}] },
      ownerId: user.uid // Adjust based on your logic
    });
  };

  const renderItem = ({ item }) => (
    <View style={styles.notifCard}>
      <View style={styles.notifHeader}>
        <Ionicons name="chatbubble-ellipses" size={20} color={colors.primary} />
        <Text style={styles.sender}>{item.senderName} in {item.recordName}</Text>
      </View>
      <Text style={styles.msgText} numberOfLines={2}>{item.text}</Text>
      
      <View style={styles.actions}>
        <TouchableOpacity style={styles.readBtn} onPress={() => markAsRead(item.id)}>
          <Text style={styles.readText}>Mark as Read</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.replyBtn} onPress={() => handleReply(item)}>
          <Ionicons name="arrow-undo" size={16} color="white" />
          <Text style={styles.replyText}>Reply</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} /></TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
      </View>
      {loading ? <ActivityIndicator style={{flex:1}} /> : (
        <FlatList 
          data={notifications}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          ListEmptyComponent={<Text style={styles.empty}>All caught up!</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { paddingTop: 60, padding: 20, backgroundColor: 'white', flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginLeft: 15 },
  notifCard: { backgroundColor: 'white', margin: 10, borderRadius: 12, padding: 15, elevation: 2 },
  notifHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sender: { fontWeight: 'bold', marginLeft: 8, color: '#333' },
  msgText: { color: '#666', marginBottom: 15 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  readBtn: { padding: 10, marginRight: 10 },
  readText: { color: '#888', fontWeight: '600' },
  replyBtn: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center' },
  replyText: { color: 'white', fontWeight: 'bold', marginLeft: 8 },
  empty: { textAlign: 'center', marginTop: 50, color: '#999' }
});