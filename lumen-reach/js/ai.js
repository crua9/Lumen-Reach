/* ============================================================
   AI — who voices the townspeople
   Provider chain:
     1. "claude"  — running inside Claude (artifact "sample" capability)
     2. "custom"  — a model endpoint the player configured in
                    Journal → Settings (OpenAI-compatible or Anthropic)
     3. "none"    — short built-in replies (see fallbackReply in ui.js)
   Every call gets a list of turns [{role:"user"|"assistant", content}]
   that starts and ends with a user turn. To plug in another AI,
   add a branch to send() below.
   ============================================================ */
const AI = (() => {
  let sample = null, provider = "pending";
  const CFG_KEY = "lumen-ai";
  function config() { try { return JSON.parse(localStorage.getItem(CFG_KEY) || "null"); } catch (e) { return null; } }
  function setConfig(c) { try { if (c) localStorage.setItem(CFG_KEY, JSON.stringify(c)); else localStorage.removeItem(CFG_KEY); } catch (e) { } pickProvider(); }
  function pickProvider() { const c = config(); provider = sample ? "claude" : c && c.endpoint && c.model ? "custom" : "none"; }
  async function init() {
    if (window.claude && window.claude.use) { try { sample = await window.claude.use("sample"); } catch (e) { sample = null; } }
    pickProvider();
  }
  function parseJSON(text) {
    try { return JSON.parse(text); } catch (e) { }
    const a = text.indexOf("{"), b = text.lastIndexOf("}");
    if (a >= 0 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch (e) { } }
    return null;
  }
  async function send(turns, opts = {}) {
    if (provider === "claude") {
      const o = { modelTier: opts.deep ? "default" : "quick", cache: false, signal: opts.signal };
      try { return opts.json ? await sample.json(turns, o) : (await sample(turns, o)).text.trim(); }
      catch (e) { if (e && ["not_granted", "sampling_disabled", "not_declared"].includes(e.code)) { sample = null; pickProvider(); } throw e; }
    }
    if (provider === "custom") {
      const c = config(); let text = "";
      if (c.format === "anthropic") {
        const r = await fetch(c.endpoint, { method: "POST", signal: opts.signal, headers: { "content-type": "application/json", "x-api-key": c.key || "", "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
          body: JSON.stringify({ model: c.model, max_tokens: 700, messages: turns }) });
        if (!r.ok) throw { code: "upstream_error", message: "HTTP " + r.status };
        const d = await r.json(); text = (d.content || []).map(x => x.text || "").join("");
      } else {
        const r = await fetch(c.endpoint, { method: "POST", signal: opts.signal, headers: Object.assign({ "content-type": "application/json" }, c.key ? { authorization: "Bearer " + c.key } : {}),
          body: JSON.stringify({ model: c.model, messages: turns, temperature: .8 }) });
        if (!r.ok) throw { code: "upstream_error", message: "HTTP " + r.status };
        const d = await r.json(); text = d.choices && d.choices[0] && d.choices[0].message ? d.choices[0].message.content : "";
      }
      if (!opts.json) return text.trim();
      const j = parseJSON(text); if (!j) throw { code: "invalid_json", text }; return j;
    }
    throw { code: "unavailable" };
  }
  return { init, send, config, setConfig, get provider() { return provider; } };
})();
