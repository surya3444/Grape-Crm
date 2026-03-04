import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, 
  Alert, Switch, ActivityIndicator, StatusBar, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  collection, query, where, getDocs, addDoc, doc, updateDoc, onSnapshot, deleteField 
} from 'firebase/firestore'; 
import { db, auth } from '../firebaseConfig';
import colors from '../colors';

export default function ManageMembersScreen({ route, navigation }) {
  const { moduleData } = route.params;
  const currentUser = auth.currentUser;

  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  
  // 1. Fetch Members Live
  useEffect(() => {
    // Listen to the module document for member changes
    const moduleRef = doc(db, 'users', currentUser.uid, 'modules', moduleData.id);
    const unsubscribe = onSnapshot(moduleRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Convert 'members' map to array
        const memberList = data.members ? Object.entries(data.members).map(([uid, info]) => ({
          uid,
          ...info
        })) : [];
        setMembers(memberList);
      }
    });
    return unsubscribe;
  }, []);

  // 2. Invite Logic
  const handleInvite = async () => {
    if (!emailInput.trim()) return Alert.alert("Error", "Enter an email address.");
    
    // Normalize email (lowercase) for search
    const searchEmail = emailInput.trim().toLowerCase();

    if (searchEmail === currentUser.email.toLowerCase()) {
        return Alert.alert("Error", "You are the admin (you already have access).");
    }

    setLoading(true);
    try {
      // A. Find the user by email
      const usersRef = collection(db, 'users');
      // Crucial: We search for the email exactly as stored by the self-healing logic (lowercase)
      const q = query(usersRef, where("email", "==", searchEmail));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        Alert.alert("User not found", "This user must create an account and open the app at least once before they can be invited.");
        setLoading(false);
        return;
      }

      const targetUser = querySnapshot.docs[0];
      const targetUserId = targetUser.id;
      const targetUserData = targetUser.data();

      // Check if already a member
      if (members.some(m => m.uid === targetUserId)) {
          Alert.alert("Already Added", "This user is already a member.");
          setLoading(false);
          return;
      }

      // B. Send Notification (Invite) to that user's specific notification collection
      // The updated Firestore rules now allow ANY authenticated user to create a doc here.
      await addDoc(collection(db, 'users', targetUserId, 'notifications'), {
        type: 'invite',
        fromName: currentUser.displayName || 'Admin',
        fromEmail: currentUser.email,
        moduleName: moduleData.name,
        moduleId: moduleData.id,
        ownerId: currentUser.uid,
        status: 'pending',
        createdAt: new Date()
      });

      Alert.alert("Success", `Invite sent to ${targetUserData.name || searchEmail}!`);
      setEmailInput('');
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Update Permissions
  const togglePermission = async (memberUid, permissionKey, currentValue) => {
    const moduleRef = doc(db, 'users', currentUser.uid, 'modules', moduleData.id);
    const fieldPath = `members.${memberUid}.permissions.${permissionKey}`;
    
    await updateDoc(moduleRef, {
      [fieldPath]: !currentValue
    });
  };

  // 4. Remove Member
  const removeMember = async (memberUid) => {
    Alert.alert("Remove User?", "They will lose access immediately.", [
      { text: "Cancel" },
      { text: "Remove", style: 'destructive', onPress: async () => {
          try {
            const moduleRef = doc(db, 'users', currentUser.uid, 'modules', moduleData.id);
            // Delete the member key from the map
            await updateDoc(moduleRef, { 
                [`members.${memberUid}`]: deleteField() 
            });
          } catch (e) {
            Alert.alert("Error", e.message);
          }
      }}
    ]);
  };

  const renderMember = ({ item }) => (
    <View style={styles.memberCard}>
      <View style={styles.memberHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.email?.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{flex: 1}}>
           <Text style={styles.memberEmail}>{item.email}</Text>
           <Text style={styles.memberStatus}>
              {item.joinedAt ? `Joined: ${new Date(item.joinedAt.seconds * 1000).toLocaleDateString()}` : 'Pending Acceptance'}
           </Text>
        </View>
        <TouchableOpacity onPress={() => removeMember(item.uid)}>
           <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />
      <Text style={styles.permTitle}>Permissions</Text>

      {/* Permission Toggles */}
      <View style={styles.permRow}>
        <Text style={styles.permLabel}>Edit Structure</Text>
        <Switch 
           value={item.permissions?.canEditModule || false} 
           onValueChange={() => togglePermission(item.uid, 'canEditModule', item.permissions?.canEditModule)}
           trackColor={{true: colors.primary}}
        />
      </View>
      <View style={styles.permRow}>
        <Text style={styles.permLabel}>Delete Records</Text>
        <Switch 
           value={item.permissions?.canDeleteRecords || false} 
           onValueChange={() => togglePermission(item.uid, 'canDeleteRecords', item.permissions?.canDeleteRecords)}
           trackColor={{true: colors.error}}
        />
      </View>
       <View style={styles.permRow}>
        <Text style={styles.permLabel}>Edit Records</Text>
        <Switch 
           value={item.permissions?.canEditRecords ?? true} 
           onValueChange={() => togglePermission(item.uid, 'canEditRecords', item.permissions?.canEditRecords)}
           trackColor={{true: colors.secondary}}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      
      {/* HEADER */}
      <View style={styles.header}>
         <TouchableOpacity onPress={() => navigation.goBack()} style={{padding: 5}}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
         </TouchableOpacity>
         <Text style={styles.headerTitle}>Manage Access</Text>
         <View style={{width: 24}} />
      </View>

      {/* INVITE BOX */}
      <View style={styles.inviteBox}>
        <Text style={styles.label}>Invite by Email</Text>
        <View style={styles.inputRow}>
          <TextInput 
            style={styles.input} 
            placeholder="user@example.com" 
            autoCapitalize="none"
            keyboardType="email-address"
            value={emailInput}
            onChangeText={setEmailInput}
          />
          <TouchableOpacity style={styles.inviteBtn} onPress={handleInvite} disabled={loading}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.inviteText}>Invite</Text>}
          </TouchableOpacity>
        </View>
        <Text style={styles.helper}>User must already have an account on this app.</Text>
      </View>

      <FlatList 
        data={members}
        keyExtractor={item => item.uid}
        renderItem={renderMember}
        contentContainerStyle={{padding: 20}}
        ListHeaderComponent={<Text style={styles.listTitle}>Current Members ({members.length})</Text>}
        ListEmptyComponent={<Text style={styles.emptyText}>No members yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: Platform.OS === 'android' ? 50 : 60, 
    backgroundColor: 'white', elevation: 4 
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  
  inviteBox: { backgroundColor: 'white', padding: 20, marginBottom: 10, elevation: 2 },
  label: { fontWeight: 'bold', marginBottom: 10, color: '#555' },
  inputRow: { flexDirection: 'row' },
  input: { flex: 1, backgroundColor: '#f0f0f0', padding: 12, borderRadius: 8, marginRight: 10, fontSize: 16 },
  inviteBtn: { backgroundColor: colors.primary, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 8 },
  inviteText: { color: 'white', fontWeight: 'bold' },
  helper: { fontSize: 12, color: '#999', marginTop: 8 },
  
  listTitle: { fontSize: 16, fontWeight: 'bold', color: '#555', marginBottom: 10 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 20, fontStyle: 'italic' },
  
  memberCard: { backgroundColor: 'white', padding: 15, borderRadius: 12, marginBottom: 15, elevation: 1 },
  memberHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText: { fontWeight: 'bold', fontSize: 18, color: '#555' },
  memberEmail: { fontWeight: 'bold', fontSize: 15, color: '#333' },
  memberStatus: { fontSize: 12, color: colors.primary },
  
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 10 },
  permTitle: { fontSize: 11, fontWeight: 'bold', color: '#ccc', marginBottom: 5, textTransform: 'uppercase' },
  permRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 6 },
  permLabel: { fontSize: 14, color: '#444' }
});