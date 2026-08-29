import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  ActivityIndicator,
  Share
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, API_BASE_URL } from '../../src/api/client';
import { Colors } from '../../src/constants/theme';
import { Card, Badge, AppButton } from '../../src/components/CommonUI';
import {
  Receipt,
  Download,
  MessageCircle,
  Search,
  DollarSign,
  Calendar,
  Share2,
  Send,
  User,
  ShieldCheck
} from 'lucide-react-native';

export default function BillingScreen() {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Fetch Invoices
  const { data: invoicesData, isLoading, refetch } = useQuery({
    queryKey: ['invoices', selectedStatus],
    queryFn: async () => {
      const params: any = {};
      if (selectedStatus !== 'ALL') params.status = selectedStatus;
      const res = await api.get('/billing/invoices', { params });
      return res.data.data;
    }
  });

  const handleDownloadPDF = (invoice: any) => {
    const pdfUrl = `${API_BASE_URL}/billing/invoices/${invoice.id}/pdf`;
    Linking.openURL(pdfUrl);
  };

  const handleShareInvoice = async (invoice: any) => {
    try {
      const pdfUrl = `${API_BASE_URL}/billing/invoices/${invoice.id}/pdf`;
      await Share.share({
        title: `Tax Invoice ${invoice.invoiceNumber}`,
        message: `🧾 TAX INVOICE: ${invoice.invoiceNumber}\nCustomer: ${invoice.customerName}\nTotal Amount: ₹${invoice.totalAmount}\nAmount Paid: ₹${invoice.amountPaid}\nBalance Due: ₹${invoice.balanceDue}\n\nView/Download PDF: ${pdfUrl}`
      });
    } catch (err: any) {
      Alert.alert('Share Error', err.message);
    }
  };

  // Send WhatsApp Invoice (Customer or Owner)
  const handleSendWhatsAppInvoice = async (invoice: any, toType: 'CUSTOMER' | 'OWNER') => {
    setSendingId(`${invoice.id}-${toType}`);
    try {
      const res = await api.post('/whatsapp/send-invoice', {
        invoiceId: invoice.id,
        toType
      });

      const data = res.data.data;
      if (data?.waLink && data?.provider !== 'WHATSAPP_BUSINESS_API') {
        Linking.openURL(data.waLink);
      }

      Alert.alert(
        'WhatsApp Sent',
        toType === 'OWNER'
          ? 'Invoice copy dispatched to Owner WhatsApp!'
          : `Invoice successfully sent to customer ${invoice.customerName}!`
      );
      refetch();
    } catch (err: any) {
      Alert.alert('WhatsApp Error', err.response?.data?.error || err.message);
    } finally {
      setSendingId(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Filter Chips */}
      <View style={styles.filterBar}>
        {['ALL', 'PENDING', 'PARTIAL', 'PAID'].map((st) => (
          <TouchableOpacity
            key={st}
            onPress={() => setSelectedStatus(st)}
            style={[styles.filterChip, selectedStatus === st && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, selectedStatus === st && styles.filterChipTextActive]}>
              {st}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={invoicesData || []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card style={styles.invoiceCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.invNumber}>{item.invoiceNumber}</Text>
                  <Text style={styles.custName}>{item.customerName}</Text>
                  <Text style={styles.custPhone}>📞 {item.customerPhone}</Text>
                </View>
                <Badge
                  label={item.status}
                  variant={item.status === 'PAID' ? 'success' : item.status === 'PARTIAL' ? 'warning' : 'danger'}
                />
              </View>

              <View style={styles.amountBreakdown}>
                <View>
                  <Text style={styles.amountLabel}>Total Bill</Text>
                  <Text style={styles.totalVal}>₹{item.totalAmount?.toLocaleString()}</Text>
                </View>

                <View>
                  <Text style={styles.amountLabel}>Paid</Text>
                  <Text style={styles.paidVal}>₹{item.amountPaid?.toLocaleString()}</Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.amountLabel}>Balance Due</Text>
                  <Text style={styles.dueVal}>₹{item.balanceDue?.toLocaleString()}</Text>
                </View>
              </View>

              {/* Action Buttons Row 1: PDF & Share */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#F1F5F9' }]}
                  onPress={() => handleDownloadPDF(item)}
                >
                  <Download size={14} color={Colors.text} />
                  <Text style={[styles.actionBtnText, { color: Colors.text }]}>PDF Bill</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#F1F5F9' }]}
                  onPress={() => handleShareInvoice(item)}
                >
                  <Share2 size={14} color={Colors.text} />
                  <Text style={[styles.actionBtnText, { color: Colors.text }]}>Share</Text>
                </TouchableOpacity>
              </View>

              {/* Action Buttons Row 2: WhatsApp Customer & WhatsApp Me */}
              <View style={[styles.actionsRow, { marginTop: 6 }]}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#DCFCE7' }]}
                  onPress={() => handleSendWhatsAppInvoice(item, 'CUSTOMER')}
                  disabled={sendingId === `${item.id}-CUSTOMER`}
                >
                  <MessageCircle size={14} color={Colors.success} />
                  <Text style={[styles.actionBtnText, { color: Colors.success }]}>
                    {sendingId === `${item.id}-CUSTOMER` ? 'Sending...' : 'WhatsApp Customer'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#EFF6FF' }]}
                  onPress={() => handleSendWhatsAppInvoice(item, 'OWNER')}
                  disabled={sendingId === `${item.id}-OWNER`}
                >
                  <ShieldCheck size={14} color={Colors.accent} />
                  <Text style={[styles.actionBtnText, { color: Colors.accent }]}>
                    {sendingId === `${item.id}-OWNER` ? 'Sending...' : 'WhatsApp Me'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Receipt size={44} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Invoices found</Text>
              <Text style={styles.emptySub}>Invoices are automatically created when new orders are placed</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  filterBar: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border
  },
  filterChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border
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
    padding: 16
  },
  invoiceCard: {
    padding: 14,
    marginBottom: 12
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  invNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text
  },
  custName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accent,
    marginTop: 2
  },
  custPhone: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  amountBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10
  },
  amountLabel: {
    fontSize: 10,
    color: Colors.textMuted
  },
  totalVal: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 2
  },
  paidVal: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.success,
    marginTop: 2
  },
  dueVal: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.danger,
    marginTop: 2
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700'
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 12
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4
  }
});
