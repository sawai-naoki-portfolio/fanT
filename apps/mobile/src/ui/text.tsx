import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextInputProps,
  type TextProps,
} from 'react-native';

import { familyFor } from './fonts';
import { colors } from './theme';

/**
 * Text in the app's rounded font. The weight in `style` picks the font file
 * (custom fonts ignore `fontWeight` on Android), so styles stay ordinary.
 */
export function Text({ style, ...props }: TextProps) {
  const flat = StyleSheet.flatten(style);
  return (
    <NativeText
      {...props}
      style={[
        styles.base,
        flat,
        { fontFamily: familyFor(flat?.fontWeight), fontWeight: undefined },
      ]}
    />
  );
}

export function TextInput({ style, ...props }: TextInputProps) {
  const flat = StyleSheet.flatten(style);
  return (
    <NativeTextInput
      placeholderTextColor={colors.textMuted}
      {...props}
      style={[
        styles.base,
        flat,
        { fontFamily: familyFor(flat?.fontWeight), fontWeight: undefined },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { color: colors.text },
});
