import { BookViewer } from '@/components/BookViewer';
import { DEVELOPER_PROFILE, FAVORITE_BOOKS, PROJECTS, SHERLOCK_HOLMES_BOOKS } from '@/constants/Portfolio';
import { STATIC_BOOKS } from '@/constants/StaticBooks';
import { AppPalette } from '@/constants/theme';
import { ThemePreference, useAppTheme, useThemedStyles } from '@/context/ThemeContext';
import { formatAuthor } from '@/utils/BookFormat';
import { openAppStoreRating } from '@/utils/Ratings';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Image, Linking, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const APPEARANCE_OPTIONS: { key: ThemePreference; label: string; icon: string }[] = [
    { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
    { key: 'light', label: 'Light', icon: 'sunny-outline' },
    { key: 'dark', label: 'Dark', icon: 'moon-outline' },
];

// Resolve favorites against the catalog so each opens its real book entry.
const toShelf = (list: { id: number; title: string }[]) =>
    list
        .map(({ id, title }) => {
            const book = STATIC_BOOKS.find((b: any) => b.id === id);
            return book ? { title, book } : null;
        })
        .filter((x): x is { title: string; book: any } => !!x);

const FAVORITES = toShelf(FAVORITE_BOOKS);
const SHERLOCK = toShelf(SHERLOCK_HOLMES_BOOKS);

export default function MoreScreen() {
    const { colors, preference, setPreference } = useAppTheme();
    const styles = useThemedStyles(makeStyles);
    const [selectedBook, setSelectedBook] = useState<any>(null);

    const openLink = async (url: string) => {
        // Open in-app browser for smooth experience
        await WebBrowser.openBrowserAsync(url, {
            readerMode: false,
            toolbarColor: colors.background,
            controlsColor: colors.accentText
        });
    };

    const openExternal = (url: string) => {
        Linking.openURL(url);
    };

    const openBook = (book: any) => {
        Haptics.selectionAsync();
        setSelectedBook(book);
    };

    const renderShelf = (shelf: { title: string; book: any }[]) => (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
            {shelf.map(({ title, book }) => {
                const cover = book.formats?.['image/jpeg'];
                return (
                    <TouchableOpacity key={book.id} style={styles.favCard} onPress={() => openBook(book)} activeOpacity={0.8}>
                        {cover ? (
                            <Image source={{ uri: cover }} style={styles.favCover} resizeMode="cover" />
                        ) : (
                            <View style={[styles.favCover, styles.favPlaceholder]}>
                                <Ionicons name="book-outline" size={28} color={colors.textMuted} />
                            </View>
                        )}
                        <Text style={styles.favTitle} numberOfLines={2}>{title}</Text>
                        <Text style={styles.favAuthor} numberOfLines={1}>{formatAuthor(book)}</Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );

    return (
        <SafeAreaView style={styles.container}>
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

                {/* --- Favorite Books --- */}
                <Text style={styles.sectionTitle}>MY FAVORITE BOOKS</Text>
                {renderShelf(FAVORITES)}

                <Text style={styles.subSectionTitle}>Sherlock Holmes — every volume</Text>
                {renderShelf(SHERLOCK)}

                {/* --- Appearance --- */}
                <Text style={styles.sectionTitle}>APPEARANCE</Text>
                <View style={styles.segment}>
                    {APPEARANCE_OPTIONS.map(opt => {
                        const active = preference === opt.key;
                        return (
                            <TouchableOpacity
                                key={opt.key}
                                style={[styles.segmentItem, active && styles.segmentItemActive]}
                                onPress={() => setPreference(opt.key)}
                                accessibilityState={{ selected: active }}
                            >
                                <Ionicons name={opt.icon as any} size={16} color={active ? colors.accentText : colors.textMuted} />
                                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                <Text style={styles.hint}>
                    System follows your device&apos;s light or dark setting. Page themes and fonts for books are in the reader under “Aa”.
                </Text>

                <Text style={styles.sectionTitle}>SUPPORT THE PROJECT</Text>

            <TouchableOpacity
                style={[styles.projectCard, { borderColor: colors.accentText, marginBottom: 15 }]}
                onPress={openAppStoreRating}
                activeOpacity={0.7}
            >
                <View style={[styles.iconBox, { backgroundColor: colors.accentSoft }]}>
                    <Ionicons name="star" size={24} color={colors.accentText} />
                </View>
                <View style={{flex: 1}}>
                    <Text style={styles.projectTitle}>Rate Vellum</Text>
                    <Text style={styles.projectDesc}>
                        Love the app? Leave a review on the {Platform.OS === 'ios' ? 'App Store' : 'Play Store'}.
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
            </TouchableOpacity>

                <Text style={styles.sectionTitle}>MORE PROJECTS</Text>

                {/* --- Projects Grid --- */}
                <View style={styles.projectsList}>
                    {PROJECTS.map((project, index) => (
                        <TouchableOpacity key={index} style={styles.projectCard} onPress={() => openLink(project.url)} activeOpacity={0.7}>
                            <View style={styles.iconBox}>
                                <Ionicons name={project.icon as any} size={24} color={colors.accentText} />
                            </View>
                            <View style={{flex: 1}}>
                                <Text style={styles.projectTitle}>{project.title}</Text>
                                <Text style={styles.projectDesc}>{project.desc}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Footer Info */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Vellum v1.0.0</Text>
                    <Text style={styles.footerText}>Built with React Native & Expo</Text>
                </View>

            </ScrollView>

            <BookViewer book={selectedBook} onClose={() => setSelectedBook(null)} />
        </SafeAreaView>
    );
}

const makeStyles = (c: AppPalette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
    header: { padding: 16, paddingBottom: 8 },
    headerTitle: { fontSize: 28, fontWeight: '900', color: c.text, letterSpacing: 2 },
    content: { padding: 16, paddingBottom: 40 },

    // Profile
    profileCard: { backgroundColor: c.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: c.border, marginBottom: 32 },
    profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    avatar: { width: 60, height: 60, borderRadius: 30, marginRight: 16, backgroundColor: c.borderStrong },
    name: { color: c.text, fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
    role: { color: c.accentText, fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
    bio: { color: c.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 20 },
    linkedinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0077B5', padding: 12, borderRadius: 8 },
    linkedinText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },

    sectionTitle: { color: c.textMuted, fontSize: 12, fontWeight: 'bold', marginBottom: 16, letterSpacing: 1 },
    subSectionTitle: { color: c.textSecondary, fontSize: 14, fontWeight: '700', marginBottom: 12 },

    // Favorites
    shelf: { gap: 14, paddingBottom: 28, paddingRight: 16 },
    favCard: { width: 104 },
    favCover: { width: 104, height: 156, borderRadius: 8, backgroundColor: c.surfaceAlt, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    favPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    favTitle: { color: c.text, fontSize: 12, fontWeight: '700', lineHeight: 16 },
    favAuthor: { color: c.textMuted, fontSize: 11, marginTop: 2 },

    // Appearance
    segment: { flexDirection: 'row', backgroundColor: c.surfaceAlt, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: c.border },
    segmentItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 9 },
    segmentItemActive: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderStrong },
    segmentText: { color: c.textMuted, fontSize: 13, fontWeight: '700' },
    segmentTextActive: { color: c.text },
    hint: { color: c.textMuted, fontSize: 12, lineHeight: 18, marginTop: 10, marginBottom: 32 },

    // Projects
    projectsList: { gap: 12 },
    projectCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: c.border },
    iconBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    projectTitle: { color: c.text, fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
    projectDesc: { color: c.textMuted, fontSize: 12 },

    footer: { marginTop: 40, alignItems: 'center', gap: 4 },
    footerText: { color: c.textFaint, fontSize: 12 },
});
