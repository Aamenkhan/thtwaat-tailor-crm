import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { Colors } from '../../src/constants/theme';
import { Card } from '../../src/components/CommonUI';
import {
  Scissors,
  QrCode,
  CheckCircle2,
  Package,
  Users2,
  Receipt,
  Building,
  LogOut,
  ChevronRight,
  Shield,
  Layers,
  MessageSquare,
  UploadCloud,
  FileSpreadsheet,
  RefreshCw,
  Factory,
  TrendingUp,
  DollarSign,
  CreditCard,
  Percent,
  FileText
} from 'lucide-react-native';

export default function MoreMenuScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out from this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        }
      }
    ]);
  };

  const menuSections = [
    {
      title: 'Financials, GST & Accounting',
      items: [
        {
          title: 'Finance Command Center',
          sub: 'Live net profit KPI, revenue vs COGS vs expenses gauges',
          icon: <DollarSign size={20} color={Colors.primary} />,
          route: '/accounting'
        },
        {
          title: 'Profit & Loss (P&L) Statement',
          sub: 'Gross revenue, COGS, factory OPEX, EBITDA & net profit margin',
          icon: <TrendingUp size={20} color={Colors.success} />,
          route: '/accounting/pnl'
        },
        {
          title: 'Expense Management',
          sub: 'Rent, power, repairs, trims, packaging & receipt photo log',
          icon: <CreditCard size={20} color={Colors.warning} />,
          route: '/accounting/expenses'
        },
        {
          title: 'GST Compliance & Tax Filing',
          sub: 'CGST/SGST/IGST split, GSTR-1 outward turnover & GSTR-3B ITC credit',
          icon: <Percent size={20} color={Colors.accent} />,
          route: '/accounting/gst'
        },
        {
          title: 'Party Ledgers & Statements',
          sub: 'Customer statement of account, vendor payables & running balances',
          icon: <FileText size={20} color={Colors.purple} />,
          route: '/accounting/ledger'
        }
      ]
    },
    {
      title: 'Garment Factory Production ERP',
      items: [
        {
          title: 'Factory Command Center',
          sub: 'Live efficiency %, active lines, daily target counters & floor KPIs',
          icon: <Factory size={20} color={Colors.primary} />,
          route: '/production-factory'
        },
        {
          title: 'Production Planning & BOM',
          sub: 'Size-color matrix, auto BOM material calculation & stock check',
          icon: <Layers size={20} color={Colors.accent} />,
          route: '/production-factory/planning'
        },
        {
          title: 'Cutting & Fabric Roll Tracker',
          sub: 'Marker length, lay plies, GSM roll tracker & Bundle QR generator',
          icon: <Scissors size={20} color={Colors.purple} />,
          route: '/production-factory/cutting'
        },
        {
          title: 'Stitching Lines & Floor Logs',
          sub: 'Real-time line efficiency %, artisan assignment & daily entry',
          icon: <TrendingUp size={20} color={Colors.info} />,
          route: '/production-factory/lines'
        },
        {
          title: 'Advanced QC & Rework Station',
          sub: 'Defect logging, severity, photos, pass/rework/scrap workflows',
          icon: <CheckCircle2 size={20} color={Colors.success} />,
          route: '/production-factory/qc-rework'
        },
        {
          title: 'Manufacturing Costing & Payroll',
          sub: 'BOM vs actual material variance, costing sheet & artisan wages',
          icon: <DollarSign size={20} color={Colors.warning} />,
          route: '/production-factory/costing'
        },
        {
          title: 'Finished Goods Warehouse',
          sub: 'Packed warehouse inventory, batch allocation & delivery',
          icon: <Package size={20} color={Colors.text} />,
          route: '/production-factory/finished-goods'
        }
      ]
    },
    {
      title: 'Bulk Data & Cloud Integrations',
      items: [
        {
          title: 'WhatsApp Message Center',
          sub: 'Templates, customer bills, payment alerts & message logs',
          icon: <MessageSquare size={20} color={Colors.success} />,
          route: '/whatsapp'
        },
        {
          title: 'Bulk Excel Import',
          sub: 'Multi-step validation, error checking & bulk upload',
          icon: <UploadCloud size={20} color={Colors.accent} />,
          route: '/imports'
        },
        {
          title: 'Excel Export Hub & Reports',
          sub: 'Export 13 data models, executive summaries & blank templates',
          icon: <FileSpreadsheet size={20} color={Colors.purple} />,
          route: '/exports'
        },
        {
          title: 'Google Sheets Cloud Sync',
          sub: 'Live 2-way spreadsheet sync layer with conflict safety',
          icon: <RefreshCw size={20} color={Colors.info} />,
          route: '/integrations/google'
        }
      ]
    },
    {
      title: 'Production & Factory Ops',
      items: [
        {
          title: 'Measurement Studio',
          sub: 'Men, Women & Kids body fitting templates',
          icon: <Scissors size={20} color={Colors.accent} />,
          route: '/measurements'
        },
        {
          title: 'Scan Job QR / Barcode',
          sub: 'Update cutting, stitching & bundle status',
          icon: <QrCode size={20} color={Colors.purple} />,
          route: '/production/scan'
        },
        {
          title: 'QC Inspection Console',
          sub: 'Inspect garments, pass, rework & defect logs',
          icon: <CheckCircle2 size={20} color={Colors.info} />,
          route: '/production/qc'
        }
      ]
    },
    {
      title: 'Inventory & Workforce',
      items: [
        {
          title: 'Raw Materials & Trims',
          sub: 'Fabrics, buttons, zippers, low-stock alerts',
          icon: <Package size={20} color={Colors.warning} />,
          route: '/inventory'
        },
        {
          title: 'Worker Wages & Piece-Rate',
          sub: 'Artisan piece-rate logs, attendance & payouts',
          icon: <Users2 size={20} color={Colors.success} />,
          route: '/workers'
        },
        {
          title: 'Tax Invoices & GST Bills',
          sub: 'PDF invoice generator, payments & ledgers',
          icon: <Receipt size={20} color={Colors.info} />,
          route: '/billing'
        }
      ]
    }
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User Info Card */}
      <Card style={styles.userCard}>
        <View style={styles.userAvatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'U'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userRole}>
            Role: <Text style={{ color: Colors.accent, fontWeight: '700' }}>{user?.role}</Text>
          </Text>
          <Text style={styles.userCompany}>{user?.companyName}</Text>
        </View>
      </Card>

      {/* Menu Groups */}
      {menuSections.map((sec, idx) => (
        <View key={idx} style={styles.section}>
          <Text style={styles.sectionTitle}>{sec.title}</Text>
          <Card style={{ padding: 4 }}>
            {sec.items.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.menuItem,
                  i < sec.items.length - 1 && styles.menuItemBorder
                ]}
                onPress={() => router.push(item.route as any)}
              >
                <View style={styles.itemIcon}>{item.icon}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemSub}>{item.sub}</Text>
                </View>
                <ChevronRight size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </Card>
        </View>
      ))}

      {/* Logout Action */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <LogOut size={18} color={Colors.danger} />
        <Text style={styles.logoutText}>Sign Out from Workspace</Text>
      </TouchableOpacity>
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
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    backgroundColor: Colors.primary,
    borderColor: Colors.primary
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  userRole: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2
  },
  userCompany: {
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 2
  },
  section: {
    marginTop: 18
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center'
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text
  },
  itemSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 14,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.danger
  }
});
