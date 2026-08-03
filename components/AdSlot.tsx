import { useEffect } from 'react';

interface Props {
  slot: string;
  className?: string;
}

const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined;

let scriptLoaded = false;

const ensureScriptLoaded = () => {
  if (scriptLoaded || !ADSENSE_CLIENT) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  s.crossOrigin = 'anonymous';
  document.head.appendChild(s);
  scriptLoaded = true;
};

// 구글 애드센스 승인 전(VITE_ADSENSE_CLIENT_ID 미설정)에는 아무것도 렌더링하지 않음
export default function AdSlot({ slot, className = '' }: Props) {
  useEffect(() => {
    if (!ADSENSE_CLIENT) return;
    ensureScriptLoaded();
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
