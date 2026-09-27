import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  return (
    <FlatList
      data={entries}
      keyExtractor={(e) => e.id}
      contentContainerStyle={[styles.list, entries.length === 0 && { flexGrow: 1 }]}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📔</Text>
          <Text style={styles.emptyTitle}>{t('entries.emptyTitle')}</Text>
          <Text style={styles.emptyText}>{t('entries.emptyBody')}</Text>
        </View>
      }
      renderItem={({ item }) => <EntryCard entry={item} onPress={() => onOpen(item)} />}
    />
  );
}

const useStyles = makeStyles(({ colors, fonts }) =>
  StyleSheet.create({
    list: { padding: 16, paddingBottom: 110 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyEmoji: { fontSize: 56, marginBottom: 12 },
    emptyTitle: { ...fonts.uiBold, fontSize: 20, color: colors.ink },
    emptyText: { ...fonts.ui, marginTop: 6, fontSize: 15, color: colors.muted, textAlign: 'center' },
  }),
);
