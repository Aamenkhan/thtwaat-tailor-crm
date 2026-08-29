import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/api/client';
import { Colors } from '../../src/constants/theme';
import { Card, Badge, AppButton, AppInput } from '../../src/components/CommonUI';
import {
  Scissors,
  User,
  Check,
  MessageCircle,
  Sparkles,
  Layers
} from 'lucide-react-native';

export default function MeasurementsScreen() {
  const queryClient = useQueryClient();

  const [selectedGender, setSelectedGender] = useState<'MEN' | 'WOMEN' | 'KIDS'>('MEN');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [unit, setUnit] = useState<'INCH' | 'CM'>('INCH');
  const [measurementValues, setMeasurementValues] = useState<Record<string, string>>({});
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Fetch Templates
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['measurement-templates', selectedGender],
    queryFn: async () => {
      const res = await api.get('/measurements/templates', { params: { gender: selectedGender } });
      return res.data.data;
    }
  });

  // Fetch Customers
  const { data: customersData } = useQuery({
    queryKey: ['customers-list'],
    queryFn: async () => {
      const res = await api.get('/customers');
      return res.data.data;
    }
  });

  // Save Measurement Mutation
  const saveMeasurementMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/measurements', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      Alert.alert(
        'Measurement Saved!',
        `Saved version ${data.measurement?.version} for ${selectedCustomer?.name}. Would you like to share via WhatsApp?`,
        [
          { text: 'Done', style: 'cancel' },
          {
            text: 'Share WhatsApp',
            onPress: () => {
              if (selectedCustomer?.phone) {
                let clean = selectedCustomer.phone.replace(/[^0-9]/g, '');
                if (clean.length === 10) clean = '91' + clean;
                const body = Object.entries(measurementValues)
                  .map(([k, v]) => `• ${k.toUpperCase()}: ${v} ${unit}`)
                  .join('\n');
                const msg = encodeURIComponent(
                  `✂️ *Measurement Record - ${title}*\nCustomer: ${selectedCustomer.name}\n${body}\nFit instructions: ${specialInstructions || 'Standard'}`
                );
                Linking.openURL(`https://wa.me/${clean}?text=${msg}`);
              }
            }
          }
        ]
      );
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error || 'Failed to save measurements');
    }
  });

  const handleSelectTemplate = (template: any) => {
    setSelectedTemplate(template);
    setTitle(template.name);
    const initial: Record<string, string> = {};
    template.fields?.forEach((f: any) => {
      initial[f.key] = f.placeholder || '';
    });
    setMeasurementValues(initial);
  };

  const handleSave = () => {
    if (!selectedCustomer) {
      Alert.alert('Required', 'Please select a customer first');
      return;
    }
    if (!title) {
      Alert.alert('Required', 'Please enter a measurement title');
      return;
    }

    saveMeasurementMutation.mutate({
      customerId: selectedCustomer.id,
      templateId: selectedTemplate?.id || null,
      title,
      gender: selectedGender,
      unit,
      values: measurementValues,
      specialInstructions
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. Customer Selection */}
      <Text style={styles.stepTitle}>1. Select Customer</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.custScroll}>
        {customersData?.map((cust: any) => (
          <TouchableOpacity
            key={cust.id}
            onPress={() => setSelectedCustomer(cust)}
            style={[
              styles.custChip,
              selectedCustomer?.id === cust.id && styles.custChipActive
            ]}
          >
            <User size={14} color={selectedCustomer?.id === cust.id ? '#FFF' : Colors.text} />
            <Text
              style={[
                styles.custChipText,
                selectedCustomer?.id === cust.id && styles.custChipTextActive
              ]}
            >
              {cust.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 2. Gender & Garment Template Selection */}
      <Text style={styles.stepTitle}>2. Garment Fitting Template</Text>
      <View style={styles.genderRow}>
        {['MEN', 'WOMEN', 'KIDS'].map((g) => (
          <TouchableOpacity
            key={g}
            onPress={() => {
              setSelectedGender(g as any);
              setSelectedTemplate(null);
            }}
            style={[styles.genderPill, selectedGender === g && styles.genderPillActive]}
          >
            <Text style={[styles.genderPillText, selectedGender === g && styles.genderPillTextActive]}>
              {g}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll}>
        {templatesData?.map((tpl: any) => (
          <TouchableOpacity
            key={tpl.id}
            onPress={() => handleSelectTemplate(tpl)}
            style={[
              styles.templateCard,
              selectedTemplate?.id === tpl.id && styles.templateCardActive
            ]}
          >
            <Scissors size={18} color={selectedTemplate?.id === tpl.id ? Colors.accent : Colors.textMuted} />
            <Text
              style={[
                styles.templateName,
                selectedTemplate?.id === tpl.id && styles.templateNameActive
              ]}
            >
              {tpl.name}
            </Text>
            <Text style={styles.templateCategory}>{tpl.category}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 3. Measurement Parameters Form */}
      <Card style={styles.formCard}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Body Measurements</Text>
          <View style={styles.unitToggle}>
            {['INCH', 'CM'].map((u) => (
              <TouchableOpacity
                key={u}
                onPress={() => setUnit(u as any)}
                style={[styles.unitBtn, unit === u && styles.unitBtnActive]}
              >
                <Text style={[styles.unitBtnText, unit === u && styles.unitBtnTextActive]}>
                  {u}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <AppInput
          label="Fitting Profile Title *"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Formal Suit, Designer Sherwani"
        />

        {/* Dynamic Measurement Grid */}
        <View style={styles.grid}>
          {selectedTemplate ? (
            selectedTemplate.fields?.map((f: any) => (
              <View key={f.key} style={styles.gridCol}>
                <AppInput
                  label={`${f.label} (${unit.toLowerCase()})`}
                  value={measurementValues[f.key] || ''}
                  onChangeText={(val) =>
                    setMeasurementValues((prev) => ({ ...prev, [f.key]: val }))
                  }
                  placeholder={f.placeholder || '0.0'}
                  keyboardType="numeric"
                />
              </View>
            ))
          ) : (
            <>
              {['Chest', 'Waist', 'Hip', 'Shoulder', 'Sleeve Length', 'Full Length'].map((item) => {
                const k = item.toLowerCase().replace(/ /g, '_');
                return (
                  <View key={k} style={styles.gridCol}>
                    <AppInput
                      label={`${item} (${unit.toLowerCase()})`}
                      value={measurementValues[k] || ''}
                      onChangeText={(val) =>
                        setMeasurementValues((prev) => ({ ...prev, [k]: val }))
                      }
                      placeholder="0.0"
                      keyboardType="numeric"
                    />
                  </View>
                );
              })}
            </>
          )}
        </View>

        <AppInput
          label="Fit Preference & Posture Notes"
          value={specialInstructions}
          onChangeText={setSpecialInstructions}
          placeholder="e.g. Sloping shoulders, loose fit waist, high armhole"
          multiline
          numberOfLines={2}
        />

        <AppButton
          title="Save to Customer Profile"
          onPress={handleSave}
          loading={saveMeasurementMutation.isPending}
          variant="accent"
          style={{ marginTop: 10 }}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  custScroll: {
    marginBottom: 16
  },
  custChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8
  },
  custChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary
  },
  custChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text
  },
  custChipTextActive: {
    color: '#FFFFFF'
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10
  },
  genderPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border
  },
  genderPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary
  },
  genderPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted
  },
  genderPillTextActive: {
    color: '#FFFFFF'
  },
  templateScroll: {
    marginBottom: 16
  },
  templateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginRight: 10,
    width: 140
  },
  templateCardActive: {
    borderColor: Colors.accent,
    backgroundColor: '#FFFBEB'
  },
  templateName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 6
  },
  templateNameActive: {
    color: Colors.accent
  },
  templateCategory: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  formCard: {
    padding: 16
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    padding: 2
  },
  unitBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  unitBtnActive: {
    backgroundColor: Colors.primary
  },
  unitBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted
  },
  unitBtnTextActive: {
    color: '#FFFFFF'
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  gridCol: {
    width: '48%'
  }
});
