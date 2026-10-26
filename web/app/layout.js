import { Instrument_Serif } from "next/font/google"; // Phông serif miễn phí (giấy phép OFL) cho tiêu đề lớn
import "./globals.css"; // Nạp CSS chung
import Providers from "./providers"; // Provider ví

export const metadata = { // Thông tin trang
  title: "Bond Market", // Tiêu đề tab
  description: "Prediction market resolved by a bond war, no oracle", // Mô tả
};

const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" }); // Tải phông về cùng app lúc build, không gọi Google khi người dùng mở trang

const THEME_SCRIPT = 'try{var t=localStorage.getItem("theme");if(t){document.documentElement.dataset.theme=t}}catch(e){}'; // Đặt chế độ sáng hoặc tối đã chọn từ lần trước, chạy trước khi vẽ trang để không bị nháy màu

export default function RootLayout({ children }) { // Khung chung của mọi trang
  return ( // Thẻ html gốc
    <html lang="en" className={serif.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
