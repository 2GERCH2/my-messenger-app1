import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// ✅ Переопределяем глобальный конструктор WebSocket. Любые попытки создать соединение
// ✅ откуда угодно, из любого места кода, любым способом всегда будут идти на наш сервер.
const OriginalWebSocket = window.WebSocket;
window.WebSocket = function() {
  console.log("✅ Перехвачена попытка создания вебсокет соединения, перенаправляем на наш сервер");
  return new OriginalWebSocket('wss://my-messenger-app1.onrender.com');
} as any;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
