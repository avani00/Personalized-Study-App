import "./globals.css";

export const metadata = {
  title: "Personalized Study App",
  description: "AI-powered adaptive study question generator",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
