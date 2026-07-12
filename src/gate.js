const HASH = "87c904917a317a0366afe3b423226d73299955c421fd5c474bf9c3ec560b5c54";

async function sha256(str) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str),
  );
  return [...new Uint8Array(buf)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

export async function checkGate(onSuccess) {
  if (sessionStorage.getItem("gate") === "ok") {
    onSuccess();
    return;
  }
  showModal(onSuccess);
}

function showModal(onSuccess) {
  const modal = document.createElement("div");
  modal.id = "gate-modal";
  modal.innerHTML = `
    <div class="gate-box">
      <button class="gate-close">✕</button>
      <p class="gate-title">archive access</p>
      <p class="gate-sub">
        works are available by invitation only.<br>
        dm me on
        <a href="https://www.instagram.com/ninhaza?igsh=emg5dXlrc3FybHlp" target="_blank">instagram</a>
        to receive the password.
      </p>
      <input
        id="gate-input"
        type="password"
        placeholder="password"
        autocomplete="off"
      />
      <button id="gate-submit">enter</button>
      <p id="gate-error"></p>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add("open"));

  modal.addEventListener("mousemove", (e) => {

    const x = (e.clientX / innerWidth) * 100;
    const y = (e.clientY / innerHeight) * 100;
    modal.style.setProperty("--gx", x + "%");
    modal.style.setProperty("--gy", y + "%");
  });

  modal.querySelector(".gate-close").addEventListener("click", removeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) removeModal();
  });

  modal.querySelector("#gate-submit").addEventListener("click", tryPassword);
  modal.querySelector("#gate-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryPassword();
  });

  async function tryPassword() {
    const val = modal.querySelector("#gate-input").value;
    const h = await sha256(val);
    if (h === HASH) {
      sessionStorage.setItem("gate", "ok");
      removeModal();
      onSuccess();
    } else {
      const err = modal.querySelector("#gate-error");
      err.textContent = "wrong password";
      modal.querySelector("#gate-input").value = "";
    }
  }

  function removeModal() {
    modal.classList.add("closing");
    setTimeout(() => modal.remove(), 500);
  }
}
