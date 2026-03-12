import { useEffect, useMemo, useState } from "react";

// =========================
// Types
// =========================
type UserModel = {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  isVerified: boolean;
  createdAt: number;
  lastSeen: number;
  isOnline: boolean;
};

type ChatModel = {
  id: string;
  userA: string;
  userB: string;
  createdAt: number;
  updatedAt: number;
};

type MessageModel = {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: number;
  isRead: boolean;
};

type VerificationCodeModel = {
  email: string;
  code: string;
  type: "register" | "login";
  isUsed: boolean;
};

// =========================
// LocalStorage Keys
// =========================
const LS_KEYS = {
  USERS: "botellon_users",
  CHATS: "botellon_chats",
  MESSAGES: "botellon_messages",
  CODES: "botellon_codes",
  SESSION: "botellon_session",
} as const;

const generateId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const simpleHash = (s: string) => String(s.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 999983);

const storage = {
  getUsers(): UserModel[] {
    return JSON.parse(localStorage.getItem(LS_KEYS.USERS) || "[]");
  },
  setUsers(users: UserModel[]) {
    localStorage.setItem(LS_KEYS.USERS, JSON.stringify(users));
  },
  getChats(): ChatModel[] {
    return JSON.parse(localStorage.getItem(LS_KEYS.CHATS) || "[]");
  },
  setChats(chats: ChatModel[]) {
    localStorage.setItem(LS_KEYS.CHATS, JSON.stringify(chats));
  },
  getMessages(): MessageModel[] {
    return JSON.parse(localStorage.getItem(LS_KEYS.MESSAGES) || "[]");
  },
  setMessages(messages: MessageModel[]) {
    localStorage.setItem(LS_KEYS.MESSAGES, JSON.stringify(messages));
  },
  getCodes(): VerificationCodeModel[] {
    return JSON.parse(localStorage.getItem(LS_KEYS.CODES) || "[]");
  },
  setCodes(codes: VerificationCodeModel[]) {
    localStorage.setItem(LS_KEYS.CODES, JSON.stringify(codes));
  },
  getSession(): { userId: string } | null {
    return JSON.parse(localStorage.getItem(LS_KEYS.SESSION) || "null");
  },
  setSession(session: { userId: string } | null) {
    if (!session) localStorage.removeItem(LS_KEYS.SESSION);
    else localStorage.setItem(LS_KEYS.SESSION, JSON.stringify(session));
  },
};

// =========================
// Socket (simple local emitter)
// =========================
type SocketEvent = "send_message" | "receive_message" | "message_read" | "user_online" | "user_offline";
const socketListeners = new Map<SocketEvent, Set<(data: any) => void>>();
const socket = {
  on(event: SocketEvent, cb: (data: any) => void) {
    if (!socketListeners.has(event)) socketListeners.set(event, new Set());
    socketListeners.get(event)!.add(cb);
    return () => socketListeners.get(event)!.delete(cb);
  },
  emit(event: SocketEvent, data: any) {
    socketListeners.get(event)?.forEach((cb) => cb(data));
  },
};

// =========================
// UI Components
// =========================
function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const h = size === "sm" ? "h-8" : size === "lg" ? "h-12" : "h-10";
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className="relative">
        <div className={`${h} aspect-square rounded-[14px] bg-gradient-to-br from-[#6c63ff] to-[#e94560] shadow-[0_8px_30px_rgba(108,99,255,0.35)] grid place-items-center`}>
          <span className="font-serif text-white font-bold text-[0.78em] tracking-[0.02em]">b</span>
        </div>
        <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-[#0f0f23] border-2 border-[#1a1a2e]"></div>
      </div>
      <div className="leading-none">
        <div className="font-[620] tracking-tight text-[1.15em]" style={{ fontFamily: "'SF Pro Display', 'Inter', system-ui" }}>
          botellón
        </div>
        <div className="text-[10px] tracking-widest text-[#a0a0b0] -mt-0.5">PRIVATE MESSENGER</div>
      </div>
    </div>
  );
}

function Avatar({ name, size = 40, online }: { name: string; size?: number; online?: boolean }) {
  const initials = name.replace("@", "").slice(0, 2).toUpperCase();
  const colors = ["#6c63ff", "#e94560", "#00d2d3", "#f9a826", "#a259ff"];
  const bg = colors[initials.charCodeAt(0) % colors.length];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="rounded-full grid place-items-center font-[630] text-white select-none" style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.42 }}>
        {initials}
      </div>
      {online && <span className="absolute bottom-0 right-0 block h-[26%] w-[26%] rounded-full bg-[#00d2d3] ring-[3px] ring-[#0f0f23]" />}
    </div>
  );
}

// =========================
// Auth: Register Page
// =========================
function RegisterPage({ onSwitchToLogin, onRegistered }: { onSwitchToLogin: () => void; onRegistered: (userId: string, email: string) => void }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const u = username.replace(/^@/, "");
    if (u.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(u)) {
      setUsernameAvailable(false);
      return;
    }
    const users = storage.getUsers();
    setUsernameAvailable(!users.some((x) => x.username === "@" + u));
  }, [username]);

  const strength = useMemo(() => {
    if (password.length < 8) return "слабый";
    const hasUpper = /[A-Z]/.test(password);
    const hasDigit = /\d/.test(password);
    if (hasUpper && hasDigit && password.length >= 10) return "сильный";
    if (hasUpper || hasDigit) return "средний";
    return "слабый";
  }, [password]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const u = username.replace(/^@/, "");
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(u)) {
      setError("Недопустимый username");
      return;
    }
    if (usernameAvailable === false) {
      setError("username уже занят");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Неверный email");
      return;
    }
    if (!/^(?=.*\d)(?=.*[A-Z]).{8,}$/.test(password)) {
      setError("Пароль слишком слабый");
      return;
    }
    if (password !== confirm) {
      setError("Пароли не совпадают");
      return;
    }

    const users = storage.getUsers();
    if (users.some((x) => x.username === "@" + u)) {
      setError("username уже занят");
      return;
    }
    if (email && users.some((x) => x.email === email)) {
      setError("email уже занят");
      return;
    }

    const newUser: UserModel = {
      id: generateId(),
      username: "@" + u,
      email: email || "",
      passwordHash: simpleHash(password),
      isVerified: email ? false : true,
      createdAt: Date.now(),
      lastSeen: Date.now(),
      isOnline: false,
    };
    users.push(newUser);
    storage.setUsers(users);

    if (email) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const codes = storage.getCodes();
      codes.push({ email, code, type: "register", isUsed: false });
      storage.setCodes(codes);
      onRegistered(newUser.id, email);
    } else {
      storage.setSession({ userId: newUser.id });
      onRegistered(newUser.id, "");
    }
  };

  return (
    <div className="min-h-dvh bg-[#0f0f23] text-white flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center">
          <Logo size="lg" />
          <div className="mt-2 text-[12px] tracking-[0.4em] text-[#a0a0b0]">private messenger</div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12.5px] font-[600] text-[#a0a0b0] mb-1">@username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.startsWith("@") ? e.target.value : "@" + e.target.value)}
              className="w-full rounded-[12px] border border-white/10 bg-[#16213e] px-4 py-3 text-[15px] outline-none focus:border-[#6c63ff]/60"
              placeholder="@username"
            />
            {usernameAvailable === false && <div className="mt-1 text-[12px] text-[#e94560]">username уже занят</div>}
          </div>
          <div>
            <label className="block text-[12.5px] font-[600] text-[#a0a0b0] mb-1">Email (необязательно)</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-[12px] border border-white/10 bg-[#16213e] px-4 py-3 text-[15px] outline-none focus:border-[#6c63ff]/60"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-[600] text-[#a0a0b0] mb-1">Пароль</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-[12px] border border-white/10 bg-[#16213e] px-4 py-3 text-[15px] outline-none focus:border-[#6c63ff]/60"
                placeholder="Минимум 8 символов"
              />
              <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a0a0b0]">
                {showPassword ? "Скрыть" : "Показать"}
              </button>
            </div>
            <div className="mt-1 text-[12px] text-[#a0a0b0]">Надёжность: {strength}</div>
          </div>
          <div>
            <label className="block text-[12.5px] font-[600] text-[#a0a0b0] mb-1">Подтверждение пароля</label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-[12px] border border-white/10 bg-[#16213e] px-4 py-3 text-[15px] outline-none focus:border-[#6c63ff]/60"
              placeholder="Повторите пароль"
            />
          </div>
          {error && <div className="text-[12px] text-[#e94560]">{error}</div>}
          <button className="w-full rounded-[12px] bg-[#6c63ff] py-3 font-[650] shadow-[0_8px_24px_rgba(108,99,255,0.35)] hover:bg-[#5d55e6]">
            Создать аккаунт
          </button>
          <div className="text-center text-[13px] text-[#a0a0b0]">
            Уже есть аккаунт?{" "}
            <button type="button" onClick={onSwitchToLogin} className="text-[#8f8aff] hover:text-white">
              Войти
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =========================
// Auth: Login Page
// =========================
function LoginPage({ onSwitchToRegister, onLoggedIn }: { onSwitchToRegister: () => void; onLoggedIn: (userId: string, requires2FA: boolean) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const u = username.startsWith("@") ? username : "@" + username;
    const users = storage.getUsers();
    const user = users.find((x) => x.username === u && x.passwordHash === simpleHash(password));
    if (!user || !user.isVerified) {
      setError("Неверные данные");
      return;
    }

    if (user.email) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const codes = storage.getCodes();
      codes.push({ email: user.email, code, type: "login", isUsed: false });
      storage.setCodes(codes);
      onLoggedIn(user.id, true);
    } else {
      user.isOnline = true;
      user.lastSeen = Date.now();
      storage.setUsers(users);
      storage.setSession({ userId: user.id });
      onLoggedIn(user.id, false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#0f0f23] text-white flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center">
          <Logo size="lg" />
          <div className="mt-2 text-[12px] tracking-[0.4em] text-[#a0a0b0]">private messenger</div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12.5px] font-[600] text-[#a0a0b0] mb-1">@username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-[12px] border border-white/10 bg-[#16213e] px-4 py-3 text-[15px] outline-none focus:border-[#6c63ff]/60"
              placeholder="@username"
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-[600] text-[#a0a0b0] mb-1">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-[12px] border border-white/10 bg-[#16213e] px-4 py-3 text-[15px] outline-none focus:border-[#6c63ff]/60"
              placeholder="Введите пароль"
            />
          </div>
          {error && <div className="text-[12px] text-[#e94560]">{error}</div>}
          <button className="w-full rounded-[12px] bg-[#6c63ff] py-3 font-[650] shadow-[0_8px_24px_rgba(108,99,255,0.35)] hover:bg-[#5d55e6]">
            Войти
          </button>
          <div className="text-center text-[13px] text-[#a0a0b0]">
            Нет аккаунта?{" "}
            <button type="button" onClick={onSwitchToRegister} className="text-[#8f8aff] hover:text-white">
              Зарегистрироваться
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =========================
// Verification Screen
// =========================
function VerificationPage({ email, type, onVerified }: { email: string; type: "register" | "login"; onVerified: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const codes = storage.getCodes();
    const idx = codes.findIndex((c) => c.email === email && c.code === code && c.type === type && !c.isUsed);
    if (idx === -1) {
      setError("Неверный код");
      return;
    }
    codes[idx].isUsed = true;
    storage.setCodes(codes);
    onVerified();
  };

  const handleResend = () => {
    const codeValue = String(Math.floor(100000 + Math.random() * 900000));
    const codes = storage.getCodes();
    codes.push({ email, code: codeValue, type, isUsed: false });
    storage.setCodes(codes);
  };

  return (
    <div className="min-h-dvh bg-[#0f0f23] text-white flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center">
          <Logo size="lg" />
          <div className="mt-2 text-[12px] tracking-[0.4em] text-[#a0a0b0]">private messenger</div>
        </div>
        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-[12.5px] font-[600] text-[#a0a0b0] mb-1">Код подтверждения</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-[12px] border border-white/10 bg-[#16213e] px-4 py-3 text-[15px] outline-none focus:border-[#6c63ff]/60"
              placeholder="6-значный код"
            />
          </div>
          {error && <div className="text-[12px] text-[#e94560]">{error}</div>}
          <button className="w-full rounded-[12px] bg-[#6c63ff] py-3 font-[650] shadow-[0_8px_24px_rgba(108,99,255,0.35)] hover:bg-[#5d55e6]">
            Подтвердить
          </button>
          <button type="button" onClick={handleResend} className="w-full rounded-[12px] border border-white/10 bg-[#16213e] py-2.5 text-[13px] text-[#a0a0b0] hover:text-white">
            Отправить код повторно
          </button>
        </form>
      </div>
    </div>
  );
}

// =========================
// Chats Page
// =========================
function ChatsPage({ currentUser, onOpenChat, onLogout }: { currentUser: UserModel; onOpenChat: (chatId: string) => void; onLogout: () => void }) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserModel[]>([]);
  const [showMenu, setShowMenu] = useState(false);

  const chats = useMemo(() => {
    const chatsData = storage.getChats();
    const users = storage.getUsers();
    const messages = storage.getMessages();
    return chatsData
      .filter((c) => c.userA === currentUser.id || c.userB === currentUser.id)
      .map((chat) => {
        const otherId = chat.userA === currentUser.id ? chat.userB : chat.userA;
        const otherUser = users.find((u) => u.id === otherId)!;
        const chatMessages = messages.filter((m) => m.chatId === chat.id).sort((a, b) => b.createdAt - a.createdAt);
        const lastMessage = chatMessages[0];
        const unreadCount = messages.filter((m) => m.chatId === chat.id && m.senderId !== currentUser.id && !m.isRead).length;
        return { ...chat, otherUser, lastMessage, unreadCount };
      })
      .sort((a, b) => (b.lastMessage?.createdAt || 0) - (a.lastMessage?.createdAt || 0));
  }, [currentUser.id]);

  useEffect(() => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    const users = storage.getUsers();
    setSearchResults(users.filter((u) => u.id !== currentUser.id && u.username.toLowerCase().includes(query.toLowerCase())));
  }, [query, currentUser.id]);

  const handleStartChat = (user: UserModel) => {
    const chatsData = storage.getChats();
    let chat = chatsData.find(
      (c) => (c.userA === currentUser.id && c.userB === user.id) || (c.userA === user.id && c.userB === currentUser.id)
    );
    if (!chat) {
      chat = { id: generateId(), userA: currentUser.id, userB: user.id, createdAt: Date.now(), updatedAt: Date.now() };
      chatsData.push(chat);
      storage.setChats(chatsData);
    }
    setQuery("");
    setSearchResults([]);
    onOpenChat(chat.id);
  };

  return (
    <div className="flex h-dvh w-full flex-col bg-[#0f0f23] text-white">
      <header className="relative z-30 flex h-[64px] items-center justify-between border-b border-white/10 bg-[#1a1a2e]/80 px-4">
        <button onClick={() => setShowMenu(true)} className="rounded-xl px-3 py-2 hover:bg-white/10">☰</button>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Logo size="sm" />
        </div>
        <Avatar name={currentUser.username} size={36} online />
      </header>

      <div className="relative border-b border-white/10 bg-[#1a1a2e]/60 px-4 py-3">
        <div className="relative">
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8a8aa3]">🔍</div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по @username..."
            className="h-[46px] w-full rounded-[16px] border border-white/10 bg-[#16213e]/70 pl-10 pr-4 text-[15px] font-[500] outline-none placeholder:text-[#7a7a92] focus:border-[#6c63ff]/60"
          />
        </div>
        {searchResults.length > 0 && (
          <div className="absolute left-4 right-4 top-[68px] z-40 max-h-[66vh] overflow-hidden rounded-[18px] border border-white/15 bg-[#1a1a2e]/95">
            <div className="max-h-[66vh] overflow-y-auto p-2">
              {searchResults.map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3 rounded-[14px] p-2.5 hover:bg-white/8">
                  <div className="flex items-center gap-3">
                    <Avatar name={user.username} size={38} online={user.isOnline} />
                    <div className="leading-tight">
                      <div className="text-[15px] font-[600]">{user.username}</div>
                      <div className="text-[11.5px] text-[#a0a0b0]">{user.isOnline ? "онлайн" : "не в сети"}</div>
                    </div>
                  </div>
                  <button onClick={() => handleStartChat(user)} className="rounded-[12px] bg-[#6c63ff] px-3.5 py-1.5 text-[13px] font-[650] hover:bg-[#5d55e6]">
                    Написать
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="grid h-full place-items-center p-8 text-center">
            <div className="max-w-[320px]">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-[18px] bg-[#1a1a2e]">🔍</div>
              <h3 className="mb-1.5 text-[18px] font-[650]">У вас пока нет переписок</h3>
              <p className="text-[13.5px] leading-[1.55] text-[#a0a0b0]">Найдите пользователя через поиск выше</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {chats.map((chat) => (
              <button key={chat.id} onClick={() => onOpenChat(chat.id)} className="group flex w-full items-center gap-3.5 px-4 py-[14px] text-left transition hover:bg-white/[0.04]">
                <Avatar name={chat.otherUser.username} size={48} online={chat.otherUser.isOnline} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[15.5px] font-[600]">{chat.otherUser.username}</span>
                    <span className="shrink-0 text-[11px] text-[#8a8aa3]">
                      {chat.lastMessage ? new Date(chat.lastMessage.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-[13.5px] text-[#bdbdd0]">{chat.lastMessage?.content || "Нет сообщений"}</p>
                    {chat.unreadCount > 0 && (
                      <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-[#e94560] px-1.5 text-[11px] font-[700] text-white">
                        {chat.unreadCount > 9 ? "9+" : chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showMenu && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMenu(false)} />
          <aside className="absolute left-0 top-0 h-dvh w-[300px] border-r border-white/10 bg-[#1a1a2e] p-5">
            <div className="mb-6 flex items-center gap-3">
              <Avatar name={currentUser.username} size={44} online />
              <div className="leading-tight">
                <div className="text-[16px] font-[650]">{currentUser.username}</div>
                <div className="text-[11.5px] text-[#a0a0b0]">Приватный аккаунт</div>
              </div>
            </div>
            <nav className="space-y-1.5 text-[14.5px]">
              <button className="flex w-full items-center gap-3 rounded-[14px] px-3.5 py-3 text-left opacity-50 cursor-not-allowed">Настройки</button>
              <button className="flex w-full items-center gap-3 rounded-[14px] px-3.5 py-3 text-left opacity-50 cursor-not-allowed">О приложении</button>
              <button
                onClick={onLogout}
                className="mt-4 flex w-full items-center gap-3 rounded-[14px] border border-[#e94560]/30 bg-[#2a1a2e]/60 px-3.5 py-3 font-[600] text-[#ffb3c2]"
              >
                Выйти из аккаунта
              </button>
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}

// =========================
// Chat Page
// =========================
function ChatPage({ currentUser, chatId, onBack }: { currentUser: UserModel; chatId: string; onBack: () => void }) {
  const [messages, setMessages] = useState<MessageModel[]>([]);
  const [input, setInput] = useState("");

  const chat = useMemo(() => {
    const chats = storage.getChats();
    return chats.find((c) => c.id === chatId) || null;
  }, [chatId]);

  const otherUser = useMemo(() => {
    if (!chat) return null;
    const users = storage.getUsers();
    const otherId = chat.userA === currentUser.id ? chat.userB : chat.userA;
    return users.find((u) => u.id === otherId) || null;
  }, [chat, currentUser.id]);

  useEffect(() => {
    const all = storage.getMessages().filter((m) => m.chatId === chatId);
    setMessages(all);
    const updated = storage.getMessages().map((m) => (m.chatId === chatId && m.senderId !== currentUser.id ? { ...m, isRead: true } : m));
    storage.setMessages(updated);
    socket.emit("message_read", { chatId });
  }, [chatId, currentUser.id]);

  useEffect(() => {
    const off = socket.on("receive_message", (msg: MessageModel) => {
      if (msg.chatId === chatId) setMessages((prev) => [...prev, msg]);
    });
    return () => {
      off();
    };
  }, [chatId]);

  const handleSend = () => {
    if (!input.trim() || !chat || !otherUser) return;
    const msg: MessageModel = {
      id: generateId(),
      chatId: chat.id,
      senderId: currentUser.id,
      content: input.trim(),
      createdAt: Date.now(),
      isRead: false,
    };
    const messagesData = storage.getMessages();
    messagesData.push(msg);
    storage.setMessages(messagesData);
    setMessages((prev) => [...prev, msg]);
    setInput("");
    socket.emit("send_message", msg);
  };

  if (!chat || !otherUser) return null;

  return (
    <div className="flex h-dvh w-full flex-col bg-[#0f0f23] text-white select-none">
      <header className="z-30 flex h-[64px] items-center gap-3 border-b border-white/10 bg-[#1a1a2e]/80 px-3">
        <button onClick={onBack} className="rounded-xl px-3 py-2 hover:bg-white/10">←</button>
        <Avatar name={otherUser.username} size={40} online={otherUser.isOnline} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15.5px] font-[650]">{otherUser.username}</div>
          <div className="text-[11.5px] text-[#a0a0b0]">{otherUser.isOnline ? "онлайн" : "не в сети"}</div>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 overflow-y-auto px-4 py-5">
          <div className="mx-auto flex w-full max-w-[720px] flex-col gap-1.5 pb-2">
            {messages.map((msg) => {
              const isMe = msg.senderId === currentUser.id;
              return (
                <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}>
                  {!isMe && <Avatar name={otherUser.username} size={28} />}
                  <div className="relative max-w-[78%]">
                    <div
                      className={`relative rounded-[18px] px-3.5 py-2.5 text-[14.8px] leading-[1.45] shadow-[0_4px_24px_rgba(0,0,0,0.35)] ${
                        isMe ? "rounded-br-[6px] bg-gradient-to-br from-[#6c63ff] to-[#5a52e8] text-white" : "rounded-bl-[6px] bg-[#1a1a2e] text-[#eaeaf3]"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words [word-break:break-word]">{msg.content}</p>
                      <div className={`mt-1 flex items-center justify-end gap-1 text-[10.5px] ${isMe ? "text-white/70" : "text-[#a0a0b0]"}`}>
                        <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        {isMe && <span>{msg.isRead ? "✓✓" : "✓"}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10 bg-[#1a1a2e]/80 px-3 py-3">
        <div className="mx-auto flex w-full max-w-[720px] items-end gap-2.5 rounded-[20px] border border-white/12 bg-[#16213e]/70 px-3.5 py-2.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Написать сообщение..."
            rows={1}
            className="max-h-[120px] min-h-[38px] flex-1 resize-none bg-transparent text-[15px] font-[500] leading-[1.45] outline-none placeholder:text-[#7a7a92]"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[14px] bg-[#6c63ff] text-white disabled:opacity-50"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================
// Main App
// =========================
export default function App() {
  const [currentUser, setCurrentUser] = useState<UserModel | null>(null);
  const [authView, setAuthView] = useState<"register" | "login" | "verify-register" | "verify-login">("register");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingUserId, setPendingUserId] = useState("");

  useEffect(() => {
    const session = storage.getSession();
    if (!session) return;
    const user = storage.getUsers().find((u) => u.id === session.userId) || null;
    if (user) {
      setCurrentUser(user);
      socket.emit("user_online", { userId: user.id });
    }
  }, []);

  const handleRegistered = (userId: string, email: string) => {
    if (!email) {
      const user = storage.getUsers().find((u) => u.id === userId) || null;
      setCurrentUser(user);
      return;
    }
    setPendingEmail(email);
    setPendingUserId(userId);
    setAuthView("verify-register");
  };

  const handleVerifiedRegistration = () => {
    const users = storage.getUsers();
    const user = users.find((u) => u.id === pendingUserId);
    if (user) {
      user.isVerified = true;
      user.isOnline = true;
      user.lastSeen = Date.now();
      storage.setUsers(users);
      storage.setSession({ userId: user.id });
      setCurrentUser(user);
    }
  };

  const handleLoggedIn = (userId: string, requires2FA: boolean) => {
    if (!requires2FA) {
      const user = storage.getUsers().find((u) => u.id === userId) || null;
      setCurrentUser(user);
      return;
    }
    const user = storage.getUsers().find((u) => u.id === userId);
    if (user) {
      setPendingEmail(user.email);
      setPendingUserId(user.id);
      setAuthView("verify-login");
    }
  };

  const handleVerifiedLogin = () => {
    const users = storage.getUsers();
    const user = users.find((u) => u.id === pendingUserId);
    if (user) {
      user.isOnline = true;
      user.lastSeen = Date.now();
      storage.setUsers(users);
      storage.setSession({ userId: user.id });
      setCurrentUser(user);
    }
  };

  const handleLogout = () => {
    if (currentUser) {
      const users = storage.getUsers();
      const user = users.find((u) => u.id === currentUser.id);
      if (user) {
        user.isOnline = false;
        user.lastSeen = Date.now();
        storage.setUsers(users);
      }
      socket.emit("user_offline", { userId: currentUser.id });
    }
    storage.setSession(null);
    setCurrentUser(null);
    setActiveChatId(null);
    setAuthView("login");
  };

  return (
    <div className="h-dvh w-full overflow-hidden bg-[#0f0f23] font-sans text-[15px] antialiased">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700&family=Instrument+Serif:ital@0;1&display=swap');
        * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        ::selection { background: rgba(108,99,255,0.25); }
        .select-none { -webkit-user-select: none; user-select: none; }
      `}</style>

      {!currentUser ? (
        authView === "register" ? (
          <RegisterPage onSwitchToLogin={() => setAuthView("login")} onRegistered={handleRegistered} />
        ) : authView === "login" ? (
          <LoginPage onSwitchToRegister={() => setAuthView("register")} onLoggedIn={handleLoggedIn} />
        ) : authView === "verify-register" ? (
          <VerificationPage email={pendingEmail} type="register" onVerified={handleVerifiedRegistration} />
        ) : (
          <VerificationPage email={pendingEmail} type="login" onVerified={handleVerifiedLogin} />
        )
      ) : activeChatId ? (
        <ChatPage currentUser={currentUser} chatId={activeChatId} onBack={() => setActiveChatId(null)} />
      ) : (
        <ChatsPage currentUser={currentUser} onOpenChat={(id) => setActiveChatId(id)} onLogout={handleLogout} />
      )}
    </div>
  );
}

// TODO: future feature - file/image upload
// TODO: future feature - group chats
// TODO: future feature - end-to-end encryption
