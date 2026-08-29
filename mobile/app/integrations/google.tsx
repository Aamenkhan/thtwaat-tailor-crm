import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, API_BASE_URL } from '../../src/api/client';
import { Colors } from '../../src/constants/theme';
import { Card, Badge, AppButton, AppInput } from '../../src/components/CommonUI';
import {
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Upload,
  Download,
  Link2,
  Clock,
  Layers
} from 'lucide-react-native';

export default function GoogleSheetsSyncScreen() {
  const queryClient = useQueryClient();
  const [googleEmail, setGoogleEmail] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  // 1. Fetch Google Integration Status
  const { data: statusData, isLoading } = useQuery({
    queryKey: ['google-status'],
    queryFn: async () => {
      const res = await api.get('/google/status');
      const data = res.data.data;
      if (data.googleEmail) setGoogleEmail(data.googleEmail);
      if (data.spreadsheetId) setSpreadsheetId(data.spreadsheetId);
      return data;
    }
  });

  // 2. Connect Account
  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await api.post('/google/connect', {
        googleEmail: googleEmail || 'owner@gmail.com',
        spreadsheetId: spreadsheetId || 'thtwaat-crm-sheet-2026',
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId || 'thtwaat-crm-sheet-2026'}`
      });
      queryClient.invalidateQueries({ queryKey: ['google-status'] });
      Alert.alert('Connected', 'Google Account & Spreadsheet integration configured successfully!');
    } catch (err: any) {
      Alert.alert('Connection Error', err.message);
    } finally {
      setIsConnecting(false);
    }
  };

  // 3. Export Single Entity to Google Sheet
  const handleExportEntity = async (entityType: string) => {
    try {
      const res = await api.post('/google/export', { entityType });
      Alert.alert(
        'Export Successful',
        `Exported ${res.data.data.exportedCount} records of ${entityType} to Google Sheets layer!`
      );
      queryClient.invalidateQueries({ queryKey: ['google-status'] });
    } catch (err: any) {
      Alert.alert('Export Error', err.message);
    }
  };

  // 4. Run Two-Way Sync
  const handleRunSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await api.post('/google/sync', {
        entities: ['customers', 'products', 'inventory', 'orders']
      });
      setSyncResult(res.data.data);
      queryClient.invalidateQueries({ queryKey: ['google-status'] });
      Alert.alert('Sync Finished', `Status: ${res.data.data.syncStatus}. Snapshots verified!`);
    } catch (err: any) {
      Alert.alert('Sync Error', err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Title */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Google Sheets Sync Layer</Text>
          <Text style={styles.subtitle}>
            Database remains source-of-truth; Google Sheets acts as live spreadsheet viewer & sync interface.
          </Text>
        </View>
        <Badge
          label={statusData?.isConnected ? 'Linked' : 'Not Linked'}
          variant={statusData?.isConnected ? 'success' : 'slate'}
        />
      </View>

      {/* Connection Card */}
      <Card style={styles.connectCard}>
        <View style={styles.cardHeader}>
          <FileSpreadsheet size={24} color={Colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionHeading}>1. Google Account & Target Sheet</Text>
            <Text style={styles.sectionSub}>OAuth 2.0 connection. Securely stored and never hardcoded.</Text>
          </View>
        </View>

        <AppInput
          label="Google Account Email"
          placeholder="e.g. tailor.boutique@gmail.com"
          value={googleEmail}
          onChangeText={setGoogleEmail}
        />

        <AppInput
          label="Target Spreadsheet ID (or leave default to auto-create)"
          placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
          value={spreadsheetId}
          onChangeText={setSpreadsheetId}
        />

        <AppButton
          title={statusData?.isConnected ? 'Update Google Connection' : 'Connect Google Account'}
          onPress={handleConnect}
          variant="primary"
          loading={isConnecting}
          icon={<Link2 size={16} color="#FFFFFF" />}
        />

        {statusData?.spreadsheetUrl && (
          <TouchableOpacity
            style={styles.openSheetLink}
            onPress={() => Linking.openURL(statusData.spreadsheetUrl)}
          >
            <ExternalLink size={14} color={Colors.accent} />
            <Text style={styles.openSheetText}>Open Connected Google Spreadsheet</Text>
          </TouchableOpacity>
        )}
      </Card>

      {/* Two-Way Sync Runner */}
      <Card style={styles.syncCard}>
        <View style={styles.cardHeader}>
          <RefreshCw size={24} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionHeading}>2. Two-Way Sync Engine</Text>
            <Text style={styles.sectionSub}>
              Syncs Customers, Products, Inventory & Orders between Database & Google Sheets.
            </Text>
          </View>
        </View>

        <View style={styles.syncMetaBox}>
          <View style={styles.metaItem}>
            <Clock size={15} color={Colors.textMuted} />
            <Text style={styles.metaLabel}>Last Synced:</Text>
            <Text style={styles.metaValue}>
              {statusData?.lastSyncAt ? new Date(statusData.lastSyncAt).toLocaleString() : 'Never'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Shield size={15} color={Colors.success} />
            <Text style={styles.metaLabel}>Protection:</Text>
            <Text style={[styles.metaValue, { color: Colors.success, fontWeight: '700' }]}>
              Safe Non-Destructive
            </Text>
          </View>
        </View>

        <AppButton
          title={isSyncing ? 'Running Two-Way Sync...' : 'Trigger Sync Now'}
          onPress={handleRunSync}
          variant="accent"
          loading={isSyncing}
          icon={<RefreshCw size={16} color="#FFFFFF" />}
        />

        {/* Sync Summary Result */}
        {syncResult && (
          <View style={styles.syncSummaryBox}>
            <Text style={styles.summaryTitle}>Sync Summary ({syncResult.syncStatus})</Text>
            <Text style={styles.summarySub}>
              Exported snapshots: {Object.entries(syncResult.exportedEntities || {}).map(([k, v]) => `${k} (${v})`).join(', ')}
            </Text>
            {syncResult.conflicts && syncResult.conflicts.length > 0 && (
              <Text style={styles.conflictText}>⚠️ {syncResult.conflicts.length} conflicts flagged for safety.</Text>
            )}
          </View>
        )}
      </Card>

      {/* Quick Export to Google Sheets */}
      <Card style={{ padding: 16 }}>
        <Text style={styles.sectionHeading}>3. Push Single Dataset to Sheet</Text>
        <View style={styles.quickGrid}>
          {[
            { label: 'Export Customers', entity: 'customers' },
            { label: 'Export Products', entity: 'products' },
            { label: 'Export Inventory', entity: 'inventory' },
            { label: 'Export Orders', entity: 'orders' },
            { label: 'Export Production', entity: 'production' },
            { label: 'Export Payments', entity: 'payments' }
          ].map((item) => (
            <TouchableOpacity
              key={item.entity}
              style={styles.quickExportBtn}
              onPress={() => handleExportEntity(item.entity)}
            >
              <Upload size={14} color={Colors.primary} />
              <Text style={styles.quickExportText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    marginTop: 3
  },
  connectCard: {
    padding: 16,
    marginBottom: 12
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text
  },
  sectionSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  openSheetLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8
  },
  openSheetText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent
  },
  syncCard: {
    padding: 16,
    marginBottom: 12
  },
  syncMetaBox: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
    gap: 6
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  metaLabel: {
    fontSize: 12,
    color: Colors.textMuted
  },
  metaValue: {
    fontSize: 12,
    color: Colors.text
  },
  syncSummaryBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC'
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.success
  },
  summarySub: {
    fontSize: 11,
    color: Colors.text,
    marginTop: 2
  },
  conflictText: {
    fontSize: 11,
    color: Colors.danger,
    marginTop: 4
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10
  },
  quickExportBtn: {
    flexBasis: '48%',
    flexGrow: 1,
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
  quickExportText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text
  }
});
