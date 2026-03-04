import React, { useRef, useState } from 'react';
import { 
  View, Text, StyleSheet, FlatList, Animated, 
  useWindowDimensions, TouchableOpacity, StatusBar, SafeAreaView 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors from '../colors'; 

const slides = [
  {
    id: '1',
    title: 'Welcome to Grape',
    description: "The world's first sketch-based CRM. Build custom business tools as easily as drawing a sketch.",
    icon: 'fruit-grapes',
    color: colors.primary, 
  },
  {
    id: '2',
    title: 'Custom Logic',
    description: 'Create your own modules and fields. Grape adapts to your workflow, no matter your industry.',
    icon: 'pencil-ruler',
    color: '#2D3436', 
  },
  {
    id: '3',
    title: 'P2P Secure Chat',
    description: 'Every record has its own discussion thread. Private, peer-to-peer encrypted communication.',
    icon: 'chat-lock',
    color: colors.primary, 
  },
  {
    id: '4',
    title: 'Kanban Visuals',
    description: 'Track your progress with built-in Kanban boards. Drag, drop, and manage leads effortlessly.',
    icon: 'view-column',
    color: '#2D3436', 
  },
  {
    id: '5',
    title: 'Team Collaboration',
    description: 'Invite members to specific modules. Work together in real-time with granular permissions.',
    icon: 'account-group',
    color: colors.primary, 
  },
  {
    id: '6',
    title: 'Smart Stats',
    description: 'Visualize your growth with auto-generated statistics and real-time business insights.',
    icon: 'chart-arc',
    color: '#2D3436', 
  },
  {
    id: '7',
    title: 'Geo Tracking',
    description: 'View your records on a map. Perfect for logistics, sales territories, and site management.',
    icon: 'map-marker-radius',
    color: colors.primary, 
  },
];

export default function OnboardingScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const scrollX = useRef(new Animated.Value(0)).current;
  const [currentIndex, setCurrentIndex] = useState(0);
  const slidesRef = useRef(null);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const viewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const finishOnboarding = async () => {
    try {
      await AsyncStorage.setItem('@onboarding_complete', 'true');
      navigation.replace('Dashboard');
    } catch (err) {
      console.log('Error @finishOnboarding: ', err);
    }
  };

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      slidesRef.current.scrollToIndex({ index: currentIndex + 1 });
    } else {
      finishOnboarding();
    }
  };

  const renderItem = ({ item }) => (
    <View style={[styles.slide, { width, backgroundColor: item.color }]}>
      <MaterialCommunityIcons 
        name={item.icon} 
        size={width * 0.9} 
        color="rgba(255,255,255,0.06)" 
        style={styles.bgIcon} 
      />
      
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name={item.icon} size={80} color={item.color} />
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* SKIP BUTTON */}
      <SafeAreaView style={styles.skipWrapper}>
        <TouchableOpacity style={styles.skipBtn} onPress={finishOnboarding}>
          <Text style={styles.skipText}>SKIP</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <FlatList
        data={slides}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        bounces={false}
        keyExtractor={(item) => item.id}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
        onViewableItemsChanged={viewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        scrollEventThrottle={32}
        ref={slidesRef}
      />

      <View style={styles.footer}>
        <View style={styles.indicatorContainer}>
          {slides.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 20, 8],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View 
                style={[styles.dot, { width: dotWidth, opacity, backgroundColor: 'white' }]} 
                key={i.toString()} 
              />
            );
          })}
        </View>

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, { color: slides[currentIndex]?.color || colors.primary }]}>
            {currentIndex === slides.length - 1 ? 'GET STARTED' : 'NEXT'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  slide: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  bgIcon: { position: 'absolute', bottom: -40, right: -60, transform: [{ rotate: '-10deg' }] },
  content: { alignItems: 'center', zIndex: 1 },
  iconCircle: { 
    width: 140, height: 140, borderRadius: 70, backgroundColor: 'white', 
    justifyContent: 'center', alignItems: 'center', marginBottom: 40,
    elevation: 10, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10
  },
  title: { fontSize: 28, fontWeight: '900', color: 'white', textAlign: 'center', marginBottom: 15, letterSpacing: 0.5 },
  description: { fontSize: 16, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 24, paddingHorizontal: 15 },
  
  // SKIP STYLES
  skipWrapper: { position: 'absolute', top: 20, right: 20, zIndex: 10 },
  skipBtn: { 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    paddingHorizontal: 15, 
    paddingVertical: 8, 
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)'
  },
  skipText: { color: 'white', fontSize: 12, fontWeight: '900', letterSpacing: 1 },

  footer: { position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center' },
  indicatorContainer: { flexDirection: 'row', marginBottom: 25, height: 10, justifyContent: 'center', alignItems: 'center' },
  dot: { height: 6, borderRadius: 3, marginHorizontal: 4 },
  button: { 
    backgroundColor: 'white', paddingHorizontal: 60, paddingVertical: 18, 
    borderRadius: 35, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 5, elevation: 5 
  },
  buttonText: { fontWeight: '900', fontSize: 15, letterSpacing: 1.5 }
});