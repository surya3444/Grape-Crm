import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../colors';

export default function SignupNameScreen({ route, navigation }) {
  const { email } = route.params; 
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const handleNext = () => {
    if (!firstName || !lastName) return;
    navigation.navigate('SignupPassword', { email, firstName, lastName });
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 20, marginTop: 40 }}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.stepIndicator}>Step 2 of 3</Text>
        <Text style={styles.title}>What's your name?</Text>
        
        <View style={styles.row}>
          <View style={{flex: 1, marginRight: 10}}>
            <Text style={styles.label}>First Name</Text>
            <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} />
          </View>
          <View style={{flex: 1}}>
             <Text style={styles.label}>Last Name</Text>
            <TextInput style={styles.input} value={lastName} onChangeText={setLastName} />
          </View>
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleNext}>
          <Text style={styles.btnText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color="white" style={{marginLeft: 10}} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  backBtn: { marginLeft: 20, marginTop: 20 },
  content: { padding: 30, paddingTop: 50 },
  stepIndicator: { color: colors.secondary, fontWeight: 'bold', marginBottom: 10 },
  title: { fontSize: 30, fontWeight: 'bold', color: colors.text, marginBottom: 40 },
  row: { flexDirection: 'row', marginBottom: 30 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: '#F7F9FC', padding: 18, borderRadius: 12, fontSize: 16, borderWidth: 1, borderColor: '#E0E0E0' },
  btn: { flexDirection: 'row', backgroundColor: colors.primary, padding: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});