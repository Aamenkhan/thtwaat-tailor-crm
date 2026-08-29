import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/theme';

export const Card: React.FC<{ children: React.ReactNode; style?: any; onPress?: () => void }> = ({ children, style, onPress }) => {
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={[styles.card, style]}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
};

export const Badge: React.FC<{ label: string; variant?: 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'slate'; style?: any }> = ({
  label,
  variant = 'slate',
  style
}) => {
  let bg = Colors.primaryLight;
  let textCol = '#FFFFFF';

  if (variant === 'success') {
    bg = Colors.successLight;
    textCol = Colors.success;
  } else if (variant === 'warning') {
    bg = Colors.warningLight;
    textCol = Colors.warning;
  } else if (variant === 'danger') {
    bg = Colors.dangerLight;
    textCol = Colors.danger;
  } else if (variant === 'info') {
    bg = Colors.infoLight;
    textCol = Colors.info;
  } else if (variant === 'purple') {
    bg = Colors.purpleLight;
    textCol = Colors.purple;
  }

  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.badgeText, { color: textCol }]}>{label}</Text>
    </View>
  );
};

export const AppButton: React.FC<{
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'accent' | 'outline' | 'danger' | 'success';
  loading?: boolean;
  disabled?: boolean;
  style?: any;
  icon?: React.ReactNode;
}> = ({ title, onPress, variant = 'primary', loading, disabled, style, icon }) => {
  let bg = Colors.primary;
  let textCol = '#FFFFFF';
  let border = 'transparent';

  if (variant === 'accent') {
    bg = Colors.accent;
  } else if (variant === 'outline') {
    bg = 'transparent';
    border = Colors.border;
    textCol = Colors.text;
  } else if (variant === 'danger') {
    bg = Colors.danger;
  } else if (variant === 'success') {
    bg = Colors.success;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        { backgroundColor: bg, borderColor: border, borderWidth: variant === 'outline' ? 1 : 0 },
        (disabled || loading) && { opacity: 0.6 },
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textCol} size="small" />
      ) : (
        <View style={styles.buttonContent}>
          {icon && <View style={{ marginRight: 8 }}>{icon}</View>}
          <Text style={[styles.buttonText, { color: textCol }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export const AppInput: React.FC<{
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: any;
  multiline?: boolean;
  numberOfLines?: number;
  style?: any;
}> = ({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, multiline, numberOfLines, style }) => {
  return (
    <View style={[styles.inputContainer, style]}>
      {label && <Text style={styles.inputLabel}>{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={numberOfLines}
        style={[
          styles.inputField,
          multiline && { height: (numberOfLines || 3) * 24, textAlignVertical: 'top' }
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start'
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600'
  },
  inputContainer: {
    marginBottom: 14
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6
  },
  inputField: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text
  }
});
