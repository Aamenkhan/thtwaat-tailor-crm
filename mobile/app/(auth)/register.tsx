import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { Colors } from '../../src/constants/theme';
import { Card, AppButton, AppInput } from '../../src/components/CommonUI';
import { Building2, ArrowLeft } from 'lucide-react-native';

export default function RegisterScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [businessType, setBusinessType] = useState<'TAILOR_SHOP' | 'GARMENT_FACTORY' | 'HYBRID'>('HYBRID');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!companyName || !ownerName || !email || !phone || !password) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/auth/register', {
        companyName,
        ownerName,
        email,
        phone,
        password,
        businessType
      });

      if (res.data && res.data.token) {
        await setAuth(res.data.token, res.data.user);
        Alert.alert('Welcome!', 'Your tailoring business workspace has been initialized.');
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      Alert.alert('Registration Failed', err.response?.data?.error || 'Unable to register company.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <ArrowLeft size={20} color="#FFFFFF" />
        <Text style={styles.backText}>Back to Sign In</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Building2 size={36} color={Colors.accent} />
        <Text style={styles.title}>Register Your Business</Text>
        <Text style={styles.subtitle}>Setup your multi-branch CRM & manufacturing workspace</Text>
      </View>

      <Card style={styles.card}>
        <AppInput
          label="Company / Boutique Name *"
          value={companyName}
          onChangeText={setCompanyName}
          placeholder="e.g. Master Fit Tailors & Co."
        />

        <AppInput
          label="Owner / Master Tailor Name *"
          value={ownerName}
          onChangeText={setOwnerName}
          placeholder="e.g. Mohd. Rizwan"
        />

        <AppInput
          label="Email Address *"
          value={email}
          onChangeText={setEmail}
          placeholder="contact@masterfit.com"
          keyboardType="email-address"
        />

        <AppInput
          label="Mobile / WhatsApp Phone *"
          value={phone}
          onChangeText={setPhone}
          placeholder="e.g. 9876543210"
          keyboardType="phone-pad"
        />

        <AppInput
          label="Create Master Password *"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
        />

        <Text style={styles.typeLabel}>Business Mode</Text>
        <View style={styles.typeRow}>
          {[
            { id: 'TAILOR_SHOP', label: 'Boutique / Shop' },
            { id: 'GARMENT_FACTORY', label: 'Factory / Unit' },
            { id: 'HYBRID', label: 'Hybrid (Both)' }
          ].map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => setBusinessType(item.id as any)}
              style={[styles.typePill, businessType === item.id && styles.typePillActive]}
            >
              <Text style={[styles.typePillText, businessType === item.id && styles.typePillTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <AppButton
          title="Create Workspace"
          onPress={handleRegister}
          loading={loading}
          variant="accent"
          style={{ marginTop: 12 }}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.primary,
    padding: 20,
    paddingTop: 50
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600'
  },
  header: {
    alignItems: 'center',
    marginBottom: 24
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 8
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 22,
    borderRadius: 16
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8
  },
  typeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16
  },
  typePill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border
  },
  typePillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted
  },
  typePillTextActive: {
    color: '#FFFFFF'
  }
});
