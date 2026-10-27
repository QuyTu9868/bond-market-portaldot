"use client"; // Chạy ở trình duyệt

import { useEffect, useState } from "react"; // Hook trạng thái
import { usePublicClient } from "wagmi"; // Đọc nhật ký sự kiện từ chuỗi
import { marketAbi } from "../lib/contract"; // ABI có sự kiện BetPlaced và BondPosted
import { marketAddress, targetChain } from "../lib/config"; // Địa chỉ contract và mạng

const W = 300; // Bề rộng biểu đồ (đơn vị của khung SVG)
const H = 120; // Chiều cao biểu đồ
const PAD = 8; // Lề trên dưới để đường 0 phần trăm và 100 phần trăm không bị cắt
const yOf = (percent) => PAD + (1 - percent / 100) * (H - 2 * PAD); // Đổi phần trăm sang tọa độ dọc

function toPath(values) { // Đổi dãy phần trăm thành đường gấp khúc, bỏ qua chỗ chưa có dữ liệu
  const n = values.length; // Số bước
  return values.map((v, i) => (v === null ? null : [n === 1 ? W / 2 : 6 + (i / (n - 1)) * (W - 12), yOf(v)])).filter(Boolean); // Tọa độ từng điểm
}

export default function ActivityChart({ id, version }) { // Biểu đồ tỉ lệ Yes theo từng lệnh, cho cược (xám) và cọc (cam)
  const client = usePublicClient({ chainId: targetChain.id }); // Máy khách đọc chuỗi
  const [steps, setSteps] = useState(null); // Các bước đã tính, null khi đang tải
  const [error, setError] = useState(false); // Không đọc được nhật ký

  useEffect(() => { // Đọc nhật ký mỗi khi mở biểu đồ hoặc số liệu thị trường đổi
    let alive = true; // Tránh cập nhật sau khi đóng
    async function load() {
      try {
        const betEvent = marketAbi.find((item) => item.type === "event" && item.name === "BetPlaced"); // Sự kiện cược
        const bondEvent = marketAbi.find((item) => item.type === "event" && item.name === "BondPosted"); // Sự kiện cọc
        const [bets, bonds] = await Promise.all([ // Đọc hai loại sự kiện của đúng thị trường này
          client.getLogs({ address: marketAddress, event: betEvent, args: { id: BigInt(id) }, fromBlock: 0n, toBlock: "latest" }),
          client.getLogs({ address: marketAddress, event: bondEvent, args: { id: BigInt(id) }, fromBlock: 0n, toBlock: "latest" }),
        ]);
        const all = [...bets.map((l) => ({ ...l, kind: "bet" })), ...bonds.map((l) => ({ ...l, kind: "bond" }))] // Gộp hai loại
          .sort((a, b) => (a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1)); // Xếp theo thứ tự xảy ra
        let betYes = 0n, betNo = 0n, bondYes = 0n, bondNo = 0n; // Quỹ cộng dồn
        const out = []; // Kết quả từng bước
        for (const log of all) { // Duyệt từng sự kiện
          const { yes, amount } = log.args; // Phe và số tiền
          if (log.kind === "bet") { if (yes) betYes += amount; else betNo += amount; } else { if (yes) bondYes += amount; else bondNo += amount; } // Cộng vào quỹ tương ứng
          const share = (a, b) => (a + b === 0n ? null : Number((a * 1000n) / (a + b)) / 10); // Phần trăm Yes, null nếu chưa có ai
          out.push({ bet: share(betYes, betNo), bond: share(bondYes, bondNo) }); // Ghi lại sau mỗi lệnh
        }
        if (alive) { setSteps(out); setError(false); } // Lưu kết quả
      } catch (e) { if (alive) setError(true); } // RPC không cho đọc nhật ký thì báo nhẹ
    }
    load();
    return () => { alive = false; };
  }, [id, version]);

  if (error) return <p className="note">Could not read the activity history from the chain.</p>; // Lỗi đọc
  if (steps === null) return <p className="note">Loading activity...</p>; // Đang tải
  if (steps.length === 0) return <p className="note">No bets or bonds yet.</p>; // Chưa có hoạt động

  const betPoints = toPath(steps.map((s) => s.bet)); // Điểm của đường cược
  const bondPoints = toPath(steps.map((s) => s.bond)); // Điểm của đường cọc
  const line = (points) => points.map(([x, y]) => `${x},${y}`).join(" "); // Chuỗi tọa độ cho polyline

  return ( // Biểu đồ SVG đơn giản, không dùng thư viện
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Yes share of bets and of bonds after each action">
        {[0, 50, 100].map((p) => <g key={p}><line x1="0" x2={W} y1={yOf(p)} y2={yOf(p)} className="grid-line" /><text x="2" y={yOf(p) - 2} className="axis">{p}%</text></g>)}
        {betPoints.length > 1 && <polyline points={line(betPoints)} className="line-bet" />}
        {bondPoints.length > 1 && <polyline points={line(bondPoints)} className="line-bond" />}
        {betPoints.map(([x, y], i) => <circle key={"b" + i} cx={x} cy={y} r="2.5" className="dot-bet" />)}
        {bondPoints.map(([x, y], i) => <circle key={"d" + i} cx={x} cy={y} r="3" className="dot-bond" />)}
      </svg>
      <p className="legend"><span className="key bet" /> Yes share of bets <span className="key bond" /> Yes share of bonds (decides the result)</p>
      <p className="note">One step per bet or bond, oldest on the left.</p>
    </div>
  );
}
