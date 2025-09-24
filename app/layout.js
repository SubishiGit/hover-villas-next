import "./globals.css";

export const metadata = {
  title: "Hover Villas Master Plan",
  description: "Interactive master plan for the villa community",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover" />
      </head>
      <body className="overflow-hidden">{children}</body>
    </html>
  );
}
