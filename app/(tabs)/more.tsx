import { DEVELOPER_PROFILE, PROJECTS } from '@/constants/Portfolio';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Image, Linking, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const THEME = { background: '#050505', accent: '#2DDA93', card: '#161616', text: '#FFF', textMuted: '#888' };

export default function MoreScreen() {
    
    const openLink = async (url: string) => {
        // Open in-app browser for smooth experience
        await WebBrowser.openBrowserAsync(url, {
            readerMode: false,
            toolbarColor: THEME.background,
            controlsColor: THEME.accent
        });
    };

    const openExternal = (url: string) => {
        Linking.openURL(url);
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            
            <View style={styles.header}>
                <Text style={styles.headerTitle}>ABOUT</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                
                {/* --- Developer Profile --- */}
                <View style={styles.profileCard}>
                    <View style={styles.profileHeader}>
                        <Image source={{ uri: DEVELOPER_PROFILE.avatar }} style={styles.avatar} />
                        <View style={{flex: 1}}>
                            <Text style={styles.name}>{DEVELOPER_PROFILE.name}</Text>
                            <Text style={styles.role}>{DEVELOPER_PROFILE.role}</Text>
                        </View>
                    </View>
                    
                    <Text style={styles.bio}>{DEVELOPER_PROFILE.bio}</Text>
                    
                    <TouchableOpacity style={styles.linkedinBtn} onPress={() => openExternal(DEVELOPER_PROFILE.linkedin)}>
                        <Ionicons name="logo-linkedin" size={20} color="#FFF" style={{marginRight: 8}} />
                        <Text style={styles.linkedinText}>Connect on LinkedIn</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.sectionTitle}>MORE PROJECTS</Text>

                {/* --- Projects Grid --- */}
                <View style={styles.projectsList}>
                    {PROJECTS.map((project, index) => (
                        <TouchableOpacity key={index} style={styles.projectCard} onPress={() => openLink(project.url)} activeOpacity={0.7}>
                            <View style={styles.iconBox}>
                                <Ionicons name={project.icon as any} size={24} color={THEME.accent} />
                            </View>
                            <View style={{flex: 1}}>
                                <Text style={styles.projectTitle}>{project.title}</Text>
                                <Text style={styles.projectDesc}>{project.desc}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#333" />
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Footer Info */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Vellum v1.0.0</Text>
                    <Text style={styles.footerText}>Built with React Native & Expo</Text>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
    header: { padding: 16, paddingBottom: 8 },
    headerTitle: { fontSize: 28, fontWeight: '900', color: '#FFF', letterSpacing: 2 },
    content: { padding: 16, paddingBottom: 40 },
    
    // Profile
    profileCard: { backgroundColor: '#111', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#222', marginBottom: 32 },
    profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    avatar: { width: 60, height: 60, borderRadius: 30, marginRight: 16, backgroundColor: '#333' },
    name: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
    role: { color: THEME.accent, fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
    bio: { color: '#CCC', fontSize: 14, lineHeight: 22, marginBottom: 20 },
    linkedinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0077B5', padding: 12, borderRadius: 8 },
    linkedinText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },

    sectionTitle: { color: '#666', fontSize: 12, fontWeight: 'bold', marginBottom: 16, letterSpacing: 1 },

    // Projects
    projectsList: { gap: 12 },
    projectCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161616', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#222' },
    iconBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(45, 218, 147, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    projectTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
    projectDesc: { color: '#888', fontSize: 12 },

    footer: { marginTop: 40, alignItems: 'center', gap: 4 },
    footerText: { color: '#444', fontSize: 12 },
});
