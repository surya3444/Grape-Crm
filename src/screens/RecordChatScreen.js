import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar, 
  SafeAreaView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import colors from '../colors';

export default function RecordChatScreen({ route, navigation }) {
  const { moduleData, recordData, ownerId } = route.params;
  const user = auth.currentUser;
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef();

  useEffect(() => {
    const targetOwnerId = ownerId || user.uid;
    const chatRef = collection(db, 'users', targetOwnerId, 'modules', moduleData.id, 'records', recordData.id, 'messages');
    const q = query(chatRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(fetched);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // --- UPDATED SEND MESSAGE WITH NOTIFICATION TRIGGER ---
  const sendMessage = async () => {
    if (inputText.trim().length === 0) return;
    const textToSend = inputText;
    setInputText('');

    try {
      const targetOwnerId = ownerId || user.uid;
      const chatRef = collection(db, 'users', targetOwnerId, 'modules', moduleData.id, 'records', recordData.id, 'messages');
      
      // 1. Add the message to the chat
      await addDoc(chatRef, {
        text: textToSend,
        senderId: user.uid,
        senderName: user.displayName || user.email.split('@')[0],
        createdAt: serverTimestamp(),
      });

      // 2. TRIGGER NOTIFICATIONS for other members
      const members = Object.keys(moduleData.members || {}).filter(id => id !== user.uid);
      
      members.forEach(async (memberId) => {
        // We write to each member's private notification collection
        const notifRef = collection(db, 'users', memberId, 'notifications');
        await addDoc(notifRef, {
          type: 'chat',
          text: textToSend,
          senderName: user.displayName || user.email.split('@')[0],
          recordId: recordData.id,
          moduleId: moduleData.id,
          moduleName: moduleData.name,
          recordName: recordData[moduleData.fields[0].name] || 'Record',
          status: 'unread',
          createdAt: serverTimestamp(),
          ownerId: targetOwnerId // Critical for reply navigation
        });
      });

    } catch (error) {
      console.log("Chat Error:", error);
    }
  };

  const renderMessage = ({ item }) => {
    const isMine = item.senderId === user.uid;
    
    return (
      <View style={[styles.msgContainer, isMine ? styles.myContainer : styles.theirContainer]}>
        {!isMine && <Text style={styles.senderName}>{item.senderName}</Text>}
        
        <View style={styles.bubbleWrapper}>
          <View style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble]}>
            <Text style={[styles.msgText, isMine && { color: 'white' }]}>{item.text}</Text>
          </View>

          <View style={[
            styles.arrow, 
            isMine ? styles.arrowRight : styles.arrowLeft,
            { borderTopColor: isMine ? colors.primary : 'white' }
          ]} />
        </View>

        <Text style={[styles.timeText, isMine ? { textAlign: 'right' } : { textAlign: 'left' }]}>
          {item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Discussion</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0} 
      >
        <View style={styles.chatArea}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={item => item.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.listContent}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />
          )}
        </View>

        <View style={styles.inputWrapper}>
          <View style={styles.inputContainer}>
            <TextInput 
              style={styles.input} 
              placeholder="Type your message..." 
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            <TouchableOpacity 
              style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]} 
              onPress={sendMessage}
              disabled={!inputText.trim()}
            >
              <Ionicons name="send" size={18} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
      <SafeAreaView style={{ backgroundColor: 'white' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 15, 
    paddingHorizontal: 20, backgroundColor: 'white', 
    borderBottomWidth: 1, borderBottomColor: '#eee', elevation: 4 
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  backBtn: { padding: 5 },
  chatArea: { flex: 1 },
  listContent: { padding: 20, paddingBottom: 30 },
  msgContainer: { marginBottom: 18, maxWidth: '80%' },
  myContainer: { alignSelf: 'flex-end' },
  theirContainer: { alignSelf: 'flex-start' },
  senderName: { fontSize: 10, fontWeight: 'bold', color: '#999', marginBottom: 4, marginLeft: 8 },
  bubbleWrapper: { position: 'relative' },
  bubble: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 15, minWidth: 60, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2 },
  myBubble: { backgroundColor: colors.primary, borderTopRightRadius: 0 },
  theirBubble: { backgroundColor: 'white', borderTopLeftRadius: 0 },
  arrow: { position: 'absolute', top: 0, width: 0, height: 0, backgroundColor: 'transparent', borderStyle: 'solid', borderTopWidth: 10, borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 0, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  arrowRight: { right: -8, borderTopColor: colors.primary, transform: [{ rotate: '-15deg' }] },
  arrowLeft: { left: -8, borderTopColor: 'white', transform: [{ rotate: '15deg' }] },
  msgText: { fontSize: 15, lineHeight: 20 },
  timeText: { fontSize: 9, color: '#bbb', marginTop: 4, marginHorizontal: 5 },
  inputWrapper: { paddingHorizontal: 15, paddingVertical: 10, backgroundColor: 'white', borderTopWidth: 1, borderColor: '#eee' },
  inputContainer: { flexDirection: 'row', backgroundColor: '#F0F2F5', borderRadius: 25, paddingHorizontal: 15, alignItems: 'center' },
  input: { flex: 1, fontSize: 16, color: '#333', paddingVertical: 10, maxHeight: 100 },
  sendBtn: { backgroundColor: colors.primary, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginLeft: 10 }
});