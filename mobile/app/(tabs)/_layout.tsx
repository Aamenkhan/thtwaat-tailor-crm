import React from 'react';
import { Tabs } from 'expo-router';
import { Colors } from '../../src/constants/theme';
import { LayoutDashboard, ShoppingBag, Layers, Users, Menu } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: Colors.primary,
          borderTopColor: Colors.primaryLight,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600'
        },
        headerStyle: {
          backgroundColor: Colors.primary,
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '700'
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          headerTitle: 'Business Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />
        }}
      />

      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          headerTitle: 'Orders Management',
          tabBarIcon: ({ color, size }) => <ShoppingBag size={size} color={color} />
        }}
      />

      <Tabs.Screen
        name="production"
        options={{
          title: 'Production',
          headerTitle: 'Production Pipeline',
          tabBarIcon: ({ color, size }) => <Layers size={size} color={color} />
        }}
      />

      <Tabs.Screen
        name="crm"
        options={{
          title: 'Customers',
          headerTitle: 'Customer CRM',
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />
        }}
      />

      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          headerTitle: 'Workspace & Tools',
          tabBarIcon: ({ color, size }) => <Menu size={size} color={color} />
        }}
      />
    </Tabs>
  );
}
