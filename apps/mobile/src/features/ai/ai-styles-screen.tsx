import { AI_TOOLS, type AiTool } from '@fant/api-types';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { localized, strings } from '../../i18n';
import { Button } from '../../ui/button';
import { ScreenHeader } from '../../ui/screen-header';
import { Bouncy } from '../../ui/bouncy';
import { colors, radius, softShadow, spacing } from '../../ui/theme';
import { useContent } from '../content/content-store';
import { available } from '../content/lookup';
import { useSettings } from '../settings/settings-store';
import { useAi } from './ai-store';
import { AI_CONSENT_VERSION } from './consent';
import { Text } from '../../ui/text';

/** Consent before the first generation (S-42, AI-03). */
function ConsentModal({
  visible,
  onAgree,
  onClose,
}: {
  readonly visible: boolean;
  readonly onAgree: () => void;
  readonly onClose: () => void;
}) {
  const { consent } = strings.ai;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.dialog}>
          <Text accessibilityRole="header" style={styles.title}>
            {consent.title}
          </Text>
          {consent.body.map((line) => (
            <Text key={line} style={styles.body}>
              ・{line}
            </Text>
          ))}
          <Button label={consent.agree} onPress={onAgree} />
          <Button label={strings.common.cancel} variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

/** Where each tool goes: masked tools first ask what to change (AI-10/11/13). */
function toolDestination(tool: AiTool, uri: string): Href {
  switch (tool) {
    case 'erase':
      return { pathname: '/ai/erase', params: { uri } };
    case 'expand':
      return { pathname: '/ai/expand', params: { uri } };
    case 'upscale':
    case 'animate':
      return { pathname: '/ai/generate', params: { uri, styleId: tool } };
  }
}

const TOOL_ICONS: Record<AiTool, string> = {
  erase: '🧽',
  expand: '🖼️',
  upscale: '🔍',
  animate: '🎞️',
};

/** Styles and tools, their price and the balance (S-41, AI-02/07/10/11). */
export function AiStylesScreen({ sourceUri }: { readonly sourceUri: string }) {
  const aiStyles = available(useContent((state) => state.manifest).aiStyles);
  const credits = useAi((state) => state.credits);
  const consentVersion = useSettings((state) => state.aiConsentVersion);
  const { bottom } = useSafeAreaInsets();
  const [pending, setPending] = useState<Href | null>(null);

  useEffect(() => {
    void useAi.getState().refreshCredits();
  }, []);

  /** Asks for consent and checks the balance before going on to `destination`. */
  const start = (destination: Href, cost: number) => {
    if (consentVersion !== AI_CONSENT_VERSION) {
      setPending(destination);
      return;
    }
    if (credits !== null && credits.total < cost) {
      router.push('/credits');
      return;
    }
    router.push(destination);
  };
  const generate = (styleId: string, cost: number) => {
    start({ pathname: '/ai/generate', params: { uri: sourceUri, styleId } }, cost);
  };

  const tools = (
    <View style={styles.tools}>
      {(Object.keys(AI_TOOLS) as AiTool[]).map((tool) => (
        <Bouncy
          key={tool}
          accessibilityRole="button"
          squash={0.96}
          accessibilityLabel={strings.common.list([
            strings.ai.tools[tool].name,
            strings.ai.cost(AI_TOOLS[tool].credits),
          ])}
          accessibilityHint={strings.ai.tools[tool].description}
          style={[styles.card, styles.tool]}
          onPress={() => {
            start(toolDestination(tool, sourceUri), AI_TOOLS[tool].credits);
          }}
        >
          <Text style={styles.toolIcon}>{TOOL_ICONS[tool]}</Text>
          <Text style={styles.name}>{strings.ai.tools[tool].name}</Text>
          <Text style={styles.description}>{strings.ai.tools[tool].description}</Text>
          <Text style={styles.cost}>{strings.ai.cost(AI_TOOLS[tool].credits)}</Text>
        </Bouncy>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { paddingBottom: bottom }]}>
      <ScreenHeader
        title={strings.ai.chooseStyle}
        actions={
          <Bouncy
            accessibilityRole="button"
            style={styles.balance}
            onPress={() => {
              router.push('/credits');
            }}
          >
            <Text style={styles.balanceText}>
              {credits === null ? '…' : strings.ai.credits(credits.total)}
            </Text>
          </Bouncy>
        }
      />
      <FlatList
        data={aiStyles}
        keyExtractor={(style) => style.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={tools}
        renderItem={({ item }) => (
          <Bouncy
            accessibilityRole="button"
            squash={0.96}
            accessibilityLabel={strings.common.list([
              localized(item.name),
              strings.ai.cost(item.credits),
            ])}
            accessibilityHint={localized(item.description)}
            style={styles.card}
            onPress={() => {
              generate(item.id, item.credits);
            }}
          >
            <Text style={styles.name}>{localized(item.name)}</Text>
            <Text style={styles.description}>{localized(item.description)}</Text>
            <Text style={styles.cost}>{strings.ai.cost(item.credits)}</Text>
          </Bouncy>
        )}
      />
      <ConsentModal
        visible={pending !== null}
        onClose={() => {
          setPending(null);
        }}
        onAgree={() => {
          useSettings.getState().update({ aiConsentVersion: AI_CONSENT_VERSION });
          const destination = pending;
          setPending(null);
          if (destination !== null) router.push(destination);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  balance: {
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.lavenderSoft,
  },
  balanceText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  list: { gap: spacing.md, padding: spacing.md },
  tools: { flexDirection: 'row', gap: spacing.md },
  tool: { flex: 1 },
  toolIcon: { fontSize: 28 },
  card: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...softShadow,
  },
  name: { color: colors.text, fontSize: 18, fontWeight: '800' },
  description: { color: colors.textMuted, fontSize: 14 },
  cost: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    overflow: 'hidden',
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
    backgroundColor: colors.accentSoft,
  },
  scrim: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.scrim },
  dialog: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  body: { color: colors.text, fontSize: 14, lineHeight: 21 },
});
