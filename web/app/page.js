"use client"; // Chạy ở trình duyệt vì dùng hook của ví

import { useEffect, useState } from "react"; // Hook trạng thái
import { keepPreviousData } from "@tanstack/react-query"; // Giữ dữ liệu cũ khi đang tải dữ liệu mới
import { useAccount, useConnect, useDisconnect, useSwitchChain, useReadContract, useReadContracts } from "wagmi"; // Hook ví và đọc chuỗi
import { marketAbi } from "../lib/contract"; // ABI
import { marketAddress, targetChain } from "../lib/config"; // Địa chỉ contract và mạng đích
import { fmt } from "../lib/format"; // Hiện số tiền gọn
import CreateMarketForm from "../components/CreateMarketForm"; // Form tạo thị trường
import MarketCard from "../components/MarketCard"; // Thẻ thị trường
import ThemeToggle from "../components/ThemeToggle"; // Nút chuyển sáng tối

export default function Home() { // Trang chủ
  const [mounted, setMounted] = useState(false); // Tránh lệch giữa server và trình duyệt khi render
  useEffect(() => setMounted(true), []); // Đánh dấu đã chạy ở trình duyệt
  const { address, isConnected, chainId } = useAccount(); // Trạng thái ví
  const { connect, connectors, isPending: connecting, error: connectError } = useConnect(); // Kết nối ví
  const { disconnect } = useDisconnect(); // Ngắt kết nối
  const { switchChain, isPending: switching } = useSwitchChain(); // Đổi mạng

  const count = useReadContract({ address: marketAddress, abi: marketAbi, functionName: "marketCount", chainId: targetChain.id, query: { enabled: !!marketAddress, refetchInterval: 5000 } }); // Số thị trường, tự tải lại mỗi 5 giây
  const total = Number(count.data ?? 0n); // Đổi sang số thường
  const ids = Array.from({ length: total }, (_, i) => i); // Danh sách id tăng dần, vị trí trong kết quả đọc chính là id, nên thêm thị trường mới không làm lệch dữ liệu cũ
  const list = useReadContracts({ // Đọc dữ liệu mọi thị trường trong một lần gọi
    contracts: ids.map((id) => ({ address: marketAddress, abi: marketAbi, functionName: "markets", args: [BigInt(id)], chainId: targetChain.id })), // Mỗi id một lệnh đọc
    query: { enabled: total > 0, refetchInterval: 5000, placeholderData: keepPreviousData }, // Chỉ đọc khi có thị trường, giữ dữ liệu cũ khi đang tải lại để thẻ không bị gỡ và dựng lại (làm mất số đang gõ)
  });
  function refresh() { // Tải lại sau khi có giao dịch thành công
    count.refetch(); // Tải lại số thị trường
    list.refetch(); // Tải lại danh sách
  }

  if (!mounted) return null; // Chưa sẵn sàng thì chưa vẽ
  const wrongNetwork = isConnected && chainId !== targetChain.id; // Ví đang ở mạng khác
  const symbol = targetChain.nativeCurrency.symbol; // Ký hiệu tiền của mạng (tPOT trên testnet)
  let totalBet = 0n; // Tổng tiền đã cược ở mọi thị trường
  let totalBond = 0n; // Tổng tiền đã cọc ở mọi thị trường
  for (const item of list.data ?? []) { // Cộng dồn từ dữ liệu đã đọc
    if (item.status !== "success") continue; // Bỏ qua thị trường chưa đọc được
    const [, , , , poolYes, poolNo, bondYes, bondNo] = item.result; // Các quỹ của thị trường này
    totalBet += poolYes + poolNo; // Cộng quỹ cược
    totalBond += bondYes + bondNo; // Cộng quỹ cọc
  }

  return ( // Giao diện trang
    <main>
      <header>
        <div className="brand"><img src="/logo.svg" alt="" />Bond Market</div>
        <div className="header-right">
          <span className="pill">{targetChain.name}</span>
          <ThemeToggle />
          {!isConnected && <button disabled={connecting} onClick={() => connect({ connector: connectors[0] })}>Connect wallet</button>}
          {isConnected && <><span className="pill">{address.slice(0, 6)}...{address.slice(-4)}</span><button className="ghost" onClick={() => disconnect()}>Disconnect</button></>}
        </div>
      </header>

      <section className="hero">
        <svg className="watermark" viewBox="0 0 512 512" aria-hidden="true"><circle cx="312" cy="256" r="96" fill="none" stroke="var(--accent)" strokeWidth="40" /><circle cx="200" cy="256" r="96" fill="none" stroke="var(--fg)" strokeWidth="40" /></svg>
        <h1>Predict. Bond. <em>Settle.</em></h1>
        <p>The larger bond decides the result. No oracle, no admin.</p>
      </section>
      <div className="stats">
        <div className="stat"><b>{total}</b><span>Markets</span></div>
        <div className="stat"><b>{fmt(totalBet)}</b><span>{symbol} bet</span></div>
        <div className="stat"><b>{fmt(totalBond)}</b><span>{symbol} bonded</span></div>
      </div>

      {connectError && <p className="status error">Could not connect: install MetaMask or unlock it, then try again.</p>}
      {!marketAddress && <p className="status error">Contract address missing. Copy web/.env.local.example to web/.env.local and fill NEXT_PUBLIC_MARKET_ADDRESS.</p>}

      {wrongNetwork && ( // Điều kiện tiên quyết: đúng mạng trước khi giao dịch
        <div className="card">
          <p>Your wallet is on the wrong network. Switch to {targetChain.name} to continue.</p>
          <button disabled={switching} onClick={() => switchChain({ chainId: targetChain.id })}>Switch network</button>
        </div>
      )}

      {isConnected && !wrongNetwork && marketAddress && <CreateMarketForm onDone={refresh} />}
      {!isConnected && marketAddress && <p className="muted">Connect your wallet to create markets, bet and bond. You can read markets without a wallet.</p>}

      <h2>Markets</h2>
      {marketAddress && total === 0 && !count.isLoading && <p className="muted">No markets yet. Create the first one.</p>}
      <div className="markets">
        {[...ids].reverse().map((id) => { // Vẽ từng thị trường, mới nhất đứng trước
          const data = list.data?.[id]; // Kết quả đọc của thị trường này (vị trí trong danh sách = id)
          if (!data || data.status !== "success") return null; // Chưa có dữ liệu thì bỏ qua
          return <MarketCard key={id} id={id} market={data.result} onChange={refresh} />; // Vẽ thẻ
        })}
      </div>
    </main>
  );
}
