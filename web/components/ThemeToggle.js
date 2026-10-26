"use client"; // Chạy ở trình duyệt

import { useEffect, useState } from "react"; // Hook trạng thái

export default function ThemeToggle() { // Nút chuyển giữa chế độ sáng và tối
  const [theme, setTheme] = useState("light"); // Chế độ đang dùng

  useEffect(() => { // Lần đầu: lấy chế độ người dùng đã chọn, không có thì theo hệ điều hành
    const chosen = document.documentElement.dataset.theme; // Chế độ đã đặt (bởi đoạn script ở layout hoặc lần bấm trước)
    setTheme(chosen || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")); // Mặc định theo hệ điều hành
  }, []);

  function toggle() { // Khi bấm nút
    const next = theme === "dark" ? "light" : "dark"; // Đổi sang chế độ kia
    setTheme(next); // Cập nhật nút
    document.documentElement.dataset.theme = next; // Đổi màu toàn trang
    try { localStorage.setItem("theme", next); } catch (e) { /* Trình duyệt chặn lưu thì bỏ qua, trang vẫn dùng được */ } // Nhớ lựa chọn cho lần sau
  }

  return <button className="ghost" onClick={toggle}>{theme === "dark" ? "Light mode" : "Dark mode"}</button>; // Nút hiện tên chế độ sẽ chuyển tới
}
