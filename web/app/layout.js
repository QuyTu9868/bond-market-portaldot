import "./globals.css"; // Nạp CSS chung
import Providers from "./providers"; // Provider ví

export const metadata = { // Thông tin trang
  title: "Bond Market", // Tiêu đề tab
  description: "Prediction market resolved by a bond war, no oracle", // Mô tả
};

export default function RootLayout({ children }) { // Khung chung của mọi trang
  return ( // Thẻ html gốc
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
