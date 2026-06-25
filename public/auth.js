(function exposeAuth(root, factory) {
  root.Top1Auth = factory();
}(typeof globalThis !== "undefined" ? globalThis : this, function createAuth() {
  const storageKey = "top1groupSession";
  const aliasEmails = {
    isaac: "isaac@top1group.com",
    demo: "demo@top1group.com"
  };

  function accountEmail(accountId) {
    const normalized = String(accountId || "").trim().toLowerCase();
    return aliasEmails[normalized] || (normalized.includes("@") ? normalized : "");
  }

  class AuthManager {
    constructor(onAuthenticated) {
      this.onAuthenticated = onAuthenticated;
      this.config = null;
      this.session = null;
      this.mode = "signin";
    }

    async init() {
      this.bind();
      try {
        const response = await fetch("/api/config", { cache: "no-store" });
        if (!response.ok) throw new Error("Config unavailable");
        this.config = await response.json();
      } catch {
        this.config = { supabaseUrl: "", supabaseKey: "", authEnabled: false };
      }

      if (new URLSearchParams(location.search).has("auth-preview")) {
        this.showAuth();
        return;
      }

      if (!this.config.authEnabled) {
        document.body.classList.remove("auth-locked");
        document.querySelector("#authGate").hidden = true;
        document.querySelector("#appShell").hidden = false;
        await this.onAuthenticated();
        return;
      }

      this.session = this.readSession();
      if (this.session && await this.verifySession()) {
        await this.enterApp();
        return;
      }
      this.clearSession();
      this.showAuth();
    }

    bind() {
      const form = document.querySelector("#authForm");
      const modeButton = document.querySelector("#authModeButton");
      const demoButton = document.querySelector("#demoAccessButton");

      form.addEventListener("submit", event => {
        event.preventDefault();
        this.submit(new FormData(form));
      });
      modeButton.addEventListener("click", () => {
        this.mode = this.mode === "signin" ? "register" : "signin";
        this.renderMode();
      });
      demoButton.addEventListener("click", () => {
        this.mode = "signin";
        this.renderMode();
        form.elements.account.value = "demo";
        form.elements.password.focus();
      });
      document.querySelectorAll("[data-language]").forEach(button => {
        button.addEventListener("click", () => {
          localStorage.setItem("top1groupLanguage", button.dataset.language);
          this.applyLanguage();
          window.dispatchEvent(new CustomEvent("top1-language-change", {
            detail: { language: button.dataset.language }
          }));
        });
      });
    }

    renderMode() {
      const translate = Top1UI.createTranslator(this.language());
      const registering = this.mode === "register";
      document.querySelector("#registrationFields").hidden = !registering;
      document.querySelector("#accountField").hidden = registering;
      document.querySelector("#authForm").elements.account.required = !registering;
      document.querySelector("#authSubmit").textContent = translate(registering ? "Create Driver Account" : "Enter Driver OS");
      document.querySelector("#authModeButton").textContent = translate(registering ? "Back to Sign In" : "Create Driver Account");
      document.querySelector("#authIntro").textContent = registering
        ? translate("Create your own private Driver workspace.")
        : translate("Your time, income and daily execution in one private operating system.");
      this.setMessage("");
      this.applyLanguage();
    }

    async submit(formData) {
      const submit = document.querySelector("#authSubmit");
      submit.disabled = true;
      this.setMessage(this.mode === "register" ? "Creating your workspace..." : "Verifying secure access...", "loading");

      try {
        if (this.mode === "register") {
          await this.signUp({
            email: formData.get("email"),
            password: formData.get("password"),
            displayName: formData.get("displayName")
          });
          this.mode = "signin";
          this.renderMode();
          document.querySelector("#authForm").elements.account.value = formData.get("email");
          this.setMessage("Account created. Check your email if confirmation is required.", "success");
        } else {
          await this.signIn(formData.get("account"), formData.get("password"));
          await this.enterApp();
        }
      } catch (error) {
        this.setMessage(error.message || "Unable to sign in.", "error");
      } finally {
        submit.disabled = false;
      }
    }

    async signIn(account, password) {
      const email = accountEmail(account);
      if (!email) throw new Error("Use isaac, demo, or your registered email.");
      const response = await fetch(`${this.config.supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          apikey: this.config.supabaseKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });
      const body = await response.json();
      if (!response.ok) throw new Error("Account ID or password is incorrect.");
      this.session = {
        ...body,
        expires_at: Math.floor(Date.now() / 1000) + Number(body.expires_in || 3600)
      };
      localStorage.setItem(storageKey, JSON.stringify(this.session));
    }

    async signUp({ email, password, displayName }) {
      if (!String(email || "").includes("@")) throw new Error("Enter a valid email address.");
      const response = await fetch(`${this.config.supabaseUrl}/auth/v1/signup`, {
        method: "POST",
        headers: {
          apikey: this.config.supabaseKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: String(email).trim().toLowerCase(),
          password,
          data: {
            display_name: String(displayName || "").trim(),
            account_type: "driver"
          }
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.msg || "Unable to create account.");
      if (body.access_token) {
        this.session = {
          ...body,
          expires_at: Math.floor(Date.now() / 1000) + Number(body.expires_in || 3600)
        };
        localStorage.setItem(storageKey, JSON.stringify(this.session));
        await this.enterApp();
      }
    }

    async verifySession() {
      if (!this.session?.access_token) return false;
      if (Number(this.session.expires_at || 0) <= Math.floor(Date.now() / 1000) + 30) {
        return this.refreshSession();
      }
      const response = await fetch(`${this.config.supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: this.config.supabaseKey,
          Authorization: `Bearer ${this.session.access_token}`
        }
      });
      return response.ok;
    }

    async refreshSession() {
      if (!this.session?.refresh_token) return false;
      const response = await fetch(`${this.config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: {
          apikey: this.config.supabaseKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ refresh_token: this.session.refresh_token })
      });
      if (!response.ok) return false;
      const body = await response.json();
      this.session = {
        ...body,
        expires_at: Math.floor(Date.now() / 1000) + Number(body.expires_in || 3600)
      };
      localStorage.setItem(storageKey, JSON.stringify(this.session));
      return true;
    }

    authHeaders() {
      return this.session?.access_token
        ? { Authorization: `Bearer ${this.session.access_token}` }
        : {};
    }

    async enterApp() {
      document.body.classList.remove("auth-locked");
      document.querySelector("#authGate").hidden = true;
      document.querySelector("#appShell").hidden = false;
      const label = this.session?.user?.user_metadata?.display_name
        || this.session?.user?.email?.split("@")[0]
        || "Local";
      document.querySelector("#accountLabel").textContent = label;
      document.body.dataset.accountType = this.accountType();
      this.applyLanguage();
      await this.onAuthenticated();
    }

    showAuth() {
      document.body.classList.add("auth-locked");
      document.querySelector("#authGate").hidden = false;
      document.querySelector("#appShell").hidden = true;
      this.applyLanguage();
    }

    async signOut() {
      if (this.session?.access_token) {
        await fetch(`${this.config.supabaseUrl}/auth/v1/logout`, {
          method: "POST",
          headers: {
            apikey: this.config.supabaseKey,
            Authorization: `Bearer ${this.session.access_token}`
          }
        }).catch(() => {});
      }
      this.clearSession();
      location.reload();
    }

    readSession() {
      try {
        return JSON.parse(localStorage.getItem(storageKey) || "null");
      } catch {
        return null;
      }
    }

    clearSession() {
      this.session = null;
      localStorage.removeItem(storageKey);
    }

    setMessage(message, tone = "") {
      const node = document.querySelector("#authMessage");
      node.textContent = Top1UI.createTranslator(this.language())(message);
      node.dataset.tone = tone;
    }

    language() {
      return Top1UI.normalizeLanguage(localStorage.getItem("top1groupLanguage") || "en");
    }

    accountType() {
      return this.session?.user?.app_metadata?.account_type
        || this.session?.user?.user_metadata?.account_type
        || "driver";
    }

    applyLanguage() {
      const language = this.language();
      document.querySelectorAll("[data-language]").forEach(button => {
        button.classList.toggle("active", button.dataset.language === language);
      });
      Top1UI.applyTranslations(document.body, language);
    }
  }

  return { AuthManager, accountEmail };
}));
