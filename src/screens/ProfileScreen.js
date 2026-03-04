import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, TextInput, Image, Alert, 
  ActivityIndicator, ScrollView, Modal, KeyboardAvoidingView, Platform, Switch 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { 
  signOut, updateProfile, updatePassword, 
  EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail 
} from 'firebase/auth';
// --- CHANGED: Added collection and getDocs to imports ---
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import colors from '../colors';

export default function ProfileScreen({ navigation }) {
  const user = auth.currentUser;
  
  // MODE STATE
  const [isEditing, setIsEditing] = useState(false);
  
  // SETTINGS STATE
  const [notifications, setNotifications] = useState(true);
  const [biometric, setBiometric] = useState(false);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState(''); 
  
  // Profile Data
  const [name, setName] = useState(user?.displayName || '');
  const [image, setImage] = useState(null); 
  const [joinedDate, setJoinedDate] = useState(new Date()); 
  // --- CHANGED: Added State for Count ---
  const [modulesCount, setModulesCount] = useState(0);

  // Security Data
  const [newEmail, setNewEmail] = useState(user?.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 1. Fetch Profile AND Modules Count
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // A. Fetch User Details
        const docSnap = await getDoc(doc(db, 'users', user.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.profileImage) setImage(data.profileImage);
          if (data.name) setName(data.name);
          if (data.createdAt) setJoinedDate(data.createdAt.toDate());
        }

        // --- CHANGED: Fetch Modules Count ---
        // 1. Get Owned Modules
        const myModulesSnap = await getDocs(collection(db, 'users', user.uid, 'modules'));
        const myCount = myModulesSnap.size;

        // 2. Get Shared Modules (Optional: Remove if you only want owned)
        const sharedSnap = await getDocs(collection(db, 'users', user.uid, 'shared_modules'));
        const sharedCount = sharedSnap.size;

        // 3. Set Total
        setModulesCount(myCount + sharedCount);

      } catch (error) {
        console.log("Error fetching profile:", error);
      }
    };

    // Trigger fetch on mount and when screen comes into focus (in case modules were added)
    const unsubscribe = navigation.addListener('focus', () => {
      fetchProfile();
    });

    return unsubscribe;
  }, [navigation]);

  // 2. Pick & HEAVILY Compress Image
  const pickImage = async () => {
    if (!isEditing) return;

    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission Required", "We need access to your photos.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1, 
      });

      if (!result.canceled) {
        const manipResult = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 250 } }], 
          { compress: 0.2, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        
        const cleanBase64 = `data:image/jpeg;base64,${manipResult.base64}`;
        
        if (cleanBase64.length > 700000) {
            Alert.alert("Image too complex", "Please choose a simpler photo.");
            return;
        }

        setImage(cleanBase64);
      }
    } catch (error) {
      Alert.alert("Error", "Could not process image.");
    }
  };

  // 3. Save Logic
  const handleSaveAttempt = () => {
    const isSensitiveChange = (newEmail !== user.email) || (newPassword.length > 0);
    if (isSensitiveChange) setAuthModalVisible(true);
    else executeSave();
  };

  const handleReAuthAndSave = async () => {
    if (!currentPassword) {
      Alert.alert("Required", "Please enter your current password.");
      return;
    }
    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      setAuthModalVisible(false);
      await executeSave(); 
    } catch (error) {
      setLoading(false);
      Alert.alert("Verification Failed", "Incorrect password.");
    }
  };

  const executeSave = async () => {
    setLoading(true);
    try {
      await updateProfile(user, { displayName: name, photoURL: image });
      await setDoc(doc(db, 'users', user.uid), {
        name: name, 
        profileImage: image,
        updatedAt: new Date()
      }, { merge: true });

      if (newEmail !== user.email) {
        await verifyBeforeUpdateEmail(user, newEmail);
        Alert.alert("Check Inbox", `Verification link sent to ${newEmail}`);
      }

      if (newPassword) {
        if (newPassword !== confirmPassword) throw new Error("Passwords do not match.");
        await updatePassword(user, newPassword);
        Alert.alert("Success", "Password changed!");
      }

      setIsEditing(false); 
      setNewPassword(''); 
      setConfirmPassword('');
      setCurrentPassword('');
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const SettingRow = ({ icon, color, label, type, value, onToggle }) => (
    <View style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <View style={[styles.settingIconBox, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      {type === 'switch' ? (
        <Switch 
          trackColor={{ false: "#e0e0e0", true: colors.primary }}
          thumbColor={Platform.OS === 'ios' ? '#fff' : value ? colors.primary : '#f4f3f4'}
          onValueChange={onToggle}
          value={value}
        />
      ) : (
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      )}
    </View>
  );

  return (
    <View style={styles.mainContainer}>
      
      {/* HEADER */}
      <View style={styles.headerBackground}>
        <View style={styles.circleDecoration1} />
        <View style={styles.circleDecoration2} />

        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditing ? "Edit Profile" : "My Profile"}</Text>
          <TouchableOpacity 
            onPress={() => setIsEditing(!isEditing)} 
            style={styles.iconBtn}
          >
            <Ionicons name={isEditing ? "close" : "pencil"} size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* CONTENT (White Card) */}
      <View style={styles.contentContainer}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          
          {/* AVATAR (Safe Zone) */}
          <View style={styles.avatarContainer}>
            <TouchableOpacity 
              onPress={pickImage} 
              activeOpacity={isEditing ? 0.7 : 1} 
              style={styles.avatarWrapper}
            >
              {image ? (
                <Image source={{ uri: image }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.placeholderAvatar]}>
                  <Text style={styles.placeholderText}>{name.charAt(0) || 'U'}</Text>
                </View>
              )}
              {isEditing && (
                <View style={styles.cameraBadge}>
                  <Ionicons name="camera" size={16} color="white" />
                </View>
              )}
            </TouchableOpacity>
            {isEditing && <Text style={styles.tapText}>Tap to change photo</Text>}
          </View>

          {/* VIEW MODE */}
          {!isEditing ? (
            <View style={styles.viewModeContainer}>
              <Text style={styles.viewName}>{name || "No Name Set"}</Text>
              
              <View style={styles.badgeContainer}>
                <MaterialCommunityIcons name="check-decagram" size={16} color={colors.primary} />
                <Text style={styles.badgeText}>{user.emailVerified ? "Verified Member" : "Standard Member"}</Text>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{formatDate(joinedDate)}</Text>
                  <Text style={styles.statLabel}>Joined</Text>
                </View>
                <View style={styles.verticalDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>Free</Text>
                  <Text style={styles.statLabel}>Plan</Text>
                </View>
                <View style={styles.verticalDivider} />
                
                {/* --- CHANGED: Use dynamic modulesCount --- */}
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{modulesCount}</Text>
                  <Text style={styles.statLabel}>Apps</Text>
                </View>
              </View>

              <View style={styles.sectionHeaderBox}>
                <Text style={styles.sectionHeaderText}>Preferences</Text>
              </View>

              <SettingRow icon="notifications" color="#FF9800" label="Notifications" type="switch" value={notifications} onToggle={setNotifications} />
              <SettingRow icon="finger-print" color="#2196F3" label="Biometric Login" type="switch" value={biometric} onToggle={setBiometric} />

              <View style={[styles.sectionHeaderBox, {marginTop: 15}]}>
                <Text style={styles.sectionHeaderText}>Support</Text>
              </View>

              <TouchableOpacity onPress={() => Alert.alert("Coming Soon", "Help Center")}>
                <SettingRow icon="help-buoy" color="#4CAF50" label="Help Center" type="link" />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.logoutBtn} onPress={() => signOut(auth)}>
                <Text style={styles.logoutText}>Sign Out</Text>
              </TouchableOpacity>
              
              <Text style={styles.versionText}>Grape CRM v1.0.2</Text>
            </View>
          ) : (
            /* EDIT MODE */
            <View style={styles.editForm}>
              <Text style={styles.sectionTitle}>Basic Info</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Display Name</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput style={styles.input} value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" keyboardType="email-address" />
              </View>

              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Security</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>New Password</Text>
                <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="Leave blank to keep current" />
              </View>

              {newPassword.length > 0 && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="Confirm new password" />
                </View>
              )}

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveAttempt} disabled={loading}>
                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </View>

      {/* MODAL */}
      <Modal animationType="slide" transparent={true} visible={authModalVisible}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <MaterialCommunityIcons name="shield-lock" size={50} color={colors.primary} style={{marginBottom: 10}} />
            <Text style={styles.modalTitle}>Security Check</Text>
            <Text style={styles.modalText}>Enter current password to verify changes.</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Current Password"
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setAuthModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleReAuthAndSave} style={styles.verifyBtn} disabled={loading}>
                 {loading ? <ActivityIndicator color="white" /> : <Text style={styles.verifyText}>Verify</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: colors.primary },
  
  headerBackground: { 
    height: 140, backgroundColor: colors.primary, 
    paddingTop: 50, paddingHorizontal: 20,
    position: 'relative', overflow: 'hidden'
  },
  circleDecoration1: { position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.1)' },
  circleDecoration2: { position: 'absolute', bottom: -20, left: 10, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.05)' },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  iconBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12 },

  contentContainer: {
    flex: 1, backgroundColor: '#fff',
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    paddingHorizontal: 20, paddingTop: 20,
  },

  avatarContainer: { alignItems: 'center', marginBottom: 10, marginTop: 10 },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: '#f2f2f7', backgroundColor: '#f0f0f0' },
  placeholderAvatar: { backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center' },
  placeholderText: { fontSize: 45, fontWeight: 'bold', color: colors.primary },
  cameraBadge: { position: 'absolute', bottom: 5, right: 5, backgroundColor: colors.text, width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'white' },
  tapText: { fontSize: 12, color: colors.primary, fontWeight: 'bold', marginTop: 8 },

  viewModeContainer: { alignItems: 'center', marginTop: 10 },
  viewName: { fontSize: 26, fontWeight: 'bold', color: colors.text, marginBottom: 5 },
  badgeContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 25 },
  badgeText: { color: colors.primary, fontWeight: 'bold', fontSize: 12, marginLeft: 5 },
  statsRow: { flexDirection: 'row', backgroundColor: '#F9FAFB', borderRadius: 16, padding: 20, width: '100%', justifyContent: 'space-between', marginBottom: 25 },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 16, fontWeight: 'bold', color: colors.text },
  statLabel: { fontSize: 12, color: '#888', marginTop: 2 },
  verticalDivider: { width: 1, backgroundColor: '#E0E0E0', height: '80%' },

  sectionHeaderBox: { width: '100%', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 10, marginBottom: 10 },
  sectionHeaderText: { fontSize: 14, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingVertical: 12 },
  settingLeft: { flexDirection: 'row', alignItems: 'center' },
  settingIconBox: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  settingLabel: { fontSize: 16, color: colors.text, fontWeight: '500' },

  editForm: { marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 15, marginTop: 10 },
  label: { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 6, marginLeft: 4 },
  inputGroup: { marginBottom: 18 },
  input: { backgroundColor: '#F7F9FC', padding: 16, borderRadius: 14, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: '#EEF0F4' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 10 },
  saveBtn: { backgroundColor: colors.primary, padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  logoutBtn: { width: '100%', padding: 16, borderRadius: 14, marginTop: 30, borderWidth: 1, borderColor: '#FFEBEE', backgroundColor: '#FFF5F5', alignItems: 'center' },
  logoutText: { color: colors.error, fontWeight: 'bold', fontSize: 16 },
  versionText: { marginTop: 20, color: '#ccc', fontSize: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 24, padding: 30, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  modalText: { textAlign: 'center', color: '#666', marginBottom: 20 },
  modalInput: { width: '100%', backgroundColor: '#F5F5F5', padding: 15, borderRadius: 10, marginBottom: 20, fontSize: 16 },
  modalActions: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 1, padding: 15, alignItems: 'center', marginRight: 10 },
  cancelText: { color: '#888', fontWeight: 'bold' },
  verifyBtn: { flex: 1, backgroundColor: colors.primary, padding: 15, borderRadius: 12, alignItems: 'center' },
  verifyText: { color: 'white', fontWeight: 'bold' }
});