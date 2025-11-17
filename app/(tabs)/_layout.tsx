import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { LibraryProvider } from '../../context/LibraryContext';

export default function TabLayout() {
  return (
    <LibraryProvider>
      <Tabs screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#050505', borderTopColor: '#222', height: 60, paddingBottom: 8 },
        tabBarActiveTintColor: '#2DDA93',
        tabBarInactiveTintColor: '#666',
      }}>
        <Tabs.Screen name="index" options={{ 
          title: 'Discover', 
          tabBarIcon: ({color}) => <Ionicons name="compass-outline" size={24} color={color} /> 
        }} />
        <Tabs.Screen name="library" options={{ 
          title: 'My Library', 
          tabBarIcon: ({color}) => <Ionicons name="library-outline" size={24} color={color} /> 
        }} />
        {/* NEW TAB */}
        <Tabs.Screen name="more" options={{ 
          title: 'About', 
          tabBarIcon: ({color}) => <Ionicons name="person-outline" size={24} color={color} /> 
        }} />
      </Tabs>
    </LibraryProvider>
  );
}
