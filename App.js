import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/firebaseConfig';
import colors from './src/colors';

// --- IMPORT ALL SCREENS ---
import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignupNameScreen from './src/screens/SignupNameScreen';
import SignupPasswordScreen from './src/screens/SignupPasswordScreen';
import OnboardingScreen from './src/screens/OnboardingScreen'; 
import Dashboard from './src/screens/Dashboard';
import CreateModuleScreen from './src/screens/CreateModuleScreen';
import ModuleListScreen from './src/screens/ModuleListScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AddRecordScreen from './src/screens/AddRecordScreen';
import EditModuleScreen from './src/screens/EditModuleScreen';
import RecordDetailScreen from './src/screens/RecordDetailScreen';
import EditRecordScreen from './src/screens/EditRecordScreen';
import ManageMembersScreen from './src/screens/ManageMembersScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import CalendarViewScreen from './src/screens/CalendarViewScreen';
import StatsScreen from './src/screens/StatsScreen';
import KanbanBoardScreen from './src/screens/KanbanBoardScreen';
import MapViewScreen from './src/screens/MapViewScreen';
import RecordChatScreen from './src/screens/RecordChatScreen';

LogBox.ignoreLogs(['AsyncStorage has been extracted']);

const Stack = createStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
        // Always starts at Onboarding if logged in, otherwise Welcome
        initialRouteName={user ? "Onboarding" : "Welcome"}
      >
        {user ? (
          // === LOGGED IN SCREENS ===
          <Stack.Group>
            {/* Onboarding acts as the gateway for every session */}
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Dashboard" component={Dashboard} />
            
            <Stack.Screen 
              name="CreateModule" 
              component={CreateModuleScreen} 
              options={{ 
                presentation: 'modal',
                cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS 
              }} 
            />

            <Stack.Screen name="KanbanBoard" component={KanbanBoardScreen} />  
            <Stack.Screen name="RecordChat" component={RecordChatScreen} />
            <Stack.Screen name="MapView" component={MapViewScreen} />
            <Stack.Screen name="CalendarView" component={CalendarViewScreen} />
            <Stack.Screen name="ModuleList" component={ModuleListScreen} />
            <Stack.Screen name="ManageMembers" component={ManageMembersScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="Stats" component={StatsScreen} />
            
            <Stack.Screen 
              name="AddRecord" 
              component={AddRecordScreen} 
              options={{ 
                presentation: 'modal',
                cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS 
              }} 
            />
            
            <Stack.Screen name="RecordDetail" component={RecordDetailScreen} />
            <Stack.Screen name="EditRecord" component={EditRecordScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="EditModule" component={EditModuleScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
          </Stack.Group>
        ) : (
          // === AUTH SCREENS ===
          <Stack.Group>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignupName" component={SignupNameScreen} />
            <Stack.Screen name="SignupPassword" component={SignupPasswordScreen} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}