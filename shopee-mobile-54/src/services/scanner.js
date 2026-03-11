import { requestCameraPermissionsAsync } from 'expo-camera';

/**
 * 카메라 권한 요청
 * @returns {Promise<boolean>} 권한 부여 여부
 */
export async function requestCameraPermission() {
  const { status } = await requestCameraPermissionsAsync();
  return status === 'granted';
}

/**
 * 바코드 스캔 결과 정규화
 * - 숫자만 추출 (송장/주문 번호용)
 * @param {string} data - 스캔된 raw 데이터
 * @returns {string} 정제된 문자열
 */
export function normalizeScannedCode(data) {
  if (!data || typeof data !== 'string') return '';
  // 숫자와 영문만 허용 (일부 송장에 영문 포함)
  return data.replace(/\s/g, '').trim();
}
