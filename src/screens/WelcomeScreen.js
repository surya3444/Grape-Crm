import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image, 
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchSignInMethodsForEmail } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import colors from '../colors';
import CustomAlert from '../components/CustomAlert';
import GrapeLoader from '../components/GrapeLoader';

export default function WelcomeScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ visible: false, title: '', message: '', type: '' });

  const showAlert = (title, message, type = 'error') => {
    setAlert({ visible: true, title, message, type });
  };

  const handleContinue = async () => {
    Keyboard.dismiss(); 

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAlert("Invalid Format", "Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const methods = await fetchSignInMethodsForEmail(auth, email);
      
      if (methods && methods.length > 0) {
        setLoading(false);
        showAlert("Account Found", "You have an account. Please Log In.", "error");
        setTimeout(() => navigation.navigate('Login', { email }), 1500);
        return; 
      } 
      
      setLoading(false);
      navigation.navigate('SignupName', { email });

    } catch (error) {
      setLoading(false);
      showAlert("Connection Error", "Could not verify email.");
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.mainContainer}>
        <CustomAlert {...alert} onClose={() => setAlert({ ...alert, visible: false })} />
        {loading && <GrapeLoader />}

        {/* STATIC LAYER: Branding */}
        <View style={styles.brandingSection}>
            <MaterialCommunityIcons name="fruit-grapes" size={80} color={colors.primary} />
            <Text style={styles.brand}>Grape</Text>
            <Text style={styles.tagline}>Relationships, ripened.</Text>
        </View>

        {/* MOVING LAYER: Inputs */}
        <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"} 
            style={styles.keyboardContainer}
        >
            <View style={styles.bottomCard}>
              {/* --- FIX START: THE INFINITE APRON --- */}
              {/* This invisible view hangs off the bottom to cover any gaps */}
              <View style={styles.infiniteApron} />
              {/* --- FIX END --- */}

              <Text style={styles.cardTitle}>Get Started</Text>

              <TouchableOpacity style={styles.googleBtn} onPress={() => showAlert("Setup Required", "Google Cloud Console setup required.")}>
                <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/300/300221.png' }} style={styles.googleIcon} />
                <Text style={styles.googleText}>Continue with Google</Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.line} /><Text style={styles.orText}>OR</Text><View style={styles.line} />
              </View>

              <Text style={styles.label}>Work Email</Text>
              <TextInput
                style={styles.input}
                placeholder="name@company.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <TouchableOpacity style={styles.primaryBtn} onPress={handleContinue}>
                <Text style={styles.primaryBtnText}>Continue with Email</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.navigate('Login', { email: '' })} style={styles.footerLink}>
                <Text style={styles.linkText}>Have an account? <Text style={{fontWeight: 'bold', color: colors.primary}}>Log in</Text></Text>
              </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>

      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  mainContainer: { 
    flex: 1, 
    backgroundColor: colors.background,
  },
  brandingSection: {
    position: 'absolute', 
    top: '15%', 
    left: 0, 
    right: 0,
    alignItems: 'center',
    zIndex: -1, 
  },
  brand: { fontSize: 48, fontWeight: '800', color: colors.primary, letterSpacing: -1 },
  tagline: { fontSize: 16, color: colors.secondary, marginTop: 5 },

  keyboardContainer: {
    flex: 1,
    justifyContent: 'flex-end', 
  },
  
  bottomCard: { 
    backgroundColor: colors.white, 
    borderTopLeftRadius: 30, 
    borderTopRightRadius: 30, 
    padding: 30,
    paddingBottom: 50, 
    width: '100%',
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: -5 }, 
    shadowOpacity: 0.1, 
    elevation: 20 
  },

  // --- THE NEW STYLE ---
  infiniteApron: {
    position: 'absolute',
    bottom: -1000, // Starts at the bottom edge and goes down
    left: 0,
    right: 0,
    height: 1000, // Huge height to ensure it covers everything
    backgroundColor: colors.white, // Matches the card
  },
  
  cardTitle: { fontSize: 24, fontWeight: 'bold', color: colors.text, marginBottom: 20 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 16, borderRadius: 12, marginBottom: 20 },
  googleIcon: { width: 24, height: 24, marginRight: 10 },
  googleText: { fontSize: 16, fontWeight: '600', color: '#333' },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  line: { flex: 1, height: 1, backgroundColor: '#eee' },
  orText: { marginHorizontal: 10, color: '#aaa', fontWeight: 'bold' },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8, marginLeft: 5 },
  input: { backgroundColor: '#F7F9FC', padding: 18, borderRadius: 12, fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E0E0E0' },
  primaryBtn: { backgroundColor: colors.primary, padding: 18, borderRadius: 12, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  footerLink: { marginTop: 25, alignItems: 'center' },
  linkText: { color: colors.text },
});