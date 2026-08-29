import './globals.css';

export const metadata = {
  title: 'CLEAN ROOM — 클린 랭귀지',
  description: 'Clean Language 연습. 상대가 말한 단어만 써서 마음속 소리를 들어 보세요.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
