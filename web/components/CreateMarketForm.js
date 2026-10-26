"use client"; // Chạy ở trình duyệt

import { useState } from "react"; // Hook trạng thái
import { useTx } from "../lib/useTx"; // Hook gửi giao dịch
import { CATEGORIES } from "../lib/contract"; // Danh sách danh mục
import { useChainNow } from "../lib/useChainNow"; // Giờ theo chuỗi
import TxStatus from "./TxStatus"; // Hiện trạng thái giao dịch

export default function CreateMarketForm({ onDone }) { // Form tạo thị trường mới
  const [question, setQuestion] = useState(""); // Câu hỏi nhập vào
  const [minutes, setMinutes] = useState("5"); // Số phút còn được cược
  const [category, setCategory] = useState(0); // Danh mục chọn (số thứ tự)
  const tx = useTx(onDone); // Giao dịch tạo thị trường
  const now = useChainNow(); // Giờ hiện tại theo chuỗi, tránh lệch với đồng hồ máy

  function submit(e) { // Khi bấm tạo
    e.preventDefault(); // Không tải lại trang
    const endsAt = now + Math.round(Number(minutes) * 60); // Hạn cược = bây giờ (theo chuỗi) + số phút
    tx.send("createMarket", [question.trim(), BigInt(endsAt), category]); // Gửi giao dịch
  }

  return ( // Giao diện form
    <form onSubmit={submit} className="card">
      <h2>Create a market</h2>
      <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="A Yes/No question, e.g. Will it rain tomorrow?" />
      <label>Category
        <select value={category} onChange={(e) => setCategory(Number(e.target.value))}>
          {CATEGORIES.map((name, index) => <option key={name} value={index}>{name}</option>)}
        </select>
      </label>
      <label>Betting stays open for (minutes)
        <input type="number" min="0.1" step="any" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
      </label>
      <button type="submit" disabled={!question.trim() || !(Number(minutes) > 0) || tx.status === "signing" || tx.status === "confirming"}>Create market</button>
      <TxStatus tx={tx} />
    </form>
  );
}
