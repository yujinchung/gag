import './globals.css';

export const metadata = {
  title: 'CLEAN ROOM — 오염 탐지기',
  description: 'Clean Language 연습. 상대가 말한 단어만 써서 마음속 그림을 되살려 보세요.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
