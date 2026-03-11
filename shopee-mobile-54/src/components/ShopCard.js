import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function ShopCard({ shop, onPress }) {
  const isValid = shop.token_valid !== false;

  return (
    <TouchableOpacity style={[styles.card, !isValid && styles.cardInvalid]} onPress={() => onPress?.(shop)} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.shopName} numberOfLines={1}>
          {shop.shop_name || `샵 ${shop.shop_id}`}
        </Text>
        {shop.memo ? (
          <Text style={styles.memo} numberOfLines={1}>
            {shop.memo}
          </Text>
        ) : null}
      </View>
      <View style={styles.footer}>
        <Text style={styles.region}>{shop.region || '-'}</Text>
        {!isValid && <Text style={styles.badge}>토큰 만료</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardInvalid: {
    opacity: 0.85,
    borderLeftWidth: 4,
    borderLeftColor: '#ee4d2d',
  },
  header: {
    marginBottom: 8,
  },
  shopName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  memo: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  region: {
    fontSize: 12,
    color: '#666',
  },
  badge: {
    fontSize: 11,
    color: '#ee4d2d',
    fontWeight: '600',
  },
});
