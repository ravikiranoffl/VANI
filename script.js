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

const syncContacts = async () => {
  const [{ data: c }, { data: p }, { data: m }] = await Promise.all([
    supabaseClient.from("contacts").select("*").eq("mobile", State.mobile),
    supabaseClient.from("profiles").select("mobile, avatar_url, name"),
    supabaseClient.from("messages").select("sender_mobile, recipient_mobile, is_read, created_at").or(`sender_mobile.eq.${State.mobile},recipient_mobile.eq.${State.mobile}`),
  ]);

  const regMap = Object.fromEntries(p?.map((x) => [x.mobile, x]) || []);
  const latestMsgMap = {}; 

  m?.forEach((msg) => {
    const otherParty = msg.sender_mobile === State.mobile ? msg.recipient_mobile : msg.sender_mobile;
    const msgTime = new Date(msg.created_at).getTime();
    if (!latestMsgMap[otherParty] || msgTime > latestMsgMap[otherParty]) {
      latestMsgMap[otherParty] = msgTime; 
    }
  });

  const finalContacts = [...(c || [])];
  // Sorting Engine: Reorder array based on the latest message timestamp[cite: 2]
  finalContacts.sort((a, b) => (latestMsgMap[b.contact] || 0) - (latestMsgMap[a.contact] || 0));

  renderContacts(finalContacts, regMap, {});
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
// ==========================================================
// CHAT ENGINE REPLACEMENTS (script.js)
// ==========================================================

// ==========================================================
// CHAT ENGINE REPLACEMENTS (script.js)
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
    // THIS IS THE TRIGGER: Locks the body and launches Full Screen Mode
    document.body.classList.add("in-mobile-chat"); 
    $("sidebarMenu")?.classList.remove("open");
    $("hamburgerBtn")?.classList.remove("active");
  }

  $("chat-box").innerHTML = "";
  loadHistory();

  updatePresenceUI(); // 🚨 NEW: Instantly color the header when chat opens

  supabaseClient.from("messages").update({ is_read: true }).match({
    sender_mobile: mobile,
    recipient_mobile: State.mobile,
    is_read: false,
  }).then(() => syncContacts());
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

  // 🛡️ THE DUPLICATE SHIELD
  if (msg.id && box.querySelector(`[data-msg-id="${msg.id}"]`)) return;

  const msgDate = new Date(msg.created_at);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  // 1. DYNAMIC DATE LABEL LOGIC
  const getLabel = (d) => {
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  };

  const currentLabel = getLabel(msgDate);
  const lastLabel = box.dataset.lastLabel;

  // 2. Inject Date Divider if the boundary has shifted
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

  // 3. Render Message Bubble
  const isMe = msg.sender_mobile === State.mobile;
  box.insertAdjacentHTML(
    "beforeend",
    /* 🚨 ADDED data-is-me below */
    `<div class="message-enter" data-msg-id="${msg.id}" data-is-me="${isMe}" style="display:flex;width:100%;justify-content:${isMe ? "flex-end" : "flex-start"};margin-bottom:12px;">
       <div class="chat-bubble" style="max-width:75%;background:${isMe ? "rgba(var(--neon-rgb), 0.1)" : "rgba(255,255,255,0.03)"};
                                      border:1px solid ${isMe ? "var(--neon-primary)" : "var(--glass-border)"};
                                      border-radius:${isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px"};
                                      backdrop-filter:blur(10px);padding:10px 14px; cursor: pointer;">
         <div class="chat-bubble-content">${sanitize(msg.content)}</div>
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
const initRealtime = () => {
    // 1. Verify State before we even try to connect
    if (!State || !State.mobile) {
        console.error("❌ REALTIME ABORTED: State.mobile is missing. You must log in first!");
        return;
    }

    console.log(`🔌 Initializing Realtime for User: ${State.mobile}`);

    // 2. Clean up any old ghost subscriptions safely
    if (State.channel) {
        supabaseClient.removeChannel(State.channel);
        State.channel = null;
    }

    // 3. Boot the Realtime Socket
    State.channel = supabaseClient
        .channel("vani-realtime-channel")
        
        // 🟢 LISTEN FOR NEW MESSAGES (INSERT)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (p) => {
            const msg = p.new;
            
            console.log("-----------------------------------------");
            console.log("📥 NEW MESSAGE DETECTED IN DATABASE!");
            console.log("Payload:", msg);
            console.log("Current App State -> My Mobile:", State.mobile, "| Looking at Contact:", State.activeContact);
            
            if (!msg?.sender_mobile) {
                console.warn("⚠️ Invalid message payload received.");
                return;
            }

            // Using Loose Equality (==) to prevent String/Number mismatches
            const isCurrentlyViewingChat = (msg.sender_mobile == State.activeContact && msg.recipient_mobile == State.mobile);
            const isMyOwnMessage = (msg.sender_mobile == State.mobile && msg.recipient_mobile == State.activeContact);
            const isForMeButImElsewhere = (msg.recipient_mobile == State.mobile && msg.sender_mobile != State.activeContact);

            if (isCurrentlyViewingChat) {
                console.log("✅ SCENARIO A: You are viewing this chat. Appending bubble and playing receive ping.");
                playSound("receive");
                await supabaseClient.from("messages").update({ is_read: true }).eq("id", msg.id);
                appendBubble(msg, true);
                await refreshContactsUI(); // Force sidebar update
            } 
            else if (isMyOwnMessage) {
                console.log("✅ SCENARIO B: You sent this from another device. Appending bubble.");
                appendBubble(msg, true);
                await refreshContactsUI();
            } 
            else if (isForMeButImElsewhere) {
                console.log("✅ SCENARIO C: Message is for you, but you are looking at another screen. Playing ping.");
                playSound("receive");
                await refreshContactsUI();
            } 
            else {
                console.log("🛑 SCENARIO D: Message is completely unrelated to your current view. Ignoring.");
            }
            console.log("-----------------------------------------");
        })

        // 💬 LISTEN FOR TYPING BROADCASTS (NO DATABASE NEEDED)
        .on("broadcast", { event: "typing" }, (payload) => {
            const data = payload.payload;
            // If they are typing to ME, and I am currently looking at THEM
            if (data.recipient == State.mobile && data.sender == State.activeContact) {
                showTypingIndicator();
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
                refreshContactsUI();
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
const initPresence = () => {
    if (!State.mobile) return;

    if (State.presenceChannel) {
        supabaseClient.removeChannel(State.presenceChannel);
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
            updatePresenceUI();
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
            console.log("🔄 VANI Waking up... Marking as ONLINE.");
            
            // 🚨 MARK AS ONLINE
            if (State.presenceChannel) {
                await State.presenceChannel.track({ mobile: State.mobile });
            } else {
                initPresence();
            }

            await syncContacts(); 
            if (State.activeContact) await loadHistory();
            if (typeof initRealtime === "function") initRealtime(); 
        }
    } else {
        console.log("💤 VANI Tab hidden... Marking as OFFLINE.");
        
        // 🚨 MARK AS OFFLINE (Instantly drops the green dot for everyone else)
        if (State && State.presenceChannel) {
            await State.presenceChannel.untrack();
        }
    }
});

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
