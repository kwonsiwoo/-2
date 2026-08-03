import { useEffect } from 'react';

interface Props {
  slot: string;
  className?: string;
}

const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined;

// adsbygoogle.js는 index.html <head>에서 정적으로 로드됨 (애드센스 사이트 인증용).
// 구글 애드센스 승인 전(VITE_ADSENSE_CLIENT_ID 미설정)에는 아무것도 렌더링하지 않음.
export default function AdSlot({ slot, className = '' }: Props) {
  useEffect(() => {
    if (!ADSENSE_CLIENT) return;
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch {}
  }, []);

  if (!ADSENSE_CLIENT) return null;

  return (
    <ins
      className={`adsbygoogle block ${className}`}
      style={{ display: 'block' }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
