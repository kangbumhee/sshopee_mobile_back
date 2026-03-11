import React from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';

/**
 * 1:1 채팅: Shopee 셀러센터/채팅 URL로 이동
 * order 정보로 채팅 링크 생성 가능 시 여기서 처리
 */
export default function ChatScreen({ order, shopId, onBack }) {
  const openSellerCenter = () => {
    const url = 'https://sellercenter.shopee.co.kr/';
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.title}>채팅</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.message}>
          구매자와의 1:1 채팅은 Shopee 셀러 앱 또는 셀러센터에서 이용하세요.
        </Text>
        <TouchableOpacity style={styles.button} onPress={openSellerCenter}>
          <Text style={styles.buttonText}>셀러센터 열기</Text>
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
