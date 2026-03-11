import OrderDetailContent from './OrderDetailContent';

export function generateStaticParams() {
  return [{ id: '0' }];
}

export default function OrderPage({ params }) {
  return <OrderDetailContent orderSn={params?.id} />;
}
