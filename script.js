// ==========================================================
// 1. SETUP, STATE & HELPERS
// ==========================================================
const supabaseClient = supabase.createClient(
  "https://gxuqhaxboagwsktoupyv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dXFoYXhib2Fnd3NrdG91cHl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Njk2NjYsImV4cCI6MjA5NjA0NTY2Nn0.jvOUukSys7sbc_Rw7ML-ISdqWEpMx5HMreR3b7v_zTU",
);

const State = { mobile: "", profile: null, activeContact: "", channel: null };
const $ = (id) => (typeof id === "string" ? document.getElementById(id) : id);
const $$ = (sel) => document.querySelectorAll(sel);

const toggleUI = (show) => {
  $("auth-view-wrapper")?.classList.toggle("hidden", show);
  $("chat-screen")?.classList.toggle("hidden", !show);
};
const sanitize = (s) =>
  s.replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[m],
  );
const playSound = () =>
  new Audio("assets/sounds/message.mp3").play().catch(() => {});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

// ==========================================================
// 2. AUTHENTICATION & SESSION
// ==========================================================
const evalSession = async () => {
  try {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session) throw "No session";

    const { data: p } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();
    if (!p) throw "No profile";

    Object.assign(State, { profile: p, mobile: p.mobile });
    $("my-avatar").src =
      p.avatar_url ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}`;
    $("my-name").textContent = p.name;
    $("my-mobile-display").textContent = `+91 ${p.mobile}`;

    toggleUI(true);
    await syncContacts();
    initRealtime();
  } catch (err) {
    toggleUI(false);
  } finally {
    $("boot-loader")?.remove();
  }
};

const handleAuth = async (e, isLogin) => {
  e.preventDefault();
  try {
    const mobile = $(isLogin ? "login-mobile" : "reg-mobile").value.trim();
    const password = $(isLogin ? "login-password" : "reg-password").value;

    if (isLogin) {
      const { data: p } = await supabaseClient
        .from("profiles")
        .select("email")
        .eq("mobile", mobile)
        .single();
      if (!p) throw new Error("Mobile not registered.");
      const { error } = await supabaseClient.auth.signInWithPassword({
        email: p.email,
        password,
      });
      if (error) throw error;
    } else {
      const email = $("reg-email").value.trim(),
        name = $("reg-name").value.trim();
      const {
        data: { user },
        error,
      } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;

      if (user)
        await supabaseClient.from("profiles").insert([
          {
            id: user.id,
            name,
            mobile,
            email,
            gender: $("reg-gender").value,
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
          },
        ]);
      alert("Operator Provisioned");
    }
    e.target.reset();
    await evalSession();
  } catch (err) {
    alert(`Auth failed: ${err.message}`);
  }
};

$("login-form")?.addEventListener("submit", (e) => handleAuth(e, true));
$("register-form")?.addEventListener("submit", (e) => handleAuth(e, false));
$("go-to-register")?.addEventListener("click", () => {
  $("login-screen").classList.add("hidden");
  $("register-screen").classList.remove("hidden");
});
$("go-to-login")?.addEventListener("click", () => {
  $("register-screen").classList.add("hidden");
  $("login-screen").classList.remove("hidden");
});

const logout = async () => {
  if (!confirm("Logout from VANI?")) return;
  State.channel?.unsubscribe();
  await supabaseClient.auth.signOut();
  location.reload();
};
["logoutBtn", "logoutProfileBtn"].forEach((id) =>
  $(id)?.addEventListener("click", logout),
);
$("my-avatar")?.parentElement?.addEventListener("dblclick", logout);

// ==========================================================
// 3. NAVIGATION & UI VIEWS
// ==========================================================
$$(".menu-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    if (item.id === "logoutBtn") return;
    e.preventDefault();
    $$(".menu-item").forEach((m) => m.classList.remove("active-menu"));
    $$(".view-section").forEach((v) => v.classList.remove("active"));

    item.classList.add("active-menu");
    $(item.dataset.view)?.classList.add("active");
    if (window.innerWidth <= 992) {
      $("sidebarMenu")?.classList.remove("open");
      $("hamburgerBtn")?.classList.remove("active");
    }
  });
});

$("hamburgerBtn")?.addEventListener("click", () => {
  $("hamburgerBtn").classList.toggle("active");
  $("sidebarMenu").classList.toggle("open");
});

$("mobile-back-btn")?.addEventListener("click", () => {
  document
    .querySelector(".chat-layout-engine")
    ?.classList.remove("mobile-chat-active");
  State.activeContact = "";
  ["active-chat-header", "message-input-bar"].forEach((id) =>
    $(id).classList.add("hidden"),
  );
  $$("#contacts-list li").forEach((li) => li.classList.remove("active"));
});

$("profileCard")?.addEventListener("click", () => {
  $$(".view-section").forEach((v) => v.classList.remove("active"));
  $("VIEW-PROFILE")?.classList.add("active");
  $("profile-avatar").src = State.profile.avatar_url;
  $("profile-name").textContent = State.profile.name;
  $("profile-mobile").textContent = `+91 ${State.profile.mobile}`;
  $("profile-email").textContent = State.profile.email;
});

// ==========================================================
// 3. NAVIGATION, OVERLAY & UI VIEWS
// ==========================================================
// Inject the mobile overlay natively
document.body.insertAdjacentHTML("beforeend", `<div id="mobile-overlay" class="mobile-overlay"></div>`);

// Centralized Menu Logic
const toggleMobileMenu = (forceClose = false) => {
  const isOpening = !$("sidebarMenu").classList.contains("open") && !forceClose;
  $("hamburgerBtn")?.classList.toggle("active", isOpening);
  $("sidebarMenu")?.classList.toggle("open", isOpening);
  $("mobile-overlay")?.classList.toggle("active", isOpening);
};

// Hamburger & Overlay Listeners
$("hamburgerBtn")?.addEventListener("click", () => toggleMobileMenu());
$("mobile-overlay")?.addEventListener("click", () => toggleMobileMenu(true));

$$(".menu-item").forEach(item => {
  item.addEventListener("click", e => {
    if (item.id === "logoutBtn") return;
    e.preventDefault();
    
    // Switch Active States
    $$(".menu-item").forEach(m => m.classList.remove("active-menu"));
    $$(".view-section").forEach(v => v.classList.remove("active"));
    item.classList.add("active-menu");
    $(item.dataset.view)?.classList.add("active");
    
    // Smoothly close menu on mobile after selection
    if (window.innerWidth <= 992) toggleMobileMenu(true);
  });
});

$("mobile-back-btn")?.addEventListener("click", () => {
  document.querySelector(".chat-layout-engine")?.classList.remove("mobile-chat-active");
  State.activeContact = "";
  ["active-chat-header", "message-input-bar"].forEach(id => $(id).classList.add("hidden"));
  $$("#contacts-list li").forEach(li => li.classList.remove("active"));
});

$("profileCard")?.addEventListener("click", () => {
  $$(".view-section").forEach(v => v.classList.remove("active"));
  $("VIEW-PROFILE")?.classList.add("active");
  $("profile-avatar").src = State.profile.avatar_url;
  $("profile-name").textContent = State.profile.name;
  $("profile-mobile").textContent = `+91 ${State.profile.mobile}`;
  $("profile-email").textContent = State.profile.email;
  if (window.innerWidth <= 992) toggleMobileMenu(true);
});
// ==========================================================
// 5. CHAT ENGINE & REALTIME
// ==========================================================
const openChat = async (mobile, name, avatar, isReg) => {
  State.activeContact = mobile;
  $$("#contacts-list li").forEach((li) =>
    li.classList.toggle("active", li.dataset.mobile === mobile),
  );

  $("chat-with-name").textContent = name;
  $("chat-target-avatar").src = avatar;
  $("chat-with-status").textContent = isReg ? "Connected" : "Offline";
  $("chat-with-status").style.color = isReg ? "var(--neon-primary)" : "#ff3366";

  ["active-chat-header", "message-input-bar"].forEach((id) =>
    $(id).classList.remove("hidden"),
  );
  if (window.innerWidth <= 992) {
    document
      .querySelector(".chat-layout-engine")
      ?.classList.add("mobile-chat-active");
    $("sidebarMenu")?.classList.remove("open");
    $("hamburgerBtn")?.classList.remove("active");
  }

  await supabaseClient.from("messages").update({ is_read: true }).match({
    sender_mobile: mobile,
    recipient_mobile: State.mobile,
    is_read: false,
  });
  await syncContacts();
  loadHistory();
};

const loadHistory = async () => {
  if (!State.activeContact) return;
  const { data } = await supabaseClient
    .from("messages")
    .select("*")
    .or(
      `and(sender_mobile.eq.${State.mobile},recipient_mobile.eq.${State.activeContact}),and(sender_mobile.eq.${State.activeContact},recipient_mobile.eq.${State.mobile})`,
    )
    .order("created_at", { ascending: true });

  const box = $("chat-box");
  box.innerHTML = "";
  box.dataset.lastDate = "";

  if (!data?.length)
    return (box.innerHTML = `<div class="empty-state"><div class="empty-icon">⎊</div><p>No communication history found.</p></div>`);
  data.forEach((msg) => appendBubble(msg, false));
  box.scrollTop = box.scrollHeight;
};

const appendBubble = (msg, autoScroll = true) => {
  const box = $("chat-box");
  box.querySelector(".empty-state")?.remove();

  const d = new Date(msg.created_at),
    dStr = d.toDateString();
  if (box.dataset.lastDate !== dStr) {
    const label =
      dStr === new Date().toDateString()
        ? "Today"
        : dStr === new Date(Date.now() - 864e5).toDateString()
          ? "Yesterday"
          : d.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });
    box.insertAdjacentHTML(
      "beforeend",
      `<div style="display:flex;justify-content:center;margin:20px 0;"><div style="padding:8px 16px;border-radius:99px;background:rgba(255,255,255,0.05);border:1px solid var(--glass-border);color:var(--text-muted);font-size:0.8rem;backdrop-filter:blur(10px);">${label}</div></div>`,
    );
    box.dataset.lastDate = dStr;
  }

  const isMe = msg.sender_mobile === State.mobile;
  box.insertAdjacentHTML(
    "beforeend",
    `<div class="message-enter" style="display:flex;width:100%;justify-content:${isMe ? "flex-end" : "flex-start"};margin-bottom:12px;"><div class="chat-bubble" style="max-width:70%;padding:12px 18px;background:${isMe ? "rgba(var(--neon-rgb), 0.1)" : "rgba(255,255,255,0.03)"};border:1px solid ${isMe ? "var(--neon-primary)" : "var(--glass-border)"};border-radius:${isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px"};backdrop-filter:blur(10px);"><div style="display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px;"><span style="font-size:0.95rem;line-height:1.5;word-break:break-word;flex:1;">${sanitize(msg.content)}</span><span style="font-size:0.65rem;color:var(--text-muted);font-family:monospace;white-space:nowrap;opacity:.7;">${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div></div></div>`,
  );
  if (autoScroll) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
};

const sendMsg = async () => {
  const content = $("msg-input").value.trim();
  if (!content || !State.activeContact) return;
  $("msg-input").value = "";
  await supabaseClient.from("messages").insert([
    {
      sender_mobile: State.mobile,
      recipient_mobile: State.activeContact,
      content,
      is_read: false,
    },
  ]);
};

$("send-msg-btn")?.addEventListener("click", sendMsg);
$("msg-input")?.addEventListener(
  "keydown",
  (e) => e.key === "Enter" && sendMsg(),
);

const initRealtime = () => {
  State.channel?.unsubscribe();
  State.channel = supabaseClient
    .channel("public:messages")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "messages" },
      async (p) => {
        const msg = p.new || p.old;
        if (!msg?.sender_mobile) return;

        const isCurr =
          (msg.sender_mobile === State.mobile &&
            msg.recipient_mobile === State.activeContact) ||
          (msg.sender_mobile === State.activeContact &&
            msg.recipient_mobile === State.mobile);
        if (isCurr && p.eventType === "INSERT") {
          if (msg.recipient_mobile === State.mobile)
            await supabaseClient
              .from("messages")
              .update({ is_read: true })
              .eq("id", msg.id);
          appendBubble(msg, true);
          if (msg.recipient_mobile === State.mobile) playSound();
        } else syncContacts();
      },
    )
    .subscribe();
};

// ==========================================================
// 6. INIT & UTILS
// ==========================================================

// Theme Persistence Hook
const origApplyTheme = window.applyTheme;
if (origApplyTheme) {
  window.applyTheme = (hex) => {
    origApplyTheme(hex);
    localStorage.setItem("vani-theme", hex);
  };
  window.addEventListener("DOMContentLoaded", () => {
    const s = localStorage.getItem("vani-theme");
    if (s) origApplyTheme(s);
  });
}

// App Boot
window.addEventListener("DOMContentLoaded", async () => {
  if (typeof supabase === "undefined") {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    s.onload = evalSession;
    document.head.appendChild(s);
  } else {
    await evalSession();
  }
});
