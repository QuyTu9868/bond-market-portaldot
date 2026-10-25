"use client"; // Chạy ở trình duyệt

import { useState } from "react"; // Hook trạng thái
import { useAccount, useReadContract } from "wagmi"; // Đọc dữ liệu và địa chỉ ví
import { formatEther, parseEther } from "viem"; // Đổi giữa wei và đơn vị tiền
import { marketAbi, RESULT_LABELS } from "../lib/contract"; // ABI và tên kết quả
import { marketAddress, targetChain } from "../lib/config"; // Địa chỉ contract và mạng
import { useTx } from "../lib/useTx"; // Hook gửi giao dịch
import { useChainNow } from "../lib/useChainNow"; // Giờ theo chuỗi
import TxStatus from "./TxStatus"; // Hiện trạng thái giao dịch

const REFUND_DELAY = 7 * 24 * 3600; // Phải khớp NO_BOND_REFUND_DELAY trong contract (7 ngày)

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

const CLOSING_SECONDS = 10; // Còn dưới số giây này là hạn cược thì khóa nút cược, vì giao dịch chỉ vào block sau vài giây và có thể bị từ chối

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
      <button disabled={!valid || busy} onClick={() => go(true)}>{label} Yes</button>
      <button disabled={!valid || busy} onClick={() => go(false)}>{label} No</button>
    </div>
  );
}

export default function MarketCard({ id, market, onChange }) { // Thẻ hiển thị một thị trường
  const [question, , bettingEndsAt, windowEnd, poolYes, poolNo, bondYes, bondNo, result] = market; // Tách các trường từ contract
  const { address } = useAccount(); // Địa chỉ ví đang kết nối
  const now = useChainNow(); // Giờ hiện tại theo chuỗi
  const betTx = useTx(onChange); // Giao dịch cược
  const bondTx = useTx(onChange); // Giao dịch cọc
  const finishTx = useTx(onChange); // Giao dịch chốt hoặc nhận tiền
  const preview = useReadContract({ address: marketAddress, abi: marketAbi, functionName: "previewPayout", args: [BigInt(id), address], chainId: targetChain.id, query: { enabled: !!address, refetchInterval: 5000 } }); // Số tiền mình sẽ nhận

  const end = Number(bettingEndsAt); // Hạn cược (giây)
  const wEnd = Number(windowEnd); // Hạn chốt (giây), 0 nếu chưa ai cọc
  let phase; // Mô tả giai đoạn hiện tại
  let canBet = false; // Cho cược không
  let canBond = false; // Cho cọc không
  let canFinish = false; // Cho chốt hoặc nhận tiền không
  if (result !== 0) { // Đã chốt
    phase = `Finished: ${RESULT_LABELS[result]}`; // Hiện kết quả
    canFinish = true; // Cho nhận tiền
  } else if (now < end) { // Còn trong hạn cược
    phase = `Betting open, ends in ${formatDuration(end - now)}`; // Đếm ngược hạn cược
    canBet = true; // Cho cược
  } else if (wEnd === 0 && now >= end + REFUND_DELAY) { // Quá 7 ngày không ai cọc
    phase = "Nobody posted a bond for 7 days: refund available"; // Báo được hoàn tiền
    canFinish = true; // Cho nhận lại tiền
  } else if (wEnd === 0) { // Chưa ai cọc
    phase = "Betting ended. Post a bond to start the resolution window"; // Mời cọc
    canBond = true; // Cho cọc
  } else if (now < wEnd) { // Đang trong cửa sổ phán quyết
    phase = `Resolution window, ends in ${formatDuration(wEnd - now)}`; // Đếm ngược cửa sổ
    canBond = true; // Cho cọc thêm
  } else { // Hết cửa sổ, chưa chốt
    phase = "Window over, ready to finalize"; // Sẵn sàng chốt
    canFinish = true; // Cho chốt và nhận tiền
  }

  const payout = preview.data ?? 0n; // Số tiền được nhận (0 nếu chưa có)
  const leading = bondYes === bondNo ? "tie" : bondYes > bondNo ? "Yes" : "No"; // Phe đang dẫn đầu về cọc

  return ( // Giao diện thẻ
    <div className="card">
      <h3>#{id} {question}</h3>
      <p className="phase">{phase}</p>
      <div className="grid">
        <div><span className="muted">Bets Yes</span><b>{formatEther(poolYes)}</b></div>
        <div><span className="muted">Bets No</span><b>{formatEther(poolNo)}</b></div>
        <div><span className="muted">Bonds Yes</span><b>{formatEther(bondYes)}</b></div>
        <div><span className="muted">Bonds No</span><b>{formatEther(bondNo)}</b></div>
      </div>
      {wEnd !== 0 && result === 0 && <p className="muted">Bond leader: {leading}</p>}
      {canBet && <><AmountAction id={id} fn="bet" label="Bet" tx={betTx} locked={end - now <= CLOSING_SECONDS} /><TxStatus tx={betTx} />{end - now <= CLOSING_SECONDS && <p className="muted">Betting is about to close. New bets are paused because they would likely arrive too late.</p>}</>}
      {canBond && <><AmountAction id={id} fn="postBond" label="Bond" tx={bondTx} /><TxStatus tx={bondTx} /></>}
      {canFinish && ( // Nút chốt và nhận tiền
        <div className="action">
          {result === 0 && <button disabled={finishTx.status === "signing" || finishTx.status === "confirming"} onClick={() => finishTx.send("finalize", [BigInt(id)])}>Finalize</button>}
          <button disabled={!address || payout === 0n || finishTx.status === "signing" || finishTx.status === "confirming"} onClick={() => finishTx.send("claim", [BigInt(id)])}>
            Claim {payout > 0n ? formatEther(payout) : ""}
          </button>
          <TxStatus tx={finishTx} />
        </div>
      )}
    </div>
  );
}
