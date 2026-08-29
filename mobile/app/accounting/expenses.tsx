import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/api/client';
import { Colors } from '../../src/constants/theme';
import { Card, Badge, AppButton, AppInput } from '../../src/components/CommonUI';
import {
  CreditCard,
  Plus,
  Search,
  CheckCircle2,
  Calendar,
  X,
  PieChart,
  Tag
} from 'lucide-react-native';

const EXPENSE_CATEGORIES = [
  'RENT',
  'ELECTRICITY_POWER',
  'MACHINE_MAINTENANCE',
  'PACKAGING',
  'LOGISTICS_FUEL',
  'STAFF_SALARY',
  'PETTY_CASH',
  'TEA_REFRESHMENTS',
  'MARKETING',
  'RAW_MATERIALS',
  'OTHER'
];

export default function ExpensesScreen() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [modalVisible, setModalVisible] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('RENT');
  const [gstRate, setGstRate] = useState('18');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [payeeVendor, setPayeeVendor] = useState('');
  const [description, setDescription] = useState('');

  // Queries
  const { data: expensesData, isLoading: expensesLoading } = useQuery({
    queryKey: ['accounting-expenses', selectedCategory],
    queryFn: async () => {
      const params: any = {};
      if (selectedCategory !== 'ALL') params.category = selectedCategory;
      const res = await api.get('/accounting/expenses', { params });
      return res.data.data;
    }
  });

  const { data: summaryData } = useQuery({
    queryKey: ['accounting-expenses-summary'],
    queryFn: async () => {
      const res = await api.get('/accounting/expenses/summary');
      return res.data.data;
    }
  });

  // Create Expense Mutation
  const createExpenseMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/accounting/expenses', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['accounting-expenses-summary'] });
      queryClient.invalidateQueries({ queryKey: ['accounting-pnl-summary'] });
      setModalVisible(false);
      Alert.alert('Expense Logged', 'Expense recorded successfully with GST/ITC tracking!');
      setTitle('');
      setAmount('');
      setPayeeVendor('');
      setDescription('');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error || 'Failed to log expense');
    }
  });

  const handleSaveExpense = () => {
    if (!title || !amount) {
      Alert.alert('Required', 'Please fill expense title and amount');
      return;
    }

    createExpenseMutation.mutate({
      title,
      amount: parseFloat(amount) || 0,
      category,
      gstRate: parseFloat(gstRate) || 0,
      paymentMethod,
      payeeVendor,
      description
    });
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Expense Management</Text>
          <Text style={styles.subtitle}>Factory OPEX, Petty Cash & GST ITC Ledger</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Log Expense</Text>
        </TouchableOpacity>
      </View>

      {/* Summary KPI Banner */}
      <View style={styles.summaryRow}>
        <Card style={[styles.summaryCard, { borderColor: '#FEF3C7' }]}>
          <Text style={styles.sumLabel}>Total Expenses</Text>
          <Text style={[styles.sumVal, { color: Colors.warning }]}>
            ₹{summaryData?.totalExpenses?.toLocaleString() ?? 0}
          </Text>
          <Text style={styles.sumSub}>{summaryData?.expenseCount ?? 0} entries</Text>
        </Card>

        <Card style={[styles.summaryCard, { borderColor: '#DCFCE7' }]}>
          <Text style={styles.sumLabel}>GST Input Credit (ITC)</Text>
          <Text style={[styles.sumVal, { color: Colors.success }]}>
            ₹{summaryData?.totalGstPaid?.toLocaleString() ?? 0}
          </Text>
          <Text style={styles.sumSub}>Claimable against output tax</Text>
        </Card>
      </View>

      {/* Category Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {['ALL', ...EXPENSE_CATEGORIES].map((cat) => (
          <TouchableOpacity
            key={cat}
            onPress={() => setSelectedCategory(cat)}
            style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, selectedCategory === cat && styles.filterChipTextActive]}>
              {cat.replace(/_/g, ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Expense List */}
      {expensesLoading ? (
        <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={expensesData || []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card style={styles.expCard}>
              <View style={styles.expTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.expTitle}>{item.title}</Text>
                  <Text style={styles.expCategory}>{item.category.replace(/_/g, ' ')} • {item.paymentMethod}</Text>
                  {item.payeeVendor && <Text style={styles.expPayee}>Payee: {item.payeeVendor}</Text>}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.expAmount}>₹{item.amount.toLocaleString()}</Text>
                  {item.gstPaid > 0 && (
                    <Text style={styles.expGst}>GST ITC: ₹{item.gstPaid}</Text>
                  )}
                </View>
              </View>
              <View style={styles.expFooter}>
                <Text style={styles.expDate}>{item.expenseDate?.split('T')[0]}</Text>
                <Badge label={item.status} variant={item.status === 'PAID' ? 'success' : 'warning'} />
              </View>
            </Card>
          )}
        />
      )}

      {/* Modal: New Expense */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Business / Factory Expense</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              <AppInput label="Expense Title *" placeholder="e.g. Factory Rent for August" value={title} onChangeText={setTitle} />
              <AppInput label="Amount (₹) *" placeholder="e.g. 45000" keyboardType="numeric" value={amount} onChangeText={setAmount} />

              <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textMuted }}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 40 }}>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.selectChip, category === cat && styles.selectChipActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.selectChipText, category === cat && styles.selectChipTextActive]}>
                      {cat.replace(/_/g, ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <AppInput label="GST Rate % (For ITC Claim)" placeholder="18" keyboardType="numeric" value={gstRate} onChangeText={setGstRate} />

              <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textMuted }}>Payment Method</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {['UPI', 'CASH', 'BANK_TRANSFER', 'CHEQUE'].map((pm) => (
                  <TouchableOpacity
                    key={pm}
                    style={[styles.pmChip, paymentMethod === pm && styles.pmChipActive]}
                    onPress={() => setPaymentMethod(pm)}
                  >
                    <Text style={[styles.pmText, paymentMethod === pm && styles.pmTextActive]}>{pm}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <AppInput label="Vendor / Payee Name" placeholder="e.g. Industrial Landlord Ltd" value={payeeVendor} onChangeText={setPayeeVendor} />
              <AppInput label="Notes / Narration" placeholder="Additional details..." value={description} onChangeText={setDescription} />

              <AppButton
                title={createExpenseMutation.isPending ? 'Recording...' : 'Save Expense & Record ITC'}
                onPress={handleSaveExpense}
                loading={createExpenseMutation.isPending}
                style={{ marginTop: 8 }}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text
  },
  subtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.warning,
    borderRadius: 8
  },
  addBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    paddingBottom: 8
  },
  summaryCard: {
    flex: 1,
    padding: 12,
    borderWidth: 1.5
  },
  sumLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase'
  },
  sumVal: {
    fontSize: 18,
    fontWeight: '800',
    marginVertical: 4
  },
  sumSub: {
    fontSize: 10,
    color: Colors.textMuted
  },
  filterScroll: {
    maxHeight: 44,
    marginBottom: 8
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    alignSelf: 'center'
  },
  filterChipActive: {
    backgroundColor: Colors.primary
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
    paddingTop: 4,
    paddingBottom: 40,
    gap: 10
  },
  expCard: {
    padding: 14
  },
  expTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  expTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text
  },
  expCategory: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  expPayee: {
    fontSize: 10,
    color: Colors.accent,
    marginTop: 1
  },
  expAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text
  },
  expGst: {
    fontSize: 10,
    color: Colors.success,
    marginTop: 2
  },
  expFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  expDate: {
    fontSize: 10,
    color: Colors.textMuted
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text
  },
  selectChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 6
  },
  selectChipActive: {
    backgroundColor: Colors.primary
  },
  selectChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted
  },
  selectChipTextActive: {
    color: '#FFFFFF'
  },
  pmChip: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderRadius: 6
  },
  pmChipActive: {
    backgroundColor: Colors.accent
  },
  pmText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted
  },
  pmTextActive: {
    color: '#FFFFFF'
  }
});
