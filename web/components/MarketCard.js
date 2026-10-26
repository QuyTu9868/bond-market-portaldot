"use client"; // Chạy ở trình duyệt

import { useState } from "react"; // Hook trạng thái
import { useAccount, useReadContract } from "wagmi"; // Đọc dữ liệu và địa chỉ ví
import { parseEther } from "viem"; // Đổi đơn vị tiền sang wei
import { marketAbi, RESULT_LABELS, CATEGORIES } from "../lib/contract"; // ABI, tên kết quả và danh mục
import { marketAddress, targetChain } from "../lib/config"; // Địa chỉ contract và mạng
import { useTx } from "../lib/useTx"; // Hook gửi giao dịch
import { useChainNow } from "../lib/useChainNow"; // Giờ theo chuỗi
import { computePayout } from "../lib/payout"; // Tính tiền sẽ nhận (contract không còn hàm xem trước)
import { fmt } from "../lib/format"; // Hiện số tiền gọn
import TxStatus from "./TxStatus"; // Hiện trạng thái giao dịch

const REFUND_DELAY = 7 * 24 * 3600; // Phải khớp NO_BOND_REFUND_DELAY trong contract (7 ngày)
const CLOSING_SECONDS = 10; // Còn dưới số giây này là hạn cược thì khóa nút cược, vì giao dịch chỉ vào block sau vài giây và có thể bị từ chối

function formatDuration(seconds) { // Đổi số giây thành chữ dễ đọc
  if (seconds <= 0) return "0s"; // Hết giờ
  const d = Math.floor(seconds / 86400); // Số ngày
  const h = Math.floor((seconds % 86400) / 3600); // Số giờ
  const m = Math.floor((seconds % 3600) / 60); // Số phút
  const s = seconds % 60; // Số giây
  if (d > 0) return `${d}d ${h}h`; // Từ 1 ngày trở lên
  if (h > 0) return `${h}h ${m}m`; // Từ 1 giờ trở lên
  return `${m}m ${s}s`; // Dưới 1 giờ
}

function SplitBar({ yes, no, yesText, noText, emptyText }) { // Thanh chia Yes (xanh) và No (đỏ) theo tỉ lệ
  const sum = yes + no; // Tổng hai phe
  if (sum === 0n) return <div className="bar"><div className="empty">{emptyText}</div></div>; // Chưa có ai thì hiện chữ mời
  const yesPct = Number((yes * 1000n) / sum) / 10; // Phần trăm của Yes, một chữ số thập phân
  return ( // Hai đoạn nối nhau, chữ ghi trực tiếp trên thanh (người mù màu vẫn đọc được)
    <div className="bar" role="img" aria-label={`${yesText}, ${noText}`}>
      {yes > 0n && <div className="y" style={{ width: `${yesPct}%` }}>{yesText}</div>}
      {no > 0n && <div className="n" style={{ width: `${100 - yesPct}%` }}>{noText}</div>}
    </div>
  );
}

function AmountAction({ id, fn, label, tx, locked }) { // Ô nhập tiền kèm hai nút Yes và No (dùng cho cược và cọc)
  const [amount, setAmount] = useState("0.01"); // Số tiền nhập
  const valid = Number(amount) > 0 && !locked; // Số tiền hợp lệ và chưa bị khóa
  const busy = tx.status === "signing" || tx.status === "confirming"; // Đang xử lý thì khóa nút
  function go(yes) { // Gửi cho phe đã chọn
    tx.send(fn, [BigInt(id), yes], parseEther(amount)); // Gửi giao dịch kèm tiền
  }
  return ( // Giao diện
    <div className="action">
      <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <button className="yes" disabled={!valid || busy} onClick={() => go(true)}>{label} Yes</button>
      <button className="no" disabled={!valid || busy} onClick={() => go(false)}>{label} No</button>
    </div>
  );
}

export default function MarketCard({ id, market, onChange }) { // Thẻ hiển thị một thị trường
  const [question, , bettingEndsAt, windowEnd, poolYes, poolNo, bondYes, bondNo, result, category] = market; // Tách các trường từ contract
  const { address } = useAccount(); // Địa chỉ ví đang kết nối
  const now = useChainNow(); // Giờ hiện tại theo chuỗi
  const betTx = useTx(onChange); // Giao dịch cược
  const bondTx = useTx(onChange); // Giao dịch cọc
  const finishTx = useTx(onChange); // Giao dịch chốt hoặc nhận tiền
  const position = useReadContract({ address: marketAddress, abi: marketAbi, functionName: "positions", args: [BigInt(id), address], chainId: targetChain.id, query: { enabled: !!address, refetchInterval: 5000 } }); // Phần của mình trong thị trường này

  const end = Number(bettingEndsAt); // Hạn cược (giây)
  const wEnd = Number(windowEnd); // Hạn chốt (giây), 0 nếu chưa ai cọc
  let phase; // Mô tả giai đoạn hiện tại
  let chip; // Nhãn ngắn của giai đoạn
  let chipKind; // Màu nhãn: open, warn hoặc done
  let timeText = ""; // Chữ bên phải nhãn (đếm ngược hoặc kết quả)
  let canBet = false; // Cho cược không
  let canBond = false; // Cho cọc không
  let canFinish = false; // Cho chốt hoặc nhận tiền không
  if (result !== 0) { // Đã chốt
    phase = `Finished: ${RESULT_LABELS[result]}`; // Hiện kết quả
    chip = "Finished"; chipKind = "done"; // Nhãn xám
    timeText = result === 1 ? "Yes won" : result === 2 ? "No won" : "Refunded"; // Kết quả ngắn
    canFinish = true; // Cho nhận tiền
  } else if (now < end) { // Còn trong hạn cược
    phase = `Betting open, ends in ${formatDuration(end - now)}`; // Đếm ngược hạn cược
    chip = "Betting open"; chipKind = "open"; // Nhãn xanh
    timeText = `ends in ${formatDuration(end - now)}`; // Đồng hồ
    canBet = true; // Cho cược
  } else if (wEnd === 0 && now >= end + REFUND_DELAY) { // Quá 7 ngày không ai cọc
    phase = "Nobody posted a bond for 7 days: refund available"; // Báo được hoàn tiền
    chip = "Refund ready"; chipKind = "warn"; // Nhãn cam
    canFinish = true; // Cho nhận lại tiền
  } else if (wEnd === 0) { // Chưa ai cọc
    phase = "Betting ended. Post a bond to start the resolution window"; // Mời cọc
    chip = "Waiting for bond"; chipKind = "warn"; // Nhãn cam
    canBond = true; // Cho cọc
  } else if (now < wEnd) { // Đang trong cửa sổ phán quyết
    phase = `Resolution window, ends in ${formatDuration(wEnd - now)}`; // Đếm ngược cửa sổ
    chip = "Resolution window"; chipKind = "warn"; // Nhãn cam
    timeText = `ends in ${formatDuration(wEnd - now)}`; // Đồng hồ
    canBond = true; // Cho cọc thêm
  } else { // Hết cửa sổ, chưa chốt
    phase = "Window over, ready to finalize"; // Sẵn sàng chốt
    chip = "Finalize now"; chipKind = "warn"; // Nhãn cam
    canFinish = true; // Cho chốt và nhận tiền
  }

  const payout = position.data ? computePayout(market, position.data) : 0n; // Số tiền được nhận (0 nếu chưa có)
  const leading = bondYes === bondNo ? "tie" : bondYes > bondNo ? "Yes" : "No"; // Phe đang dẫn đầu về cọc
  const closing = canBet && end - now <= CLOSING_SECONDS; // Sắp hết hạn cược
  const busy = finishTx.status === "signing" || finishTx.status === "confirming"; // Đang xử lý chốt hoặc nhận tiền

  return ( // Giao diện thẻ
    <div className="card">
      <div className="top"><span className={`chip ${chipKind}`}>{chip}</span><span className="time">{timeText}</span></div>
      <p className="cat">{CATEGORIES[category] ?? "Other"}</p>
      <h3>#{id} {question}</h3>
      <p className="phase">{phase}</p>

      <div className="label"><span>Bets</span><span>{fmt(poolYes + poolNo)}</span></div>
      <SplitBar yes={poolYes} no={poolNo} yesText={`Yes ${fmt(poolYes)}`} noText={`No ${fmt(poolNo)}`} emptyText="No bets yet" />
      {bondYes + bondNo > 0n && <>
        <div className="label"><span>Bonds</span>{wEnd !== 0 && result === 0 ? <span>Bond leader: {leading}</span> : <span>{fmt(bondYes + bondNo)}</span>}</div>
        <SplitBar yes={bondYes} no={bondNo} yesText={`Yes ${fmt(bondYes)}`} noText={`No ${fmt(bondNo)}`} emptyText="No bonds yet" />
      </>}
      {result !== 0 && result !== 3 && <p className="note">Result is decided by bonds, not by bets.</p>}
      {canBond && wEnd !== 0 && <p className="note">A late bond extends the window by a quarter. <b>Outbid to change the result.</b></p>}

      {canBet && <><AmountAction id={id} fn="bet" label="Bet" tx={betTx} locked={closing} /><TxStatus tx={betTx} />{closing && <p className="note">Betting is about to close. New bets are paused because they would likely arrive too late.</p>}</>}
      {canBond && <><AmountAction id={id} fn="postBond" label="Bond" tx={bondTx} /><TxStatus tx={bondTx} /></>}
      {canFinish && ( // Nút chốt và nhận tiền
        <>
          <div className="result">
            <div><div className="small">Your payout</div><div className="amount">{fmt(payout)}</div></div>
            {result === 0 && <button className="ghost" disabled={busy} onClick={() => finishTx.send("finalize", [BigInt(id)])}>Finalize</button>}
            <button disabled={!address || payout === 0n || busy} onClick={() => finishTx.send("claim", [BigInt(id)])}>Claim {payout > 0n ? fmt(payout) : ""}</button>
          </div>
          <TxStatus tx={finishTx} />
        </>
      )}
    </div>
  );
}
