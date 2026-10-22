"use client"; // Chạy ở trình duyệt

import { useState } from "react"; // Hook trạng thái
import { WagmiProvider } from "wagmi"; // Cung cấp kết nối ví cho cả app
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"; // Bộ nhớ đệm cho dữ liệu đọc từ chuỗi
import { hashFn } from "wagmi/query"; // Hàm băm khóa truy vấn có hỗ trợ số BigInt
import { wagmiConfig } from "../lib/config"; // Cấu hình wagmi

export default function Providers({ children }) { // Bọc toàn bộ app
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { queryKeyHashFn: hashFn } } })); // Tạo bộ nhớ đệm một lần, mặc định băm được BigInt (react-query 5.59 băm khóa trước khi wagmi kịp can thiệp)
  return ( // Lồng hai provider
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
