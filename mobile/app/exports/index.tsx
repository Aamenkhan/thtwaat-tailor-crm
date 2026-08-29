import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking
} from 'react-native';
import { api, API_BASE_URL } from '../../src/api/client';
import { Colors } from '../../src/constants/theme';
import { Card, Badge, AppButton } from '../../src/components/CommonUI';
import {
  FileSpreadsheet,
  Download,
  Filter,
  Users,
  Briefcase,
  Package,
  Layers,
  ShoppingBag,
  Scissors,
  Boxes,
  Truck,
  ClipboardList,
  UserCheck,
  CreditCard,
  Receipt,
  BarChart3,
  ExternalLink
} from 'lucide-react-native';

export default function ExportHubScreen() {
  const [selectedDateFilter, setSelectedDateFilter] = useState('ALL');

  const exportEntities = [
    {
      key: 'customers',
      name: 'Customers Directory',
      desc: 'Export all individual clients, phones, WhatsApp, GST & addresses',
      icon: <Users size={22} color={Colors.accent} />,
      category: 'CRM'
    },
    {
      key: 'buyers',
      name: 'B2B Buyers & Boutiques',
      desc: 'Wholesale accounts, bulk buyers, order volume & total turnover',
      icon: <Briefcase size={22} color={Colors.purple} />,
      category: 'CRM'
    },
    {
      key: 'products',
      name: 'Product Styles Catalog',
      desc: 'Style SKU, selling prices, BOM cost, fabric specs & standard minutes',
      icon: <Package size={22} color={Colors.info} />,
      category: 'Catalog'
    },
    {
      key: 'variants',
      name: 'Product Size & Color Variants',
      desc: 'Full matrix of sizes (S, M, L, 38, 40) and color options',
      icon: <Layers size={22} color={Colors.warning} />,
      category: 'Catalog'
    },
    {
      key: 'orders',
      name: 'Tailoring & Bulk Orders',
      desc: 'Order numbers, delivery dates, trial dates, totals & advance dues',
      icon: <ShoppingBag size={22} color={Colors.success} />,
      category: 'Orders'
    },
    {
      key: 'measurements',
      name: 'Bespoke Body Measurements',
      desc: 'Chest, waist, hips, shoulder, collar & special fit instructions',
      icon: <Scissors size={22} color={Colors.accent} />,
      category: 'Fitting'
    },
    {
      key: 'inventory',
      name: 'Raw Materials & Trims Inventory',
      desc: 'Fabrics, buttons, zippers, current stock balances & valuations',
      icon: <Boxes size={22} color={Colors.warning} />,
      category: 'Inventory'
    },
    {
      key: 'suppliers',
      name: 'Material Suppliers & Mills',
      desc: 'Contact details, GST numbers, and payment terms',
      icon: <Truck size={22} color={Colors.purple} />,
      category: 'Inventory'
    },
    {
      key: 'purchases',
      name: 'Purchase Orders (PO)',
      desc: 'Raw material procurement orders and delivery tracking',
      icon: <ClipboardList size={22} color={Colors.info} />,
      category: 'Inventory'
    },
    {
      key: 'production',
      name: 'Production Job Cards',
      desc: 'Cutting, stitching, finishing, worker logs & QC inspection passes',
      icon: <Layers size={22} color={Colors.accent} />,
      category: 'Production'
    },
    {
      key: 'workers',
      name: 'Artisans & Tailor Workforce',
      desc: 'Tailors, master cutters, piece-rate wages & active roster',
      icon: <UserCheck size={22} color={Colors.success} />,
      category: 'Artisans'
    },
    {
      key: 'payments',
      name: 'Customer Payment Ledger',
      desc: 'Cash, UPI, bank transfers, advance collections & UTR reference logs',
      icon: <CreditCard size={22} color={Colors.success} />,
      category: 'Accounts'
    },
    {
      key: 'invoices',
      name: 'Tax Invoices & GST Bills',
      desc: 'Official invoice register with taxable subtotal, GST & due balances',
      icon: <Receipt size={22} color={Colors.info} />,
      category: 'Accounts'
    },
    {
      key: 'reports',
      name: 'Executive Business Overview Report',
      desc: 'Aggregated revenue, outstanding dues, order counts & inventory value',
      icon: <BarChart3 size={22} color={Colors.primary} />,
      category: 'Executive'
    }
  ];

  const handleExport = (key: string) => {
    let url = `${API_BASE_URL}/exports/${key}`;
    const params = new URLSearchParams();

    const now = new Date();
    if (selectedDateFilter === 'TODAY') {
      const todayStr = now.toISOString().split('T')[0];
      params.append('startDate', todayStr);
    } else if (selectedDateFilter === 'LAST_7_DAYS') {
      const past = new Date(now.getTime() - 7 * 86400000);
      params.append('startDate', past.toISOString().split('T')[0]);
    } else if (selectedDateFilter === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      params.append('startDate', firstDay.toISOString().split('T')[0]);
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    Linking.openURL(url);
  };

  const handleDownloadTemplate = (type: string) => {
    const url = `${API_BASE_URL}/exports/templates/${type}`;
    Linking.openURL(url);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Excel Export & Reports Hub</Text>
        <Text style={styles.subtitle}>
          Generate production-ready Excel workbooks for your business records, accounting, and compliance.
        </Text>
      </View>

      {/* Date Filter Bar */}
      <Card style={styles.filterCard}>
        <View style={styles.filterHeader}>
          <Filter size={16} color={Colors.textMuted} />
          <Text style={styles.filterTitle}>Date Range Filter (Applied on Export)</Text>
        </View>
        <View style={styles.filterChipsRow}>
          {[
            { id: 'ALL', label: 'All Time' },
            { id: 'TODAY', label: 'Today' },
            { id: 'LAST_7_DAYS', label: 'Last 7 Days' },
            { id: 'THIS_MONTH', label: 'This Month' }
          ].map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => setSelectedDateFilter(item.id)}
              style={[styles.filterChip, selectedDateFilter === item.id && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, selectedDateFilter === item.id && styles.filterChipTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* 13 Entity Export Cards */}
      <Text style={styles.sectionHeading}>Select Dataset to Export (.xlsx)</Text>

      {exportEntities.map((ent) => (
        <Card key={ent.key} style={styles.exportCard}>
          <View style={styles.cardLeft}>
            <View style={styles.iconBox}>{ent.icon}</View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.entityName}>{ent.name}</Text>
                <Badge label={ent.category} variant="slate" />
              </View>
              <Text style={styles.entityDesc}>{ent.desc}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.downloadBtn} onPress={() => handleExport(ent.key)}>
            <Download size={16} color="#FFFFFF" />
            <Text style={styles.downloadBtnText}>Export Excel</Text>
          </TouchableOpacity>
        </Card>
      ))}

      {/* Templates Section */}
      <View style={styles.templatesSection}>
        <Text style={styles.sectionHeading}>Official Blank Import Templates</Text>
        <Card style={{ padding: 14 }}>
          <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 10 }}>
            Download pre-formatted Excel sheets ready for bulk data entry:
          </Text>
          <View style={styles.templatesGrid}>
            {[
              { label: 'Products Template', type: 'products' },
              { label: 'Customers Template', type: 'customers' },
              { label: 'Inventory Template', type: 'inventory' },
              { label: 'Orders Template', type: 'orders' },
              { label: 'Measurements Template', type: 'measurements' },
              { label: 'Suppliers Template', type: 'suppliers' }
            ].map((t) => (
              <TouchableOpacity
                key={t.type}
                style={styles.templateItem}
                onPress={() => handleDownloadTemplate(t.type)}
              >
                <FileSpreadsheet size={16} color={Colors.accent} />
                <Text style={styles.templateItemText}>{t.label}</Text>
                <ExternalLink size={12} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </Card>
      </View>
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
  header: {
    marginBottom: 16
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4
  },
  filterCard: {
    padding: 12,
    marginBottom: 16
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10
  },
  filterTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 6
  },
  filterChip: {
    flex: 1,
    paddingVertical: 7,
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
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 8,
    marginBottom: 12
  },
  exportCard: {
    padding: 14,
    marginBottom: 10
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  entityName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text
  },
  entityDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    backgroundColor: Colors.primary,
    borderRadius: 8
  },
  downloadBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  templatesSection: {
    marginTop: 16
  },
  templatesGrid: {
    gap: 8
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border
  },
  templateItemText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text
  }
});
