"use client"; // Chạy ở trình duyệt

import { useRef, useState } from "react"; // Hook trạng thái và tham chiếu

export default function HoldButton({ children, onConfirm, disabled, ms = 800 }) { // Nút phải nhấn giữ một lúc mới xác nhận, chống bấm nhầm
  const [progress, setProgress] = useState(0); // Tiến độ nhấn giữ từ 0 đến 1
  const frame = useRef(null); // Mã của vòng lặp hoạt ảnh đang chạy
  const startedAt = useRef(0); // Lúc bắt đầu nhấn giữ

  function stop() { // Dừng nhấn giữ và đặt lại tiến độ
    if (frame.current) cancelAnimationFrame(frame.current); // Hủy vòng lặp đang chạy
    frame.current = null; // Không còn vòng lặp
    setProgress(0); // Về 0
  }

  function tick() { // Mỗi khung hình cập nhật tiến độ
    const value = Math.min(1, (performance.now() - startedAt.current) / ms); // Tiến độ theo thời gian đã giữ
    setProgress(value); // Cập nhật thanh tiến độ
    if (value >= 1) { frame.current = null; setProgress(0); onConfirm(); return; } // Giữ đủ lâu thì xác nhận
    frame.current = requestAnimationFrame(tick); // Chưa đủ thì chạy tiếp
  }

  function begin() { // Bắt đầu nhấn giữ
    if (disabled || frame.current) return; // Đang khóa hoặc đang giữ rồi thì bỏ qua
    startedAt.current = performance.now(); // Ghi lại lúc bắt đầu
    frame.current = requestAnimationFrame(tick); // Chạy vòng lặp
  }

  return ( // Nút có thanh tiến độ chạy bên trong, dùng được cả chuột, cảm ứng và bàn phím (giữ Enter hoặc Space)
    <button
      type="button"
      className="hold"
      style={{ "--p": progress }}
      disabled={disabled}
      onPointerDown={begin}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); begin(); } }}
      onKeyUp={stop}
      onBlur={stop}
    >{children}</button>
  );
}
