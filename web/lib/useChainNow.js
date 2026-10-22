"use client"; // Chạy ở trình duyệt

import { useEffect, useState } from "react"; // Hook trạng thái
import { useBlock } from "wagmi"; // Đọc block mới nhất
import { targetChain } from "./config"; // Mạng đích

// Giờ hiện tại (giây) theo chuỗi = giờ của block mới nhất + thời gian đã trôi kể từ lúc đọc block đó.
// Đồng hồ máy có thể lệch so với chuỗi (nhanh hoặc chậm), contract chỉ tin giờ của block.
export function useChainNow() {
  const [wall, setWall] = useState(Math.floor(Date.now() / 1000)); // Giờ đồng hồ máy
  useEffect(() => { // Cho đồng hồ chạy mỗi giây để đếm ngược
    const timer = setInterval(() => setWall(Math.floor(Date.now() / 1000)), 1000); // Mỗi giây cập nhật
    return () => clearInterval(timer); // Dọn khi rời trang
  }, []);
  const block = useBlock({ chainId: targetChain.id, query: { refetchInterval: 5000 } }); // Block mới nhất, tải lại mỗi 5 giây
  const fetchedAt = Math.floor((block.dataUpdatedAt || Date.now()) / 1000); // Lúc máy đọc được block đó
  const offset = block.data ? Number(block.data.timestamp) - fetchedAt : 0; // Chuỗi lệch so với máy bao nhiêu giây (âm nếu chuỗi chậm hơn)
  return wall + offset; // Giờ theo chuỗi
}
