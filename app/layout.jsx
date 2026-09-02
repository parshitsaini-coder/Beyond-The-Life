import './globals.css';

export const metadata = {
  title: 'BTL Dashboard',
  description: 'Life Goals, Daily Routines & Time Table Tracker',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
