import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function OrderCard({ order, shopName, onPress }) {
  const orderSn = order.order_sn || order.orderSn;
  const status = order.order_status || order.order_status_pending || '-';
  const tracking = order.tracking_number || (order.package_list && order.package_list[0]?.tracking_number) || '';

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress?.(order)} activeOpacity={0.7}>
      <Text style={styles.orderSn}>{orderSn}</Text>
      {shopName ? <Text style={styles.shopName}>{shopName}</Text> : null}
      <View style={styles.row}>
        <Text style={styles.label}>상태</Text>
        <Text style={styles.value}>{status}</Text>
      </View>
      {tracking ? (
        <View style={styles.row}>
          <Text style={styles.label}>송장</Text>
          <Text style={styles.value} numberOfLines={1}>
            {tracking}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  orderSn: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  shopName: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  label: {
    fontSize: 12,
    color: '#666',
    width: 48,
  },
  value: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
});
