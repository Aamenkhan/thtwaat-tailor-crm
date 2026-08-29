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
  ActivityIndicator,
  Linking
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api, API_BASE_URL } from '../../src/api/client';
import { Colors } from '../../src/constants/theme';
import { Card, Badge, AppButton, AppInput } from '../../src/components/CommonUI';
import {
  Plus,
  Search,
  Calendar,
  DollarSign,
  ChevronRight,
  Sparkles,
  X,
  User,
  Scissors,
  Download
} from 'lucide-react-native';

export default function OrdersScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [modalVisible, setModalVisible] = useState(false);

  // New Order Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [itemName, setItemName] = useState('');
  const [gender, setGender] = useState<'MEN' | 'WOMEN' | 'KIDS'>('MEN');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('1500');
  const [deliveryDays, setDeliveryDays] = useState('5');
  const [trialDays, setTrialDays] = useState('3');
  const [advancePaid, setAdvancePaid] = useState('500');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CREDIT_CARD'>('UPI');
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [notes, setNotes] = useState('');

  // Fetch Orders
  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ['orders', selectedStatus, selectedType, search],
    queryFn: async () => {
      const params: any = {};
      if (selectedStatus !== 'ALL') params.status = selectedStatus;
      if (selectedType !== 'ALL') params.type = selectedType;
      if (search) params.search = search;
      const res = await api.get('/orders', { params });
      return res.data.data;
    }
  });

  // Fetch Customers for order dropdown
  const { data: customersData } = useQuery({
    queryKey: ['customers-list'],
    queryFn: async () => {
      const res = await api.get('/customers');
      return res.data.data;
    }
  });

  // Create Order Mutation
  const createOrderMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/orders', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setModalVisible(false);
      Alert.alert('Order Created', `Order ${data.order?.orderNumber} has been generated!`);
      // Reset form
      setItemName('');
      setNotes('');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error || 'Failed to create order');
    }
  });

  const handleCreateOrder = () => {
    if (!selectedCustomerId) {
      Alert.alert('Required', 'Please select a customer');
      return;
    }
    if (!itemName) {
      Alert.alert('Required', 'Please enter garment item name');
      return;
    }

    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + parseInt(deliveryDays || '5', 10));

    const trialDate = new Date();
    trialDate.setDate(trialDate.getDate() + parseInt(trialDays || '3', 10));

    const payload = {
      customerId: selectedCustomerId,
      orderType: 'BESPOKE_TAILORING',
      priority,
      deliveryDate: deliveryDate.toISOString(),
      trialDate: trialDate.toISOString(),
      discount: 0,
      taxRate: 5,
      advancePaid: parseFloat(advancePaid || '0'),
      paymentMethod,
      notes,
      items: [
        {
          customItemName: itemName,
          itemType: 'BESPOKE_TAILORING',
          gender,
          quantity: parseInt(quantity || '1', 10),
          unitPrice: parseFloat(unitPrice || '0'),
          fabricProvidedByCustomer: false
        }
      ]
    };

    createOrderMutation.mutate(payload);
  };

  const getStatusVariant = (st: string) => {
    switch (st) {
      case 'CONFIRMED': return 'info';
      case 'IN_CUTTING': return 'purple';
      case 'IN_STITCHING': return 'warning';
      case 'TRIAL_READY': return 'accent';
      case 'READY_FOR_PICKUP': return 'success';
      case 'DELIVERED': return 'success';
      default: return 'slate';
    }
  };

  return (
    <View style={styles.container}>
      {/* Search & Action Bar */}
      <View style={styles.topActions}>
        <View style={styles.searchBox}>
          <Search size={18} color={Colors.textMuted} />
          <AppInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search order no, customer, phone..."
            style={styles.searchInput}
          />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Plus size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Quick Export Bar */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 10 }}>
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
          onPress={() => Linking.openURL(`${API_BASE_URL}/exports/orders`)}
        >
          <Download size={14} color={Colors.text} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.text }}>Export Orders Excel (.xlsx)</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {['ALL', 'CONFIRMED', 'IN_CUTTING', 'IN_STITCHING', 'TRIAL_READY', 'READY_FOR_PICKUP', 'DELIVERED'].map((st) => (
          <TouchableOpacity
            key={st}
            onPress={() => setSelectedStatus(st)}
            style={[styles.filterChip, selectedStatus === st && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, selectedStatus === st && styles.filterChipTextActive]}>
              {st.replace(/_/g, ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Orders List */}
      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={ordersData || []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card style={styles.orderCard} onPress={() => router.push(`/orders/${item.id}`)}>
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.orderNum}>{item.orderNumber}</Text>
                  <Text style={styles.custName}>{item.customer?.name}</Text>
                </View>
                <Badge label={item.status.replace(/_/g, ' ')} variant={getStatusVariant(item.status) as any} />
              </View>

              <View style={styles.itemSummary}>
                <Scissors size={14} color={Colors.textMuted} />
                <Text style={styles.itemSummaryText}>
                  {item.items?.map((i: any) => `${i.quantity}x ${i.customItemName}`).join(', ') || 'Custom Garment'}
                </Text>
              </View>

              <View style={styles.cardBottom}>
                <View style={styles.dateMeta}>
                  <Calendar size={13} color={Colors.textMuted} />
                  <Text style={styles.metaText}>
                    Due: {new Date(item.deliveryDate).toLocaleDateString()}
                  </Text>
                </View>

                <View style={styles.priceMeta}>
                  <Text style={styles.totalPrice}>₹{item.finalAmount?.toLocaleString()}</Text>
                  {item.balanceDue > 0 ? (
                    <Text style={styles.balanceDue}>Due: ₹{item.balanceDue?.toLocaleString()}</Text>
                  ) : (
                    <Text style={styles.paidBadge}>PAID</Text>
                  )}
                </View>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Scissors size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No orders found</Text>
              <Text style={styles.emptySub}>Tap '+' button above to create a tailoring order</Text>
            </View>
          }
        />
      )}

      {/* Create Order Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Bespoke Order</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Customer Selector */}
              <Text style={styles.inputLabel}>Select Customer *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.custSelectScroll}>
                {customersData?.map((cust: any) => (
                  <TouchableOpacity
                    key={cust.id}
                    onPress={() => setSelectedCustomerId(cust.id)}
                    style={[
                      styles.custChip,
                      selectedCustomerId === cust.id && styles.custChipActive
                    ]}
                  >
                    <User size={14} color={selectedCustomerId === cust.id ? '#FFF' : Colors.text} />
                    <Text
                      style={[
                        styles.custChipText,
                        selectedCustomerId === cust.id && styles.custChipTextActive
                      ]}
                    >
                      {cust.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <AppInput
                label="Garment / Item Name *"
                value={itemName}
                onChangeText={setItemName}
                placeholder="e.g. 2-Piece Italian Suit, Silk Kurti"
              />

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <AppInput
                    label="Quantity"
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <AppInput
                    label="Unit Price (₹) *"
                    value={unitPrice}
                    onChangeText={setUnitPrice}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <AppInput
                    label="Trial (Days from today)"
                    value={trialDays}
                    onChangeText={setTrialDays}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <AppInput
                    label="Delivery (Days from today) *"
                    value={deliveryDays}
                    onChangeText={setDeliveryDays}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <AppInput
                    label="Advance Paid (₹)"
                    value={advancePaid}
                    onChangeText={setAdvancePaid}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Payment Mode</Text>
                  <View style={styles.payMethods}>
                    {['UPI', 'CASH'].map((m) => (
                      <TouchableOpacity
                        key={m}
                        onPress={() => setPaymentMethod(m as any)}
                        style={[styles.payMethodBtn, paymentMethod === m && styles.payMethodBtnActive]}
                      >
                        <Text style={[styles.payMethodText, paymentMethod === m && styles.payMethodTextActive]}>
                          {m}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <AppInput
                label="Special Cutting & Design Notes"
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. Double vents, peak lapels, side adjusters..."
                multiline
                numberOfLines={2}
              />

              <AppButton
                title="Create Order & Generate Job Cards"
                onPress={handleCreateOrder}
                loading={createOrderMutation.isPending}
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
  orderCard: {
    padding: 14,
    marginBottom: 10
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  orderNum: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text
  },
  custName: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: '600',
    marginTop: 2
  },
  itemSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10
  },
  itemSummaryText: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '500'
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  dateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  metaText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500'
  },
  priceMeta: {
    alignItems: 'flex-end'
  },
  totalPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text
  },
  balanceDue: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.danger,
    marginTop: 1
  },
  paidBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.success,
    marginTop: 1
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60
  },
  emptyTitle: {
    fontSize: 16,
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
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6
  },
  custSelectScroll: {
    marginBottom: 14
  },
  custChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
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
  formRow: {
    flexDirection: 'row',
    gap: 10
  },
  payMethods: {
    flexDirection: 'row',
    gap: 6
  },
  payMethodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border
  },
  payMethodBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary
  },
  payMethodText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted
  },
  payMethodTextActive: {
    color: '#FFFFFF'
  }
});
