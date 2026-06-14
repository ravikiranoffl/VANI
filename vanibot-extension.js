// ==========================================================
// 🧩 MODULAR EXTENSION: VANIBOT TYPING SIMULATOR
// ==========================================================
// If you delete this file, the app ignores it and the bot still works.

document.addEventListener("DOMContentLoaded", () => {
  // Wait for Supabase to boot
  setTimeout(() => {
    if (typeof supabaseClient === "undefined" || !State || !State.mobile)
      return;

    console.log("🧩 VaniBot UI Extension Armed.");

    // Listen for new messages specifically from the Bot
    supabaseClient
      .channel("vanibot-ui-extension")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `sender_mobile=eq.0000000000`,
        },
        (payload) => {
          const msg = payload.new;

          // Only intervene if we are actively looking at the bot's chat
          if (State.activeContact === "0000000000") {
            // Show "Typing..."
            if (typeof showTypingIndicator === "function")
              showTypingIndicator();

            // Fake a human delay before rendering the message that already arrived
            setTimeout(
              () => {
                if (typeof hideTypingIndicator === "function")
                  hideTypingIndicator();
                if (typeof loadChat === "function")
                  loadChat(State.activeContact);
              },
              1500 + Math.random() * 1000,
            );
          }
        },
      )
      .subscribe();
  }, 4000);
});
