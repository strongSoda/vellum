import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const THEME = { background: '#161616', text: '#FFF', accent: '#2DDA93' };

export const ListSelectModal = ({ visible, onClose, onSelect, title, items, current }: any) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <View style={styles.box}>
        <Text style={styles.title}>{title}</Text>
        <ScrollView style={{ maxHeight: 400 }}>
          <TouchableOpacity style={styles.item} onPress={() => onSelect(null)}>
             <Text style={[styles.itemText, !current && { color: THEME.accent }]}>All / Any</Text>
          </TouchableOpacity>
          {items.map((item: any, i: number) => {
             const val = item.code || item;
             const label = item.name ? `${item.name} (${item.code})` : item;
             const isActive = current === val;
             return (
              <TouchableOpacity key={i} style={styles.item} onPress={() => onSelect(val)}>
                <Text style={[styles.itemText, isActive && { color: THEME.accent, fontWeight: 'bold' }]}>{label}</Text>
                {isActive && <Text style={{color: THEME.accent}}>✓</Text>}
              </TouchableOpacity>
             );
          })}
        </ScrollView>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}><Text style={styles.closeText}>Close</Text></TouchableOpacity>
      </View>
    </View>
  </Modal>
);

export const DateFilterModal = ({ visible, onClose, onApply }: any) => {
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.box}>
                    <Text style={styles.title}>Filter by Author Year</Text>
                    <View style={{flexDirection: 'row', gap: 10, marginBottom: 20}}>
                        <TextInput style={styles.input} placeholder="Start (e.g 1800)" placeholderTextColor="#666" keyboardType="numeric" value={start} onChangeText={setStart}/>
                        <TextInput style={styles.input} placeholder="End (e.g 1900)" placeholderTextColor="#666" keyboardType="numeric" value={end} onChangeText={setEnd}/>
                    </View>
                    <View style={{flexDirection: 'row', gap: 10}}>
                        <TouchableOpacity onPress={onClose} style={[styles.closeBtn, {flex:1, marginTop:0}]}><Text style={styles.closeText}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => {onApply(start, end); onClose();}} style={[styles.closeBtn, {flex:1, marginTop:0, backgroundColor: THEME.accent}]}><Text style={{color:'#000', fontWeight:'bold'}}>Apply</Text></TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  box: { backgroundColor: THEME.background, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#333' },
  title: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign:'center' },
  item: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#222', flexDirection: 'row', justifyContent: 'space-between' },
  itemText: { color: '#CCC', fontSize: 16 },
  closeBtn: { marginTop: 20, padding: 14, backgroundColor: '#222', borderRadius: 10, alignItems: 'center' },
  closeText: { color: '#FFF', fontWeight: '600' },
  input: { flex: 1, backgroundColor: '#000', color: '#FFF', padding: 12, borderRadius: 8, textAlign: 'center', borderWidth: 1, borderColor: '#333' }
});
