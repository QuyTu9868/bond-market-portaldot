"use client"; // Chạy ở trình duyệt

import { keepPreviousData } from "@tanstack/react-query"; // Giữ dữ liệu cũ khi tải lại
import { useAccount, useReadContracts } from "wagmi"; // Ví và đọc chuỗi
import { marketAbi, RESULT_LABELS, CATEGORIES } from "../lib/contract"; // ABI, tên kết quả và danh mục
import { marketAddress, targetChain } from "../lib/config"; // Địa chỉ contract và mạng
import { useTx } from "../lib/useTx"; // Hook gửi giao dịch
import { useChainNow } from "../lib/useChainNow"; // Giờ theo chuỗi
import { computePayout } from "../lib/payout"; // Tính tiền sẽ nhận
import { REFUND_DELAY } from "../lib/phase"; // Số giây chờ hoàn tiền khi không ai cọc
import { fmt } from "../lib/format"; // Hiện số tiền gọn
import TxStatus from "./TxStatus"; // Trạng thái giao dịch

function Row({ id, market, position, now, onChange }) { // Một dòng vị thế của người dùng trong một thị trường
  const tx = useTx(onChange); // Giao dịch chốt hoặc nhận tiền của dòng này
  const [question, , bettingEndsAt, windowEnd, , , , , result, category] = market; // Các trường cần dùng
  const [betYes, betNo, bondYes, bondNo, claimed] = position; // Phần của người dùng
  const end = Number(bettingEndsAt); // Hạn cược
  const wEnd = Number(windowEnd); // Hạn chốt, 0 nếu chưa ai cọc
  const finalizable = result !== 0 || (wEnd !== 0 && now >= wEnd) || (wEnd === 0 && now >= end + REFUND_DELAY); // Đã có thể chốt hoặc nhận tiền
  const payout = computePayout(market, position); // Số tiền sẽ nhận (0 nếu đã nhận)
  const busy = tx.status === "signing" || tx.status === "confirming"; // Đang xử lý
  let status = "Resolution window"; // Mô tả trạng thái
  if (result !== 0) status = `Finished: ${RESULT_LABELS[result]}`; // Đã chốt
  else if (finalizable) status = "Ready to settle"; // Sẵn sàng chốt
  else if (now < end) status = "Betting open"; // Còn cược được
  else if (wEnd === 0) status = "Waiting for bond"; // Chưa ai cọc
  return ( // Một dòng
    <div className="pf-row">
      <div className="pf-main">
        <p className="cat">{CATEGORIES[category] ?? "Other"}</p>
        <a className="pf-title" href={`#m=${id}`}>#{id} {question}</a>
        <p className="muted">{status}</p>
      </div>
      <div className="pf-cell"><span className="small">Your bets</span><b>Yes {fmt(betYes)} / No {fmt(betNo)}</b></div>
      <div className="pf-cell"><span className="small">Your bonds</span><b>Yes {fmt(bondYes)} / No {fmt(bondNo)}</b></div>
      <div className="pf-cell"><span className="small">{claimed ? "Claimed" : "Payout"}</span><b>{claimed ? "Done" : fmt(payout)}</b></div>
      <div className="pf-act">
        {result === 0 && finalizable && <button className="ghost" disabled={busy} onClick={() => tx.send("finalize", [BigInt(id)])}>Finalize</button>}
        {finalizable && !claimed && payout > 0n && <button disabled={busy} onClick={() => tx.send("claim", [BigInt(id)])}>Claim {fmt(payout)}</button>}
        <TxStatus tx={tx} />
      </div>
    </div>
  );
}

export default function Portfolio({ markets, onChange }) { // Trang các vị thế của người dùng
  const { address, isConnected } = useAccount(); // Ví đang kết nối
  const now = useChainNow(); // Giờ theo chuỗi
  const ids = (markets ?? []).map((_, index) => index); // Danh sách id thị trường
  const positions = useReadContracts({ // Đọc phần của người dùng ở mọi thị trường trong một lần gọi
    contracts: ids.map((id) => ({ address: marketAddress, abi: marketAbi, functionName: "positions", args: [BigInt(id), address], chainId: targetChain.id })),
    query: { enabled: !!address && ids.length > 0, refetchInterval: 5000, placeholderData: keepPreviousData },
  });

  if (!isConnected) return <div className="card"><h2>Your positions</h2><p className="muted">Connect your wallet to see your bets, bonds and what you can claim.</p></div>; // Điều kiện tiên quyết: cần ví

  const rows = []; // Các dòng có vị thế
  let staked = 0n; // Tổng tiền đã bỏ vào
  let claimable = 0n; // Tổng tiền có thể nhận
  for (const id of ids) { // Duyệt từng thị trường
    const m = markets[id]; const p = positions.data?.[id]; // Thị trường và phần của người dùng
    if (m?.status !== "success" || p?.status !== "success") continue; // Chưa đọc được
    const [betYes, betNo, bondYes, bondNo, claimed] = p.result; // Phần của người dùng
    const stake = betYes + betNo + bondYes + bondNo; // Tổng đã bỏ vào thị trường này
    if (stake === 0n) continue; // Không tham gia thì bỏ qua
    staked += stake; // Cộng dồn
    const [, , bettingEndsAt, windowEnd, , , , , result] = m.result; // Để biết đã chốt được chưa
    const end = Number(bettingEndsAt); const wEnd = Number(windowEnd); // Mốc thời gian
    const finalizable = result !== 0 || (wEnd !== 0 && now >= wEnd) || (wEnd === 0 && now >= end + REFUND_DELAY); // Đã có thể nhận
    if (finalizable && !claimed) claimable += computePayout(m.result, p.result); // Cộng tiền có thể nhận
    rows.push({ id, market: m.result, position: p.result }); // Thêm dòng
  }
  rows.reverse(); // Mới nhất lên đầu

  return ( // Giao diện trang
    <div>
      <h2>Your positions</h2>
      <div className="stats">
        <div className="stat"><b>{rows.length}</b><span>Markets joined</span></div>
        <div className="stat"><b>{fmt(staked)}</b><span>Total staked</span></div>
        <div className="stat"><b>{fmt(claimable)}</b><span>Ready to claim</span></div>
      </div>
      {rows.length === 0 && <p className="muted">You have no positions yet. Open a market and place a bet or a bond.</p>}
      <div className="pf">{rows.map((row) => <Row key={row.id} now={now} onChange={onChange} {...row} />)}</div>
    </div>
  );
}
