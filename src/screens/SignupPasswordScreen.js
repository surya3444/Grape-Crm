import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebaseConfig';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import colors from '../colors';

export default function SignupPasswordScreen({ route, navigation }) {
  const { email, firstName, lastName } = route.params;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Validation States
  const [hasLength, setHasLength] = useState(false);
  const [hasNumber, setHasNumber] = useState(false);
  const [hasSpecial, setHasSpecial] = useState(false);
  const [match, setMatch] = useState(false);

  // Live Check
  useEffect(() => {
    setHasLength(password.length >= 8);
    setHasNumber(/\d/.test(password)); // Regex for number
    setHasSpecial(/[!@#$%^&*(),.?":{}|<>]/.test(password)); // Regex for special char
    setMatch(password === confirmPassword && password.length > 0);
  }, [password, confirmPassword]);

  const isValid = hasLength && hasNumber && hasSpecial && match;

  const handleSignUp = async () => {
    if (!isValid) return;

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: `${firstName} ${lastName}` });
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper for Rule Item
  const RuleItem = ({ label, passed }) => (
    <View style={styles.ruleRow}>
      <Ionicons name={passed ? "checkmark-circle" : "close-circle"} size={18} color={passed ? colors.primary : "#e0e0e0"} />
      <Text style={[styles.ruleText, { color: passed ? colors.text : "#aaa" }]}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>

        {/* ADDED BACK BUTTON */}
    
    <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 20, marginTop: 40 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
    
      <View style={styles.content}>
        <Text style={styles.stepIndicator}>Step 3 of 3</Text>
        <Text style={styles.title}>Create a strong password</Text>

        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        
        <TextInput
          style={[styles.input, !match && confirmPassword.length > 0 && { borderColor: colors.error }]}
          placeholder="Confirm Password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        {/* RULES SECTION */}
        <View style={styles.rulesContainer}>
          <RuleItem label="At least 8 characters" passed={hasLength} />
          <RuleItem label="Contains a number" passed={hasNumber} />
          <RuleItem label="Contains a special character (!@#$)" passed={hasSpecial} />
          <RuleItem label="Passwords match" passed={match} />
        </View>

        {loading ? (
           <ActivityIndicator size="large" color={colors.primary} style={{marginTop: 30}} />
        ) : (
          <TouchableOpacity 
            style={[styles.btn, !isValid && styles.disabledBtn]} 
            onPress={handleSignUp}
            disabled={!isValid}
          >
            <Text style={styles.btnText}>Create Account</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { padding: 30, paddingTop: 60 },
  stepIndicator: { color: colors.secondary, fontWeight: 'bold', marginBottom: 10 },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.text, marginBottom: 30 },
  input: { backgroundColor: '#F7F9FC', padding: 18, borderRadius: 12, fontSize: 16, borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 15 },
  
  rulesContainer: { marginTop: 10, marginBottom: 30 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  ruleText: { marginLeft: 10, fontSize: 14 },

  btn: { backgroundColor: colors.primary, padding: 18, borderRadius: 12, alignItems: 'center' },
  disabledBtn: { backgroundColor: '#E0E0E0' },
  btnText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});