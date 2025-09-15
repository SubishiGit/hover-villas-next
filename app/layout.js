import "./globals.css";

export const metadata = {
  title: "Hover Villas Master Plan",
  description: "Interactive master plan for the villa community",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
