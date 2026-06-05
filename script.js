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

// ==========================================================
// 2. BULLETPROOF AUTHENTICATION & SESSION
// ==========================================================
const evalSession = async () => {
  try {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session) throw new Error("No active session.");

    // EXPLICIT ERROR CHECK: Fetch profile
    const { data: p, error: profileErr } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (profileErr) throw new Error(`Database Error: ${profileErr.message}`);
    if (!p) throw new Error("Ghost User: Profile data is missing.");

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
    console.error("SESSION REJECTED:", err.message);
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
      // EXPLICIT ERROR CHECK: Fetch email for login
      const { data: p, error: fetchErr } = await supabaseClient
        .from("profiles")
        .select("email")
        .eq("mobile", mobile)
        .single();

      if (fetchErr || !p)
        throw new Error("Mobile not registered. Please register first.");

      const { error: authErr } = await supabaseClient.auth.signInWithPassword({
        email: p.email,
        password,
      });
      if (authErr) throw authErr;
    } else {
      const email = $("reg-email").value.trim();
      const name = $("reg-name").value.trim();

      const {
        data: { user },
        error: signUpErr,
      } = await supabaseClient.auth.signUp({ email, password });
      if (signUpErr) throw signUpErr;

      if (user) {
        // EXPLICIT ERROR CHECK: Insert profile
        const { error: insertErr } = await supabaseClient
          .from("profiles")
          .insert([
            {
              id: user.id,
              name,
              mobile,
              email,
              gender: $("reg-gender").value,
              avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
            },
          ]);

        if (insertErr) {
          throw new Error(
            `Profile creation blocked by database: ${insertErr.message}. RLS might be enabled.`,
          );
        }
      }
      alert("Operator Provisioned! Attempting Uplink...");
    }
    e.target.reset();
    await evalSession();
  } catch (err) {
    alert(`Auth Error: ${err.message}`);
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
// 3. NAVIGATION, OVERLAY & UI VIEWS
// ==========================================================
document.body.insertAdjacentHTML(
  "beforeend",
  `<div id="mobile-overlay" class="mobile-overlay"></div>`,
);

const toggleMobileMenu = (forceClose = false) => {
  const isOpening = !$("sidebarMenu").classList.contains("open") && !forceClose;
  $("hamburgerBtn")?.classList.toggle("active", isOpening);
  $("sidebarMenu")?.classList.toggle("open", isOpening);
  $("mobile-overlay")?.classList.toggle("active", isOpening);
};

$("hamburgerBtn")?.addEventListener("click", () => toggleMobileMenu());
$("mobile-overlay")?.addEventListener("click", () => toggleMobileMenu(true));

$$(".menu-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    if (item.id === "logoutBtn") return;
    e.preventDefault();
    $$(".menu-item").forEach((m) => m.classList.remove("active-menu"));
    $$(".view-section").forEach((v) => v.classList.remove("active"));
    item.classList.add("active-menu");
    $(item.dataset.view)?.classList.add("active");
    if (window.innerWidth <= 992) toggleMobileMenu(true);
  });
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
  if (window.innerWidth <= 992) toggleMobileMenu(true);
});

// ==========================================================
// 4. CONTACTS ENGINE (Now with Timestamp Sorting)
// ==========================================================
$("add-contact-btn")?.addEventListener("click", async () => {
  const contact = $("new-contact-mobile").value.trim(),
    name = $("new-contact-name").value.trim();
  if (contact.length !== 10 || !name || contact === State.mobile)
    return alert("Invalid or self contact.");
  try {
    const { error } = await supabaseClient
      .from("contacts")
      .insert([{ mobile: State.mobile, name, contact, gender: "Other" }]);
    if (error) throw error;
    $("new-contact-mobile").value = $("new-contact-name").value = "";
    await syncContacts();
    alert("Contact linked successfully.");
  } catch (err) {
    alert(`Contact Error: ${err.message}`);
  }
});

const syncContacts = async () => {
  try {
    // 1. Fetch contacts, profiles, and messages
    const [{ data: c }, { data: p }, { data: m }] = await Promise.all([
      supabaseClient.from("contacts").select("*").eq("mobile", State.mobile),
      supabaseClient.from("profiles").select("mobile, avatar_url, name"),
      supabaseClient
        .from("messages")
        .select("sender_mobile, recipient_mobile, is_read, created_at")
        .or(`sender_mobile.eq.${State.mobile},recipient_mobile.eq.${State.mobile}`),
    ]);

    const regMap = Object.fromEntries(p?.map((x) => [x.mobile, x]) || []);
    const unreadMap = {};
    const activeNumbers = new Set();
    const latestMsgMap = {}; 

    // 2. Map unread counts and calculate latest message timestamps
    m?.forEach((msg) => {
      const otherParty = msg.sender_mobile === State.mobile ? msg.recipient_mobile : msg.sender_mobile;
      if (msg.recipient_mobile === State.mobile && !msg.is_read) {
        unreadMap[msg.sender_mobile] = (unreadMap[msg.sender_mobile] || 0) + 1;
      }
      activeNumbers.add(otherParty);
      const msgTime = new Date(msg.created_at).getTime();
      if (!latestMsgMap[otherParty] || msgTime > latestMsgMap[otherParty]) {
        latestMsgMap[otherParty] = msgTime; 
      }
    });

    const finalContacts = [...(c || [])];
    const savedNumbers = new Set(finalContacts.map((x) => x.contact));

    // 3. Inject unsaved numbers
    activeNumbers.forEach((num) => {
      if (!savedNumbers.has(num)) {
        finalContacts.push({ contact: num, name: regMap[num]?.name || `+91 ${num}`, mobile: State.mobile });
      }
    });

    // 4. SORTING ENGINE
    finalContacts.sort((a, b) => {
      const timeA = latestMsgMap[a.contact] || 0;
      const timeB = latestMsgMap[b.contact] || 0;
      return timeB - timeA;
    });

    renderContacts(finalContacts, regMap, unreadMap);
  } catch (error) {
    console.error("Background sync isolated and recovered from failure:", error);
  }
};

const renderContacts = (contacts, regMap, unreadMap) => {
  const list = $("contacts-list"),
    grid = document.querySelector(".contacts-directory-grid");
  if (list)
    list.innerHTML = contacts.length
      ? ""
      : `<li class="placeholder-item" style="text-align:center;color:var(--text-muted);">No contacts found.</li>`;
  if (grid) $$(".directory-card").forEach((c) => c.remove());

  contacts.forEach((c) => {
    const p = regMap[c.contact],
      unread = unreadMap[c.contact] || 0;
    const avatar =
      p?.avatar_url ||
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(c.name)}`;

    if (list) {
      const li = document.createElement("li");
      li.className = State.activeContact === c.contact ? "active" : "";
      li.dataset.mobile = c.contact;
      li.innerHTML = `<img src="${avatar}" style="width:45px;height:45px;border-radius:12px;"/><div style="flex:1;"><h4 style="font-size:1rem;font-weight:600;">${c.name}</h4><p style="font-size:0.8rem;color:var(--text-muted);font-family:monospace;">+91 ${c.contact}</p></div>${unread > 0 ? `<div style="min-width:22px;height:22px;background:var(--neon-primary);color:#000;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:800;">${unread}</div>` : ""}`;
      li.onclick = () => openChat(c.contact, c.name, avatar, !!p);
      list.appendChild(li);
    }

    if (grid) {
      // FIXED: Generate nodes safely to avoid DOM selection bugs
      const card = document.createElement("div");
      card.className = "glass-panel directory-card";
      card.style.cssText = "padding:25px;";
      card.innerHTML = `<div style="display:flex;align-items:center;gap:15px;margin-bottom:20px;"><img src="${avatar}" style="width:60px;height:60px;border-radius:16px;"/><div><h3>${c.name}</h3><p style="color:var(--text-muted);font-family:monospace;">+91 ${c.contact}</p></div></div><div style="display:flex;gap:10px;"><button class="glow-btn open-chat-btn" style="flex:1;">Open Chat</button><button class="delete-contact-btn" style="flex:1;border:none;border-radius:12px;cursor:pointer;font-weight:600;background:#ff4d4d;color:white;padding:12px;">Delete</button></div>`;

      // FIXED: Proper querySelector logic for menu switching
      card.querySelector(".open-chat-btn").onclick = () => {
        openChat(c.contact, c.name, avatar, !!p);
        document.querySelector('[data-view="VIEW-CHATS"]')?.click();
      };

      card.querySelector(".delete-contact-btn").onclick = async () => {
        if (!confirm(`Delete ${c.name}?`)) return;
        await supabaseClient
          .from("contacts")
          .delete()
          .match({ mobile: State.mobile, contact: c.contact });
        if (State.activeContact === c.contact) {
          State.activeContact = "";
          $("chat-box").innerHTML = "";
          ["active-chat-header", "message-input-bar"].forEach((id) =>
            $(id).classList.add("hidden"),
          );
        }
        syncContacts();
      };
      grid.appendChild(card);
    }
  });
};

// ==========================================================
// 5. CHAT ENGINE & REALTIME (Optimistic UI Upgrade)
// ==========================================================
const openChat = async (mobile, name, avatar, isReg) => {
  State.activeContact = mobile;
  $$("#contacts-list li").forEach((li) => li.classList.toggle("active", li.dataset.mobile === mobile));

  $("chat-with-name").textContent = name;
  $("chat-target-avatar").src = avatar;
  $("chat-with-status").textContent = isReg ? "Connected" : "Offline";
  $("chat-with-status").style.color = isReg ? "var(--neon-primary)" : "#ff3366";

  ["active-chat-header", "message-input-bar"].forEach((id) => $(id).classList.remove("hidden"));
  if (window.innerWidth <= 992) {
    document.querySelector(".chat-layout-engine")?.classList.add("mobile-chat-active");
    $("sidebarMenu")?.classList.remove("open");
    $("hamburgerBtn")?.classList.remove("active");
  }

  $("chat-box").innerHTML = "";
  loadHistory();

  supabaseClient.from("messages").update({ is_read: true }).match({
    sender_mobile: mobile,
    recipient_mobile: State.mobile,
    is_read: false,
  }).then(() => syncContacts());
};

const loadHistory = async () => {
  if (!State.activeContact) return;
  const { data } = await supabaseClient.from("messages").select("*").or(`and(sender_mobile.eq.${State.mobile},recipient_mobile.eq.${State.activeContact}),and(sender_mobile.eq.${State.activeContact},recipient_mobile.eq.${State.mobile})`).order("created_at", { ascending: true });

  const box = $("chat-box");
  box.innerHTML = ""; box.dataset.lastDate = "";

  if (!data?.length) return (box.innerHTML = `<div class="empty-state"><div class="empty-icon">⎊</div><p>No communication history found.</p></div>`);
  data.forEach((msg) => appendBubble(msg, false));
  box.scrollTop = box.scrollHeight;
};

const appendBubble = (msg, autoScroll = true) => {
  const box = $("chat-box");
  box.querySelector(".empty-state")?.remove();

  // 🛡️ THE DUPLICATE SHIELD: Prevents Realtime from cloning messages we already drew
  if (msg.id && box.querySelector(`[data-msg-id="${msg.id}"]`)) return;

  const d = new Date(msg.created_at), dStr = d.toDateString();

  if (box.dataset.lastDate !== dStr) {
    const label = dStr === new Date().toDateString() ? "Today" : dStr === new Date(Date.now() - 864e5).toDateString() ? "Yesterday" : d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    box.insertAdjacentHTML("beforeend", `<div style="display:flex;justify-content:center;margin:20px 0;"><div style="padding:8px 16px;border-radius:99px;background:rgba(255,255,255,0.05);border:1px solid var(--glass-border);color:var(--text-muted);font-size:0.8rem;backdrop-filter:blur(10px);">${label}</div></div>`);
    box.dataset.lastDate = dStr;
  }

  const isMe = msg.sender_mobile === State.mobile;
  box.insertAdjacentHTML(
    "beforeend",
    `<div class="message-enter" data-msg-id="${msg.id}" style="display:flex;width:100%;justify-content:${isMe ? "flex-end" : "flex-start"};margin-bottom:12px;"><div class="chat-bubble" style="max-width:75%;background:${isMe ? "rgba(var(--neon-rgb), 0.1)" : "rgba(255,255,255,0.03)"};border:1px solid ${isMe ? "var(--neon-primary)" : "var(--glass-border)"};border-radius:${isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px"};backdrop-filter:blur(10px);"><div class="chat-bubble-content">${sanitize(msg.content)}</div><div class="chat-bubble-time">${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div></div></div>`
  );

  if (autoScroll) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
};

const sendMsg = async (e) => {
  if (e) e.preventDefault(); // STOPS silent layout reloads
  const content = $("msg-input").value.trim();
  if (!content || !State.activeContact) return;
  
  $("msg-input").value = ""; 

  // ⚡ OPTIMISTIC UI: Draw the bubble instantly before the DB even responds
  const tempId = "temp-" + Date.now();
  const optimisticMsg = {
     id: tempId,
     sender_mobile: State.mobile,
     recipient_mobile: State.activeContact,
     content: content,
     created_at: new Date().toISOString()
  };
  appendBubble(optimisticMsg, true);
  syncContacts(); // Instantly bump this chat to the top

  // 💾 BACKGROUND DB UPLOAD
  const { data, error } = await supabaseClient.from("messages").insert([
    {
      sender_mobile: State.mobile,
      recipient_mobile: State.activeContact,
      content,
      is_read: false,
    },
  ]).select().single(); // Ask DB to return the final generated row

  if (error) {
      alert(`Send Error: ${error.message}`);
      $(`[data-msg-id="${tempId}"]`)?.remove(); // Wipe the fake bubble if offline
      return;
  }

  // 🔄 SILENT SWAP: Replace our temporary ID with the real Database UUID
  const bubble = document.querySelector(`[data-msg-id="${tempId}"]`);
  if (bubble) bubble.dataset.msgId = data.id;
};

// Listeners securely pass the event object to block reloads
$("send-msg-btn")?.addEventListener("click", (e) => sendMsg(e));
$("msg-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        sendMsg(e);
    }
});

// 📡 BULLETPROOF REALTIME ENGINE
const initRealtime = () => {
  State.channel?.unsubscribe();
  State.channel = supabaseClient
    .channel("public-db-changes")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        const msg = p.new;
        if (!msg?.sender_mobile) return;

        const isCurr = (msg.sender_mobile === State.mobile && msg.recipient_mobile === State.activeContact) || 
                       (msg.sender_mobile === State.activeContact && msg.recipient_mobile === State.mobile);

        if (isCurr) {
          if (msg.recipient_mobile === State.mobile) {
            // Update read receipts completely in the background
            supabaseClient.from("messages").update({ is_read: true }).eq("id", msg.id).then(() => syncContacts());
            playSound();
          }
          // The Duplicate Shield ignores this if we just sent it ourselves
          appendBubble(msg, true); 
        } else if (msg.recipient_mobile === State.mobile) {
            playSound(); 
        }

        syncContacts();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "contacts" }, () => syncContacts())
    .subscribe();
};

// ==========================================================
// 6. INIT & UTILS
// ==========================================================

const neonThemes = [
  { name: "Cyberpunk Pink", hex: "#ff007f" },
  { name: "Matrix Green", hex: "#00ff41" },
  { name: "Plasma Purple", hex: "#b026ff" },
  { name: "Quantum Blue", hex: "#00f3ff" },
  { name: "Solar Flare", hex: "#ffaa00" },
  { name: "Toxic Glow", hex: "#ccff00" },
  { name: "Neon Violet", hex: "#7a00ff" },
  { name: "Synthwave Cyan", hex: "#0ff0fc" },
  { name: "Blood Moon", hex: "#ff003c" },
  { name: "Abyssal Blue", hex: "#0055ff" },
  { name: "Galactic Orchid", hex: "#da70d6" },
  { name: "Hyper Gold", hex: "#ffd700" },
  { name: "Radioactive Lime", hex: "#39ff14" },
  { name: "Deep Space Indigo", hex: "#4b0082" },
  { name: "Crimson Forge", hex: "#dc143c" },
  { name: "Arctic Ice", hex: "#a0e6ff" },
  { name: "Nebula Magenta", hex: "#ff00ff" },
  { name: "Void Blacklight", hex: "#8a2be2" },
  { name: "Hologram Mint", hex: "#98ff98" },
  { name: "Supernova Orange", hex: "#ff4500" },
  { name: "Tritium Glow", hex: "#7fff00" },
  { name: "Vaporwave Pink", hex: "#ff71ce" },
  { name: "Cobalt Core", hex: "#0047ab" },
  { name: "Phosphor Yellow", hex: "#ffff00" },
  { name: "Astral Teal", hex: "#008080" },
  { name: "Stellar Peach", hex: "#ffcba4" },
  { name: "Ionized Rose", hex: "#ff007f" },
  { name: "Cherenkov Blue", hex: "#00bfff" },
  { name: "Dark Matter Grey", hex: "#a9a9a9" },
  { name: "Obsidian Ruby", hex: "#e0115f" },
  { name: "Lucid Emerald", hex: "#50c878" },
];

const applyTheme = (hex) => {
  document.documentElement.style.setProperty("--neon-primary", hex);
  document.documentElement.style.setProperty(
    "--neon-rgb",
    `${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}`,
  );
  localStorage.setItem("vani-theme", hex);
};

// Generate Settings Theme Buttons dynamically
const themeContainer = $("themeButtonsContainer");
if (themeContainer) {
  neonThemes.forEach((t) => {
    const btn = document.createElement("button");
    btn.className = "theme-btn";
    btn.textContent = t.name;
    btn.style.cssText = `border-color:${t.hex}; color:#fff; box-shadow:0 0 15px rgba(0,0,0,0.5), inset 0 0 10px ${t.hex}40;`;
    btn.onmouseenter = () =>
      (btn.style.cssText = `border-color:${t.hex}; color:#000; background:${t.hex}; box-shadow:0 0 20px ${t.hex}, inset 0 0 15px ${t.hex};`);
    btn.onmouseleave = () =>
      (btn.style.cssText = `border-color:${t.hex}; color:#fff; background:transparent; box-shadow:0 0 15px rgba(0,0,0,0.5), inset 0 0 10px ${t.hex}40;`);
    btn.onclick = () => applyTheme(t.hex);
    themeContainer.appendChild(btn);
  });
}
// ==========================================================
// 7. ADVANCED AUTOMATION & 60FPS CINEMATIC ENGINE
// ==========================================================

let cinematicFrameId = null;
let cinematicStartTime = null;

// Mathematical converter to turn smooth Light/Color waves into strict RGB codes
const hslToRgb = (h, s, l) => {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [
    Math.round(255 * f(0)),
    Math.round(255 * f(8)),
    Math.round(255 * f(4)),
  ];
};

// The 60 Frames-Per-Second Render Loop
const cinematicLoop = (timestamp) => {
  if (!cinematicStartTime) cinematicStartTime = timestamp;
  const elapsed = timestamp - cinematicStartTime;

  // 25-Second Seamless Loop
  const cycle = (elapsed % 25000) / 25000;
  const hue = cycle * 360;

  // The "Dimming" Physics (Breathes between 50% and 35% brightness)
  const lightness = 50 + 15 * Math.cos(cycle * Math.PI * 2);

  // Calculate exact RGB
  const [r, g, b] = hslToRgb(hue, 100, lightness);

  // Surgically inject the new colors directly into the CSS variables
  document.documentElement.style.setProperty(
    "--neon-primary",
    `rgb(${r}, ${g}, ${b})`,
  );
  document.documentElement.style.setProperty("--neon-rgb", `${r}, ${g}, ${b}`);

  // Request the next frame
  cinematicFrameId = requestAnimationFrame(cinematicLoop);
};

const enableCinematicMode = () => {
  // Lock out the Settings UI
  $("toggle-random-boot").disabled = true;
  $("toggle-random-boot").parentElement.classList.add("theme-locked");
  $$(".theme-btn").forEach((btn) => btn.classList.add("theme-locked"));

  // Ignite the render engine
  if (!cinematicFrameId) {
    cinematicStartTime = null; // Reset timer
    cinematicFrameId = requestAnimationFrame(cinematicLoop);
  }
};

const disableCinematicMode = () => {
  // Unlock the Settings UI
  $("toggle-random-boot").disabled = false;
  $("toggle-random-boot").parentElement.classList.remove("theme-locked");
  $$(".theme-btn").forEach((btn) => btn.classList.remove("theme-locked"));

  // Kill the render engine
  if (cinematicFrameId) {
    cancelAnimationFrame(cinematicFrameId);
    cinematicFrameId = null;
  }

  // Snap back to a valid theme
  if ($("toggle-random-boot").checked) {
    const randomTheme =
      neonThemes[Math.floor(Math.random() * neonThemes.length)];
    applyTheme(randomTheme.hex);
  } else {
    const savedTheme = localStorage.getItem("vani-theme");
    applyTheme(savedTheme || neonThemes[0].hex);
  }
};

const bootThemeEngine = () => {
  const prefRandomBoot = localStorage.getItem("vani-random-boot") !== "false";
  const prefCinematic = localStorage.getItem("vani-cinematic") === "true";
  const savedTheme = localStorage.getItem("vani-theme");

  const randomToggle = $("toggle-random-boot");
  const cinematicToggle = $("toggle-cinematic-mode");

  if (randomToggle) randomToggle.checked = prefRandomBoot;
  if (cinematicToggle) cinematicToggle.checked = prefCinematic;

  if (prefCinematic) {
    enableCinematicMode();
  } else {
    disableCinematicMode();
  }

  randomToggle?.addEventListener("change", (e) => {
    localStorage.setItem("vani-random-boot", e.target.checked);
  });

  cinematicToggle?.addEventListener("change", (e) => {
    const isOn = e.target.checked;
    localStorage.setItem("vani-cinematic", isOn);
    isOn ? enableCinematicMode() : disableCinematicMode();
  });
};

// --- SYSTEM BOOT SEQUENCE ---
window.addEventListener("DOMContentLoaded", async () => {
  bootThemeEngine();

  if (typeof supabase === "undefined") {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    s.onload = evalSession;
    document.head.appendChild(s);
  } else {
    await evalSession();
  }
});
