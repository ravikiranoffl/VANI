// ==========================================================
// 1. SETUP, STATE & HELPERS
// ==========================================================
const supabaseClient = supabase.createClient(
  "https://gxuqhaxboagwsktoupyv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dXFoYXhib2Fnd3NrdG91cHl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Njk2NjYsImV4cCI6MjA5NjA0NTY2Nn0.jvOUukSys7sbc_Rw7ML-ISdqWEpMx5HMreR3b7v_zTU",
);

// Add presenceChannel and onlineUsers to your State memory
const State = { 
    mobile: "", 
    profile: null, 
    activeContact: "", 
    channel: null,
    presenceChannel: null,       // NEW
    onlineUsers: new Set()       // NEW: A high-speed list of online numbers
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
      osc.start(); osc.stop(ctx.currentTime + 0.05);
    } else if (type === "receive") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    } else if (type === "delete") {
      // 💥 THE NEW POP OUT SOUND (High frequency dropping rapidly to zero)
      osc.type = "sine";
      osc.frequency.setValueAtTime(900, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.8, ctx.currentTime); // Slightly louder for impact
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start(); osc.stop(ctx.currentTime + 0.08);
    }
  } catch(e) { console.warn("Audio blocked by browser."); }
};

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
    initPresence(); // 🚨 NEW: Boot up the Online Tracker!
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
  if (window.innerWidth <= 992) toggleMobileMenu(true);
});

// ==========================================================
// 4. CONTACTS ENGINE (Now with Timestamp Sorting)
// ==========================================================


const refreshContactsUI = async () => {
    // We re-run syncContacts, which contains your sorting logic
    await syncContacts(); 
};

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

// ==========================================================
// 4. CONTACTS ENGINE (Now with Ghost Profiles & Time Sorting)
// ==========================================================
const syncContacts = async () => {
  const [{ data: c }, { data: p }, { data: m }] = await Promise.all([
    supabaseClient.from("contacts").select("*").eq("mobile", State.mobile),
    supabaseClient.from("profiles").select("mobile, avatar_url, name"),
    supabaseClient.from("messages").select("sender_mobile, recipient_mobile, is_read, created_at").or(`sender_mobile.eq.${State.mobile},recipient_mobile.eq.${State.mobile}`),
  ]);

  const regMap = Object.fromEntries(p?.map((x) => [x.mobile, x]) || []);
  const latestMsgMap = {};
  
  // 🚨 NEW: Map to track unread message counts
  const unreadMap = {}; 

  const ghostNumbers = new Set();

  m?.forEach((msg) => {
    const otherParty = msg.sender_mobile === State.mobile ? msg.recipient_mobile : msg.sender_mobile;
    const msgTime = new Date(msg.created_at).getTime();
    if (!latestMsgMap[otherParty] || msgTime > latestMsgMap[otherParty]) {
      latestMsgMap[otherParty] = msgTime;
    }
    ghostNumbers.add(otherParty);

    // 🚨 NEW: Calculate Unread Count
    // If you are the recipient AND the message is unread...
    if (msg.recipient_mobile === State.mobile && msg.is_read === false) {
        // ...AND the sender is NOT the person we are currently looking at
        if (String(msg.sender_mobile) !== String(State.activeContact)) {
            unreadMap[msg.sender_mobile] = (unreadMap[msg.sender_mobile] || 0) + 1;
        }
    }
  });

  const savedMap = {};
  c?.forEach((saved) => savedMap[saved.contact] = true);

  const finalContacts = [...(c || [])];

  ghostNumbers.forEach(number => {
      if (!savedMap[number] && number !== State.mobile) {
          finalContacts.push({
              contact: number,
              name: `+91 ${number}`, 
              isGhost: true 
          });
      }
  });

  // Sorting Engine
  finalContacts.sort((a, b) => (latestMsgMap[b.contact] || 0) - (latestMsgMap[a.contact] || 0));

  // 🚨 UPDATE: Pass the calculated unreadMap to the render function
  renderContacts(finalContacts, regMap, unreadMap);
  if (typeof updatePresenceUI === "function") updatePresenceUI();
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
      
      // 🚨 UPDATE: Injects the unread-badge cleanly. Cap count at 99+ to prevent UI breaking.
      li.innerHTML = `
        <img src="${avatar}" style="width:45px;height:45px;border-radius:12px; object-fit: cover;"/>
        <div style="flex:1; min-width:0; overflow:hidden;">
            <h4 style="font-size:1rem;font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.name}</h4>
            <p style="font-size:0.8rem;color:var(--text-muted);font-family:monospace;">+91 ${c.contact}</p>
        </div>
        ${unread > 0 ? `<div class="unread-badge">${unread > 99 ? '99+' : unread}</div>` : ""}
      `;
      
      li.onclick = () => openChat(c.contact, c.name, avatar, !!p, c.isGhost);
      list.appendChild(li);
    }

    if (grid) {
      const card = document.createElement("div");
      card.className = "glass-panel directory-card";
      card.style.cssText = "padding:25px;";
      
      // 🚨 UPGRADE: Hide the "Delete" button if it's a Ghost Profile (since it isn't saved yet)
      card.innerHTML = `<div style="display:flex;align-items:center;gap:15px;margin-bottom:20px;"><img src="${avatar}" style="width:60px;height:60px;border-radius:16px;"/><div><h3>${c.name}</h3><p style="color:var(--text-muted);font-family:monospace;">+91 ${c.contact}</p></div></div><div style="display:flex;gap:10px;"><button class="glow-btn open-chat-btn" style="flex:1;">Open Chat</button>${c.isGhost ? '' : '<button class="delete-contact-btn" style="flex:1;border:none;border-radius:12px;cursor:pointer;font-weight:600;background:#ff4d4d;color:white;padding:12px;">Delete</button>'}</div>`;

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
      grid.appendChild(card);
    }
  });
};

// ==========================================================
// CHAT ENGINE REPLACEMENTS (script.js)
// ==========================================================

const clearUnreadBadgeFromUI = (mobile) => {
    const li = document.querySelector(`li[data-mobile="${mobile}"]`);
    if (li) {
        const badge = li.querySelector('.unread-badge');
        if (badge) badge.remove();
    }
};

const openChat = async (mobile, name, avatar, isReg, isGhost = false) => {
  clearUnreadBadgeFromUI(mobile); // Instantly remove badge
  State.activeContact = mobile;
  State.activeContact = mobile;
  $$("#contacts-list li").forEach((li) => li.classList.toggle("active", li.dataset.mobile === mobile));

  $("chat-with-name").textContent = name;
  $("chat-target-avatar").src = avatar;
  $("chat-with-status").textContent = isReg ? "Connected" : "Offline";
  $("chat-with-status").style.color = isReg ? "var(--neon-primary)" : "#ff3366";

  ["active-chat-header", "message-input-bar"].forEach((id) => $(id).classList.remove("hidden"));
  
  // 👻 GHOST PROFILE LOGIC: Show or hide the Save button
  const saveBtn = $("save-ghost-btn");
  if (saveBtn) {
      if (isGhost) {
          saveBtn.classList.remove("hidden");
          saveBtn.dataset.mobile = mobile; // Attach number for the modal
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

  updatePresenceUI(); // Instantly color the header when chat opens

  // 🚨 1. OPTIMISTIC UI: Instantly kill the badge in the DOM so it feels blazing fast
  const activeContactLi = document.querySelector(`li[data-mobile="${mobile}"]`);
  if (activeContactLi) {
      const badge = activeContactLi.querySelector('.unread-badge');
      if (badge) badge.remove(); 
  }

  // 🚨 2. STRICT AWAIT: Force the app to wait for database confirmation
  const { error: updateErr } = await supabaseClient.from("messages")
      .update({ is_read: true })
      .eq("sender_mobile", mobile)
      .eq("recipient_mobile", State.mobile)
      .eq("is_read", false);

  if (updateErr) {
      // If this fires, your RLS policy is missing an UPDATE rule for messages!
      console.error("Matrix Error: Database rejected the Read-Receipt update.", updateErr.message);
  } else {
      // 3. Sync silently in the background only AFTER confirmation
      syncContacts(); 
  }

  if (typeof checkCallButtonVisibility === "function") {
      checkCallButtonVisibility();
  }
};

const loadHistory = async () => {
  if (!State.activeContact) return;
  
  // LIMIT is used to keep the app fast regardless of database size
  const { data } = await supabaseClient
    .from("messages")
    .select("*")
    .or(`and(sender_mobile.eq.${State.mobile},recipient_mobile.eq.${State.activeContact}),and(sender_mobile.eq.${State.activeContact},recipient_mobile.eq.${State.mobile})`)
    .order("created_at", { ascending: false }) // Fetch newest first
    .limit(50); // Get only the last 50 messages[cite: 2]

  const box = $("chat-box");
  box.innerHTML = "";
  box.dataset.lastLabel = ""; // Reset date tracking

  if (!data?.length) {
    box.innerHTML = `<div class="empty-state"><div class="empty-icon">⎊</div><p>No history found.</p></div>`;
  } else {
    // Reverse data so chronological order is restored for rendering
    data.reverse().forEach((msg) => appendBubble(msg, false));
    box.scrollTop = box.scrollHeight;
  }
};

const appendBubble = (msg, autoScroll = true) => {
  $("typing-indicator-ui")?.remove();
  const box = $("chat-box");
  box.querySelector(".empty-state")?.remove();

  if (msg.id && box.querySelector(`[data-msg-id="${msg.id}"]`)) return;

  const msgDate = new Date(msg.created_at);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const getLabel = (d) => {
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  };

  const currentLabel = getLabel(msgDate);
  const lastLabel = box.dataset.lastLabel;

  if (lastLabel !== currentLabel) {
    box.insertAdjacentHTML(
      "beforeend",
      `<div class="date-divider" style="display:flex;justify-content:center;margin:20px 0;">
        <div style="padding:6px 14px;border-radius:99px;background:rgba(255,255,255,0.05);
                    border:1px solid var(--glass-border);color:var(--text-muted);
                    font-size:0.75rem;backdrop-filter:blur(10px);letter-spacing:0.5px;">
          ${currentLabel}
        </div>
      </div>`
    );
    box.dataset.lastLabel = currentLabel;
  }

  const isMe = msg.sender_mobile === State.mobile;
  let bubbleHTML = "";

  // 🚨 NEW: THE UNIFIED TIMELINE PARSER
  if (msg.content.startsWith("[CALL_LOG:")) {
      const parts = msg.content.replace("[CALL_LOG:", "").replace("]", "").split(":");
      const type = parts[0]; // "VOICE" or "MISSED"
      const duration = parts[1] || "";
      
      const icon = type === "MISSED" ? `<i class="fa-solid fa-phone-slash"></i>` : `<i class="fa-solid fa-phone"></i>`;
      const title = type === "MISSED" ? "Missed Call" : "Voice Call";
      const durationText = type === "MISSED" ? "" : duration;
      const color = type === "MISSED" ? "#ff4d4d" : "var(--neon-primary)";

      bubbleHTML = `
        <div class="call-log-bubble">
            <div class="call-log-icon" style="color: ${color}; box-shadow: inset 0 0 10px ${type === "MISSED" ? 'rgba(255,77,77,0.2)' : 'rgba(var(--neon-rgb), 0.2)'};">
                ${icon}
            </div>
            <div class="call-log-details">
                <h4>${title}</h4>
                ${durationText ? `<p>Duration: ${durationText}</p>` : ''}
            </div>
        </div>
      `;
  } else {
      // STANDARD TEXT MESSAGE
      bubbleHTML = `<div class="chat-bubble-content">${sanitize(msg.content)}</div>`;
  }

  box.insertAdjacentHTML(
    "beforeend",
    `<div class="message-enter" data-msg-id="${msg.id}" data-is-me="${isMe}" style="display:flex;width:100%;justify-content:${isMe ? "flex-end" : "flex-start"};margin-bottom:12px;">
       <div class="chat-bubble" style="max-width:75%;background:${isMe ? "rgba(var(--neon-rgb), 0.1)" : "rgba(255,255,255,0.03)"};
                                      border:1px solid ${isMe ? "var(--neon-primary)" : "var(--glass-border)"};
                                      border-radius:${isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px"};
                                      backdrop-filter:blur(10px);padding:10px 14px; cursor: pointer;">
         ${bubbleHTML}
         <div class="chat-bubble-time" style="font-size:0.6rem;opacity:0.6;margin-top:4px;text-align:right;">
           ${msgDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
         </div>
       </div>
     </div>`
  );

  if (autoScroll) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
};

// ==========================================================
// 💬 TYPING INDICATOR ENGINE
// ==========================================================
let typingHideTimeout = null;

const showTypingIndicator = () => {
    let indicator = $("typing-indicator-ui");
    
    // If it's not on screen, create it
    if (!indicator) {
        const box = $("chat-box");
        box.insertAdjacentHTML('beforeend', `
            <div id="typing-indicator-ui" class="message-enter" style="display:flex;width:100%;justify-content:flex-start;margin-bottom:12px; transition: opacity 0.4s ease;">
                <div class="typing-indicator" style="margin: 0; border-radius: 16px 16px 16px 4px;">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `);
        box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
    } else {
        // If it's already there, make sure it's fully visible
        indicator.style.opacity = "1";
    }

    // Reset the fade-out timer every time they press a key
    if (typingHideTimeout) clearTimeout(typingHideTimeout);
    
    typingHideTimeout = setTimeout(() => {
        hideTypingIndicator();
    }, 2000); // 2 Seconds of silence = Fade out
};

const hideTypingIndicator = () => {
    const indicator = $("typing-indicator-ui");
    if (indicator) {
        indicator.style.opacity = "0"; // Smooth fade out
        setTimeout(() => indicator.remove(), 400); // Destroy after fade completes
    }
};

const sendMsg = async (e) => {
  if (e) e.preventDefault(); // STOPS silent layout reloads
  const content = $("msg-input").value.trim();
  if (!content || !State.activeContact) return;
  
  $("msg-input").value = ""; 
  hideTypingIndicator(); // Instantly kill my own typing dots
  playSound("send");

  // 💾 BACKGROUND DB UPLOAD
  const { error } = await supabaseClient.from("messages").insert([
    {
      sender_mobile: State.mobile,
      recipient_mobile: State.activeContact,
      content,
      is_read: false,
    },
  ]); 

  if (error) {
      alert(`Send Error: ${error.message}`);
  }
};

// ==========================================================
// 🗑️ DOUBLE TAP TO DELETE ENGINE
// ==========================================================
$("chat-box")?.addEventListener("dblclick", async (e) => {
    // Find the message wrapper that was double-tapped
    const bubbleWrapper = e.target.closest(".message-enter");
    
    // Ignore if they didn't tap a message, or if it's still uploading
    if (!bubbleWrapper || !bubbleWrapper.dataset.msgId || bubbleWrapper.dataset.msgId.startsWith("temp-")) return;

    // Security: Only allow the user to delete their OWN messages
    if (bubbleWrapper.dataset.isMe !== "true") return; 

    // 1. PLAY THE INSTANT POP SOUND
    playSound("delete");

    // 2. TRIGGER THE VISUAL POP ANIMATION
    bubbleWrapper.classList.add("message-deleted");

    // 3. DELETE FROM SUPABASE (Background Process)
    await supabaseClient.from("messages").delete().eq("id", bubbleWrapper.dataset.msgId);

    // 4. DESTROY THE DOM ELEMENT (After animation completes)
    setTimeout(() => {
        bubbleWrapper.remove();
        
        // Cleanup: If this was the last message today, hide the "Today" divider
        const box = $("chat-box");
        if (box && box.children.length > 0) {
            const lastChild = box.lastElementChild;
            if (lastChild && lastChild.classList.contains('date-divider')) {
                lastChild.remove();
            }
        }
    }, 200); 
});

// Listeners securely pass the event object to block reloads
$("send-msg-btn")?.addEventListener("click", (e) => sendMsg(e));

// 1. YOUR OLD CODE: Sends the message when "Enter" is pressed
$("msg-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        sendMsg(e);
    }
});

// 2. THE NEW CODE: Broadcasts that you are typing when normal keys are pressed
let lastTypingTime = 0;
$("msg-input")?.addEventListener("input", () => {
    if (!State.channel || !State.activeContact) return;
    
    const now = Date.now();
    // Only send a ping once every 1.5 seconds to save battery/bandwidth
    if (now - lastTypingTime > 1500) { 
        State.channel.send({
            type: 'broadcast',
            event: 'typing',
            payload: { sender: State.mobile, recipient: State.activeContact }
        });
        lastTypingTime = now;
    }
});

// ==========================================================
// 📡 THE DIAGNOSTIC REALTIME ENGINE (WITH DELETE SYNC)
// ==========================================================
const initRealtime = async () => {
    // 1. Verify State before we even try to connect
    if (!State || !State.mobile) {
        console.error("❌ REALTIME ABORTED: State.mobile is missing. You must log in first!");
        return;
    }

    console.log(`🔌 Initializing Realtime for User: ${State.mobile}`);

    // 2. Clean up any old ghost subscriptions safely
    // 🚨 FIX: AWAIT the removal of the old channel so the server doesn't crash
    if (State.channel) {
        await supabaseClient.removeChannel(State.channel);
        State.channel = null;
    }

   // 3. Boot the Realtime Socket
    // 🚨 FIX: Everyone MUST be on the exact same channel name for Broadcasts to connect!
    State.channel = supabaseClient
        .channel('vani_global_matrix', {
            config: {
                broadcast: { ack: false, self: false }
            }
        })
        
        // 🟢 LISTEN FOR NEW MESSAGES (INSERT)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (p) => {
            const msg = p.new;
            
            if (!msg?.sender_mobile) return;

            const isCurrentlyViewingChat = (msg.sender_mobile == State.activeContact && msg.recipient_mobile == State.mobile);
            const isMyOwnMessage = (msg.sender_mobile == State.mobile && msg.recipient_mobile == State.activeContact);
            const isForMeButImElsewhere = (msg.recipient_mobile == State.mobile && msg.sender_mobile != State.activeContact);

            if (isCurrentlyViewingChat) {
                // SCENARIO A: You are looking at the chat when they text you.
                playSound("receive");
                appendBubble(msg, true);
                
                // Instantly burn the unread status in the database
                await supabaseClient.from("messages").update({ is_read: true }).eq("id", msg.id);
                // 🛑 We explicitly DO NOT call syncContacts() here to prevent the badge from flickering.
            } 
            else if (isMyOwnMessage) {
                // 🚨 SCENARIO B (RESTORED): You sent a message. Append it to your own screen!
                appendBubble(msg, true);
                await refreshContactsUI(); // Moves the contact to the top of the sidebar
            } 
            else if (isForMeButImElsewhere) {
                // SCENARIO C: Someone texts you while you are in another chat/menu.
                playSound("receive");
                await refreshContactsUI(); // Generates the green badge and moves them to the top
            }
        })
        // 💬 LISTEN FOR TYPING BROADCASTS (NO DATABASE NEEDED)
        .on("broadcast", { event: "typing" }, (payload) => {
            const data = payload.payload;
            // If they are typing to ME, and I am currently looking at THEM
            if (data.recipient == State.mobile && data.sender == State.activeContact) {
                showTypingIndicator();
            }
        })

        // 📞 LISTEN FOR WEBRTC SIGNALS
        .on("broadcast", { event: "webrtc_signal" }, (payload) => {
            const data = payload.payload;
            if (data.recipient === State.mobile) {
                console.log("📡 Incoming WebRTC Signal:", data.type);
                handleIncomingWebRTCSignal(data);
            }
        })
        
        // 🔴 LISTEN FOR DELETED MESSAGES (DOUBLE-TAP FEATURE)
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (p) => {
            console.log("🗑️ REALTIME DELETE DETECTED. Removing message:", p.old.id);
            const deletedId = p.old.id;
            const bubble = document.querySelector(`[data-msg-id="${deletedId}"]`);
            
            if (bubble) {
                // Animate it shrinking away, then remove it from the DOM
                bubble.classList.add("message-deleted");
                setTimeout(() => {
                    bubble.remove();
                }, 200);
                
                // Refresh the sidebar in case this was the most recent message
                if (typeof refreshContactsUI === "function") refreshContactsUI();
            }
        })

        // 🔌 CONNECT THE SOCKET
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                console.log("🟢 VANI REALTIME IS LIVE AND LISTENING.");
            } else {
                console.error("🔴 VANI REALTIME FAILED. Status:", status, "Error:", err);
            }
        });
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
  const prefAudio = localStorage.getItem("vani-audio") !== "false"; // NEW

  const randomToggle = $("toggle-random-boot");
  const cinematicToggle = $("toggle-cinematic-mode");
  const audioToggle = $("toggle-system-audio"); // NEW

  if (randomToggle) randomToggle.checked = prefRandomBoot;
  if (cinematicToggle) cinematicToggle.checked = prefCinematic;
  if (audioToggle) audioToggle.checked = prefAudio; // NEW

  if (prefCinematic) {
    enableCinematicMode();
  } else {
    disableCinematicMode();
  }

  randomToggle?.addEventListener("change", (e) => localStorage.setItem("vani-random-boot", e.target.checked));
  cinematicToggle?.addEventListener("change", (e) => {
    const isOn = e.target.checked;
    localStorage.setItem("vani-cinematic", isOn);
    isOn ? enableCinematicMode() : disableCinematicMode();
  });
  
  // NEW: Save audio preference
  audioToggle?.addEventListener("change", (e) => localStorage.setItem("vani-audio", e.target.checked));
};

// ⌨️ MOBILE KEYBOARD FIX: Automatically scroll to bottom when keyboard opens
$("msg-input")?.addEventListener("focus", () => {
    setTimeout(() => {
        const box = $("chat-box");
        if (box) {
            box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
        }
    }, 300); // 300ms allows the keyboard sliding animation to finish
});

// ==========================================================
// 🟢 PRESENCE ENGINE (ONLINE / OFFLINE TRACKER)
// ==========================================================

// ==========================================================
// 🟢 PRESENCE UI UPDATER (PERMANENT RED/GREEN DOTS)
// ==========================================================
const updatePresenceUI = () => {
    // 1. Update the Active Chat Header (Top Bar)
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

    // 2. Update the Sidebar Contacts (Permanent Dots)
    $$("#contacts-list li").forEach(li => {
        const mobile = li.dataset.mobile;
        const isOnline = State.onlineUsers.has(String(mobile));
        
        // Ensure the avatar is wrapped so the dot can stick to the corner
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
            
            // If the dot doesn't exist yet, create it permanently!
            if (!indicator) {
                wrapper.insertAdjacentHTML("beforeend", `<div class="presence-dot" style="position:absolute; bottom:-2px; right:-2px; border:2px solid var(--bg-deep); width:12px; height:12px; border-radius:50%; transition: background 0.3s ease, box-shadow 0.3s ease;"></div>`);
                indicator = wrapper.querySelector(".presence-dot");
            }

            // Update the colors constantly based on network status
            if (isOnline) {
                indicator.style.background = "#00ff88"; // Neon Green
                indicator.style.boxShadow = "0 0 8px #00ff88";
            } else {
                indicator.style.background = "#ff4d4d"; // Crimson Red
                indicator.style.boxShadow = "none";
            }
        }
    });
};

// ==========================================================
// 🟢 PRESENCE ENGINE (ONLINE / OFFLINE TRACKER)
// ==========================================================
const initPresence = async () => {
    if (!State.mobile) return;

    // 🚨 FIX: AWAIT the removal
    if (State.presenceChannel) {
        await supabaseClient.removeChannel(State.presenceChannel);
        State.presenceChannel = null;
    }

    // Connect to the Global Waiting Room
    State.presenceChannel = supabaseClient.channel('vani_global_presence');

    State.presenceChannel
        .on('presence', { event: 'sync' }, () => {
            // Someone joined or left! Rebuild the list of online users.
            const newState = State.presenceChannel.presenceState();
            State.onlineUsers.clear();
            for (const id in newState) {
                newState[id].forEach(user => {
                    if (user.mobile) State.onlineUsers.add(String(user.mobile));
                });
            }
            if (typeof updatePresenceUI === "function") updatePresenceUI();
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                // Announce to the network that YOU are online
                await State.presenceChannel.track({
                    mobile: State.mobile,
                    online_at: new Date().toISOString(),
                });
            }
        });
};

// ==========================================================
// 🛡️ ANTI-SLEEP & TAB THROTTLING WAKE-UP ENGINE
// ==========================================================
document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible") {
        if (State && State.mobile) {
            console.log("🔄 VANI Waking up... Syncing Data.");
            
            // 1. Force a manual fetch of any messages missed while tab was hidden
            await syncContacts(); 
            if (State.activeContact) await loadHistory();

            // 2. Safely re-announce Presence (Green Dot)
            if (State.presenceChannel && State.presenceChannel.state === 'joined') {
                await State.presenceChannel.track({ mobile: State.mobile, online_at: new Date().toISOString() });
            } else if (typeof initPresence === "function") {
                initPresence();
            }
            
            // 🚨 FIX: We DO NOT call initRealtime() here anymore! 
            // Supabase automatically keeps the socket alive. Violently restarting it caused the crash.
        }
    } else {
        console.log("💤 VANI Tab hidden... Marking as OFFLINE.");
        
        // Safely drop the Green Dot for everyone else
        if (State && State.presenceChannel && State.presenceChannel.state === 'joined') {
            await State.presenceChannel.untrack();
        }
    }
});

// ==========================================================
// GHOST PROFILE SAVING ENGINE
// ==========================================================

$("save-ghost-btn")?.addEventListener("click", (e) => {
    e.preventDefault(); // Stop any background layout shifts

    // e.currentTarget guarantees we get the data from the button itself
    const btn = e.currentTarget; 
    const mobile = btn.dataset.mobile; 
    
    if (!mobile) {
        console.error("Ghost Modal Error: No phone number attached to button.");
        return;
    }
    
    // Inject the number and clear the input
    $("ghost-save-number").value = `+91 ${mobile}`;
    $("ghost-save-name").value = ""; 
    
    // Unhide the modal
    $("ghost-save-modal").style.display = "flex";
    
    // Auto-focus the input box so you can start typing immediately
    setTimeout(() => {
        $("ghost-save-name").focus();
    }, 100);
});

$("cancel-ghost-btn")?.addEventListener("click", () => {
    $("ghost-save-modal").style.display = "none";
});

$("confirm-ghost-save-btn")?.addEventListener("click", async () => {
    const contact = $("save-ghost-btn").dataset.mobile;
    const name = $("ghost-save-name").value.trim();

    if (!name) return alert("Please enter a name.");

    try {
        // 1. Save to Database
        const { error } = await supabaseClient
          .from("contacts")
          .insert([{ mobile: State.mobile, name, contact, gender: "Other" }]);
        if (error) throw error;

        // 2. Hide UI & Button
        $("ghost-save-modal").style.display = "none";
        $("save-ghost-btn").classList.add("hidden");
        
        // 3. Seamlessly Update Header Name
        $("chat-with-name").textContent = name;

        // 4. Force a silent Sidebar Redraw
        await syncContacts();

        // 5. Play confirmation ding!
        if (typeof playSound === "function") playSound("receive"); 

    } catch (err) {
        alert(`Save Error: ${err.message}`);
    }
});

// ==========================================================
// 🌐 NETWORK GUARDIAN (OFFLINE / ONLINE MONITOR)
// ==========================================================

const handleNetworkChange = () => {
    const overlay = $("offline-overlay");
    if (!overlay) return;

    if (!navigator.onLine) {
        // 🛑 WE ARE OFFLINE: Drop the shield
        overlay.style.display = "flex";
        console.warn("📡 NETWORK LOST: Freezing matrix and displaying offline shield.");
    } else {
        // 🟢 WE ARE ONLINE: Lift the shield and Auto-Heal
        overlay.style.display = "none";
        console.log("📡 NETWORK RESTORED: Re-establishing uplinks...");
        
        // Auto-Heal the App (Fetch missing messages and reset Presence)
        if (State && State.mobile) {
            if (typeof syncContacts === "function") syncContacts();
            if (State.activeContact && typeof loadHistory === "function") loadHistory();
            if (typeof initPresence === "function" && (!State.presenceChannel || State.presenceChannel.state !== 'joined')) {
                initPresence();
            }
        }
    }
};

// Listen to the browser's native network events
window.addEventListener("offline", handleNetworkChange);
window.addEventListener("online", handleNetworkChange);

// The Manual "Attempt Reconnect" Button Logic
$("offline-reload-btn")?.addEventListener("click", () => {
    const btn = $("offline-reload-btn");
    
    // Give tactical visual feedback
    const originalText = btn.textContent;
    btn.textContent = "Scanning Frequencies...";
    btn.style.opacity = "0.5";
    btn.style.pointerEvents = "none";
    
    setTimeout(() => {
        if (navigator.onLine) {
            // Hardware confirms internet is back, trigger a hard reload to ensure clean cache
            location.reload(); 
        } else {
            // Still dead. Revert the button so they can try again later.
            btn.textContent = originalText;
            btn.style.opacity = "1";
            btn.style.pointerEvents = "auto";
            
            // Optional: Play the error/delete sound if you want audio feedback
            if (typeof playSound === "function") playSound("delete"); 
        }
    }, 800); // Fake 800ms scan delay for premium UX
});

// ==========================================================
// 📞 VANI WEBRTC WALKIE-TALKIE ENGINE
// ==========================================================

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
    pendingCandidates: []
};

const STUN_SERVERS = {
    iceServers: [
        // Standard Google STUN (Always Free)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:relay.metered.com:80' }, // 🚨 NEW: Metered's dedicated STUN
        
        // YOUR FREE PRIVATE TURN RELAY
        {
            urls: "turn:vani.metered.live:80", 
            username: "bcb001f9853ce7b645865e73",             
            credential: "LIPH0AaJJdT3o3sv"             
        },
        // 🚨 UPGRADE: Changed 'turn' to 'turns' to encrypt the firewall traversal
        {
            urls: "turns:vani.metered.live:443", 
            username: "bcb001f9853ce7b645865e73",             
            credential: "LIPH0AaJJdT3o3sv"  
        },
        {
            urls: "turns:vani.metered.live:443?transport=tcp", 
            username: "bcb001f9853ce7b645865e73",             
            credential: "LIPH0AaJJdT3o3sv"  
        }
    ]
};

// 1. SIGNALING EMITTER
const sendCallSignal = (type, data = {}) => {
    if (!State.channel) return;
    State.channel.send({
        type: 'broadcast',
        event: 'webrtc_signal',
        payload: { sender: State.mobile, recipient: CallState.targetMobile, type, ...data }
    });
};

// 2. TIMERS & LOGGING
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

    // ONLY THE CALLER LOGS TO THE DATABASE
    if (CallState.isCaller) {
        let logString = "[CALL_LOG:MISSED]";
        if (wasAnswered && CallState.startTime) {
            const diff = Math.floor((Date.now() - CallState.startTime) / 1000);
            logString = `[CALL_LOG:VOICE:${formatDuration(diff)}]`;
        }

        console.log(`💾 Logging Call to DB: ${logString}`);
        await supabaseClient.from("messages").insert([{
            sender_mobile: State.mobile,
            recipient_mobile: CallState.targetMobile,
            content: logString,
            is_read: false,
        }]);
    }
};

// 3. UI CONTROLLER
const setCallUI = (statusText, showAcceptBtn = false) => {
    $("active-call-matrix").classList.remove("hidden");
    $("active-call-matrix").style.display = "flex"; // 🚨 Force flex layout only when active
    $("call-status-text").textContent = statusText;
    
    // Attempt to grab name/avatar from UI or State
    $("call-target-name").textContent = $("chat-with-name")?.textContent || CallState.targetMobile;
    $("call-target-avatar").src = $("chat-target-avatar")?.src || "https://i.pinimg.com/736x/00/b6/cd/00b6cd3089a4740e521d35fc1093006a.jpg";

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
    $("active-call-matrix").style.display = "none"; // 🚨 Force hide
};

// 4. WEBRTC PIPELINE
const initWebRTC = async () => {
    try {
        console.log("🎤 Requesting Microphone Access...");
        CallState.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        
        CallState.peerConnection = new RTCPeerConnection(STUN_SERVERS);
        
        // Add Local Tracks to PC
        CallState.localStream.getTracks().forEach(track => {
            CallState.peerConnection.addTrack(track, CallState.localStream);
        });

       // Listen for Remote Tracks (Upgraded for Mobile Safari/Chrome)
        CallState.peerConnection.ontrack = (event) => {
            console.log(`🎧 Remote track received! Type: ${event.track.kind}`);
            const audioEl = $("remote-audio-stream");
            
            // 🚨 FIX: Manually construct the MediaStream. 
            // Relying on event.streams[0] often fails on mobile browsers.
            let stream = audioEl.srcObject;
            if (!stream) {
                stream = new MediaStream();
                audioEl.srcObject = stream;
            }
            stream.addTrack(event.track);
            
            // Force volume to max
            audioEl.volume = 1.0;

            audioEl.play().then(() => {
                console.log("🔊 WebRTC Audio is actively playing!");
            }).catch(e => {
                console.warn("🔇 Browser blocked playback. Audio context locked.", e);
            });
        };

        // 🚨 NEW: THE DIAGNOSTIC PROBE
        // This will tell us if your Wi-Fi/Cellular firewall is blocking the actual audio data.
        CallState.peerConnection.oniceconnectionstatechange = () => {
            const state = CallState.peerConnection.iceConnectionState;
            console.log("🌐 ICE Connection State:", state);
            
            if (state === "connected" || state === "completed") {
                // 🟢 TUNNEL OPEN! THIS IS WHEN YOU HEAR AUDIO!
                $("call-status-text").innerHTML = `<span style="color:#00ff88; font-weight:bold; letter-spacing: 4px;">🟢 UPLINK LIVE</span>`;
                $("call-target-avatar").style.borderColor = "#00ff88";
            } else if (state === "checking") {
                // 🟡 STILL PUNCHING THROUGH FIREWALL
                $("call-status-text").innerHTML = `<span style="color:#ffaa00;">Bypassing Firewalls...</span>`;
            } else if (state === "disconnected" || state === "failed") {
                alert("🛰️ Relay Connection Severed. The network firewall blocked the signal.");
                endCall(true);
            }
        };
        // ICE Candidate Handling
        CallState.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                sendCallSignal('ICE_CANDIDATE', { candidate: event.candidate });
            }
        };

    } catch (err) {
        console.error("🎤 Microphone Error:", err);
        alert("Microphone access is required to make calls in the matrix.");
        throw err;
    }
};

// 5. CALL ACTIONS
const startCall = async () => {
    if (!State.activeContact) return;
    if (CallState.isActive || CallState.isRinging) return alert("System busy. Finish current transmission.");

    console.log(`📞 Initiating Call to ${State.activeContact}...`);
    CallState.isCaller = true;
    CallState.targetMobile = State.activeContact;
    CallState.isActive = true;

    try {
        await initWebRTC();
        setCallUI("Ringing...", false);
        
        const offer = await CallState.peerConnection.createOffer();
        await CallState.peerConnection.setLocalDescription(offer);
        
        sendCallSignal('OFFER', { offer });
    } catch (err) {
        endCall(false);
    }
};

const acceptCall = async () => {
    console.log("✅ Call Accepted.");
    CallState.isActive = true;
    CallState.isRinging = false;
    
    try {
        await initWebRTC();
      // Change this line inside acceptCall():
        setCallUI("Securing Tunnel...", false);
        startCallTimer();
        
        // Use the remote description saved during the 'OFFER' event
        const answer = await CallState.peerConnection.createAnswer();
        await CallState.peerConnection.setLocalDescription(answer);
        
        sendCallSignal('ANSWER', { answer });
    } catch (err) {
        endCall(false);
    }
};

const endCall = (wasAnswered = false) => {
    console.log("🛑 Terminating Call Sequence.");
    
    // If I hang up, tell the other person
    if (CallState.isActive || CallState.isRinging) {
        sendCallSignal('HANGUP');
    }

    // Kill Media Streams
    if (CallState.localStream) {
        CallState.localStream.getTracks().forEach(track => track.stop());
    }
    if (CallState.peerConnection) {
        CallState.peerConnection.close();
    }

    stopCallTimerAndLog(wasAnswered);
    closeCallUI();

    // Reset State
    CallState.isActive = false;
    CallState.isRinging = false;
    CallState.peerConnection = null;
    CallState.localStream = null;
    CallState.targetMobile = null;
    CallState.isCaller = false;
    CallState.startTime = null;
    CallState.pendingCandidates = [];
};

// 6. SIGNAL PROCESSOR
const handleIncomingWebRTCSignal = async (data) => {
    const { sender, type } = data;

    switch (type) {
        case 'OFFER':
            // The Busy Signal
            if (CallState.isActive || CallState.isRinging) {
                console.log(`🚫 Rejecting call from ${sender} (Busy)`);
                return State.channel.send({ type: 'broadcast', event: 'webrtc_signal', payload: { sender: State.mobile, recipient: sender, type: 'BUSY' }});
            }
            
            console.log(`🔔 Incoming call from ${sender}`);
            CallState.targetMobile = sender;
            CallState.isRinging = true;
            CallState.isCaller = false;
            
            // Note: We don't initWebRTC here because of Safari/iOS autoplay restrictions. 
            // We wait for them to click "Accept". We just save the offer globally.
            CallState.pendingOffer = data.offer; 
            setCallUI("Incoming Transmission...", true);
            
            break;

      case 'ANSWER':
            console.log("🔗 Call Answered. Connecting Streams...");
            if (CallState.peerConnection) {
                await CallState.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                
                // 🚨 FIX: The Caller must also check their voicemail and inject any addresses 
                // that arrived before the Answer signal!
                if (CallState.pendingCandidates && CallState.pendingCandidates.length > 0) {
                    for (const candidate of CallState.pendingCandidates) {
                        await CallState.peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.log("ICE Inject Error:", e));
                    }
                    console.log(`🔌 Caller successfully injected ${CallState.pendingCandidates.length} saved network addresses.`);
                    CallState.pendingCandidates = []; // Clear the array
                }

                // Change this line inside case 'ANSWER':
                setCallUI("Securing Tunnel...", false); 
                startCallTimer
            }
            break;

        case 'ICE_CANDIDATE':
            if (data.candidate) {
                // If we answered and the engine is running, apply it immediately
                if (CallState.peerConnection && CallState.peerConnection.remoteDescription) {
                    try {
                        await CallState.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                    } catch (e) {
                        console.error("ICE Error:", e);
                    }
                } else {
                    // 🚨 FIX: If we are still ringing, SAVE the address in the voicemail array!
                    CallState.pendingCandidates = CallState.pendingCandidates || [];
                    CallState.pendingCandidates.push(data.candidate);
                }
            }
            break;

        case 'HANGUP':
            console.log("🔌 Remote party hung up.");
            // If they hung up and we were connected, log it as answered. If ringing, it's a miss.
            endCall(CallState.startTime !== null); 
            break;

        case 'BUSY':
            console.log("⚠️ Target is busy.");
            alert("Node is currently in another transmission.");
            endCall(false); // Logs as missed
            break;
    }
};

// 7. EVENT BINDINGS
$("start-call-btn")?.addEventListener("click", startCall);
$("decline-call-btn")?.addEventListener("click", () => endCall(CallState.startTime !== null));

// Refactored Accept Binding for iOS Audio Context Safety

$("accept-call-btn")?.addEventListener("click", async () => {
    console.log("✅ Call Accepted.");
    
    // Force the audio element to wake up immediately
    const audioEl = $("remote-audio-stream");
    if (audioEl) {
        audioEl.play().catch(e => console.log("Silently unlocking audio context..."));
    }

    CallState.isActive = true;
    CallState.isRinging = false;
    
    try {
        await initWebRTC(); // Grabs mic and boots engine
        await CallState.peerConnection.setRemoteDescription(new RTCSessionDescription(CallState.pendingOffer));
        
        // 🚨 FIX: Inject all the saved network addresses we caught while ringing!
        if (CallState.pendingCandidates && CallState.pendingCandidates.length > 0) {
            for (const candidate of CallState.pendingCandidates) {
                await CallState.peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.log("ICE Inject Error:", e));
            }
            console.log(`🔌 Successfully injected ${CallState.pendingCandidates.length} saved network addresses.`);
            CallState.pendingCandidates = []; // Clear the array
        }

        setCallUI("Connected", false);
        startCallTimer();
        
        const answer = await CallState.peerConnection.createAnswer();
        await CallState.peerConnection.setLocalDescription(answer);
        
        sendCallSignal('ANSWER', { answer });
    } catch (err) {
        endCall(false);
    }
});

// Network Guardian Binding (Uplink Severed)
window.addEventListener("offline", () => {
    if (CallState.isActive || CallState.isRinging) {
        console.warn("📡 NETWORK LOST: Force terminating active transmission.");
        endCall(CallState.startTime !== null);
    }
});

// Expose the Call button dynamically when opening a chat
const checkCallButtonVisibility = () => {
    if (State.activeContact) {
        $("start-call-btn")?.classList.remove("hidden");
    } else {
        $("start-call-btn")?.classList.add("hidden");
    }
};


// --- SYSTEM BOOT SEQUENCE ---
// ==========================================================

const bootApp = async () => {
  try {
      // 1. Load user theme preferences
      bootThemeEngine();

      // 2. Verify Supabase successfully loaded from the CDN in index.html
      if (typeof supabase === "undefined") {
          throw new Error("Supabase Database Core failed to load. Check network connection.");
      }

      // 3. Check login status and launch VANI
      await evalSession();
      
  } catch (err) {
      console.error("🔥 SYSTEM BOOT FAILURE:", err.message);
      alert(err.message);
      
      // Failsafe: hide the loader so the user isn't stuck on a blank screen
      const loader = document.getElementById("boot-loader");
      if (loader) loader.style.display = "none";
  }
};

// Fire the boot sequence immediately upon script load!
bootApp();
