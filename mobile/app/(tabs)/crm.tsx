import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Linking,
  ActivityIndicator
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api, API_BASE_URL } from '../../src/api/client';
import { Colors } from '../../src/constants/theme';
import { Card, Badge, AppButton, AppInput } from '../../src/components/CommonUI';
import {
  Users,
  Search,
  Plus,
  Phone,
  MessageCircle,
  Scissors,
  X,
  Tag,
  Building,
  ChevronRight,
  Download,
  UploadCloud,
  FileSpreadsheet
} from 'lucide-react-native';

export default function CRMScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [modalVisible, setModalVisible] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [customerType, setCustomerType] = useState<'INDIVIDUAL' | 'TAILOR_CUSTOMER' | 'BOUTIQUE' | 'BRAND'>('INDIVIDUAL');
  const [notes, setNotes] = useState('');

  // Fetch Customers
  const { data: customersData, isLoading, refetch } = useQuery({
    queryKey: ['customers', selectedType, search],
    queryFn: async () => {
      const params: any = {};
      if (selectedType !== 'ALL') params.type = selectedType;
      if (search) params.search = search;
      const res = await api.get('/customers', { params });
      return res.data.data;
    }
  });

  // Create Customer Mutation
  const createCustomerMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/customers', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setModalVisible(false);
      Alert.alert('Customer Added', 'New customer profile created successfully!');
      // Reset form
      setName('');
      setBusinessName('');
      setPhone('');
      setWhatsapp('');
      setAddress('');
      setNotes('');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error || 'Failed to save customer');
    }
  });

  const handleSaveCustomer = () => {
    if (!name || !phone) {
      Alert.alert('Required', 'Please enter customer name and phone number');
      return;
    }

    createCustomerMutation.mutate({
      name,
      businessName: businessName || null,
      phone,
      whatsapp: whatsapp || phone,
      email: email || null,
      address: address || null,
      customerType,
      notes: notes || null,
      tags: [customerType]
    });
  };

  const handleOpenWhatsApp = (custPhone: string, custName: string) => {
    let clean = custPhone.replace(/[^0-9]/g, '');
    if (clean.length === 10) clean = '91' + clean;
    const msg = encodeURIComponent(`Namaste ${custName} ji, greetings from our boutique!`);
    Linking.openURL(`https://wa.me/${clean}?text=${msg}`);
  };

  const handleCall = (custPhone: string) => {
    Linking.openURL(`tel:${custPhone}`);
  };

  return (
    <View style={styles.container}>
      {/* Search & Header */}
      <View style={styles.topActions}>
        <View style={styles.searchBox}>
          <Search size={18} color={Colors.textMuted} />
          <AppInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search customers by name, phone..."
            style={styles.searchInput}
          />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Plus size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Quick Bulk Import / Export Bar */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 10 }}>
        <TouchableOpacity
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 7,
            backgroundColor: '#EFF6FF',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#BFDBFE'
          }}
          onPress={() => router.push('/imports' as any)}
        >
          <UploadCloud size={14} color={Colors.accent} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.accent }}>Import Excel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 7,
            backgroundColor: '#F8FAFC',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: Colors.border
          }}
          onPress={() => Linking.openURL(`${API_BASE_URL}/exports/customers`)}
        >
          <Download size={14} color={Colors.text} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.text }}>Export Excel</Text>
        </TouchableOpacity>
      </View>

      {/* Customer Type Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {['ALL', 'INDIVIDUAL', 'BOUTIQUE', 'BRAND', 'WHOLESALE'].map((type) => (
          <TouchableOpacity
            key={type}
            onPress={() => setSelectedType(type)}
            style={[styles.filterChip, selectedType === type && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, selectedType === type && styles.filterChipTextActive]}>
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Customer Directory List */}
      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={customersData || []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card style={styles.customerCard}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.custName}>{item.name}</Text>
                  {item.businessName && (
                    <Text style={styles.businessName}>{item.businessName}</Text>
                  )}
                  <Text style={styles.phoneText}>📞 {item.phone}</Text>
                </View>

                <Badge label={item.customerType} variant="purple" />
              </View>

              {item.notes && (
                <Text style={styles.custNotes} numberOfLines={1}>
                  Note: {item.notes}
                </Text>
              )}

              {/* Quick Actions Row */}
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#DCFCE7' }]}
                  onPress={() => handleOpenWhatsApp(item.whatsapp || item.phone, item.name)}
                >
                  <MessageCircle size={15} color={Colors.success} />
                  <Text style={[styles.actionBtnText, { color: Colors.success }]}>WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#DBEAFE' }]}
                  onPress={() => handleCall(item.phone)}
                >
                  <Phone size={15} color={Colors.info} />
                  <Text style={[styles.actionBtnText, { color: Colors.info }]}>Call</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#FEF3C7' }]}
                  onPress={() => router.push(`/measurements`)}
                >
                  <Scissors size={15} color={Colors.accent} />
                  <Text style={[styles.actionBtnText, { color: Colors.accent }]}>
                    {item._count?.measurements || 0} Fits
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Users size={44} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No customers found</Text>
              <Text style={styles.emptySub}>Add customer profiles to maintain measurements & orders</Text>
            </View>
          }
        />
      )}

      {/* Add Customer Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Customer Profile</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <AppInput
                label="Full Name *"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Vikramaditya Singhania"
              />

              <AppInput
                label="Business / Brand Name (Optional)"
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="e.g. Singhania Haute Couture"
              />

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <AppInput
                    label="Mobile Phone *"
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="9876543210"
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <AppInput
                    label="WhatsApp No."
                    value={whatsapp}
                    onChangeText={setWhatsapp}
                    placeholder="9876543210"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <AppInput
                label="Email Address"
                value={email}
                onChangeText={setEmail}
                placeholder="vikram@singhania.com"
                keyboardType="email-address"
              />

              <AppInput
                label="Delivery Address"
                value={address}
                onChangeText={setAddress}
                placeholder="Apartment, Street, City..."
              />

              <Text style={styles.inputLabel}>Customer Type</Text>
              <View style={styles.typeRow}>
                {[
                  { id: 'INDIVIDUAL', label: 'Individual' },
                  { id: 'BOUTIQUE', label: 'Boutique' },
                  { id: 'BRAND', label: 'Brand' }
                ].map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setCustomerType(item.id as any)}
                    style={[styles.typePill, customerType === item.id && styles.typePillActive]}
                  >
                    <Text style={[styles.typePillText, customerType === item.id && styles.typePillTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <AppInput
                label="Preferences & Special Fit Notes"
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. Likes extra shoulder room, prefers linen and silks"
                multiline
                numberOfLines={2}
              />

              <AppButton
                title="Save Customer Profile"
                onPress={handleSaveCustomer}
                loading={createCustomerMutation.isPending}
                variant="accent"
                style={{ marginVertical: 16 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 46
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
    marginLeft: 6
  },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterScroll: {
    maxHeight: 38,
    marginBottom: 10
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted
  },
  filterChipTextActive: {
    color: '#FFFFFF'
  },
  listContent: {
    padding: 16,
    paddingTop: 6
  },
  customerCard: {
    padding: 14,
    marginBottom: 10
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6
  },
  custName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text
  },
  businessName: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '600',
    marginTop: 1
  },
  phoneText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4
  },
  custNotes: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    marginBottom: 10
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700'
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 12
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    padding: 20
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text
  },
  modalBody: {
    paddingBottom: 20
  },
  formRow: {
    flexDirection: 'row',
    gap: 10
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6
  },
  typeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14
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
