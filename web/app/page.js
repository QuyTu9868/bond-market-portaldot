"use client"; // Chạy ở trình duyệt vì dùng hook của ví

import { useEffect, useState } from "react"; // Hook trạng thái
import { useAccount, useConnect, useDisconnect, useSwitchChain, useReadContract, useReadContracts } from "wagmi"; // Hook ví và đọc chuỗi
import { marketAbi } from "../lib/contract"; // ABI
import { marketAddress, targetChain } from "../lib/config"; // Địa chỉ contract và mạng đích
import CreateMarketForm from "../components/CreateMarketForm"; // Form tạo thị trường
import MarketCard from "../components/MarketCard"; // Thẻ thị trường

export default function Home() { // Trang chủ
  const [mounted, setMounted] = useState(false); // Tránh lệch giữa server và trình duyệt khi render
  useEffect(() => setMounted(true), []); // Đánh dấu đã chạy ở trình duyệt
  const { address, isConnected, chainId } = useAccount(); // Trạng thái ví
  const { connect, connectors, isPending: connecting, error: connectError } = useConnect(); // Kết nối ví
  const { disconnect } = useDisconnect(); // Ngắt kết nối
  const { switchChain, isPending: switching } = useSwitchChain(); // Đổi mạng

  const count = useReadContract({ address: marketAddress, abi: marketAbi, functionName: "marketCount", chainId: targetChain.id, query: { enabled: !!marketAddress, refetchInterval: 5000 } }); // Số thị trường, tự tải lại mỗi 5 giây
  const total = Number(count.data ?? 0n); // Đổi sang số thường
  const ids = Array.from({ length: total }, (_, i) => total - 1 - i); // Danh sách id, mới nhất đứng trước
  const list = useReadContracts({ // Đọc dữ liệu mọi thị trường trong một lần gọi
    contracts: ids.map((id) => ({ address: marketAddress, abi: marketAbi, functionName: "markets", args: [BigInt(id)], chainId: targetChain.id })), // Mỗi id một lệnh đọc
    query: { enabled: total > 0, refetchInterval: 5000 }, // Chỉ đọc khi có thị trường
  });
  function refresh() { // Tải lại sau khi có giao dịch thành công
    count.refetch(); // Tải lại số thị trường
    list.refetch(); // Tải lại danh sách
  }

  if (!mounted) return null; // Chưa sẵn sàng thì chưa vẽ
  const wrongNetwork = isConnected && chainId !== targetChain.id; // Ví đang ở mạng khác

  return ( // Giao diện trang
    <main>
      <header>
        <div>
          <h1>Bond Market</h1>
          <p className="muted">Bet Yes or No. The result is decided by whoever bonds more, no oracle, no admin.</p>
        </div>
        <div className="wallet">
          {!isConnected && <button disabled={connecting} onClick={() => connect({ connector: connectors[0] })}>Connect wallet</button>}
          {isConnected && <><span className="muted">{address.slice(0, 6)}...{address.slice(-4)}</span> <button className="ghost" onClick={() => disconnect()}>Disconnect</button></>}
        </div>
      </header>

      {connectError && <p className="status error">Could not connect: install MetaMask or unlock it, then try again.</p>}
      {!marketAddress && <p className="status error">Contract address missing. Copy web/.env.local.example to web/.env.local and fill NEXT_PUBLIC_MARKET_ADDRESS.</p>}
      <p className="muted">Network: {targetChain.name}</p>

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
      {ids.map((id, index) => { // Vẽ từng thị trường
        const data = list.data?.[index]; // Kết quả đọc của thị trường này
        if (!data || data.status !== "success") return null; // Chưa có dữ liệu thì bỏ qua
        return <MarketCard key={id} id={id} market={data.result} onChange={refresh} />; // Vẽ thẻ
      })}
    </main>
  );
}
