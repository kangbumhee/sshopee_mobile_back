import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { onAuthChange, signInWithGoogleIdToken } from '../services/auth';

/**
 * 로그인 화면
 * - 웹: Google 로그인 버튼 → 리다이렉트/팝업 (추가 설정 필요)
 * - 앱: expo-auth-session + Google OAuth 후 idToken으로 signInWithGoogleIdToken 호출
 * 현재는 "테스트 로그인" 플로우만 제공. 실제 Google 로그인은 expo-auth-session 연동 필요.
 */
export default function LoginScreen({ onLogin }) {
  const [loading, setLoading] = React.useState(false);

  useEffect(() => {
    const unsub = onAuthChange((user) => {
      if (user) onLogin?.();
    });
    return () => unsub();
  }, [onLogin]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      // TODO: expo-auth-session으로 Google ID 토큰 발급 후 아래 호출
      // await signInWithGoogleIdToken(idToken);
      Alert.alert(
        'Google 로그인',
        '크롬 확장에서 사용 중인 Google 계정으로 로그인해야 합니다. 웹에서 Firebase Auth 연동 후, 앱에서는 expo-auth-session으로 Google ID 토큰을 받아 signInWithGoogleIdToken()을 호출하세요.'
      );
    } catch (e) {
      Alert.alert('로그인 실패', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Shopee Mobile Manager</Text>
      <Text style={styles.subtitle}>크롬 확장과 동일한 Firebase 계정으로 로그인하세요.</Text>
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleGoogleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Google 로그인</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#ee4d2d',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
