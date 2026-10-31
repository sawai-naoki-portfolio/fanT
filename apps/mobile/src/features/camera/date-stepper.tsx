import type { CalendarDate } from '@fant/filters';
import { StyleSheet, View } from 'react-native';

import { strings } from '../../i18n';
import { IconButton } from '../../ui/icon-button';
import { colors, spacing } from '../../ui/theme';
import { stepDate } from './calendar';
import { Text } from '../../ui/text';

const FIELDS = ['year', 'month', 'day'] as const;

/** Picks a fixed date for the imprint (FLM-04) with steppers that cannot produce an invalid date. */
export function DateStepper({
  date,
  onChange,
}: {
  readonly date: CalendarDate;
  readonly onChange: (date: CalendarDate) => void;
}) {
  return (
    <View style={styles.row}>
      {FIELDS.map((field) => {
        const label = strings.date.fields[field];
        return (
          <View key={field} style={styles.field}>
            <IconButton
              icon="chevron-up"
              label={strings.date.increase(label)}
              size={18}
              onPress={() => {
                onChange(stepDate(date, field, 1));
              }}
            />
            <Text style={styles.value}>{strings.date.value(date[field], label)}</Text>
            <IconButton
              icon="chevron-down"
              label={strings.date.decrease(label)}
              size={18}
              onPress={() => {
                onChange(stepDate(date, field, -1));
              }}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  field: { alignItems: 'center', gap: spacing.xs },
  value: { color: colors.text, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
