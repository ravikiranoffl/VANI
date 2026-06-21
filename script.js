const supabaseClient = supabase.createClient(
  "https://gxuqhaxboagwsktoupyv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dXFoYXhib2Fnd3NrdG91cHl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Njk2NjYsImV4cCI6MjA5NjA0NTY2Nn0.jvOUukSys7sbc_Rw7ML-ISdqWEpMx5HMreR3b7v_zTU",
);

(function initAlertMatrix() {
  const styleId = "vani-alert-styles";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
            #vani-alert-matrix {
                position: fixed; top: max(20px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%);
                z-index: 2147483647 !important; display: flex; flex-direction: column; gap: 12px;
                pointer-events: none; width: 90%; max-width: 400px;
            }
            .vani-alert-box {
                background: rgba(8, 8, 12, 0.95) !important; backdrop-filter: blur(20px) !important;
                -webkit-backdrop-filter: blur(20px) !important; border: 1px solid var(--neon-primary);
                color: #fff !important; padding: 16px 24px; border-radius: 16px;
                font-family: 'Space Grotesk', sans-serif !important; font-size: 0.95rem; font-weight: 600;
                letter-spacing: 0.5px; box-shadow: 0 10px 30px rgba(0,0,0,0.5), inset 0 0 15px rgba(var(--neon-rgb), 0.15);
                pointer-events: all; cursor: pointer; display: flex; align-items: center; gap: 15px;
                animation: alertSlideDown 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            }
            .vani-alert-box.closing { animation: alertSlideUp 0.3s ease-in forwards; }
            .vani-alert-icon { font-size: 1.2rem; flex-shrink: 0; }
            @keyframes alertSlideDown {
                from { opacity: 0; transform: translateY(-30px) scale(0.95); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes alertSlideUp {
                from { opacity: 1; transform: translateY(0) scale(1); }
                to { opacity: 0; transform: translateY(-20px) scale(0.9); }
            }
        `;
    document.head.appendChild(style);
  }

  window.alert = function (message) {
    let matrix = document.getElementById("vani-alert-matrix");
    if (!matrix) {
      matrix = document.createElement("div");
      matrix.id = "vani-alert-matrix";
      document.body.appendChild(matrix);
    }

    const alertBox = document.createElement("div");
    alertBox.className = "vani-alert-box";

    const msgStr = String(message).toLowerCase();
    let iconHTML =
      '<i class="fa-solid fa-bell vani-alert-icon" style="color: var(--neon-primary); text-shadow: 0 0 10px var(--neon-primary);"></i>';

    if (
      msgStr.includes("error") ||
      msgStr.includes("fail") ||
      msgStr.includes("reject") ||
      msgStr.includes("denied")
    ) {
      iconHTML =
        '<i class="fa-solid fa-triangle-exclamation vani-alert-icon" style="color: #ff4d4d; text-shadow: 0 0 10px #ff4d4d;"></i>';
      alertBox.style.borderColor = "#ff4d4d";
      alertBox.style.boxShadow =
        "0 10px 30px rgba(0,0,0,0.5), inset 0 0 15px rgba(255, 77, 77, 0.15)";
    } else if (
      msgStr.includes("success") ||
      msgStr.includes("locked") ||
      msgStr.includes("provisioned") ||
      msgStr.includes("linked")
    ) {
      iconHTML =
        '<i class="fa-solid fa-shield-check vani-alert-icon" style="color: #00ff88; text-shadow: 0 0 10px #00ff88;"></i>';
      alertBox.style.borderColor = "#00ff88";
      alertBox.style.boxShadow =
        "0 10px 30px rgba(0,0,0,0.5), inset 0 0 15px rgba(0, 255, 136, 0.15)";
    }

    alertBox.innerHTML =
      iconHTML +
      '<span style="flex: 1; line-height: 1.4;">' +
      message +
      "</span>";

    alertBox.addEventListener("click", () => {
      alertBox.classList.add("closing");
      setTimeout(() => alertBox.remove(), 300);
    });

    matrix.appendChild(alertBox);

    if (typeof playSound === "function") {
      playSound(msgStr.includes("error") ? "delete" : "receive");
    }

    setTimeout(() => {
      if (document.body.contains(alertBox)) {
        alertBox.classList.add("closing");
        setTimeout(() => alertBox.remove(), 300);
      }
    }, 4500);
  };

  console.log("🚨 VANI Alert Matrix Overridden Successfully.");
})();

const State = {
  mobile: "",
  profile: null,
  activeContact: "",
  channel: null,
  presenceChannel: null,
  onlineUsers: new Set(),
};

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

const playSound = (type) => {
  if (localStorage.getItem("vani-audio") === "false") return;

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "send") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } else if (type === "receive") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === "delete") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(900, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.8, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    }
  } catch (e) {
    console.warn("Audio blocked by browser.");
  }
};

const evalSession = async () => {
  try {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session) throw new Error("No active session.");

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

    $("my-mobile-display").textContent = p.vani_id
      ? `@${p.vani_id}`
      : "Pending Handle...";

    toggleUI(true);

    if (State.profile && !State.profile.welcomed_by_vani) {
      await triggerHelplineWelcome();
    }

    $("login-form")?.reset();
    $("register-form")?.reset();

    if (!p.vani_id) {
      const modal = document.getElementById("claim-handle-modal");
      if (modal) modal.style.display = "flex";
      return;
    }

    await syncContacts();
    initRealtime();
    initPresence();
    linkDeviceToOneSignal();
    VaniCreditsEngine.init(State.mobile);
  } catch (err) {
    console.error("SESSION REJECTED:", err.message);

    if (err.message !== "No active session.") {
      alert(`System Reject: ${err.message}`);
    }
    toggleUI(false);
  } finally {
    const loader = $("boot-loader");
    if (loader) {
      setTimeout(() => {
        loader.style.opacity = "0";
        loader.style.transition = "opacity 0.8s ease-in-out";

        setTimeout(() => loader.remove(), 800);
      }, 1200);
    }
  }
};

const handleAuth = async (e, isLogin) => {
  e.preventDefault();

  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.textContent;

  try {
    btn.textContent = "Authenticating...";
    btn.style.opacity = "0.5";
    btn.disabled = true;

    const mobile = $(isLogin ? "login-mobile" : "reg-mobile").value.trim();
    const password = $(isLogin ? "login-password" : "reg-password").value;

    if (isLogin) {
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

      const rawHandle = $("reg-handle")
        ? $("reg-handle").value.trim()
        : `u_${Date.now().toString().slice(-6)}`;
      const finalHandle = window.validateVaniHandle(rawHandle, name);

      const {
        data: { user },
        error: signUpErr,
      } = await supabaseClient.auth.signUp({ email, password });
      if (signUpErr) throw signUpErr;

      if (user) {
        const { error: insertErr } = await supabaseClient
          .from("profiles")
          .insert([
            {
              id: user.id,
              name,
              mobile,
              email,
              gender: $("reg-gender").value,
              avatar_url: `https://static.vecteezy.com/system/resources/thumbnails/005/544/718/small/profile-icon-design-free-vector.jpg`,
              vani_id: finalHandle,
            },
          ]);

        if (insertErr) {
          throw new Error(
            insertErr.code === "23505"
              ? "That VANI ID is already taken by another operator!"
              : `Database error: ${insertErr.message}`,
          );
        }
      }
      alert("Operator Provisioned! Attempting Uplink...");
    }

    await evalSession();
  } catch (err) {
    alert(`Auth Error: ${err.message}`);
  } finally {
    btn.textContent = originalText;
    btn.style.opacity = "1";
    btn.disabled = false;
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

    if (
      typeof RandomState !== "undefined" &&
      RandomState.roomId &&
      item.dataset.view !== "VIEW-RANDOM"
    ) {
      if (
        !confirm(
          "Are you sure you want to leave? This will permanently disconnect your active stranger chat.",
        )
      ) {
        return;
      }

      supabaseClient
        .from("vani_random")
        .update({ status: "closed" })
        .eq("id", RandomState.roomId);
      if (typeof abortRandomSearch === "function") abortRandomSearch();
    }

    $$(".menu-item").forEach((m) => m.classList.remove("active-menu"));
    $$(".view-section").forEach((v) => v.classList.remove("active"));
    item.classList.add("active-menu");
    $(item.dataset.view)?.classList.add("active");
    if (window.innerWidth <= 992) toggleMobileMenu(true);
  });
});

$("mobile-back-btn")?.addEventListener("click", () => {
  document.body.classList.remove("in-mobile-chat");

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

  if (!$("profile-handle-display")) {
    $("profile-name").insertAdjacentHTML(
      "afterend",
      `
        <p id="profile-handle-display" style="letter-spacing: 0; color: var(--neon-primary); font-family: 'Space Grotesk', sans-serif; font-size: 1.3rem;  margin: 5px 0 -10px 0;">
            @${State.profile.vani_id || "pending"}
        </p>
      `,
    );
  } else {
    $("profile-handle-display").textContent = `@${State.profile.vani_id}`;
  }

  if (window.innerWidth <= 992) toggleMobileMenu(true);
});

const refreshContactsUI = async () => {
  await syncContacts();
};

$("add-contact-btn")?.addEventListener("click", async () => {
  const rawHandle = $("new-contact-handle").value.trim();
  const name = $("new-contact-name").value.trim();

  if (!rawHandle || !name)
    return alert("Please enter a VANI ID and a local name.");

  const cleanHandle = rawHandle.toLowerCase().replace(/@/g, "");
  if (cleanHandle === State.profile.vani_id)
    return alert("You cannot add your own Contact.");

  const btn = $("add-contact-btn");
  btn.textContent = "Scanning Matrix...";
  btn.disabled = true;

  try {
    const { data: targetProfile, error: lookupErr } = await supabaseClient
      .from("profiles")
      .select("mobile")
      .eq("vani_id", cleanHandle)
      .single();

    if (lookupErr || !targetProfile)
      throw new Error("VANI ID not found in the matrix.");

    const targetMobile = targetProfile.mobile;

    const { data: existing } = await supabaseClient
      .from("contacts")
      .select("id")
      .match({ mobile: State.mobile, contact: targetMobile });

    if (existing && existing.length > 0)
      throw new Error("Contact is already linked in your directory.");

    const { error } = await supabaseClient
      .from("contacts")
      .insert([
        { mobile: State.mobile, name, contact: targetMobile, gender: "Other" },
      ]);

    if (error) throw error;

    $("new-contact-handle").value = $("new-contact-name").value = "";
    await syncContacts();
    alert(`Contact @${cleanHandle} Linked Successfully.`);
  } catch (err) {
    alert(`Discovery Error: ${err.message}`);
  } finally {
    btn.textContent = "Add New Contact";
    btn.disabled = false;
  }
});

const syncContacts = async () => {
  const [{ data: c }, { data: p }, { data: m }] = await Promise.all([
    supabaseClient.from("contacts").select("*").eq("mobile", State.mobile),
    supabaseClient.from("profiles").select("mobile, avatar_url, name, vani_id"),
    supabaseClient.rpc("get_recent_chats", { user_mobile: State.mobile }),
  ]);

  const regMap = Object.fromEntries(p?.map((x) => [x.mobile, x]) || []);

  const latestMsgMap = Object.fromEntries(
    m?.map((row) => [
      row.contact_mobile,
      new Date(row.last_message_time).getTime(),
    ]) || [],
  );
  const unreadMap = Object.fromEntries(
    m?.map((row) => [row.contact_mobile, row.unread_count]) || [],
  );

  const savedMap = {};
  c?.forEach((saved) => (savedMap[saved.contact] = true));
  const finalContacts = [...(c || [])];

  m?.forEach((row) => {
    if (!savedMap[row.contact_mobile] && row.contact_mobile !== State.mobile) {
      finalContacts.push({
        contact: row.contact_mobile,
        name: `Unknown`,
        isGhost: true,
      });
    }
  });

  finalContacts.sort(
    (a, b) => (latestMsgMap[b.contact] || 0) - (latestMsgMap[a.contact] || 0),
  );

  renderContacts(finalContacts, regMap, unreadMap);
  if (typeof updatePresenceUI === "function") updatePresenceUI();
};

const renderContacts = (contacts, regMap, unreadMap) => {
  const list = $("contacts-list");
  const grid = document.querySelector(".contacts-directory-grid");

  const stateSnapshot = JSON.stringify({
    active: State.activeContact,
    data: contacts.map((c) => ({
      id: c.contact,
      name: c.name,
      unread: unreadMap[c.contact] || 0,
      handle: regMap[c.contact]?.vani_id || "",
      avatar: regMap[c.contact]?.avatar_url || "",
      ghost: c.isGhost || false,
    })),
  });

  if (list && list.dataset.snapshot === stateSnapshot) return;
  if (list) list.dataset.snapshot = stateSnapshot;

  if (list) {
    list.innerHTML = contacts.length
      ? ""
      : `<li class="placeholder-item" style="text-align:center;color:var(--text-muted);">No contacts found.</li>`;
  }
  if (grid) $$(".directory-card").forEach((c) => c.remove());

  const listFragment = document.createDocumentFragment();
  const gridFragment = document.createDocumentFragment();

  contacts.forEach((c) => {
    const p = regMap[c.contact];
    const unread = unreadMap[c.contact] || 0;
    const avatar =
      p?.avatar_url ||
      `https://static.vecteezy.com/system/resources/thumbnails/005/544/718/small/profile-icon-design-free-vector.jpg`;
    const displayHandle = p?.vani_id ? `@${p.vani_id}` : "@unclaimed";

    if (list) {
      const li = document.createElement("li");
      li.className = State.activeContact === c.contact ? "active" : "";
      li.dataset.mobile = c.contact;

      li.innerHTML = `<img src="${avatar}" alt="${name} avatar" width="45" height="45" loading="lazy" style="width:45px;height:45px;border-radius:12px; object-fit: cover;">
        <div style="flex:1; min-width:0; overflow:hidden;">
            <h2 style="margin:0; font-size:1rem;font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.name}</h2>
            <p style="margin:0; font-size:0.85rem;color:var(--text-muted);font-family:monospace; letter-spacing: 0.5px;">${displayHandle}</p>
        </div>
        ${unread > 0 ? `<div class="unread-badge">${unread > 99 ? "99+" : unread}</div>` : ""}
      `;
      li.onclick = () => openChat(c.contact, c.name, avatar, !!p, c.isGhost);
      listFragment.appendChild(li);
    }

    if (grid) {
      const card = document.createElement("div");
      card.className = "glass-panel directory-card";
      card.style.cssText = "padding:25px;";

      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:15px;margin-bottom:20px;">
            <img src="${avatar}" alt="${c.name} avatar" width="60" height="60" style="width:60px;height:60px;border-radius:16px; object-fit: cover;"/>
            <div>
                <h3 style="margin:0 0 5px 0; font-size: 1.1rem;">${c.name}</h3>
                <p style="color:var(--neon-primary);font-family:monospace;margin:0;">${displayHandle}</p>
            </div>
        </div>
        <div style="display:flex;gap:10px;">
            <button class="glow-btn open-chat-btn" style="flex:1;">Open Chat</button>
            ${c.isGhost ? "" : '<button class="delete-contact-btn" style="flex:1;">Delete</button>'}
        </div>
      `;

      card.querySelector(".open-chat-btn").onclick = () => {
        openChat(c.contact, c.name, avatar, !!p, c.isGhost);
        document.querySelector('[data-view="VIEW-CHATS"]')?.click();
      };

      if (!c.isGhost) {
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
      }
      gridFragment.appendChild(card);
    }
  });

  if (list && contacts.length > 0) {
    if (typeof animateFLIP === "function") {
      animateFLIP("contacts-list", () => {
        list.innerHTML = "";
        list.appendChild(listFragment);
      });
    } else {
      list.appendChild(listFragment);
    }
  }
  if (grid) grid.appendChild(gridFragment);
};

const clearUnreadBadgeFromUI = (mobile) => {
  const li = document.querySelector(`li[data-mobile="${mobile}"]`);
  if (li) {
    const badge = li.querySelector(".unread-badge");
    if (badge) badge.remove();
  }
};

const openChat = async (mobile, name, avatar, isReg, isGhost = false) => {
  clearUnreadBadgeFromUI(mobile);
  State.activeContact = mobile;
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

  const saveBtn = $("save-ghost-btn");
  if (saveBtn) {
    if (isGhost) {
      saveBtn.classList.remove("hidden");
      saveBtn.dataset.mobile = mobile;
    } else {
      saveBtn.classList.add("hidden");
    }
  }

  if (window.innerWidth <= 992) {
    document.body.classList.add("in-mobile-chat");
    $("sidebarMenu")?.classList.remove("open");
    $("hamburgerBtn")?.classList.remove("active");
  }

  $("chat-box").innerHTML = "";
  loadHistory();

  updatePresenceUI();

  const activeContactLi = document.querySelector(`li[data-mobile="${mobile}"]`);
  if (activeContactLi) {
    const badge = activeContactLi.querySelector(".unread-badge");
    if (badge) badge.remove();
  }

  const { error: updateErr } = await supabaseClient
    .from("messages")
    .update({ is_read: true })
    .eq("sender_mobile", mobile)
    .eq("recipient_mobile", State.mobile)
    .eq("is_read", false);

  if (updateErr) {
    console.error(
      "Matrix Error: Database rejected the Read-Receipt update.",
      updateErr.message,
    );
  } else {
    syncContacts();
  }

  if (typeof checkCallButtonVisibility === "function") {
    checkCallButtonVisibility();
  }
};

window.getVaniDateLabel = (dateString) => {
  const d = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const appendBubble = (msg, autoScroll = true, targetBoxId = "chat-box") => {
  $("typing-indicator-ui")?.remove();
  const box = $(targetBoxId);
  if (!box) return;
  box.querySelector(".empty-state")?.remove();

  if (msg.id && box.querySelector(`[data-msg-id="${msg.id}"]`)) return;

  const msgDate = new Date(msg.created_at);
  const isMe = msg.sender_mobile === State.mobile;

  const currentLabel = window.getVaniDateLabel(msg.created_at);
  const lastLabel = box.dataset.bottomDate;

  if (lastLabel !== currentLabel) {
    box.insertAdjacentHTML(
      "beforeend",
      `<div class="date-divider" data-date="${currentLabel}" style="display:flex;justify-content:center;margin:20px 0;"><div style="padding:6px 14px;border-radius:99px;background:rgba(255,255,255,0.05);border:1px solid var(--glass-border);color:var(--text-muted);font-size:0.75rem;backdrop-filter:blur(10px)">${currentLabel}</div></div>`,
    );
    box.dataset.bottomDate = currentLabel;
  }

  let bubbleHTML = "";

  if (msg.content.startsWith("[CALL_LOG:")) {
    const parts = msg.content
      .replace("[CALL_LOG:", "")
      .replace("]", "")
      .split(":");
    const type = parts[0],
      duration = parts[1] || "";
    bubbleHTML = `
        <div class="call-log-bubble">
            <div class="call-log-icon" style="color: ${type === "MISSED" ? "#ff4d4d" : "var(--neon-primary)"};">
                ${type === "MISSED" ? '<i class="fa-solid fa-phone-slash"></i>' : '<i class="fa-solid fa-phone"></i>'}
            </div>
            <div class="call-log-details">
                <h4>${type === "MISSED" ? "Missed Call" : "Voice Call"}</h4>
                ${duration ? `<p>Duration: ${duration}</p>` : ""}
            </div>
        </div>`;
  } else {
    bubbleHTML = `<div class="chat-bubble-content">${sanitize(msg.content)}</div>`;
  }

  const heartStyle = isMe
    ? "left: -8px; right: auto;"
    : "right: -8px; left: auto;";
  const heartHTML = msg.is_liked
    ? `<div class="liked-badge" style="${heartStyle}"><i class="fa-solid fa-heart"></i></div>`
    : "";

  box.insertAdjacentHTML(
    "beforeend",
    `<div class="message-enter" data-msg-id="${msg.id}" data-is-me="${isMe}" data-is-liked="${msg.is_liked || false}" style="display:flex;width:100%;justify-content:${isMe ? "flex-end" : "flex-start"};margin-bottom:12px;">
       <div class="chat-bubble" style="max-width:75%;background:${isMe ? "rgba(var(--neon-rgb), 0.1)" : "rgba(255,255,255,0.03)"}; border:1px solid ${isMe ? "var(--neon-primary)" : "var(--glass-border)"}; border-radius:${isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px"}; padding:10px 14px; cursor: pointer;">
         ${bubbleHTML} <div class="chat-bubble-time" style="font-size:0.6rem;opacity:0.6;margin-top:4px;text-align:right;">
           ${msgDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
         </div>
         ${heartHTML}
       </div>
    </div>`,
  );

  const newlyAddedWrapper = box.querySelector(`[data-msg-id="${msg.id}"]`);
  if (newlyAddedWrapper) {
    const bubbleElement = newlyAddedWrapper.querySelector(".chat-bubble");
    if (bubbleElement) initSwipeToReply(bubbleElement, msg);
  }

  if (autoScroll) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
};

let typingHideTimeout = null;

const showTypingIndicator = () => {
  let indicator = $("typing-indicator-ui");

  if (!indicator) {
    const box = $("chat-box");
    box.insertAdjacentHTML(
      "beforeend",
      `
            <div id="typing-indicator-ui" class="message-enter" style="display:flex;width:100%;justify-content:flex-start;margin-bottom:12px; transition: opacity 0.4s ease;">
                <div class="typing-indicator" style="margin: 0; border-radius: 16px 16px 16px 4px;">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `,
    );
    box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  } else {
    indicator.style.opacity = "1";
  }

  if (typingHideTimeout) clearTimeout(typingHideTimeout);

  typingHideTimeout = setTimeout(() => {
    hideTypingIndicator();
  }, 2000);
};

const hideTypingIndicator = () => {
  const indicator = $("typing-indicator-ui");
  if (indicator) {
    indicator.style.opacity = "0";
    setTimeout(() => indicator.remove(), 400);
  }
};

const sendMsg = async (e) => {
  if (e) e.preventDefault();
  const input = $("msg-input");
  if (!input) return;

  const content = input.value.trim();
  if (!content || !State.activeContact) return;

  input.value = "";
  input.focus();
  if (typeof hideTypingIndicator === "function") hideTypingIndicator();
  if (typeof playSound === "function") playSound("send");

  const { error } = await supabaseClient.from("messages").insert([
    {
      sender_mobile: State.mobile,
      recipient_mobile: State.activeContact,
      content,
      is_read: false,
    },
  ]);

  if (error) {
    console.error("🔥 SUPABASE REJECTED MESSAGE:", error);
    alert(
      `Matrix Error: ${error.message}\nDetails: ${error.details || "Check console."}`,
    );
  }
  if (!error) {
    triggerOneSignalPush(State.activeContact, State.profile.name, content);
  }
};

async function triggerOneSignalPush(
  recipientMobile,
  senderName,
  messageContent,
) {
  const ONESIGNAL_APP_ID = "30dfa9ba-710b-474d-a12f-a7a1509cb29f";
  const ONESIGNAL_REST_API_KEY =
    "os_v2_app_gdp2totrbndu3ijpu6qvbhfst4x6pixofyiejlnvse55xaprufc32wglh7ywvzfsitysvxh65tn5tchsgol7qskr2nm4tw334qk6i3q";

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    target_channel: "push",

    include_aliases: {
      vani_mobile: [recipientMobile],
    },
    headings: { en: `VANI: ${senderName}` },
    contents: { en: messageContent },

    small_icon: "ic_stat_onesignal_default",
    large_icon:
      "https://api.dicebear.com/7.x/shapes/svg?seed=vani-neon&backgroundColor=030305",
    android_accent_color: "FF00f3ff",
  };

  try {
    const proxyUrl = "https://corsproxy.io/?";
    const targetUrl = "https://onesignal.com/api/v1/notifications";

    await fetch(proxyUrl + encodeURIComponent(targetUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    console.log("📡 Push trigger successfully routed through managed server.");
  } catch (e) {
    console.error("VANI Push Failed:", e);
  }
}

setTimeout(() => {
  const sendBtn = $("send-msg-btn");
  const msgInput = $("msg-input");

  if (sendBtn) {
    const newSendBtn = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);

    const handleSendAction = (e) => {
      e.preventDefault();
      if (msgInput) msgInput.focus();

      newSendBtn.style.transform = "scale(0.93) translateY(2px)";
      setTimeout(() => (newSendBtn.style.transform = ""), 150);

      sendMsg();
    };

    newSendBtn.addEventListener("mousedown", handleSendAction);
    newSendBtn.addEventListener("touchstart", handleSendAction, {
      passive: false,
    });
  }

  if (msgInput) {
    const newMsgInput = msgInput.cloneNode(true);
    msgInput.parentNode.replaceChild(newMsgInput, msgInput);

    newMsgInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMsg(e);
    });

    let typingThrottle = false;
    newMsgInput.addEventListener("input", () => {
      if (!typingThrottle && State.channel && State.activeContact) {
        typingThrottle = true;
        State.channel.send({
          type: "broadcast",
          event: "typing",
          payload: { sender: State.mobile, recipient: State.activeContact },
        });
        setTimeout(() => {
          typingThrottle = false;
        }, 1000);
      }
    });
  }
}, 500);

const initRealtime = async () => {
  if (!State || !State.mobile) {
    console.error(
      "❌ REALTIME ABORTED: State.mobile is missing. You must log in first!",
    );
    return;
  }

  console.log(`🔌 Initializing Realtime for User: ${State.mobile}`);

  if (State.channel) {
    await supabaseClient.removeChannel(State.channel);
    State.channel = null;
  }

  State.channel = supabaseClient
    .channel("vani_global_matrix", {
      config: {
        broadcast: { ack: false, self: false },
      },
    })

    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      async (p) => {
        const msg = p.new;

        if (!msg?.sender_mobile) return;

        const isCurrentlyViewingChat =
          msg.sender_mobile == State.activeContact &&
          msg.recipient_mobile == State.mobile;
        const isMyOwnMessage =
          msg.sender_mobile == State.mobile &&
          msg.recipient_mobile == State.activeContact;
        const isForMeButImElsewhere =
          msg.recipient_mobile == State.mobile &&
          msg.sender_mobile != State.activeContact;

        if (isCurrentlyViewingChat) {
          playSound("receive");
          appendBubble(msg, true);

          await supabaseClient
            .from("messages")
            .update({ is_read: true })
            .eq("id", msg.id);
        } else if (isMyOwnMessage) {
          appendBubble(msg, true);
          await refreshContactsUI();
        } else if (isForMeButImElsewhere) {
          playSound("receive");
          await refreshContactsUI();
        }
      },
    )

    .on("broadcast", { event: "typing" }, (payload) => {
      const data = payload.payload;

      if (
        data.recipient == State.mobile &&
        data.sender == State.activeContact
      ) {
        showTypingIndicator();
      }
    })

    .on("broadcast", { event: "webrtc_signal" }, (payload) => {
      const data = payload.payload;
      if (data.recipient === State.mobile) {
        console.log("📡 Incoming WebRTC Signal:", data.type);
        handleIncomingWebRTCSignal(data);
      }
    })

    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "messages" },
      (p) => {
        console.log("🗑️ REALTIME DELETE DETECTED. Removing message:", p.old.id);
        const deletedId = p.old.id;
        const bubble = document.querySelector(`[data-msg-id="${deletedId}"]`);

        if (bubble) {
          bubble.classList.add("message-deleted");
          setTimeout(() => {
            bubble.remove();
          }, 200);

          if (typeof refreshContactsUI === "function") refreshContactsUI();
        }
      },
    )

    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "messages" },
      (p) => {
        const msg = p.new;
        const bubbleWrapper = document.querySelector(
          `[data-msg-id="${msg.id}"]`,
        );

        if (bubbleWrapper) {
          const wasLiked = bubbleWrapper.dataset.isLiked === "true";

          if (msg.is_liked && !wasLiked) {
            bubbleWrapper.dataset.isLiked = "true";
            window.updateLikeUI(bubbleWrapper, true);
            window.triggerHeartExplosion(bubbleWrapper);
            if (typeof playSound === "function") playSound("send");
          } else if (!msg.is_liked && wasLiked) {
            bubbleWrapper.dataset.isLiked = "false";
            window.updateLikeUI(bubbleWrapper, false);
          }
        }
      },
    )

    .subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        console.log("🟢 VANI REALTIME IS LIVE AND LISTENING.");
      } else {
        console.error(
          "🔴 VANI REALTIME FAILED. Status:",
          status,
          "Error:",
          err,
        );
      }
    });
};

let isSpeakerMode = true;

const toggleAudioOutput = async () => {
  const audioEl = document.getElementById("remote-audio-stream");
  const icon = document.getElementById("speaker-icon");

  if (!audioEl.setSinkId) {
    alert("Audio routing is restricted by your browser/OS (common on iOS).");
    return;
  }

  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    const devices = await navigator.mediaDevices.enumerateDevices();

    const audioOutputs = devices.filter(
      (device) => device.kind === "audiooutput",
    );

    if (audioOutputs.length < 2) {
      alert("No alternative audio outputs detected by the browser.");
      return;
    }

    if (isSpeakerMode) {
      const earpiece =
        audioOutputs.find(
          (d) =>
            d.label.toLowerCase().includes("earpiece") ||
            d.label.toLowerCase().includes("phone"),
        ) || audioOutputs[1];
      await audioEl.setSinkId(earpiece.deviceId);
      icon.className = "fa-solid fa-volume-low";
      isSpeakerMode = false;
    } else {
      const speaker =
        audioOutputs.find((d) => d.label.toLowerCase().includes("speaker")) ||
        audioOutputs[0];
      await audioEl.setSinkId(speaker.deviceId);
      icon.className = "fa-solid fa-volume-high";
      isSpeakerMode = true;
    }
  } catch (err) {
    console.error("Audio Routing Failed:", err);
    alert("Failed to switch audio output. " + err.message);
  }
};

document
  .getElementById("toggle-speaker-btn")
  ?.addEventListener("click", toggleAudioOutput);

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

const themeContainer = $("themeButtonsContainer");
if (themeContainer) {
  neonThemes.forEach((t) => {
    const btn = document.createElement("button");
    btn.className = "theme-btn";
    btn.textContent = t.name;
    btn.style.cssText = `border-color:${t.hex}; color:#fff; inset 0 0 10px ${t.hex}40;`;
    btn.onmouseenter = () =>
      (btn.style.cssText = `border-color:${t.hex}; color:#000; background:${t.hex}; box-shadow:0 0 20px ${t.hex}, inset 0 0 15px ${t.hex};`);
    btn.onmouseleave = () =>
      (btn.style.cssText = `border-color:${t.hex}; color:#fff; background:transparent; inset 0 0 10px ${t.hex}40;`);
    btn.onclick = () => applyTheme(t.hex);
    themeContainer.appendChild(btn);
  });
}

let cinematicFrameId = null;
let cinematicStartTime = null;

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

const cinematicLoop = (timestamp) => {
  if (!cinematicStartTime) cinematicStartTime = timestamp;
  const elapsed = timestamp - cinematicStartTime;

  const cycle = (elapsed % 25000) / 25000;
  const hue = cycle * 360;

  const lightness = 50 + 15 * Math.cos(cycle * Math.PI * 2);

  const [r, g, b] = hslToRgb(hue, 100, lightness);

  document.documentElement.style.setProperty(
    "--neon-primary",
    `rgb(${r}, ${g}, ${b})`,
  );
  document.documentElement.style.setProperty("--neon-rgb", `${r}, ${g}, ${b}`);

  cinematicFrameId = requestAnimationFrame(cinematicLoop);
};

const enableCinematicMode = () => {
  if (!cinematicFrameId) {
    cinematicStartTime = null;
    cinematicFrameId = requestAnimationFrame(cinematicLoop);
  }
};

const disableCinematicMode = () => {
  if (cinematicFrameId) {
    cancelAnimationFrame(cinematicFrameId);
    cinematicFrameId = null;
  }

  if ($("toggle-random-boot") && $("toggle-random-boot").checked) {
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
  const prefAudio = localStorage.getItem("vani-audio") !== "false";

  const randomToggle = $("toggle-random-boot");
  const cinematicToggle = $("toggle-cinematic-mode");
  const audioToggle = $("toggle-system-audio");

  if (randomToggle) randomToggle.checked = prefRandomBoot;
  if (cinematicToggle) cinematicToggle.checked = prefCinematic;
  if (audioToggle) audioToggle.checked = prefAudio;

  if (prefCinematic && prefRandomBoot && randomToggle) {
    randomToggle.checked = false;
    localStorage.setItem("vani-random-boot", "false");
  }

  if (cinematicToggle && cinematicToggle.checked) {
    enableCinematicMode();
  } else {
    disableCinematicMode();
  }

  randomToggle?.addEventListener("change", (e) => {
    const isOn = e.target.checked;
    localStorage.setItem("vani-random-boot", isOn);

    if (isOn && cinematicToggle && cinematicToggle.checked) {
      cinematicToggle.checked = false;
      localStorage.setItem("vani-cinematic", "false");
      disableCinematicMode();
    }
  });

  cinematicToggle?.addEventListener("change", (e) => {
    const isOn = e.target.checked;
    localStorage.setItem("vani-cinematic", isOn);

    if (isOn && randomToggle && randomToggle.checked) {
      randomToggle.checked = false;
      localStorage.setItem("vani-random-boot", "false");
    }

    isOn ? enableCinematicMode() : disableCinematicMode();
  });

  audioToggle?.addEventListener("change", (e) =>
    localStorage.setItem("vani-audio", e.target.checked),
  );
};

$("msg-input")?.addEventListener("focus", () => {
  setTimeout(() => {
    const box = $("chat-box");
    if (box) {
      box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
    }
  }, 300);
});

const updatePresenceUI = () => {
  if (State.activeContact) {
    const isOnline = State.onlineUsers.has(String(State.activeContact));
    const statusEl = $("chat-with-status");
    if (statusEl) {
      statusEl.innerHTML = isOnline
        ? `<span style="display:inline-block;width:10px;height:10px;background:#00ff88;border-radius:50%;margin-right:6px;box-shadow:0 0 8px #00ff88;"></span>Online`
        : `<span style="display:inline-block;width:10px;height:10px;background:#ff4d4d;border-radius:50%;margin-right:6px;"></span>Offline`;
      statusEl.style.color = isOnline ? "#00ff88" : "#ff4d4d";
    }
  }

  $$("#contacts-list li").forEach((li) => {
    const mobile = li.dataset.mobile;
    const isOnline = State.onlineUsers.has(String(mobile));

    let img = li.querySelector("img");
    if (img && !img.parentElement.classList.contains("avatar-wrapper")) {
      const wrapper = document.createElement("div");
      wrapper.className = "avatar-wrapper";
      wrapper.style.position = "relative";
      wrapper.style.display = "inline-flex";
      img.parentNode.insertBefore(wrapper, img);
      wrapper.appendChild(img);
    }

    const wrapper = li.querySelector(".avatar-wrapper");
    if (wrapper) {
      let indicator = wrapper.querySelector(".presence-dot");

      if (!indicator) {
        wrapper.insertAdjacentHTML(
          "beforeend",
          `<div class="presence-dot" style="position:absolute; bottom:-2px; right:-2px; border:2px solid var(--bg-deep); width:12px; height:12px; border-radius:50%; transition: background 0.3s ease, box-shadow 0.3s ease;"></div>`,
        );
        indicator = wrapper.querySelector(".presence-dot");
      }

      if (isOnline) {
        indicator.style.background = "#00ff88";
        indicator.style.boxShadow = "0 0 8px #00ff88";
      } else {
        indicator.style.background = "#ff4d4d";
        indicator.style.boxShadow = "none";
      }
    }
  });
};

const initPresence = async () => {
  if (!State.mobile) return;

  if (State.presenceChannel) {
    await supabaseClient.removeChannel(State.presenceChannel);
    State.presenceChannel = null;
  }

  State.presenceChannel = supabaseClient.channel("vani_global_presence");

  State.presenceChannel
    .on("presence", { event: "sync" }, () => {
      const newState = State.presenceChannel.presenceState();
      State.onlineUsers.clear();
      for (const id in newState) {
        newState[id].forEach((user) => {
          if (user.mobile) State.onlineUsers.add(String(user.mobile));
        });
      }
      if (typeof updatePresenceUI === "function") updatePresenceUI();
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        if (State.profile && State.profile.vani_id === "helpline") {
          console.log(
            "🕵️ Stealth Mode Activated: Presence broadcasting suppressed for @helpline.",
          );
          return;
        }

        await State.presenceChannel.track({
          mobile: State.mobile,
          online_at: new Date().toISOString(),
        });
      }
    });
};

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible") {
    if (State && State.mobile) {
      console.log("🔄 VANI Waking up... Syncing Data.");

      await syncContacts();
      if (State.activeContact) await loadHistory();

      if (State.presenceChannel && State.presenceChannel.state === "joined") {
        await State.presenceChannel.track({
          mobile: State.mobile,
          online_at: new Date().toISOString(),
        });
      } else if (typeof initPresence === "function") {
        initPresence();
      }
    }
  } else {
    console.log("💤 VANI Tab hidden... Marking as OFFLINE.");

    if (
      State &&
      State.presenceChannel &&
      State.presenceChannel.state === "joined"
    ) {
      await State.presenceChannel.untrack();
    }
  }
});

$("save-ghost-btn")?.addEventListener("click", async (e) => {
  e.preventDefault();
  const btn = e.currentTarget;
  const mobile = btn.dataset.mobile;

  if (!mobile) {
    console.error("Ghost Modal Error: No phone number attached to button.");
    return;
  }

  $("ghost-save-number").value = "Fetching Identity...";
  $("ghost-save-name").value = "";
  $("ghost-save-modal").style.display = "flex";

  try {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("vani_id")
      .eq("mobile", mobile)
      .single();

    if (error || !data) throw new Error("Matrix identity not found.");

    $("ghost-save-number").value = `@${data.vani_id}`;

    setTimeout(() => {
      $("ghost-save-name").focus();
    }, 100);
  } catch (err) {
    $("ghost-save-number").value = "@unknown_node";
    console.error("Identity Mask Error:", err.message);
  }
});

$("cancel-ghost-btn")?.addEventListener("click", () => {
  $("ghost-save-modal").style.display = "none";
});

$("confirm-ghost-save-btn")?.addEventListener("click", async () => {
  const contact = $("save-ghost-btn").dataset.mobile;
  const name = $("ghost-save-name").value.trim();

  if (!name) return alert("Please enter a name.");

  try {
    const { error } = await supabaseClient
      .from("contacts")
      .insert([{ mobile: State.mobile, name, contact, gender: "Other" }]);
    if (error) throw error;

    $("ghost-save-modal").style.display = "none";
    $("save-ghost-btn").classList.add("hidden");

    $("chat-with-name").textContent = name;

    await syncContacts();

    if (typeof playSound === "function") playSound("receive");
  } catch (err) {
    alert(`Save Error: ${err.message}`);
  }
});

const handleNetworkChange = () => {
  const overlay = $("offline-overlay");
  if (!overlay) return;

  if (!navigator.onLine) {
    overlay.style.display = "flex";
    console.warn(
      "📡 NETWORK LOST: Freezing matrix and displaying offline shield.",
    );
  } else {
    overlay.style.display = "none";
    console.log("📡 NETWORK RESTORED: Re-establishing uplinks...");

    if (State && State.mobile) {
      if (typeof syncContacts === "function") syncContacts();
      if (State.activeContact && typeof loadHistory === "function")
        loadHistory();
      if (
        typeof initPresence === "function" &&
        (!State.presenceChannel || State.presenceChannel.state !== "joined")
      ) {
        initPresence();
      }
    }
  }
};

window.addEventListener("offline", handleNetworkChange);
window.addEventListener("online", handleNetworkChange);

$("offline-reload-btn")?.addEventListener("click", () => {
  const btn = $("offline-reload-btn");

  const originalText = btn.textContent;
  btn.textContent = "Scanning Frequencies...";
  btn.style.opacity = "0.5";
  btn.style.pointerEvents = "none";

  setTimeout(() => {
    if (navigator.onLine) {
      location.reload();
    } else {
      btn.textContent = originalText;
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";

      if (typeof playSound === "function") playSound("delete");
    }
  }, 800);
});

const CallState = {
  isActive: false,
  isRinging: false,
  peerConnection: null,
  localStream: null,
  remoteStream: null,
  startTime: null,
  timerInterval: null,
  targetMobile: null,
  isCaller: false,
  pendingCandidates: [],
};

const sendCallSignal = (type, data = {}) => {
  if (!State.channel) return;
  State.channel.send({
    type: "broadcast",
    event: "webrtc_signal",
    payload: {
      sender: State.mobile,
      recipient: CallState.targetMobile,
      type,
      ...data,
    },
  });
};

const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const startCallTimer = () => {
  CallState.startTime = Date.now();
  $("call-duration-timer").classList.remove("hidden");
  CallState.timerInterval = setInterval(() => {
    const diff = Math.floor((Date.now() - CallState.startTime) / 1000);
    $("call-duration-timer").textContent = formatDuration(diff);
  }, 1000);
};

const stopCallTimerAndLog = async (wasAnswered) => {
  clearInterval(CallState.timerInterval);
  $("call-duration-timer").classList.add("hidden");
  $("call-duration-timer").textContent = "00:00";

  if (CallState.isCaller) {
    let logString = "[CALL_LOG:MISSED]";
    if (wasAnswered && CallState.startTime) {
      const diff = Math.floor((Date.now() - CallState.startTime) / 1000);
      logString = `[CALL_LOG:VOICE:${formatDuration(diff)}]`;
    }

    console.log(`💾 Logging Call to DB: ${logString}`);
    await supabaseClient.from("messages").insert([
      {
        sender_mobile: State.mobile,
        recipient_mobile: CallState.targetMobile,
        content: logString,
        is_read: false,
      },
    ]);
  }
};

const setCallUI = (statusText, showAcceptBtn = false) => {
  $("active-call-matrix").classList.remove("hidden");
  $("active-call-matrix").style.display = "flex";
  $("call-status-text").textContent = statusText;

  $("call-target-name").textContent = "Encrypting Identity...";
  $("call-target-avatar").src =
    "https://static.vecteezy.com/system/resources/thumbnails/005/544/718/small/profile-icon-design-free-vector.jpg";

  (async () => {
    let callerName = "Unknown";
    let callerAvatar =
      "https://static.vecteezy.com/system/resources/thumbnails/005/544/718/small/profile-icon-design-free-vector.jpg";

    const localContactLi = document.querySelector(
      `li[data-mobile="${CallState.targetMobile}"]`,
    );

    if (localContactLi) {
      callerName =
        localContactLi.querySelector("h3")?.textContent || callerName;
      callerAvatar = localContactLi.querySelector("img")?.src || callerAvatar;
    } else {
      try {
        const { data } = await supabaseClient
          .from("profiles")
          .select("vani_id, avatar_url")
          .eq("mobile", CallState.targetMobile)
          .single();

        if (data) {
          callerName = data.vani_id ? `@${data.vani_id}` : callerName;
          callerAvatar = data.avatar_url || callerAvatar;
        }
      } catch (e) {
        console.log("Silent Identity Fetch Failed:", e);
      }
    }

    $("call-target-name").textContent = callerName;
    $("call-target-avatar").src = callerAvatar;
  })();

  if (showAcceptBtn) {
    $("accept-call-btn").classList.remove("hidden");
    $("decline-call-btn").style.borderColor = "#ff4d4d";
    $("decline-call-btn").style.color = "#ff4d4d";
  } else {
    $("accept-call-btn").classList.add("hidden");
    $("decline-call-btn").style.borderColor = "var(--neon-primary)";
    $("decline-call-btn").style.color = "var(--neon-primary)";
  }
};

const closeCallUI = () => {
  $("active-call-matrix").classList.add("hidden");
  $("active-call-matrix").style.display = "none";
};

const fetchSecureICEServers = async () => {
  try {
    const { data, error } = await supabaseClient.functions.invoke(
      "get-turn-credentials",
    );
    if (error) throw error;
    return { iceServers: data };
  } catch (err) {
    console.warn("TURN Fetch Failed, falling back to public STUN.", err);
    return { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
  }
};

const initWebRTC = async () => {
  try {
    console.log("🎤 Requesting Microphone Access...");
    CallState.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    const secureServers = await fetchSecureICEServers();
    CallState.peerConnection = new RTCPeerConnection(secureServers);

    CallState.localStream.getTracks().forEach((track) => {
      CallState.peerConnection.addTrack(track, CallState.localStream);
    });

    CallState.peerConnection.ontrack = (event) => {
      const audioEl = $("remote-audio-stream");
      let stream = audioEl.srcObject;
      if (!stream) {
        stream = new MediaStream();
        audioEl.srcObject = stream;
      }
      stream.addTrack(event.track);
      audioEl.volume = 1.0;
      audioEl
        .play()
        .catch((e) => console.warn("🔇 Browser blocked playback.", e));
    };

    CallState.peerConnection.oniceconnectionstatechange = () => {
      const state = CallState.peerConnection.iceConnectionState;
      if (state === "connected" || state === "completed") {
        $("call-status-text").innerHTML =
          `<span style="color:#00ff88; font-weight:bold; letter-spacing: 4px;">🟢 UPLINK LIVE</span>`;
        $("call-target-avatar").style.borderColor = "#00ff88";

        $("toggle-speaker-btn").classList.remove("hidden");

        VaniCreditsEngine.markCallStarted(CallState.isCaller);
      } else if (state === "disconnected" || state === "failed") {
        endCall(true);
      }
    };

    CallState.peerConnection.onicecandidate = (event) => {
      if (event.candidate)
        sendCallSignal("ICE_CANDIDATE", { candidate: event.candidate });
    };
  } catch (err) {
    console.error("🎤 Microphone Error:", err);
    closeCallUI();
    alert("System Error: Microphone access was denied or is unavailable.");
    if (CallState.isActive || CallState.isRinging) sendCallSignal("HANGUP");
    throw err;
  }
};

const startCall = async () => {
  if (!State.activeContact) return;
  if (CallState.isActive || CallState.isRinging)
    return alert("System busy. Finish current transmission.");

  if (!VaniCreditsEngine.isCallAllowed()) {
    return alert(
      "Network Locked. Your monthly outgoing call quota (20 minutes) has been exhausted. You can still receive incoming calls.",
    );
  }

  console.log(`📞 Initiating Call to ${State.activeContact}...`);

  const audioEl = document.getElementById("remote-audio-stream");
  if (audioEl) {
    audioEl
      .play()
      .catch((e) => console.log("Silently unlocking audio context..."));
  }

  CallState.isCaller = true;
  CallState.targetMobile = State.activeContact;
  CallState.isActive = true;

  try {
    await initWebRTC();
    setCallUI("Ringing...", false);

    const offer = await CallState.peerConnection.createOffer();
    await CallState.peerConnection.setLocalDescription(offer);

    sendCallSignal("OFFER", { offer });
  } catch (err) {
    console.error("Start Call Error:", err);
    endCall(false);
  }
};

const endCall = (wasAnswered = false) => {
  console.log("🛑 Terminating Call Sequence.");

  if (CallState.isActive || CallState.isRinging) {
    sendCallSignal("HANGUP");
  }

  if (CallState.localStream) {
    CallState.localStream.getTracks().forEach((track) => track.stop());
  }
  if (CallState.peerConnection) {
    CallState.peerConnection.close();
  }

  const audioEl = document.getElementById("remote-audio-stream");
  if (audioEl) {
    audioEl.srcObject = null;
    audioEl.pause();
  }

  stopCallTimerAndLog(wasAnswered);
  closeCallUI();
  $("toggle-speaker-btn").classList.add("hidden");

  VaniCreditsEngine.processCallEnd();

  CallState.isActive = false;
  CallState.isRinging = false;
  CallState.peerConnection = null;
  CallState.localStream = null;
  CallState.targetMobile = null;
  CallState.isCaller = false;
  CallState.startTime = null;
  CallState.pendingCandidates = [];
};

const handleIncomingWebRTCSignal = async (data) => {
  const { sender, type } = data;

  switch (type) {
    case "OFFER":
      if (CallState.isActive || CallState.isRinging) {
        console.log(`🚫 Rejecting call from ${sender} (Busy)`);
        return State.channel.send({
          type: "broadcast",
          event: "webrtc_signal",
          payload: { sender: State.mobile, recipient: sender, type: "BUSY" },
        });
      }

      console.log(`🔔 Incoming call from ${sender}`);
      CallState.targetMobile = sender;
      CallState.isRinging = true;
      CallState.isCaller = false;

      CallState.pendingOffer = data.offer;
      setCallUI("Incoming Transmission...", true);
      break;

    case "ANSWER":
      console.log("🔗 Call Answered. Connecting Streams...");
      if (CallState.peerConnection) {
        await CallState.peerConnection.setRemoteDescription(
          new RTCSessionDescription(data.answer),
        );

        if (
          CallState.pendingCandidates &&
          CallState.pendingCandidates.length > 0
        ) {
          for (const candidate of CallState.pendingCandidates) {
            await CallState.peerConnection
              .addIceCandidate(new RTCIceCandidate(candidate))
              .catch((e) => console.log("ICE Inject Error:", e));
          }
          console.log(
            `🔌 Caller successfully injected ${CallState.pendingCandidates.length} saved network addresses.`,
          );
          CallState.pendingCandidates = [];
        }

        setCallUI("Securing Tunnel...", false);
        startCallTimer();
      }
      break;

    case "ICE_CANDIDATE":
      if (data.candidate) {
        if (
          CallState.peerConnection &&
          CallState.peerConnection.remoteDescription
        ) {
          try {
            await CallState.peerConnection.addIceCandidate(
              new RTCIceCandidate(data.candidate),
            );
          } catch (e) {
            console.error("ICE Error:", e);
          }
        } else {
          CallState.pendingCandidates = CallState.pendingCandidates || [];
          CallState.pendingCandidates.push(data.candidate);
        }
      }
      break;

    case "HANGUP":
      console.log("🔌 Remote party hung up.");
      endCall(CallState.startTime !== null);
      break;

    case "BUSY":
      console.log("⚠️ Target is busy.");
      alert("Contact is currently in another transmission.");
      endCall(false);
      break;
  }
};

document.getElementById("start-call-btn")?.addEventListener("click", startCall);
document
  .getElementById("decline-call-btn")
  ?.addEventListener("click", () => endCall(CallState.startTime !== null));

document
  .getElementById("accept-call-btn")
  ?.addEventListener("click", async () => {
    console.log("✅ Call Accepted.");

    const audioEl = document.getElementById("remote-audio-stream");
    if (audioEl) {
      audioEl
        .play()
        .catch((e) => console.log("Silently unlocking audio context..."));
    }

    CallState.isActive = true;
    CallState.isRinging = false;

    try {
      await initWebRTC();
      await CallState.peerConnection.setRemoteDescription(
        new RTCSessionDescription(CallState.pendingOffer),
      );

      if (
        CallState.pendingCandidates &&
        CallState.pendingCandidates.length > 0
      ) {
        for (const candidate of CallState.pendingCandidates) {
          await CallState.peerConnection
            .addIceCandidate(new RTCIceCandidate(candidate))
            .catch((e) => console.log("ICE Inject Error:", e));
        }
        CallState.pendingCandidates = [];
      }

      setCallUI("Connected", false);
      startCallTimer();

      const answer = await CallState.peerConnection.createAnswer();
      await CallState.peerConnection.setLocalDescription(answer);

      sendCallSignal("ANSWER", { answer });
    } catch (err) {
      endCall(false);
    }
  });

window.addEventListener("offline", () => {
  if (CallState.isActive || CallState.isRinging) {
    console.warn("📡 NETWORK LOST: Force terminating active transmission.");
    endCall(CallState.startTime !== null);
  }
});

window.checkCallButtonVisibility = () => {
  const btn = document.getElementById("start-call-btn");
  if (btn) {
    if (State.activeContact) {
      btn.classList.remove("hidden");
    } else {
      btn.classList.add("hidden");
    }
  }
};

(function injectNaturalLightTheme() {
  const styleId = "vani-light-theme-engine";
  let style = document.getElementById(styleId);
  if (style) style.remove();

  style = document.createElement("style");
  style.id = styleId;
  style.innerHTML = `
        

        
        body[data-theme="light"] {
            --bg-deep: #f0f2f5; 
            --bg-panel: rgba(255, 255, 255, 0.75); 
            --bg-panel-hover: rgba(255, 255, 255, 0.95);
            --text-main: #111827; 
            --text-muted: #6b7280; 
            --glass-border: rgba(0, 0, 0, 0.12); 
            --glass-highlight: rgba(0, 0, 0, 0.05);
        }

        
        .brand-logo, body[data-theme="light"] .brand-logo {
            background: none !important;
            -webkit-text-fill-color: var(--neon-primary) !important;
            color: var(--neon-primary) !important;
            filter: drop-shadow(0 0 8px rgba(var(--neon-rgb), 0.4)) !important;
            text-shadow: none !important;
        }

        
        .brand-logo, body[data-theme="light"] .brand-logo {
            background: none !important;
            -webkit-text-fill-color: var(--neon-primary) !important;
            color: var(--neon-primary) !important;
            filter: drop-shadow(0 0 8px rgba(var(--neon-rgb), 0.4)) !important;
            text-shadow: none !important;
        }

        
        body[data-theme="light"] .brand-logo,
        body[data-theme="light"] .glow-btn,
        body[data-theme="light"] .icon-send-btn,
        body[data-theme="light"] #start-call-btn,
        body[data-theme="light"] .theme-btn {
            filter: brightness(0.85) saturate(1.2) !important;
        }

        
        body[data-theme="light"] .mobile-header,
        body[data-theme="light"].in-mobile-chat .chat-header-bar {
            background: rgba(255, 255, 255, 0.95) !important;
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
            border-bottom: 1px solid rgba(0, 0, 0, 0.1) !important;
            box-shadow: none !important;
        }

        body[data-theme="light"] .message-input-console,
        body[data-theme="light"].in-mobile-chat .message-input-console {
            background: rgba(240, 242, 245, 0.95) !important;
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
            border-top: 1px solid rgba(0, 0, 0, 0.1) !important;
        }

        body[data-theme="light"].in-mobile-chat .chat-area-viewport {
            background: var(--bg-deep) !important;
        }

        body[data-theme="light"] .side-nav {
            background: linear-gradient(180deg, #e2e8f0 0%, #f8fafc 100%) !important;
            box-shadow: 20px 0 50px rgba(0,0,0,0.05) !important; 
        }

        body[data-theme="light"] .mobile-back-btn,
        body[data-theme="light"] .icon-send-btn,
        body[data-theme="light"] #start-call-btn {
            background: rgba(255, 255, 255, 0.9) !important;
            color: var(--text-main) !important;
            border: 1px solid var(--neon-primary) !important;
            box-shadow: 0 4px 15px rgba(var(--neon-rgb), 0.15) !important;
        }

        
        body[data-theme="light"] input, 
        body[data-theme="light"] select {
            background: rgba(255, 255, 255, 0.9) !important;
            color: var(--text-main) !important;
            border: 1px solid rgba(0,0,0,0.2) !important;
        }
        body[data-theme="light"] input:focus, 
        body[data-theme="light"] select:focus {
            background: #ffffff !important;
            border-color: var(--neon-primary) !important;
            box-shadow: 0 0 12px rgba(var(--neon-rgb), 0.15) !important;
        }

        body[data-theme="light"] .message-enter[data-is-me="false"] .chat-bubble {
            background: #ffffff !important;
            border: 1px solid rgba(0,0,0,0.08) !important;
            box-shadow: 0 2px 10px rgba(0,0,0,0.04) !important;
            color: var(--text-main) !important;
        }
        body[data-theme="light"] .message-enter[data-is-me="true"] .chat-bubble {
            color: var(--text-main) !important;
        }

        
        body[data-theme="light"] .matrix-slider {
            background-color: rgba(0, 0, 0, 0.1) !important;
            border: 1px solid rgba(0, 0, 0, 0.2) !important;
        }
        body[data-theme="light"] .matrix-slider:before {
            background-color: #fff !important;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3) !important;
        }
        body[data-theme="light"] .matrix-switch input:checked + .matrix-slider {
            background-color: rgba(var(--neon-rgb), 0.2) !important;
            border-color: var(--neon-primary) !important;
        }
        body[data-theme="light"] .matrix-switch input:checked + .matrix-slider:before {
            background-color: var(--neon-primary) !important;
            box-shadow: 0 0 10px var(--neon-primary) !important;
        }

        body[data-theme="light"] .theme-btn { color: var(--text-main) !important; }
        body[data-theme="light"] .theme-btn:hover { color: #fff !important; }

        
        body[data-theme="light"] #active-call-matrix,
        body[data-theme="light"] #offline-overlay,
        body[data-theme="light"] #ghost-save-modal {
            background: rgba(255, 255, 255, 0.85) !important;
        }

        body[data-theme="light"] .ambient-texture {
            background-image: 
                radial-gradient(circle at 15% 50%, rgba(0,0,0,0.04) 0%, transparent 50%),
                radial-gradient(circle at 85% 30%, rgba(var(--neon-rgb), 0.06) 0%, transparent 50%) !important;
        }

        body[data-theme="light"] .date-divider > div {
            background: rgba(0,0,0,0.05) !important;
            color: var(--text-muted) !important;
            border-color: rgba(0,0,0,0.1) !important;
        }
        body[data-theme="light"] #chat-with-name { color: var(--text-main) !important; }
    `;
  document.head.appendChild(style);

  const settingsPanel = document.querySelector(
    ".settings-controls.glass-panel",
  );
  let lightToggle = document.getElementById("toggle-light-theme");

  if (settingsPanel && !lightToggle) {
    const toggleHTML = `
            <hr style="border: 0; border-top: 1px solid var(--glass-border); margin: 20px 0;" />
            <div class="setting-row">
                <div style="flex: 1; padding-right: 20px">
                    <h3 style="font-size: 1.1rem; margin: 0 0 5px 0">Light Theme</h3>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0; line-height: 1.4;">
                        Override dark matrix with natural daytime visibility colors.
                    </p>
                </div>
                <label class="matrix-switch">
                    <input type="checkbox" id="toggle-light-theme" />
                    <span class="matrix-slider"></span>
                </label>
            </div>
        `;
    settingsPanel.insertAdjacentHTML("beforeend", toggleHTML);
    lightToggle = document.getElementById("toggle-light-theme");
  }

  if (lightToggle) {
    const isLightMode = localStorage.getItem("vani-light-theme") === "true";
    lightToggle.checked = isLightMode;

    if (isLightMode) {
      document.body.setAttribute("data-theme", "light");
    } else {
      document.body.removeAttribute("data-theme");
    }

    const newToggle = lightToggle.cloneNode(true);
    lightToggle.parentNode.replaceChild(newToggle, lightToggle);

    newToggle.addEventListener("change", (e) => {
      if (e.target.checked) {
        document.body.setAttribute("data-theme", "light");
        localStorage.setItem("vani-light-theme", "true");
      } else {
        document.body.removeAttribute("data-theme");
        localStorage.setItem("vani-light-theme", "false");
      }
    });
  }

  console.log("☀️ Natural Light Theme Engine v3 Booted Successfully!");
})();

(function injectAutoDayTheme() {
  let autoDayInterval = null;

  const runAutoDayLogic = () => {
    const hour = new Date().getHours();
    const isDayTime = hour >= 6 && hour < 18;
    const lightToggle = document.getElementById("toggle-light-theme");

    const shouldBeLight = isDayTime;
    const isCurrentlyLight = document.body.hasAttribute("data-theme");

    if (shouldBeLight !== isCurrentlyLight) {
      if (shouldBeLight) {
        document.body.setAttribute("data-theme", "light");
      } else {
        document.body.removeAttribute("data-theme");
      }
    }

    if (lightToggle && lightToggle.checked !== shouldBeLight) {
      lightToggle.checked = shouldBeLight;
      localStorage.setItem("vani-light-theme", shouldBeLight.toString());
    }
  };

  const enableAutoDay = () => {
    runAutoDayLogic();
    if (!autoDayInterval) {
      autoDayInterval = setInterval(runAutoDayLogic, 60000);
    }
  };

  const disableAutoDay = () => {
    if (autoDayInterval) {
      clearInterval(autoDayInterval);
      autoDayInterval = null;
    }
  };

  const settingsPanel = document.querySelector(
    ".settings-controls.glass-panel",
  );
  if (settingsPanel && !document.getElementById("toggle-auto-day")) {
    settingsPanel.insertAdjacentHTML(
      "beforeend",
      `
            <div class="setting-row">
                <div style="flex: 1; padding-right: 20px">
                    <h3 style="font-size: 1.1rem; margin: 0 0 5px 0">Auto-Day Theme</h3>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0; line-height: 1.4;">
                        Sync with the Sun: Light (Upto 6PM), Dark (Upto 6AM).
                    </p>
                </div>
                <label class="matrix-switch">
                    <input type="checkbox" id="toggle-auto-day" />
                    <span class="matrix-slider"></span>
                </label>
            </div>
        `,
    );
  }

  const autoToggle = document.getElementById("toggle-auto-day");
  const lightToggle = document.getElementById("toggle-light-theme");

  const syncAutoDayState = () => {
    const isOn = localStorage.getItem("vani-auto-day") === "true";
    if (autoToggle) autoToggle.checked = isOn;
    if (isOn) enableAutoDay();
  };
  syncAutoDayState();

  autoToggle?.addEventListener("change", (e) => {
    const isOn = e.target.checked;
    localStorage.setItem("vani-auto-day", isOn);

    if (isOn) {
      if (lightToggle && lightToggle.checked) {
        lightToggle.checked = false;
        localStorage.setItem("vani-light-theme", "false");
        document.body.removeAttribute("data-theme");
      }
      enableAutoDay();
    } else {
      disableAutoDay();
    }
  });

  lightToggle?.addEventListener("change", (e) => {
    if (autoToggle && autoToggle.checked) {
      autoToggle.checked = false;
      localStorage.setItem("vani-auto-day", "false");
      disableAutoDay();
    }

    if (e.target.checked) {
      document.body.setAttribute("data-theme", "light");
      localStorage.setItem("vani-light-theme", "true");
    } else {
      document.body.removeAttribute("data-theme");
      localStorage.setItem("vani-light-theme", "false");
    }
  });
})();

(function initVaniIdentityEngine() {
  const regEmail = document.getElementById("reg-email");
  if (regEmail && !document.getElementById("reg-handle")) {
    regEmail.insertAdjacentHTML(
      "beforebegin",
      `
            <input type="text" id="reg-handle" placeholder="VANI ID (eg. john_bill)" minlength="3" maxlength="15" required style="text-transform: lowercase;" />
        `,
    );
  }

  const contactMobileInput = document.getElementById("new-contact-mobile");
  if (contactMobileInput) {
    contactMobileInput.id = "new-contact-handle";
    contactMobileInput.placeholder = "Enter Target VANI ID (e.g. neo)";
    contactMobileInput.removeAttribute("maxlength");
    contactMobileInput.type = "text";
  }

  if (!document.getElementById("claim-handle-modal")) {
    document.body.insertAdjacentHTML(
      "beforeend",
      `
            <div id="claim-handle-modal" style="display: none; position: fixed; inset: 0; background: rgba(3,3,5,0.95); backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px); z-index: 99999999; align-items: center; justify-content: center;">
                <div class="glass-panel" style="padding: 40px; width: 90%; max-width: 400px; text-align: center; border-color: var(--neon-primary); box-shadow: 0 0 30px rgba(var(--neon-rgb), 0.2);">
                    <h2 style="color: var(--neon-primary); margin-bottom: 10px; font-family: 'Space Grotesk', sans-serif;">Claim Your VANI ID</h2>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 25px;">VANI is now handle-first. Protect your identity by claiming a unique ID. Phone numbers are now strictly hidden.</p>
                    
                    <div style="display: flex; align-items: center; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); border-radius: 12px; margin-bottom: 20px; overflow: hidden; transition: border-color 0.3s;">
                        <span style="padding: 15px 0 15px 20px; color: var(--neon-primary); font-weight: bold; font-size: 1.1rem; line-height: 1; flex-shrink: 0;">@</span>
                        <input type="text" id="claim-handle-input" placeholder="your_alias" style="flex: 1; padding: 15px; background: transparent; border: none; color: #fff; font-size: 1rem; outline: none; min-width: 0;" />
                    </div>

                    <button id="claim-handle-btn" class="glow-btn full-width">Lock Identity Permanently</button>
                </div>
            </div>
        `,
    );
  }

  window.validateVaniHandle = (handle, name) => {
    const cleanHandle = handle.toLowerCase().replace(/@/g, "").trim();
    const cleanName = name.toLowerCase().trim();

    if (cleanHandle.length < 3)
      throw new Error("Handle must be at least 3 characters.");
    if (!/^[a-z0-9_]+$/.test(cleanHandle))
      throw new Error(
        "Handle can only contain lowercase letters, numbers, and underscores.",
      );

    const reserved = ["admin", "support", "vani", "official", "system"];
    if (reserved.some((r) => cleanHandle.includes(r)))
      throw new Error("Reserved system keyword detected in handle.");

    return cleanHandle;
  };

  document
    .getElementById("claim-handle-btn")
    ?.addEventListener("click", async () => {
      const btn = document.getElementById("claim-handle-btn");
      btn.textContent = "Locking...";
      btn.disabled = true;

      try {
        const rawHandle = document.getElementById("claim-handle-input").value;
        const finalHandle = window.validateVaniHandle(
          rawHandle,
          State.profile.name,
        );

        const { error } = await supabaseClient
          .from("profiles")
          .update({ vani_id: finalHandle })
          .eq("id", State.profile.id);
        if (error)
          throw new Error(
            error.code === "23505"
              ? "This handle is already taken!"
              : error.message,
          );

        State.profile.vani_id = finalHandle;
        document.getElementById("claim-handle-modal").style.display = "none";

        if (typeof syncContacts === "function") await syncContacts();
        if (typeof initRealtime === "function") initRealtime();
        if (typeof initPresence === "function") initPresence();

        alert("Identity Locked! Welcome to VANI.");
      } catch (err) {
        alert(err.message);
        btn.textContent = "Lock Identity Permanently";
        btn.disabled = false;
      }
    });

  supabaseClient
    .channel("vani_profiles_sync")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "profiles" },
      (p) => {
        if (
          typeof syncContacts === "function" &&
          document.getElementById("app").classList.contains("hidden") === false
        ) {
          syncContacts();
        }
      },
    )
    .subscribe();
})();

let historyPage = 0;
let isLoadingHistory = false;
let hasMoreHistory = true;
let scrollObserver = null;

const attachScrollObserver = () => {
  if (scrollObserver) scrollObserver.disconnect();

  const target = document.getElementById("history-trigger-pad");
  if (!target || !hasMoreHistory) return;

  scrollObserver = new IntersectionObserver(
    async (entries) => {
      if (entries[0].isIntersecting && !isLoadingHistory) {
        await loadHistory(true);
      }
    },
    { root: $("chat-box"), threshold: 0.1 },
  );

  scrollObserver.observe(target);
};

const loadHistory = async (isLoadMore = false) => {
  if (!State.activeContact || isLoadingHistory) return;
  isLoadingHistory = true;

  const box = $("chat-box");

  if (!isLoadMore) {
    historyPage = 0;
    hasMoreHistory = true;
    box.innerHTML = `<div id="history-trigger-pad" style="height: 20px; width: 100%; flex-shrink: 0;"></div>`;

    box.dataset.topDate = "";
    box.dataset.bottomDate = "";
  }

  const limit = 50;
  const from = historyPage * limit;
  const to = from + limit - 1;

  const { data } = await supabaseClient
    .from("messages")
    .select("*")
    .or(
      `and(sender_mobile.eq.${State.mobile},recipient_mobile.eq.${State.activeContact}),and(sender_mobile.eq.${State.activeContact},recipient_mobile.eq.${State.mobile})`,
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  const oldScrollHeight = box.scrollHeight;

  if (!data || data.length < limit) hasMoreHistory = false;

  if (data?.length > 0) {
    historyPage++;
    const triggerPad = document.getElementById("history-trigger-pad");

    const chronoData = data.reverse();
    let chunkHTML = "";
    let currentChunkDate = isLoadMore ? box.dataset.topDate : "";

    chronoData.forEach((msg, index) => {
      const msgLabel = window.getVaniDateLabel(msg.created_at);

      if (!currentChunkDate || currentChunkDate !== msgLabel) {
        chunkHTML += `<div class="date-divider" data-date="${msgLabel}" style="display:flex;justify-content:center;margin:20px 0;"><div style="padding:6px 14px;border-radius:99px;background:rgba(255,255,255,0.05);border:1px solid var(--glass-border);color:var(--text-muted);font-size:0.75rem;backdrop-filter:blur(10px)">${msgLabel}</div></div>`;
        currentChunkDate = msgLabel;
      }

      chunkHTML += createBubbleHTML(msg);

      if (!isLoadMore && index === chronoData.length - 1) {
        box.dataset.bottomDate = msgLabel;
      }
    });

    box.dataset.topDate = window.getVaniDateLabel(chronoData[0].created_at);

    if (isLoadMore) {
      const oldTopDivider = triggerPad.nextElementSibling;
      if (oldTopDivider && oldTopDivider.classList.contains("date-divider")) {
        const newChunkBottomDate = window.getVaniDateLabel(
          chronoData[chronoData.length - 1].created_at,
        );
        if (oldTopDivider.dataset.date === newChunkBottomDate) {
          oldTopDivider.remove();
        }
      }
    }

    triggerPad.insertAdjacentHTML("afterend", chunkHTML);

    if (isLoadMore) {
      box.scrollTop = box.scrollHeight - oldScrollHeight;
    } else {
      box.scrollTop = box.scrollHeight;
    }
  } else if (!isLoadMore) {
    box.innerHTML = `<div class="empty-state"><div class="empty-icon">⎊</div><p>No history found.</p></div>`;
  }

  isLoadingHistory = false;
  attachScrollObserver();
};

const createBubbleHTML = (msg) => {
  const isMe = msg.sender_mobile === State.mobile;
  const msgDate = new Date(msg.created_at);
  let bubbleContent = `<div class="chat-bubble-content">${sanitize(msg.content)}</div>`;

  if (msg.content.startsWith("[CALL_LOG:")) {
    const parts = msg.content
      .replace("[CALL_LOG:", "")
      .replace("]", "")
      .split(":");
    const type = parts[0],
      duration = parts[1] || "";
    bubbleContent = `
            <div class="call-log-bubble">
                <div class="call-log-icon" style="color: ${type === "MISSED" ? "#ff4d4d" : "var(--neon-primary)"};">
                    ${type === "MISSED" ? '<i class="fa-solid fa-phone-slash"></i>' : '<i class="fa-solid fa-phone"></i>'}
                </div>
                <div class="call-log-details">
                    <h4>${type === "MISSED" ? "Missed Call" : "Voice Call"}</h4>
                    ${duration ? `<p>Duration: ${duration}</p>` : ""}
                </div>
            </div>`;
  }

  const heartStyle = isMe
    ? "left: -8px; right: auto;"
    : "right: -8px; left: auto;";
  const heartHTML = msg.is_liked
    ? `<div class="liked-badge" style="${heartStyle}"><i class="fa-solid fa-heart"></i></div>`
    : "";

  return `<div class="message-enter" data-msg-id="${msg.id}" data-is-me="${isMe}" data-is-liked="${msg.is_liked || false}" style="display:flex;width:100%;justify-content:${isMe ? "flex-end" : "flex-start"};margin-bottom:12px;">
       <div class="chat-bubble" style="max-width:75%;background:${isMe ? "rgba(var(--neon-rgb), 0.1)" : "rgba(255,255,255,0.03)"}; border:1px solid ${isMe ? "var(--neon-primary)" : "var(--glass-border)"}; border-radius:${isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px"}; padding:10px 14px; cursor: pointer;">
         ${bubbleContent}
         <div class="chat-bubble-time" style="font-size:0.6rem;opacity:0.6;margin-top:4px;text-align:right;">
           ${msgDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
         </div>
         ${heartHTML}
       </div>
</div>`;
};

const animateFLIP = (containerId, domUpdateCallback) => {
  const container = $(containerId);
  if (!container || !container.children.length) return domUpdateCallback();

  const firstRects = {};
  Array.from(container.children).forEach((el) => {
    if (el.dataset.mobile)
      firstRects[el.dataset.mobile] = el.getBoundingClientRect();
  });

  domUpdateCallback();

  Array.from(container.children).forEach((el) => {
    const id = el.dataset.mobile;
    if (id && firstRects[id]) {
      const lastRect = el.getBoundingClientRect();
      const deltaY = firstRects[id].top - lastRect.top;

      if (deltaY !== 0) {
        el.style.transform = `translateY(${deltaY}px)`;
        el.style.transition = "none";

        requestAnimationFrame(() => {
          el.style.transform = "";
          el.style.transition =
            "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)";
        });
      }
    }
  });
};

window.updateLikeUI = (bubbleWrapper, isLiked) => {
  const bubble = bubbleWrapper.querySelector(".chat-bubble");
  let badge = bubble.querySelector(".liked-badge");
  const isMe = bubbleWrapper.dataset.isMe === "true";

  if (isLiked) {
    if (!badge) {
      const heartStyle = isMe
        ? "left: -8px; right: auto;"
        : "right: -8px; left: auto;";
      bubble.insertAdjacentHTML(
        "beforeend",
        `<div class="liked-badge" style="${heartStyle}"><i class="fa-solid fa-heart"></i></div>`,
      );
    }
  } else {
    if (badge) badge.remove();
  }
};

window.triggerHeartExplosion = (bubbleWrapper) => {
  const bubble = bubbleWrapper.querySelector(".chat-bubble");
  const particleCount = 12;
  const isMe = bubbleWrapper.dataset.isMe === "true";

  for (let i = 0; i < particleCount; i++) {
    const heart = document.createElement("i");
    heart.className = "fa-solid fa-heart heart-particle";

    if (isMe) {
      heart.style.left = `2px`;
      heart.style.right = `auto`;
    } else {
      heart.style.right = `2px`;
      heart.style.left = `auto`;
    }
    heart.style.bottom = `-5px`;

    let tx = isMe ? Math.random() * 80 - 20 : Math.random() * -80 + 20;
    const ty = Math.random() * -100 - 50;
    const rot = (Math.random() - 0.5) * 90;
    const endScale = 0.8 + Math.random() * 0.7;
    const duration = 1.2 + Math.random() * 1.0;

    heart.style.setProperty("--tx", `${tx}px`);
    heart.style.setProperty("--ty", `${ty}px`);
    heart.style.setProperty("--rot", `${rot}deg`);
    heart.style.setProperty("--end-scale", endScale);
    heart.style.setProperty("--anim-duration", `${duration}s`);
    heart.style.fontSize = `${0.8 + Math.random() * 0.6}rem`;

    bubble.appendChild(heart);
    setTimeout(() => heart.remove(), 2500);
  }
};

window.bindMatrixInteractions = (boxId, tableName) => {
  const box = $(boxId);
  if (!box || box.hasAttribute("data-interactions-bound")) return;

  box.addEventListener("dblclick", async (e) => {
    const bubbleWrapper = e.target.closest(".message-enter");
    if (
      !bubbleWrapper ||
      !bubbleWrapper.dataset.msgId ||
      bubbleWrapper.dataset.msgId.startsWith("temp-")
    )
      return;
    if (bubbleWrapper.dataset.isMe !== "true") return;

    playSound("delete");
    bubbleWrapper.classList.add("message-deleted");

    if (tableName === "random_chats") {
      await supabaseClient
        .from(tableName)
        .update({ is_hidden: true })
        .eq("id", bubbleWrapper.dataset.msgId);
    } else {
      await supabaseClient
        .from(tableName)
        .delete()
        .eq("id", bubbleWrapper.dataset.msgId);
    }

    setTimeout(() => {
      bubbleWrapper.remove();
      if (box.children.length > 0) {
        const lastChild = box.lastElementChild;
        if (lastChild && lastChild.classList.contains("date-divider"))
          lastChild.remove();
      }
    }, 200);
  });

  let pressTimer;
  let isPressing = false;
  let startY = 0;

  const toggleLikeStatus = async (bubbleWrapper) => {
    const msgId = bubbleWrapper.dataset.msgId;
    if (!msgId || msgId.startsWith("temp-")) return;

    const isCurrentlyLiked = bubbleWrapper.dataset.isLiked === "true";
    const newStatus = !isCurrentlyLiked;

    bubbleWrapper.dataset.isLiked = newStatus;
    window.updateLikeUI(bubbleWrapper, newStatus);

    if (newStatus) {
      window.triggerHeartExplosion(bubbleWrapper);
      if (typeof playSound === "function") playSound("send");
    }

    await supabaseClient
      .from(tableName)
      .update({ is_liked: newStatus })
      .eq("id", msgId);
  };

  const handleTouchStart = (e) => {
    const bubbleWrapper = e.target.closest(".message-enter");
    if (!bubbleWrapper) return;
    isPressing = true;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    pressTimer = setTimeout(() => {
      if (isPressing) {
        toggleLikeStatus(bubbleWrapper);
        isPressing = false;
      }
    }, 400);
  };

  const handleTouchEnd = () => {
    isPressing = false;
    clearTimeout(pressTimer);
  };

  const handleTouchMove = (e) => {
    const currentY = e.touches ? e.touches[0].clientY : e.clientY;
    if (Math.abs(currentY - startY) > 10) {
      isPressing = false;
      clearTimeout(pressTimer);
    }
  };

  box.addEventListener("touchstart", handleTouchStart, { passive: true });
  box.addEventListener("touchend", handleTouchEnd);
  box.addEventListener("touchcancel", handleTouchEnd);
  box.addEventListener("touchmove", handleTouchMove, { passive: true });
  box.addEventListener("mousedown", handleTouchStart);
  box.addEventListener("mouseup", handleTouchEnd);
  box.addEventListener("mousemove", handleTouchMove);
  box.addEventListener("contextmenu", (e) => {
    if (e.target.closest(".message-enter")) e.preventDefault();
  });

  box.setAttribute("data-interactions-bound", "true");
};

document.addEventListener("DOMContentLoaded", () => {
  window.bindMatrixInteractions("chat-box", "messages");
});

let RandomState = {
  userId: "",
  sessionId: null,
  isWaiting: false,
  timeoutId: null,
  queueChannel: null,
  chatMsgChannel: null,
  chatStatusChannel: null,
};

const generateStrangerID = () => {
  const matrixWords = [
    "neonwire",
    "stardust",
    "gridlock",
    "cybernet",
    "phantomx",
    "glitcher",
    "bytecode",
    "dataflow",
    "firewall",
    "backdoor",
    "terminal",
    "override",
    "protocol",
    "synthwav",
    "darknode",
    "hyperion",
    "solarray",
    "valkyrie",
    "obsidian",
    "specters",
    "mainframe",
    "datalink",
    "netspace",
    "voidwalk",
    "cyphersx",
    "strangerx",
    "unknownr",
    "outsider",
    "nomadnet",
    "wayfarer",
    "drifterx",
    "vagabond",
    "roamerzx",
    "wanderer",
    "anonflux",
    "anonwave",
    "mystiquex",
    "enigmatic",
    "shadowkin",
    "lostsoul",
    "faceless",
    "nameless",
    "incognit",
    "cipherman",
    "maskedup",
    "hiddenone",
    "voidguest",
    "nightroam",
    "ghostwalk",
    "ghostnet",
    "crypticx",
    "xtranger",
    "offworldr",
    "newcomer",
    "passerby",
    "travelerx",
    "farrover",
    "unseenfx",
    "mystroam",
    "otherkind",
    "odysseyx",
    "solorift",
    "darkguest",
    "straybyte",
    "lonepath",
    "riftroam",
    "anonsoul",
    "graynomad",
    "fogwalker",
    "hollowman",
    "rogueroam",
    "silentone",
    "voidnomad",
    "nightguest",
    "unknownx",
  ];
  const randomWord =
    matrixWords[Math.floor(Math.random() * matrixWords.length)];
  return randomWord + Math.floor(1000 + Math.random() * 9000);
};

document
  .querySelector('[data-view="VIEW-RANDOM"]')
  ?.addEventListener("click", () => {
    if (!RandomState.userId) {
      RandomState.userId = generateStrangerID();
      const inputField = $("random-fake-id");
      if (inputField) inputField.value = RandomState.userId;
    }
    trackActiveStrangers();
  });

const trackActiveStrangers = async () => {
  const { count } = await supabaseClient
    .from("random_sessions")
    .select("*", { count: "exact", head: true })
    .eq("status", "waiting");

  const counter = $("random-active-counter");
  if (counter) counter.textContent = (count || 0).toString().padStart(2, "0");
};

supabaseClient
  .channel("random_global_queue")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "random_sessions" },
    trackActiveStrangers,
  )
  .subscribe();

const abortRandomSearch = async (shouldAutoReconnect = false) => {
  if (RandomState.timeoutId) clearTimeout(RandomState.timeoutId);
  if (RandomState.queueChannel) {
    await supabaseClient.removeChannel(RandomState.queueChannel);
    RandomState.queueChannel = null;
  }
  if (RandomState.chatMsgChannel) {
    await supabaseClient.removeChannel(RandomState.chatMsgChannel);
    RandomState.chatMsgChannel = null;
  }
  if (RandomState.chatStatusChannel) {
    await supabaseClient.removeChannel(RandomState.chatStatusChannel);
    RandomState.chatStatusChannel = null;
  }

  if (RandomState.sessionId && RandomState.isWaiting) {
    await supabaseClient
      .from("random_sessions")
      .delete()
      .eq("session_id", RandomState.sessionId);
  }

  RandomState.isWaiting = false;
  State.isRandomChat = false;
  RandomState.sessionId = null;

  document.body.classList.remove("in-random-mobile-chat");

  RandomState.userId = generateStrangerID();
  const inputField = $("random-fake-id");
  if (inputField) inputField.value = RandomState.userId;

  const chatUI = $("random-chat-interface");
  if (chatUI) {
    chatUI.style.display = "none";
    chatUI.classList.add("hidden");
  }

  const setupUI = $("random-setup-container");
  if (setupUI) setupUI.style.display = "block";

  const header = $("random-view-header");
  if (header) header.style.display = "block";

  const chatBox = $("random-chat-box");
  if (chatBox) chatBox.innerHTML = "";

  const startBtn = $("btn-start-random");
  if (startBtn) {
    startBtn.classList.remove("hidden");
    startBtn.textContent = "Chat with Stranger";
    startBtn.disabled = false;
  }
  $("btn-stop-random")?.classList.add("hidden");

  if (shouldAutoReconnect) {
    const autoReconnect = $("random-auto-reconnect");
    if (autoReconnect && autoReconnect.checked) {
      setTimeout(startRandomChat, 500);
    } else {
      alert("Stranger disconnected or matrix busy. Kindly try again.");
    }
  }
};

const launchStrangerChatInterface = (sessionData) => {
  if (typeof playSound === "function") playSound("receive");
  const targetId =
    sessionData.user1_id === RandomState.userId
      ? sessionData.user2_id
      : sessionData.user1_id;

  State.isRandomChat = true;
  State.activeContact = targetId;

  $("random-setup-container").style.display = "none";
  const header = $("random-view-header");
  if (header) header.style.display = "none";

  const chatUI = $("random-chat-interface");
  if (chatUI) {
    chatUI.classList.remove("hidden");
    chatUI.style.display = "flex";
    if (window.innerWidth <= 992)
      document.body.classList.add("in-random-mobile-chat");
    else chatUI.style.height = "100%";
  }

  const nameEl = $("random-target-name");
  if (nameEl) nameEl.textContent = targetId;

  const avatarEl = $("random-target-avatar");
  if (avatarEl)
    avatarEl.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${targetId}`;

  const chatBox = $("random-chat-box");
  if (chatBox) {
    chatBox.innerHTML = `
            <div class="empty-state" style="margin-top:20px; border: 1px solid var(--neon-primary); padding: 15px; border-radius: 12px; background: rgba(var(--neon-rgb), 0.05);">
                <p style="color: var(--neon-primary); font-weight: bold;">Anonymous Tunnel Secured.</p>
                <p style="font-size:0.8rem; color:var(--text-muted);">This chat is ephemeral and completely isolated. Be respectful.</p>
            </div>`;
    if (typeof window.bindMatrixInteractions === "function")
      window.bindMatrixInteractions("random-chat-box", "random_chats");
  }

  RandomState.chatMsgChannel = supabaseClient
    .channel(`chat_messages_${sessionData.session_id}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "random_chats" },
      (p) => {
        const msg = p.new;

        if (msg.session_id === sessionData.session_id && !msg.is_hidden) {
          const isMe = msg.sender_id === RandomState.userId;
          appendBubble(
            {
              id: msg.id,
              sender_mobile: isMe ? State.mobile : targetId,
              content: msg.content,
              created_at: msg.created_at,
              is_liked: msg.is_liked,
            },
            true,
            "random-chat-box",
          );
          if (!isMe && typeof playSound === "function") playSound("receive");
        }
      },
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "random_chats" },
      (p) => {
        const msg = p.new;
        if (msg.session_id === sessionData.session_id) {
          const bubbleWrapper = document.querySelector(
            `[data-msg-id="${msg.id}"]`,
          );
          if (bubbleWrapper) {
            if (msg.is_hidden) {
              bubbleWrapper.classList.add("message-deleted");
              setTimeout(() => bubbleWrapper.remove(), 200);
              return;
            }

            const wasLiked = bubbleWrapper.dataset.isLiked === "true";
            if (msg.is_liked && !wasLiked) {
              bubbleWrapper.dataset.isLiked = "true";
              window.updateLikeUI(bubbleWrapper, true);
              window.triggerHeartExplosion(bubbleWrapper);

              if (
                msg.sender_id !== RandomState.userId &&
                typeof playSound === "function"
              )
                playSound("send");
            } else if (!msg.is_liked && wasLiked) {
              bubbleWrapper.dataset.isLiked = "false";
              window.updateLikeUI(bubbleWrapper, false);
            }
          }
        }
      },
    )
    .subscribe();

  RandomState.chatStatusChannel = supabaseClient
    .channel(`chat_status_${sessionData.session_id}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "random_sessions" },
      (p) => {
        const row = p.new;
        if (
          row.session_id === sessionData.session_id &&
          row.status === "closed"
        ) {
          alert("Stranger disconnected. Connection lost.");
          abortRandomSearch(true);
        }
      },
    )
    .subscribe();
};

const startRandomChat = async () => {
  const btn = $("btn-start-random");
  if (btn) {
    btn.textContent = "Scanning Matrix...";
    btn.disabled = true;
  }
  $("btn-stop-random")?.classList.remove("hidden");
  RandomState.isWaiting = true;

  try {
    const { data: session, error } = await supabaseClient.rpc(
      "join_random_matrix",
      {
        p_user_name: State.profile.name,
        p_user_id: RandomState.userId,
      },
    );

    if (error) throw error;
    RandomState.sessionId = session.session_id;

    if (session.status === "active") {
      RandomState.isWaiting = false;
      launchStrangerChatInterface(session);
    } else {
      if (btn) btn.textContent = "Waiting for Stranger...";
      RandomState.timeoutId = setTimeout(() => abortRandomSearch(true), 10000);

      RandomState.queueChannel = supabaseClient
        .channel(`queue_${session.session_id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "random_sessions",
            filter: `session_id=eq.${session.session_id}`,
          },
          (p) => {
            if (p.new.status === "active") {
              clearTimeout(RandomState.timeoutId);
              RandomState.isWaiting = false;
              launchStrangerChatInterface(p.new);
            }
          },
        )
        .subscribe();
    }
  } catch (err) {
    alert("Matrix Error: " + err.message);
    abortRandomSearch(false);
  }
};

$("btn-start-random")?.addEventListener("click", startRandomChat);

$("btn-stop-random")?.addEventListener("click", async () => {
  if (RandomState.sessionId) {
    await supabaseClient
      .from("random_sessions")
      .update({ status: "closed", end_time: new Date().toISOString() })
      .eq("session_id", RandomState.sessionId);
  }
  abortRandomSearch(false);
});

const sendRandomMsg = async (e) => {
  if (e) e.preventDefault();
  const input = $("random-msg-input");
  const content = input?.value.trim();
  if (!content || !RandomState.sessionId) return;

  input.value = "";
  input.focus();
  if (typeof playSound === "function") playSound("send");

  const { error } = await supabaseClient.from("random_chats").insert([
    {
      session_id: RandomState.sessionId,
      sender_id: RandomState.userId,
      content: content,
    },
  ]);

  if (error) alert(`Matrix Error: ${error.message}`);
};

const randomSendBtn = $("random-send-btn");
const randomMsgInput = $("random-msg-input");

if (randomSendBtn) {
  const handleRandomSendAction = (e) => {
    e.preventDefault();
    if (randomMsgInput) randomMsgInput.focus();

    randomSendBtn.style.transform = "scale(0.93) translateY(2px)";
    setTimeout(() => (randomSendBtn.style.transform = ""), 150);

    sendRandomMsg();
  };

  randomSendBtn.addEventListener("mousedown", handleRandomSendAction);
  randomSendBtn.addEventListener("touchstart", handleRandomSendAction, {
    passive: false,
  });
}

if (randomMsgInput) {
  randomMsgInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendRandomMsg(e);
  });
}

$("random-disconnect-btn")?.addEventListener("click", async () => {
  if (confirm("End connection with stranger?")) {
    if (RandomState.sessionId) {
      await supabaseClient
        .from("random_sessions")
        .update({ status: "closed", end_time: new Date().toISOString() })
        .eq("session_id", RandomState.sessionId);
    }
    abortRandomSearch(false);
  }
});

window.OneSignalDeferred = window.OneSignalDeferred || [];

window.OneSignalDeferred.push(async function (OneSignal) {
  await OneSignal.init({
    appId: "30dfa9ba-710b-474d-a12f-a7a1509cb29f",
    safari_web_id: "web.onesignal.auto.1997779e-e1de-41f4-ac74-4543cfbf0412",
    notifyButton: {
      enable: false,
    },
    path: "/VANI/",
    serviceWorkerParam: { scope: "/VANI/" },
    serviceWorkerPath: "VANI/OneSignalSDKWorker.js",
  });
});

async function linkDeviceToOneSignal() {
  if (!State || !State.mobile) return;

  OneSignalDeferred.push(async function (OneSignal) {
    await OneSignal.Slidedown.promptPush();

    await OneSignal.User.addAlias("vani_mobile", State.mobile);
    console.log(`🔗 Device hard-linked to node: ${State.mobile}`);
  });
}

async function triggerHelplineWelcome() {
  console.log("🤖 Initializing System Nodes Uplink Check...");

  const HELPLINE_MOBILE = "8185942428";
  const VANIBOT_MOBILE = "0000000000";

  try {
    const { data: existingMsg } = await supabaseClient
      .from("messages")
      .select("id")
      .eq("sender_mobile", HELPLINE_MOBILE)
      .eq("recipient_mobile", State.mobile)
      .limit(1);

    if (existingMsg && existingMsg.length > 0) {
      State.profile.welcomed_by_vani = true;
      return;
    }

    const welcomeText = `Thanks for registering with us, ${State.profile.name || "Operator"}! Welcome to VANI. You can ask any questions or report issues directly in this secure channel. How can we assist you today?`;

    const { error: msgError } = await supabaseClient.from("messages").insert({
      sender_mobile: HELPLINE_MOBILE,
      recipient_mobile: State.mobile,
      content: welcomeText,
      created_at: new Date().toISOString(),
    });

    if (msgError) throw msgError;

    const { data: existingContacts } = await supabaseClient
      .from("contacts")
      .select("contact")
      .eq("mobile", State.mobile)
      .in("contact", [HELPLINE_MOBILE, VANIBOT_MOBILE]);

    const savedNumbers = existingContacts
      ? existingContacts.map((c) => c.contact)
      : [];
    const newContactsToInsert = [];

    if (!savedNumbers.includes(HELPLINE_MOBILE)) {
      newContactsToInsert.push({
        mobile: State.mobile,
        contact: HELPLINE_MOBILE,
        name: "VANI",
        gender: "System",
      });
    }

    if (!savedNumbers.includes(VANIBOT_MOBILE)) {
      newContactsToInsert.push({
        mobile: State.mobile,
        contact: VANIBOT_MOBILE,
        name: "Bot",
        gender: "System",
      });
    }

    if (newContactsToInsert.length > 0) {
      await supabaseClient.from("contacts").insert(newContactsToInsert);
    }

    await supabaseClient
      .from("profiles")
      .update({ welcomed_by_vani: true })
      .eq("id", State.profile.id);

    State.profile.welcomed_by_vani = true;
    console.log("🟢 Helpline & Bot Auto-Save Successful.");

    if (typeof syncContacts === "function") await syncContacts();
  } catch (err) {
    console.error("❌ Welcome Protocol Failed:", err);
  }
}

const VaniCreditsEngine = {
  myMobile: null,
  callStartTime: null,
  amITheCaller: false,
  maxSeconds: 1200,
  currentSeconds: 0,

  init: function (mobileNumber) {
    this.myMobile = mobileNumber;
    this.fetchCurrentCredits();
    this.subscribeToRealtimeCredits();
  },

  fetchCurrentCredits: async function () {
    if (!this.myMobile) return;
    const { data, error } = await supabaseClient
      .from("user_credits")
      .select("call_credits_seconds")
      .eq("mobile", this.myMobile)
      .maybeSingle();

    if (data) this.updateUI(data.call_credits_seconds);
    else this.updateUI(0);
  },

  subscribeToRealtimeCredits: function () {
    supabaseClient
      .channel("public:user_credits")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_credits",
          filter: `mobile=eq.${this.myMobile}`,
        },
        (payload) => this.updateUI(payload.new.call_credits_seconds),
      )
      .subscribe();
  },

  updateUI: function (totalSeconds) {
    this.currentSeconds = totalSeconds;
    const displayEl = document.getElementById("credits-amount-display");
    const fillPath = document.getElementById("gauge-fill-path");
    const needle = document.getElementById("gauge-needle");
    const warning = document.getElementById("quota-warning-badge");

    if (!displayEl || !fillPath || !needle) return;

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    displayEl.innerText = `${minutes}m ${seconds}s`;

    let percentage = totalSeconds / this.maxSeconds;
    if (percentage > 1) percentage = 1;

    const dashoffset = 283 - 283 * percentage;
    fillPath.style.strokeDashoffset = dashoffset;

    const rotation = -90 + 180 * percentage;
    needle.style.transform = `translateX(-50%) rotate(${rotation}deg)`;

    let color = "var(--neon-primary)";
    if (percentage >= 0.75) color = "#ffaa00";
    if (percentage >= 1) color = "#ff4d4d";

    fillPath.style.stroke = color;

    needle.style.color = color;

    fillPath.style.filter = `drop-shadow(0 0 10px ${color})`;
    needle.querySelector(".needle-base").style.background = color;
    needle.querySelector(".needle-base").style.boxShadow = `0 0 15px ${color}`;

    if (percentage >= 1) {
      if (warning) warning.classList.remove("hidden");
      this.lockOutgoingMatrix(true);
    } else {
      if (warning) warning.classList.add("hidden");
      this.lockOutgoingMatrix(false);
    }

    displayEl.classList.add("credits-flash");
    setTimeout(() => displayEl.classList.remove("credits-flash"), 1200);
  },

  lockOutgoingMatrix: function (isLocked) {
    const callBtn = document.getElementById("start-call-btn");
    if (callBtn) {
      if (isLocked) {
        callBtn.classList.add("btn-network-locked");
      } else {
        callBtn.classList.remove("btn-network-locked");
      }
    }
  },

  isCallAllowed: function () {
    return this.currentSeconds < this.maxSeconds;
  },

  markCallStarted: function (isCaller) {
    this.callStartTime = Date.now();
    this.amITheCaller = isCaller;
  },

  processCallEnd: async function () {
    if (!this.callStartTime || !this.amITheCaller) {
      this.resetClock();
      return;
    }
    const durationInSeconds = Math.floor(
      (Date.now() - this.callStartTime) / 1000,
    );
    if (durationInSeconds > 0) {
      await supabaseClient.rpc("increment_call_credits", {
        p_mobile: this.myMobile,
        p_seconds: durationInSeconds,
      });
    }
    this.resetClock();
  },

  resetClock: function () {
    this.callStartTime = null;
    this.amITheCaller = false;
  },
};

let deferredInstallPrompt = null;
const installModal = document.getElementById("pwa-install-modal");
const acceptBtn = document.getElementById("pwa-accept-btn");
const declineBtn = document.getElementById("pwa-decline-btn");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => {
        console.log("VANI Service Worker Registered:", reg.scope);
        reg.update();
      })
      .catch((err) => console.error("SW FAILED:", err.message));
  });
}

window.addEventListener("beforeinstallprompt", (e) => {
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone;
  const isAlreadyInstalled =
    localStorage.getItem("vani-pwa-installed") === "true";

  if (isStandalone || isAlreadyInstalled) {
    console.log(
      "🛑 Installation aborted: App is already installed or running in standalone mode.",
    );
    return;
  }

  e.preventDefault();
  deferredInstallPrompt = e;

  if (installModal) {
    setTimeout(() => {
      installModal.classList.remove("hidden");
      requestAnimationFrame(() => {
        installModal.classList.add("slide-up-active");
      });
    }, 1500);
  }
});

if (acceptBtn) {
  acceptBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;

    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log(`User PWA Choice: ${outcome}`);

    deferredInstallPrompt = null;
    installModal.classList.remove("slide-up-active");
    setTimeout(() => installModal.classList.add("hidden"), 600);
  });
}

if (declineBtn) {
  declineBtn.addEventListener("click", () => {
    installModal.classList.remove("slide-up-active");
    setTimeout(() => installModal.classList.add("hidden"), 600);
  });
}

window.addEventListener("appinstalled", () => {
  console.log("✅ VANI successfully installed to device.");

  localStorage.setItem("vani-pwa-installed", "true");

  if (installModal) {
    installModal.classList.remove("slide-up-active");
    setTimeout(() => installModal.classList.add("hidden"), 600);
  }
  deferredInstallPrompt = null;
});

function initSwipeToReply(messageElement, messageData) {
  let startX;
  let currentX;

  messageElement.addEventListener(
    "touchstart",
    (e) => {
      startX = e.touches[0].clientX;
    },
    { passive: true },
  );

  messageElement.addEventListener(
    "touchmove",
    (e) => {
      currentX = e.touches[0].clientX;
      let delta = startX - currentX;

      if (delta > 50) {
        messageElement.classList.add("swiping");
        messageElement.style.transform = `translateX(${-delta / 2}px)`;
      }
    },
    { passive: true },
  );

  messageElement.addEventListener("touchend", (e) => {
    let delta = startX - e.changedTouches[0].clientX;

    if (delta > 100) {
      triggerReply(messageData);
    }

    messageElement.classList.remove("swiping");
    messageElement.style.transform = "translateX(0)";
  });
}

function triggerReply(messageData) {
  const replyBar = document.getElementById("reply-bar");
  replyBar.classList.remove("hidden");
  replyBar.innerHTML = `Replying to: <span>${messageData.content.substring(0, 20)}...</span>`;

  document.getElementById("msg-input").focus();
}

const bootApp = async () => {
  const failsafeTimer = setTimeout(() => {
    const loader = document.getElementById("boot-loader");
    if (loader) {
      console.warn(
        "⏱️ Matrix Sync Timeout: Forcing shield down to prevent infinite hang.",
      );
      requestAnimationFrame(() => {
        loader.style.opacity = "0";
        loader.style.pointerEvents = "none";
        setTimeout(() => loader.remove(), 800);
      });
    }
  }, 5000);

  try {
    bootThemeEngine();

    if (typeof supabase === "undefined") {
      throw new Error(
        "Supabase Database Core failed to load. Check network connection.",
      );
    }

    await evalSession();
  } catch (err) {
    console.error("🔥 SYSTEM BOOT FAILURE:", err.message);
    alert(err.message);

    const loader = document.getElementById("boot-loader");
    if (loader) {
      loader.style.opacity = "0";
      loader.style.pointerEvents = "none";
      setTimeout(() => loader.remove(), 800);
    }
  } finally {
    clearTimeout(failsafeTimer);
  }
};

bootApp();
