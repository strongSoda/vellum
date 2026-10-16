import { useAppTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { LibraryProvider } from '../../context/LibraryContext';

export default function TabLayout() {
  const { colors } = useAppTheme();

  return (
    <LibraryProvider>
      <Tabs screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border, height: 60, paddingBottom: 8 },
        tabBarActiveTintColor: colors.accentText,
        tabBarInactiveTintColor: colors.textMuted,
        sceneStyle: { backgroundColor: colors.background },
      }}>
        <Tabs.Screen name="index" options={{
          title: 'Discover',
          tabBarIcon: ({color}) => <Ionicons name="compass-outline" size={24} color={color} />
        }} />
        <Tabs.Screen name="library" options={{
          title: 'My Library',
          tabBarIcon: ({color}) => <Ionicons name="library-outline" size={24} color={color} />
        }} />
        <Tabs.Screen name="snippets" options={{
          title: 'Snippets',
          tabBarIcon: ({color}) => <Ionicons name="bookmarks-outline" size={22} color={color} />
        }} />
        <Tabs.Screen name="more" options={{
          title: 'About',
          tabBarIcon: ({color}) => <Ionicons name="person-outline" size={24} color={color} />
        }} />
      </Tabs>
    </LibraryProvider>
  );
}
