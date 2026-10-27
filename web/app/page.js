"use client"; // Chạy ở trình duyệt vì dùng hook của ví

import { useEffect, useState } from "react"; // Hook trạng thái
import { keepPreviousData } from "@tanstack/react-query"; // Giữ dữ liệu cũ khi đang tải dữ liệu mới
import { useAccount, useConnect, useDisconnect, useSwitchChain, useReadContract, useReadContracts } from "wagmi"; // Hook ví và đọc chuỗi
import { marketAbi, CATEGORIES } from "../lib/contract"; // ABI và danh mục
import { marketAddress, targetChain } from "../lib/config"; // Địa chỉ contract và mạng đích
import { fmt } from "../lib/format"; // Hiện số tiền gọn
import CreateMarketForm from "../components/CreateMarketForm"; // Form tạo thị trường
import MarketCard from "../components/MarketCard"; // Thẻ thị trường
import ThemeToggle from "../components/ThemeToggle"; // Nút chuyển sáng tối
import PriceTicker from "../components/PriceTicker"; // Dải giá tham khảo
import HowItWorks from "../components/HowItWorks"; // Khối giải thích ngắn
import Portfolio from "../components/Portfolio"; // Trang vị thế của người dùng

function readRoute() { // Đọc trang đang xem từ phần sau dấu # của địa chỉ, nhờ vậy mỗi thị trường có đường dẫn riêng để chia sẻ
  const hash = window.location.hash; // Phần sau dấu #
  if (hash === "#portfolio") return { view: "portfolio" }; // Trang vị thế
  const match = /^#m=(\d+)$/.exec(hash); // Trang riêng của một thị trường, dạng #m=5
  if (match) return { view: "market", id: Number(match[1]) }; // Trả về id
  return { view: "markets" }; // Mặc định là danh sách
}

export default function Home() { // Trang chủ
  const [route, setRoute] = useState({ view: "markets" }); // Trang đang xem
  const [filter, setFilter] = useState(-1); // Danh mục đang lọc, -1 là tất cả
  const [query, setQuery] = useState(""); // Chữ đang tìm
  const [sort, setSort] = useState("newest"); // Cách sắp xếp: newest, pool hoặc ending
  const [mounted, setMounted] = useState(false); // Tránh lệch giữa server và trình duyệt khi render
  useEffect(() => { // Khi vào trang: đọc địa chỉ và theo dõi khi người dùng đổi trang
    setMounted(true); // Đánh dấu đã chạy ở trình duyệt
    setRoute(readRoute()); // Trang ban đầu
    const onChange = () => setRoute(readRoute()); // Khi địa chỉ đổi
    window.addEventListener("hashchange", onChange); // Lắng nghe
    return () => window.removeEventListener("hashchange", onChange); // Dọn khi rời trang
  }, []);
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
  const perCategory = {}; // Số thị trường theo danh mục
  for (const item of list.data ?? []) { // Cộng dồn từ dữ liệu đã đọc
    if (item.status !== "success") continue; // Bỏ qua thị trường chưa đọc được
    const [, , , , poolYes, poolNo, bondYes, bondNo] = item.result; // Các quỹ của thị trường này
    totalBet += poolYes + poolNo; // Cộng quỹ cược
    totalBond += bondYes + bondNo; // Cộng quỹ cọc
    perCategory[item.result[9]] = (perCategory[item.result[9]] ?? 0) + 1; // Đếm số thị trường của từng danh mục
  }

  const needle = query.trim().toLowerCase(); // Chữ tìm kiếm viết thường
  const nowSeconds = Math.floor(Date.now() / 1000); // Giờ hiện tại để sắp xếp theo hạn
  const visible = ids // Các thị trường sẽ hiện: lọc theo danh mục và chữ tìm, rồi sắp xếp
    .map((id) => ({ id, data: list.data?.[id] }))
    .filter(({ data }) => data && data.status === "success")
    .filter(({ data }) => filter === -1 || data.result[9] === filter)
    .filter(({ id, data }) => needle === "" || data.result[0].toLowerCase().includes(needle) || `#${id}` === needle)
    .sort((a, b) => {
      const ra = a.data.result; const rb = b.data.result; // Dữ liệu hai thị trường
      if (sort === "pool") { // Quỹ lớn nhất trước (cược cộng cọc)
        const pa = ra[4] + ra[5] + ra[6] + ra[7]; const pb = rb[4] + rb[5] + rb[6] + rb[7]; // Tổng quỹ
        return pa === pb ? b.id - a.id : pa > pb ? -1 : 1;
      }
      if (sort === "ending") { // Sắp hết hạn cược trước, thị trường đã qua hạn xuống cuối
        const ea = Number(ra[2]) > nowSeconds && ra[8] === 0 ? Number(ra[2]) : Infinity; // Hạn còn hiệu lực
        const eb = Number(rb[2]) > nowSeconds && rb[8] === 0 ? Number(rb[2]) : Infinity;
        return ea === eb ? b.id - a.id : ea - eb;
      }
      return b.id - a.id; // Mới nhất trước
    });

  return ( // Giao diện trang
    <main>
      <header>
        <a className="brand" href="#markets"><img src="/logo.svg" alt="" />Bond Market</a>
        <nav className="nav">
          <a href="#markets" className={route.view === "portfolio" ? "" : "active"}>Markets</a>
          <a href="#portfolio" className={route.view === "portfolio" ? "active" : ""}>Portfolio</a>
        </nav>
        <div className="header-right">
          <span className="pill">{targetChain.name}</span>
          <ThemeToggle />
          {!isConnected && <button disabled={connecting} onClick={() => connect({ connector: connectors[0] })}>Connect wallet</button>}
          {isConnected && <><span className="pill">{address.slice(0, 6)}...{address.slice(-4)}</span><button className="ghost" onClick={() => disconnect()}>Disconnect</button></>}
        </div>
      </header>

      {route.view === "markets" && <>
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
        <PriceTicker />
        <HowItWorks />
      </>}

      {connectError && <p className="status error">Could not connect: install MetaMask or unlock it, then try again.</p>}
      {!marketAddress && <p className="status error">Contract address missing. Copy web/.env.local.example to web/.env.local and fill NEXT_PUBLIC_MARKET_ADDRESS.</p>}

      {wrongNetwork && ( // Điều kiện tiên quyết: đúng mạng trước khi giao dịch
        <div className="card">
          <p>Your wallet is on the wrong network. Switch to {targetChain.name} to continue.</p>
          <button disabled={switching} onClick={() => switchChain({ chainId: targetChain.id })}>Switch network</button>
        </div>
      )}

      {route.view === "portfolio" && <Portfolio markets={list.data} onChange={refresh} />}

      {route.view === "market" && <>
        <p><a href="#markets">&larr; All markets</a></p>
        {list.data?.[route.id]?.status === "success"
          ? <div className="single"><MarketCard key={route.id} id={route.id} market={list.data[route.id].result} onChange={refresh} detail /></div>
          : <p className="muted">{total > 0 && route.id >= total ? "This market does not exist." : "Loading market..."}</p>}
      </>}

      {route.view === "markets" && <>
        {isConnected && !wrongNetwork && marketAddress && <CreateMarketForm onDone={refresh} />}
        {!isConnected && marketAddress && <p className="muted">Connect your wallet to create markets, bet and bond. You can read markets without a wallet.</p>}

        <h2>Markets</h2>
        <div className="tabs">
          <button className={`tab ${filter === -1 ? "active" : ""}`} onClick={() => setFilter(-1)}>All ({total})</button>
          {CATEGORIES.map((name, index) => <button key={name} className={`tab ${filter === index ? "active" : ""}`} onClick={() => setFilter(index)}>{name} ({perCategory[index] ?? 0})</button>)}
        </div>
        <div className="toolbar">
          <input type="search" aria-label="Search markets" placeholder="Search markets by question or #id" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select aria-label="Sort markets" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest</option>
            <option value="pool">Biggest pool</option>
            <option value="ending">Ending soon</option>
          </select>
        </div>
        {marketAddress && total === 0 && !count.isLoading && <p className="muted">No markets yet. Create the first one.</p>}
        {total > 0 && visible.length === 0 && <p className="muted">No markets match your filters.</p>}
        <div className="markets">
          {visible.map(({ id, data }) => <MarketCard key={id} id={id} market={data.result} onChange={refresh} />)}
        </div>
      </>}
    </main>
  );
}
