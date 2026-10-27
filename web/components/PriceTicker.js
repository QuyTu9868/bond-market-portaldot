"use client"; // Chạy ở trình duyệt

import { useEffect, useState } from "react"; // Hook trạng thái

const URL = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true"; // API giá công khai của CoinGecko, không cần khóa
const COINS = [{ id: "bitcoin", label: "BTC" }, { id: "ethereum", label: "ETH" }, { id: "solana", label: "SOL" }]; // Ba đồng hiện giá

export default function PriceTicker() { // Dải giá tham khảo, KHÔNG quyết định kết quả thị trường nào
  const [prices, setPrices] = useState(null); // Giá mới nhất, null khi chưa lấy được

  useEffect(() => { // Lấy giá ngay và cập nhật mỗi 60 giây
    let alive = true; // Tránh cập nhật sau khi rời trang
    async function load() { // Một lần lấy giá
      try { // Thử gọi API
        const res = await fetch(URL); // Gọi
        if (!res.ok) throw new Error("HTTP " + res.status); // Bị giới hạn hoặc lỗi thì bỏ qua
        const data = await res.json(); // Đọc kết quả
        if (alive) setPrices(data); // Lưu giá
      } catch (e) { /* Lỗi mạng hoặc bị giới hạn: giữ giá cũ, không làm hỏng trang */ } // Không báo lỗi to vì chỉ là thông tin phụ
    }
    load(); // Lấy lần đầu
    const timer = setInterval(load, 60000); // Lặp lại mỗi phút (tôn trọng giới hạn của API miễn phí)
    return () => { alive = false; clearInterval(timer); }; // Dọn khi rời trang
  }, []);

  if (!prices) return null; // Chưa có giá thì không hiện gì

  return ( // Giao diện dải giá
    <div className="ticker">
      {COINS.map(({ id, label }) => {
        const price = prices[id]?.usd; // Giá USD
        const change = prices[id]?.usd_24h_change; // Thay đổi 24 giờ
        if (price === undefined) return null; // Thiếu dữ liệu thì bỏ đồng này
        return <span key={id} className="coin"><b>{label}</b> ${price.toLocaleString("en-US", { maximumFractionDigits: 2 })} <i className={change >= 0 ? "up" : "down"}>{change >= 0 ? "+" : ""}{change?.toFixed(2)}%</i></span>;
      })}
      <span className="muted">Live prices from CoinGecko, for reference only. They never decide a market.</span>
    </div>
  );
}
