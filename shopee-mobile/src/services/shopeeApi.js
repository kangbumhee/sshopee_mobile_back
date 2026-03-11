import { shopeeApi as shopeeApiCallable, getShops as getShopsCallable } from '../config/firebase';

/**
 * 연결된 샵 목록 조회
 */
export async function getConnectedShops() {
  const { data } = await getShopsCallable();
  return data?.shops ?? [];
}

/**
 * 주문 목록 조회
 */
export async function getOrders(shopId, { timeFrom, timeTo, pageSize = 50 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const timeToSec = timeTo ?? now;
  const timeFromSec = timeFrom ?? now - 30 * 86400;
  const { data } = await shopeeApiCallable({
    action: 'getOrders',
    shopId: String(shopId),
    params: { timeFrom: timeFromSec, timeTo: timeToSec, pageSize },
  });
  return data;
}

/**
 * 주문 상세 조회
 */
export async function getOrderDetail(shopId, orderSnList) {
  const list = Array.isArray(orderSnList) ? orderSnList : [orderSnList];
  const { data } = await shopeeApiCallable({
    action: 'getOrderDetail',
    shopId: String(shopId),
    params: { orderSnList: list },
  });
  return data;
}

/**
 * 트래킹 번호로 주문 검색 (전체 샵)
 */
export async function searchByTrackingNumber(trackingNumber) {
  const { data } = await shopeeApiCallable({
    action: 'searchByTracking',
    params: { trackingNumber: String(trackingNumber).trim() },
  });
  return data?.orders ?? [];
}

/**
 * 재고 수정
 */
export async function updateStock(shopId, stockData) {
  const { data } = await shopeeApiCallable({
    action: 'updateStock',
    shopId: String(shopId),
    params: { stockData },
  });
  return data;
}

/**
 * 송장 번호 조회
 */
export async function getTrackingNumber(shopId, orderSn) {
  const { data } = await shopeeApiCallable({
    action: 'getTrackingNumber',
    shopId: String(shopId),
    params: { orderSn },
  });
  return data;
}
