import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { Colors } from '../../src/constants/theme';
import { Card, AppButton, AppInput } from '../../src/components/CommonUI';
import { Scissors, Factory, Sparkles, LogIn } from 'lucide-react-native';

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [identifier, setIdentifier] = useState('owner@royalstitch.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (loginEmail?: string, loginPass?: string) => {
    const id = loginEmail || identifier;
    const pwd = loginPass || password;

    if (!id || !pwd) {
      Alert.alert('Error', 'Please enter email/phone and password');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/auth/login', { identifier: id, password: pwd });
      if (res.data && res.data.token) {
        await setAuth(res.data.token, res.data.user);
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      Alert.alert('Login Failed', err.response?.data?.error || 'Unable to connect to server. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Scissors size={32} color={Colors.accent} />
        </View>
        <Text style={styles.title}>THTWAAT CRM</Text>
        <Text style={styles.subtitle}>Bespoke Tailor & Garment Manufacturing SaaS</Text>
      </View>

      <Card style={styles.authCard}>
        <Text style={styles.cardHeader}>Sign In to Workspace</Text>

        <AppInput
          label="Email or Phone"
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="e.g. owner@royalstitch.com"
          keyboardType="email-address"
        />

        <AppInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
        />

        <AppButton
          title="Sign In"
          onPress={() => handleLogin()}
          loading={loading}
          icon={<LogIn size={18} color="#FFF" />}
          style={{ marginTop: 8 }}
        />

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>QUICK DEMO LOGINS</Text>
          <View style={styles.line} />
        </View>

        <View style={styles.demoButtonsRow}>
          <TouchableOpacity
            style={styles.demoBtn}
            onPress={() => {
              setIdentifier('owner@royalstitch.com');
              setPassword('password123');
              handleLogin('owner@royalstitch.com', 'password123');
            }}
          >
            <Sparkles size={16} color={Colors.accent} />
            <Text style={styles.demoBtnText}>👑 Owner / Boutique</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.demoBtn}
            onPress={() => {
              setIdentifier('production@royalstitch.com');
              setPassword('password123');
              handleLogin('production@royalstitch.com', 'password123');
            }}
          >
            <Factory size={16} color={Colors.info} />
            <Text style={styles.demoBtnText}>🏭 Factory Manager</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => router.push('/(auth)/register')}
        >
          <Text style={styles.registerText}>
            New business? <Text style={{ color: Colors.accent, fontWeight: '700' }}>Register New Company</Text>
          </Text>
        </TouchableOpacity>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.primary,
    padding: 20,
    justifyContent: 'center'
  },
  header: {
    alignItems: 'center',
    marginBottom: 28
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center'
  },
  authCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 18
  },
  cardHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 18
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    marginHorizontal: 10
  },
  demoButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12
  },
  demoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border
  },
  demoBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text
  },
  registerLink: {
    marginTop: 16,
    alignItems: 'center'
  },
  registerText: {
    fontSize: 13,
    color: Colors.textMuted
  }
});
