import { ReactElement } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import EntryCard from '../components/EntryCard';
import { makeStyles } from '../theme';
import { Entry } from '../types';

export default function EntryListScreen({
  entries,
  onOpen,
  header,
}: {
  entries: Entry[];
  onOpen: (e: Entry) => void;
  /** Shown above the list — the "On this day" memories and letter banner. */
  header?: ReactElement;
}) {
  const styles = useStyles();
  return (
    <FlatList
      data={entries}
      keyExtractor={(e) => e.id}
      contentContainerStyle={[styles.list, entries.length === 0 && { flexGrow: 1 }]}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📔</Text>
          <Text style={styles.emptyTitle}>Your diary is empty</Text>
          <Text style={styles.emptyText}>Tap the + button to write your first entry.</Text>
        </View>
      }
      renderItem={({ item }) => <EntryCard entry={item} onPress={() => onOpen(item)} />}
    />
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    list: { padding: 16, paddingBottom: 110 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyEmoji: { fontSize: 56, marginBottom: 12 },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.ink },
    emptyText: { marginTop: 6, fontSize: 15, color: colors.muted, textAlign: 'center' },
  }),
);
