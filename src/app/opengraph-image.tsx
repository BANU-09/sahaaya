import { ImageResponse } from 'next/og';
export const alt = 'SAHAAYA by BanuSreya — Your health. Your family. Always connected.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '64px 72px',
        background: '#faf7f0',
        color: '#153f36',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <svg width="76" height="76" viewBox="0 0 48 48">
          <rect width="48" height="48" rx="16" fill="#153f36" />
          <path
            d="M24 30c-3-3-11-7-11-13 0-6 8-7 11-2 3-5 11-4 11 2 0 6-8 10-11 13Z"
            fill="#fff8ed"
          />
          <path
            d="M9 29c4 7 11 10 15 10s11-3 15-10M10 28l5-3m23 3-5-3"
            stroke="#a9dcc4"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        <span style={{ fontSize: 44, fontWeight: 700 }}>sahaaya.</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 66, fontWeight: 700, lineHeight: 1.08 }}>
          Your health. Your family.
        </div>
        <div style={{ fontSize: 66, fontWeight: 700, color: '#377761' }}>Always connected.</div>
        <div style={{ fontSize: 25, color: '#546c62', marginTop: 14 }}>
          Reviewed medicines · Shared follow-up · Six languages
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 24,
          borderTop: '1px solid #cddbd2',
          paddingTop: 24,
        }}
      >
        <span>Care coordination with the patient in control.</span>
        <span>By BanuSreya</span>
      </div>
    </div>,
    size,
  );
}
