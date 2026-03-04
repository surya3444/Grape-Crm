// src/components/GrapeLoader.js
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import colors from '../colors';

export default function GrapeLoader() {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Rotation Animation (Endless)
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // 2. Pulse Animation (Heartbeat)
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // A single grape circle
  const Grape = ({ style }) => (
    <View style={[styles.grape, style]} />
  );

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.container, { transform: [{ rotate: spin }, { scale: scaleAnim }] }]}>
        {/* Three grapes clustered together */}
        <Grape style={{ position: 'absolute', top: 0, left: 15 }} /> 
        <Grape style={{ position: 'absolute', top: 25, left: 0 }} /> 
        <Grape style={{ position: 'absolute', top: 25, left: 30 }} /> 
        {/* Stem */}
        <View style={styles.stem} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)', // Semi-transparent white
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  grape: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#fff',
  },
  stem: {
    position: 'absolute',
    top: -5,
    left: 28,
    width: 4,
    height: 15,
    backgroundColor: colors.secondary,
    transform: [{ rotate: '-15deg' }],
    zIndex: -1,
  }
});