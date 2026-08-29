import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
  Modal
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, API_BASE_URL } from '../../src/api/client';
import { Colors } from '../../src/constants/theme';
import { Card, Badge, AppButton, AppInput } from '../../src/components/CommonUI';
import {
  Calendar,
  DollarSign,
  Layers,
  MessageCircle,
  Download,
  CheckCircle2,
  Clock,
  ArrowRight,
  Scissors,
  Plus,
  X
} from 'lucide-react-native';

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'CASH' | 'UPI' | 'CREDIT_CARD'>('UPI');

  const { data: orderData, isLoading, refetch } = useQuery({
    queryKey: ['order-detail', id],
    queryFn: async () => {
      const res = await api.get(`/orders/${id}`);
      return res.data.order;
    }
  });

  // Record Payment Mutation
  const paymentMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/payments', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setPaymentModalVisible(false);
      setPayAmount('');
      Alert.alert('Payment Recorded', 'Payment has been updated successfully');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error || 'Failed to record payment');
    }
  });

  const handleRecordPayment = () => {
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Required', 'Please enter a valid amount');
      return;
    }

    paymentMutation.mutate({
      orderId: orderData.id,
      invoiceId: orderData.invoices?.[0]?.id || null,
      customerId: orderData.customerId,
      amount: amt,
      paymentMethod: payMethod,
      notes: 'Balance settlement payment'
    });
  };

  const handleOpenWhatsApp = () => {
    if (!orderData?.customer) return;
    const phone = orderData.customer.whatsapp || orderData.customer.phone;
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.length === 10) clean = '91' + clean;

    const text = encodeURIComponent(
      `Namaste ${orderData.customer.name} ji,\nUpdate for Order *${orderData.orderNumber}*:\nStatus: ${orderData.status.replace(/_/g, ' ')}\nTotal: ₹${orderData.finalAmount}\nBalance: ₹${orderData.balanceDue}\nDelivery Date: ${new Date(orderData.deliveryDate).toLocaleDateString()}`
    );

    Linking.openURL(`https://wa.me/${clean}?text=${text}`);
  };

  const handleDownloadPDF = () => {
    const inv = orderData?.invoices?.[0];
    if (!inv) {
      Alert.alert('No Invoice', 'Invoice not generated for this order');
      return;
    }
    const pdfUrl = `${API_BASE_URL}/billing/invoices/${inv.id}/pdf`;
    Linking.openURL(pdfUrl);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (!orderData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Order not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Order Header Summary */}
      <Card style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.orderNumber}>{orderData.orderNumber}</Text>
            <Text style={styles.orderType}>{orderData.orderType.replace(/_/g, ' ')}</Text>
          </View>
          <Badge label={orderData.status.replace(/_/g, ' ')} variant="info" />
        </View>

        <View style={styles.datesRow}>
          <View style={styles.dateCol}>
            <Text style={styles.dateLabel}>Trial Date</Text>
            <Text style={styles.dateValue}>
              {orderData.trialDate ? new Date(orderData.trialDate).toLocaleDateString() : 'N/A'}
            </Text>
          </View>
          <View style={styles.dateCol}>
            <Text style={styles.dateLabel}>Delivery Date</Text>
            <Text style={[styles.dateValue, { color: Colors.accent }]}>
              {new Date(orderData.deliveryDate).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </Card>

      {/* Customer Information */}
      <Card style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Customer Details</Text>
          <TouchableOpacity onPress={handleOpenWhatsApp}>
            <View style={styles.waBadge}>
              <MessageCircle size={14} color={Colors.success} />
              <Text style={styles.waText}>WhatsApp</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.custName}>{orderData.customer?.name}</Text>
        {orderData.customer?.businessName && (
          <Text style={styles.custSub}>{orderData.customer.businessName}</Text>
        )}
        <Text style={styles.custPhone}>📞 {orderData.customer?.phone}</Text>
        {orderData.customer?.address && (
          <Text style={styles.custAddress}>📍 {orderData.customer.address}</Text>
        )}
      </Card>

      {/* Order Garment Items */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Ordered Garments ({orderData.items?.length})</Text>
        {orderData.items?.map((item: any, idx: number) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemBullet}>
              <Scissors size={14} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>
                {item.quantity}x {item.customItemName}
              </Text>
              {item.measurement && (
                <Text style={styles.itemMeasTitle}>
                  Fit: {item.measurement.title} (v{item.measurement.version})
                </Text>
              )}
              {item.designNotes && (
                <Text style={styles.itemNotes}>Note: {item.designNotes}</Text>
              )}
            </View>
            <Text style={styles.itemPrice}>₹{item.totalAmount?.toLocaleString()}</Text>
          </View>
        ))}
      </Card>

      {/* Production Job Cards & Live Tracking */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Production Job Cards & Stages</Text>
        {orderData.jobCards?.map((jc: any) => (
          <View key={jc.id} style={styles.jcRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.jcNumber}>{jc.jobCardNumber}</Text>
              <Text style={styles.jcWorker}>
                Worker: {jc.assignedWorker?.name || 'Pending assignment'}
              </Text>
            </View>
            <Badge label={jc.currentStage.replace(/_/g, ' ')} variant="purple" />
          </View>
        ))}
      </Card>

      {/* Financial Summary & Payment */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Invoice & Billing Summary</Text>

        <View style={styles.finRow}>
          <Text style={styles.finLabel}>Subtotal</Text>
          <Text style={styles.finValue}>₹{orderData.totalAmount?.toLocaleString()}</Text>
        </View>

        {orderData.discount > 0 && (
          <View style={styles.finRow}>
            <Text style={styles.finLabel}>Discount</Text>
            <Text style={[styles.finValue, { color: Colors.success }]}>
              -₹{orderData.discount?.toLocaleString()}
            </Text>
          </View>
        )}

        {orderData.taxAmount > 0 && (
          <View style={styles.finRow}>
            <Text style={styles.finLabel}>GST ({orderData.taxRate}%)</Text>
            <Text style={styles.finValue}>₹{orderData.taxAmount?.toLocaleString()}</Text>
          </View>
        )}

        <View style={[styles.finRow, styles.finTotalRow]}>
          <Text style={styles.finTotalLabel}>Total Amount</Text>
          <Text style={styles.finTotalValue}>₹{orderData.finalAmount?.toLocaleString()}</Text>
        </View>

        <View style={styles.finRow}>
          <Text style={styles.finLabel}>Advance Received</Text>
          <Text style={[styles.finValue, { color: Colors.success }]}>
            ₹{orderData.advancePaid?.toLocaleString()}
          </Text>
        </View>

        <View style={styles.finRow}>
          <Text style={[styles.finLabel, { fontWeight: '700', color: Colors.danger }]}>
            Balance Due
          </Text>
          <Text style={[styles.finValue, { fontWeight: '800', color: Colors.danger }]}>
            ₹{orderData.balanceDue?.toLocaleString()}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.finActions}>
          {orderData.balanceDue > 0 && (
            <AppButton
              title="Collect Payment"
              variant="accent"
              onPress={() => {
                setPayAmount(orderData.balanceDue.toString());
                setPaymentModalVisible(true);
              }}
              icon={<DollarSign size={16} color="#FFFFFF" />}
              style={{ flex: 1 }}
            />
          )}

          <AppButton
            title="PDF Bill"
            variant="outline"
            onPress={handleDownloadPDF}
            icon={<Download size={16} color={Colors.text} />}
            style={{ flex: orderData.balanceDue > 0 ? 0.7 : 1 }}
          />
        </View>
      </Card>

      {/* Collect Payment Modal */}
      <Modal visible={paymentModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Payment</Text>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <AppInput
              label="Amount to Settle (₹) *"
              value={payAmount}
              onChangeText={setPayAmount}
              keyboardType="numeric"
            />

            <Text style={styles.payMethodLabel}>Payment Mode</Text>
            <View style={styles.payMethodsRow}>
              {['UPI', 'CASH', 'CREDIT_CARD'].map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setPayMethod(m as any)}
                  style={[styles.payMethodPill, payMethod === m && styles.payMethodPillActive]}
                >
                  <Text style={[styles.payMethodPillText, payMethod === m && styles.payMethodPillTextActive]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <AppButton
              title="Confirm Payment"
              onPress={handleRecordPayment}
              loading={paymentMutation.isPending}
              variant="success"
              style={{ marginTop: 16 }}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  errorText: {
    fontSize: 16,
    color: Colors.danger,
    fontWeight: '700'
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },
  headerCard: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    padding: 16
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  orderType: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2
  },
  datesRow: {
    flexDirection: 'row',
    backgroundColor: Colors.primaryLight,
    padding: 12,
    borderRadius: 10
  },
  dateCol: {
    flex: 1
  },
  dateLabel: {
    fontSize: 11,
    color: '#94A3B8'
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2
  },
  card: {
    marginTop: 12,
    padding: 16
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 10
  },
  waBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  waText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.success
  },
  custName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text
  },
  custSub: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '600',
    marginTop: 1
  },
  custPhone: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4
  },
  custAddress: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10
  },
  itemBullet: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text
  },
  itemMeasTitle: {
    fontSize: 11,
    color: Colors.accent,
    marginTop: 2
  },
  itemNotes: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text
  },
  jcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  jcNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text
  },
  jcWorker: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  finRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6
  },
  finLabel: {
    fontSize: 13,
    color: Colors.textMuted
  },
  finValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text
  },
  finTotalRow: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 8,
    marginVertical: 4
  },
  finTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text
  },
  finTotalValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text
  },
  finActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14
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
  payMethodLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6
  },
  payMethodsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14
  },
  payMethodPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border
  },
  payMethodPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary
  },
  payMethodPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted
  },
  payMethodPillTextActive: {
    color: '#FFFFFF'
  }
});
