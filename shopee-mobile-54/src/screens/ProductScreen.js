import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';

/**
 * 제품 수정: 셀러센터 상품 관리 URL로 이동 (WebView 대체)
 */
export default function ProductScreen({ productId, shopId, onBack }) {
  const openProductPage = () => {
    const url = `https://sellercenter.shopee.co.kr/product/list`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.title}>제품 수정</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.message}>
          상품 상세 수정은 셀러센터에서 진행해 주세요.
        </Text>
        <TouchableOpacity style={styles.button} onPress={openProductPage}>
          <Text style={styles.buttonText}>상품 관리 열기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backText: {
    fontSize: 16,
    color: '#ee4d2d',
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  message: {
    fontSize: 15,
    color: '#555',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#ee4d2d',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
