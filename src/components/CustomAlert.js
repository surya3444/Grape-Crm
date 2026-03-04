import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../colors';

const CustomAlert = ({ visible, title, message, type = 'error', onClose }) => {
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      // Slide Down
      Animated.timing(slideAnim, {
        toValue: 50, // Distance from top
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Auto hide after 3 seconds
      const timer = setTimeout(() => {
        handleClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: -150,
      duration: 300,
      useNativeDriver: true,
    }).start(() => onClose && onClose());
  };

  if (!visible) return null;

  const bgColor = type === 'success' ? colors.primary : colors.error;
  const icon = type === 'success' ? 'checkmark-circle' : 'alert-circle';

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <View style={[styles.content, { borderLeftColor: bgColor }]}>
        <Ionicons name={icon} size={28} color={bgColor} style={{ marginRight: 10 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
        </View>
        <TouchableOpacity onPress={handleClose}>
          <Ionicons name="close" size={20} color="#999" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 20, right: 20, zIndex: 999 },
  content: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
    padding: 15, borderRadius: 12, borderLeftWidth: 5,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, elevation: 10
  },
  title: { fontWeight: 'bold', fontSize: 16, color: '#333' },
  message: { color: '#666', fontSize: 14, marginTop: 2 }
});

export default CustomAlert;