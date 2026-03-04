import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image, 
  KeyboardAvoidingView, Platform, ScrollView, TouchableWithoutFeedback, Keyboard 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import colors from '../colors';
import CustomAlert from '../components/CustomAlert';
import GrapeLoader from '../components/GrapeLoader';

export default function LoginScreen({ route, navigation }) {
  const { email: initialEmail } = route.params || { email: '' };
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ visible: false, title: '', message: '', type: '' });

  const showAlert = (title, message, type = 'error') => {
    setAlert({ visible: true, title, message, type });
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert("Missing Fields", "Please enter both email and password.");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setLoading(false);
      // Custom Error Messages
      if (error.code === 'auth/invalid-credential') {
         showAlert("Login Failed", "Incorrect email or password.");
      } else if (error.code === 'auth/too-many-requests') {
         showAlert("Access Denied", "Too many failed attempts. Try again later.");
      } else {
         showAlert("Error", "Could not log in. Check your connection.");
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      showAlert("Email Required", "Enter your email above to reset password.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      showAlert("Email Sent", "Check your inbox for reset instructions.", "success");
    } catch (error) {
      showAlert("Error", "Could not send reset email.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <CustomAlert {...alert} onClose={() => setAlert({ ...alert, visible: false })} />
      {loading && <View style={styles.loaderOverlay}><GrapeLoader /></View>}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
            
            {/* Back Button - Moved Down */}
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 20, marginTop: 40 }}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.header}>
              <MaterialCommunityIcons name="fruit-grapes" size={60} color={colors.primary} />
              <Text style={styles.welcomeText}>Welcome Back</Text>
              <Text style={styles.subText}>Sign in to continue to Grape.</Text>
            </View>

            <View style={styles.form}>
               {/* Google Button */}
               <TouchableOpacity style={styles.googleBtn} onPress={() => showAlert("Setup Required", "Google Cloud Console setup required.")}>
                  <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/300/300221.png' }} style={styles.googleIcon} />
                  <Text style={styles.googleText}>Sign in with Google</Text>
               </TouchableOpacity>

               <View style={styles.divider}>
                  <View style={styles.line} /><Text style={styles.orText}>OR</Text><View style={styles.line} />
               </View>

              <Text style={styles.label}>Email</Text>
              <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
              
              <Text style={styles.label}>Password</Text>
              <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />

              <TouchableOpacity onPress={handleForgotPassword} style={{alignSelf: 'flex-end', marginBottom: 20}}>
                <Text style={{color: colors.primary, fontWeight: '600'}}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btn} onPress={handleLogin}>
                <Text style={styles.btnText}>Log In</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: { marginLeft: 20, marginTop: 60, zIndex: 10 }, // MOVED DOWN
  header: { alignItems: 'center', marginTop: 10, marginBottom: 30 },
  welcomeText: { fontSize: 28, fontWeight: 'bold', color: colors.text, marginTop: 10 },
  subText: { fontSize: 16, color: '#888' },
  form: { paddingHorizontal: 30, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: '#F7F9FC', padding: 18, borderRadius: 12, fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E0E0E0' },
  btn: { backgroundColor: colors.primary, padding: 18, borderRadius: 12, alignItems: 'center', shadowColor: colors.primary, shadowOpacity: 0.3, elevation: 5 },
  btnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 16, borderRadius: 12, marginBottom: 20 },
  googleIcon: { width: 24, height: 24, marginRight: 10 },
  googleText: { fontSize: 16, fontWeight: '600', color: '#333' },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  line: { flex: 1, height: 1, backgroundColor: '#eee' },
  orText: { marginHorizontal: 10, color: '#aaa', fontWeight: 'bold' },
  loaderOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 100, backgroundColor: 'rgba(255,255,255,0.5)' }
});