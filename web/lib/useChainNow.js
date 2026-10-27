"use client"; // Chạy ở trình duyệt

import { useEffect, useState } from "react"; // Hook trạng thái
import { useBlock } from "wagmi"; // Đọc block mới nhất
import { targetChain } from "./config"; // Mạng đích

// Giờ AN TOÀN theo chuỗi: chính là giờ của block mới nhất (giây). Giao dịch chỉ chạy ở block sau đó, nên giờ này không bao giờ SỚM hơn giờ contract thấy.
// Dùng cho mọi quyết định "đã tới mốc chưa" (cho cọc, chốt, nhận tiền), để không bấm được nút rồi bị contract từ chối vì chưa tới giờ.
export function useChainNow() {
  const block = useBlock({ chainId: targetChain.id, query: { refetchInterval: 2000 } }); // Block mới nhất, tải lại mỗi 2 giây
  return block.data ? Number(block.data.timestamp) : Math.floor(Date.now() / 1000); // Chưa có block thì tạm dùng đồng hồ máy
}

// Giờ HIỂN THỊ: giờ của block mới nhất cộng thời gian đã trôi kể từ lúc đọc, chạy mượt từng giây. CHỈ dùng để vẽ chữ đếm ngược, không dùng để quyết định cho bấm nút.
export function useChainDisplayNow() {
  const [wall, setWall] = useState(Math.floor(Date.now() / 1000)); // Giờ đồng hồ máy
  useEffect(() => { // Cho đồng hồ chạy mỗi giây để đếm ngược mượt
    const timer = setInterval(() => setWall(Math.floor(Date.now() / 1000)), 1000); // Mỗi giây cập nhật
    return () => clearInterval(timer); // Dọn khi rời trang
  }, []);
  const block = useBlock({ chainId: targetChain.id, query: { refetchInterval: 2000 } }); // Cùng truy vấn block với hàm trên
  const fetchedAt = Math.floor((block.dataUpdatedAt || Date.now()) / 1000); // Lúc máy đọc được block đó
  const offset = block.data ? Number(block.data.timestamp) - fetchedAt : 0; // Chuỗi lệch so với máy bao nhiêu giây
  return wall + offset; // Giờ ước lượng để hiển thị
}
