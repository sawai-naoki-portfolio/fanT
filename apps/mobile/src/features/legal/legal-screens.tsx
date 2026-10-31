import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '../../i18n';
import { ScreenHeader } from '../../ui/screen-header';
import { colors, spacing } from '../../ui/theme';
import { LinkRow, Section } from '../settings/settings-rows';
import { LEGAL_DOCUMENTS, type LegalDocument } from './documents';
import { Text } from '../../ui/text';

/** The legal documents (S-71, SET-02). */
export function LegalListScreen() {
  return (
    <View style={styles.container}>
      <ScreenHeader title={strings.legal.title} />
      <View style={styles.content}>
        <Section title={strings.legal.title}>
          {(Object.keys(LEGAL_DOCUMENTS) as LegalDocument[]).map((doc) => (
            <LinkRow
              key={doc}
              label={LEGAL_DOCUMENTS[doc].title}
              onPress={() => {
                router.push({ pathname: '/settings/legal/[doc]', params: { doc } });
              }}
            />
          ))}
        </Section>
      </View>
    </View>
  );
}

export function LegalDocumentScreen({ doc }: { readonly doc: LegalDocument }) {
  const { bottom } = useSafeAreaInsets();
  const { title, body } = LEGAL_DOCUMENTS[doc];
  return (
    <View style={styles.container}>
      <ScreenHeader title={title} />
      <ScrollView contentContainerStyle={[styles.document, { paddingBottom: bottom + spacing.lg }]}>
        <Text selectable style={styles.body}>
          {body}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  document: { padding: spacing.md },
  body: { color: colors.text, fontSize: 14, lineHeight: 22 },
});
