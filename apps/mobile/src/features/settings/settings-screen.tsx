import { router } from 'expo-router';
import { Linking, Platform, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APP_CONFIG } from '../../config';
import { strings } from '../../i18n';
import { showError, showMessage } from '../../ui/dialogs';
import { ScreenHeader } from '../../ui/screen-header';
import { colors, spacing } from '../../ui/theme';
import { applyOriginalRetention } from '../album/album-db';
import { reportError } from '../analytics/analytics';
import { restorePurchases, usePremium } from '../purchases/purchases-store';
import { ChoiceRow, InfoRow, LinkRow, Section, SwitchRow } from './settings-rows';
import { EXPORT_SIZES, RETENTION_CHOICES, useSettings, WINK_ACTIONS } from './settings-store';

/** Settings (S-70, SET-01/03/04, GST-03). */
export function SettingsScreen() {
  const settings = useSettings();
  const premium = usePremium();
  const { bottom } = useSafeAreaInsets();
  const { update } = settings;

  const restore = async () => {
    try {
      showMessage(
        (await restorePurchases()) ? strings.paywall.restored : strings.paywall.nothingToRestore,
      );
    } catch (error) {
      reportError(error, 'settings.restore');
      showError();
    }
  };

  const contact = () => {
    const { supportEmail } = APP_CONFIG;
    if (supportEmail === null) return;
    // Device details help with support; nothing personal is included.
    const body = `\n\n---\nfanT ${APP_CONFIG.appVersion} / ${Platform.OS} ${String(Platform.Version)}`;
    void Linking.openURL(
      `mailto:${supportEmail}?subject=${encodeURIComponent(strings.settings.contactSubject)}&body=${encodeURIComponent(body)}`,
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: bottom + spacing.lg }]}
    >
      <ScreenHeader title={strings.settings.title} />
      <Section title={strings.settings.sections.camera}>
        <SwitchRow
          label={strings.settings.tapToShoot}
          value={settings.tapToShoot}
          onChange={(tapToShoot) => {
            update({ tapToShoot });
          }}
        />
        <SwitchRow
          label={strings.settings.shutterFeedback}
          value={settings.shutterFeedback}
          onChange={(shutterFeedback) => {
            update({ shutterFeedback });
          }}
        />
      </Section>
      <Section title={strings.settings.sections.saving}>
        <ChoiceRow
          label={strings.settings.saveSize}
          options={EXPORT_SIZES}
          value={settings.saveSize}
          format={(size) => strings.photo.saveSize[size]}
          onChange={(saveSize) => {
            update({ saveSize });
          }}
        />
        <InfoRow label={strings.settings.location} value={strings.settings.locationValue} />
        <ChoiceRow
          label={strings.settings.retention}
          options={RETENTION_CHOICES}
          value={settings.originalRetentionDays}
          format={strings.settings.retentionValue}
          onChange={(originalRetentionDays) => {
            update({ originalRetentionDays });
            applyOriginalRetention(originalRetentionDays);
          }}
        />
      </Section>
      <Section title={strings.settings.sections.gestures}>
        <SwitchRow
          label={strings.settings.winkEnabled}
          value={settings.winkGestures.enabled}
          onChange={(enabled) => {
            update({ winkGestures: { ...settings.winkGestures, enabled } });
          }}
        />
        {settings.winkGestures.enabled &&
          (['rightEye', 'leftEye'] as const).map((eye) => (
            <ChoiceRow
              key={eye}
              label={strings.settings[eye]}
              options={WINK_ACTIONS}
              value={settings.winkGestures[eye]}
              format={(action) => strings.settings.winkActions[action]}
              onChange={(action) => {
                update({ winkGestures: { ...settings.winkGestures, [eye]: action } });
              }}
            />
          ))}
      </Section>
      <Section title={strings.settings.sections.purchases}>
        <LinkRow
          label={strings.settings.premium}
          value={premium ? strings.settings.premiumActive : undefined}
          onPress={() => {
            router.push({ pathname: '/paywall', params: { trigger: 'settings' } });
          }}
        />
        {APP_CONFIG.apiBaseUrl !== null && (
          <LinkRow
            label={strings.settings.credits}
            onPress={() => {
              router.push('/credits');
            }}
          />
        )}
        <LinkRow label={strings.settings.restore} onPress={() => void restore()} />
      </Section>
      <Section title={strings.settings.sections.about}>
        {APP_CONFIG.supportEmail !== null && (
          <LinkRow label={strings.settings.contact} onPress={contact} />
        )}
        <LinkRow
          label={strings.settings.legal}
          onPress={() => {
            router.push('/settings/legal');
          }}
        />
        <InfoRow label={strings.settings.version} value={APP_CONFIG.appVersion} />
      </Section>
      {APP_CONFIG.isInternalBuild && (
        <Section title={strings.settings.sections.developer}>
          <SwitchRow
            label={strings.settings.developerPremium}
            value={settings.developerPremium}
            onChange={(developerPremium) => {
              update({ developerPremium });
            }}
          />
          <SwitchRow
            label={strings.settings.performance}
            value={settings.performanceOverlay}
            onChange={(performanceOverlay) => {
              update({ performanceOverlay });
            }}
          />
        </Section>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.lg, paddingHorizontal: spacing.md },
});
