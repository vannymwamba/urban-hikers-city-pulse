import { useState, useRef, useCallback } from "react";

const ACCENT = "#FFE01A";
const BG = "#0A0A0A";
const SURFACE = "#111";
const BORDER = "#1e1e1e";
const MUTED = "#555";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0A0A0A; }
  ::-webkit-scrollbar { display: none; }
  input, textarea, select {
    font-family: 'Space Mono', monospace;
    background: #111;
    border: 1px solid #222;
    color: #fff;
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 12px;
    width: 100%;
    outline: none;
    transition: border-color 0.2s;
  }
  input:focus, textarea:focus, select:focus {
    border-color: #FFE01A;
  }
  input::placeholder, textarea::placeholder { color: #444; }
  select option { background: #111; color: #fff; }
  button { cursor: pointer; font-family: 'Space Mono', monospace; }
  @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.3} }
  @keyframes slide-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin { to { transform: rotate(360deg) } }
`;

const HUBS = ["otr", "downtown", "northside", "mt-adams", "findlay-market", "evanston"];
const LABELS = ["Guest Guide", "Partner Venue", "Sponsor", "Community Partner", "Official Partner"];

function LogoPreview({ logoFile, initials, accentColor }) {
  const [preview, setPreview] = useState(null);
  const reader = useRef(null);

  if (logoFile && !preview) {
    reader.current = new FileReader();
    reader.current.onload = (e) => setPreview(e.target.result);
    reader.current.readAsDataURL(logoFile);
  }
  if (!logoFile && preview) setPreview(null);

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      {/* Strip preview */}
      <div style={{
        background: "#0d0d0d",
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        padding: "8px 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        flex: 1,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: SURFACE, border: `1px solid #2a2a2a`,
          borderRadius: 5, padding: "3px 8px",
        }}>
          {preview ? (
            <img src={preview} alt="logo" style={{ width: 20, height: 20, borderRadius: 3, objectFit: "cover" }} />
          ) : (
            <div style={{
              width: 20, height: 20, borderRadius: 3,
              background: accentColor || "#C8A800",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 7, fontWeight: 700, color: "#0A0A0A", letterSpacing: 0.5,
            }}>
              {(initials || "??").slice(0, 3)}
            </div>
          )}
          <span style={{ fontSize: 9, color: "#aaa", letterSpacing: 0.5, whiteSpace: "nowrap" }}>
            {initials ? `${initials} Hotel` : "Partner Name"}
          </span>
        </div>
        <span style={{ flex: 1, fontSize: 7, color: "#333", letterSpacing: 1.5, textTransform: "uppercase" }}>
          GUEST GUIDE
        </span>
        <span style={{ fontSize: 8, color: ACCENT }}>OTR HUB ↗</span>
      </div>
      <div style={{ fontSize: 8, color: MUTED, letterSpacing: 1, textTransform: "uppercase" }}>
        Live preview
      </div>
    </div>
  );
}

function DropZone({ onFile, currentFile }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) onFile(file);
  }, [onFile]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `1.5px dashed ${dragging ? ACCENT : currentFile ? "#333" : "#222"}`,
        borderRadius: 8,
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        background: dragging ? "#111500" : "transparent",
        transition: "all 0.2s",
      }}
    >
      <input
        // @ts-ignore
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        style={{ display: "none" }}
        onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); }}
      />
      {currentFile ? (
        <>
          <div style={{ fontSize: 20 }}>✓</div>
          <div style={{ fontSize: 11, color: "#aaa", fontFamily: "'Space Mono', monospace" }}>
            {currentFile.name}
          </div>
          <div style={{ fontSize: 9, color: MUTED }}>Click to replace</div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 24, opacity: 0.4 }}>⊕</div>
          <div style={{ fontSize: 11, color: MUTED, fontFamily: "'Space Mono', monospace", textAlign: "center" }}>
            Drop logo here or click to upload
          </div>
          <div style={{ fontSize: 9, color: "#333" }}>PNG · SVG · JPG · WEBP · Max 2MB</div>
        </>
      )}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
        <label style={{ fontSize: 9, color: ACCENT, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'Space Mono', monospace" }}>
          {label}
        </label>
        {hint && <span style={{ fontSize: 9, color: MUTED }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        fontSize: 8, color: "#333", letterSpacing: 2.5,
        textTransform: "uppercase", marginBottom: 16,
        paddingBottom: 8, borderBottom: `1px solid #161616`,
        fontFamily: "'Space Mono', monospace",
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export default function PartnerOnboarding() {
  const [form, setForm] = useState({
    id: "",
    name: "",
    short_name: "",
    logo_initials: "",
    accent_color: "#C8A800",
    hub_id: "otr",
    label: "Guest Guide",
    active: true,
  });
  const [logoFile, setLogoFile] = useState(null);
  const [step, setStep] = useState("form"); // form | generating | done
  const [copyDone, setCopyDone] = useState(false);

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const autoId = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleNameChange = (val) => {
    update("name", val);
    if (!form.id || form.id === autoId(form.name)) update("id", autoId(val));
    if (!form.short_name) update("short_name", val.split(" ").slice(0, 2).join(" "));
    if (!form.logo_initials) update("logo_initials", val.split(" ").map(w => w[0]).join("").slice(0, 3).toUpperCase());
  };

  const nfcUrl = `https://app.localpulses.com?partner=${form.id}&hub=${form.hub_id}`;
  const firestoreDoc = JSON.stringify({
    name: form.name,
    short_name: form.short_name,
    logo_url: logoFile ? `[upload to Storage: partners/${form.id}/logo]` : null,
    logo_initials: form.logo_initials,
    accent_color: form.accent_color,
    hub_id: form.hub_id,
    label: form.label,
    active: form.active,
  }, null, 2);

  const handleGenerate = () => {
    setStep("generating");
    setTimeout(() => setStep("done"), 1800);
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  };

  const isValid = form.id && form.name && form.hub_id && form.label;

  return (
    <>
      <style>{css}</style>
      <div style={{
        minHeight: "100vh",
        background: BG,
        fontFamily: "'Space Mono', monospace",
        color: "#fff",
        padding: "0 0 60px",
      }}>

        {/* Header */}
        <div style={{
          borderBottom: `1px solid ${BORDER}`,
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          background: BG,
          zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              background: ACCENT, color: BG, fontWeight: 700,
              fontSize: 10, padding: "4px 8px", borderRadius: 4, letterSpacing: 1,
            }}>
              PULSE OS
            </div>
            <span style={{ fontSize: 10, color: MUTED, letterSpacing: 1 }}>
              Partner Onboarding
            </span>
          </div>
          <div style={{
            fontSize: 8, color: "#333", letterSpacing: 1.5,
            textTransform: "uppercase",
          }}>
            Admin Only
          </div>
        </div>

        <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 24px" }}>

          {step === "form" && (
            <div style={{ animation: "slide-in 0.3s ease" }}>

              {/* Live preview strip */}
              <div style={{ marginBottom: 32 }}>
                <LogoPreview
                  logoFile={logoFile}
                  initials={form.logo_initials || form.short_name}
                  accentColor={form.accent_color}
                />
              </div>

              {/* IDENTITY */}
              <Section title="01 — Partner Identity">
                <Field label="Hotel / Venue Full Name" hint="Required">
                  <input
                    value={form.name}
                    onChange={e => handleNameChange(e.target.value)}
                    placeholder="21c Museum Hotel Cincinnati"
                  />
                </Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Short Name" hint="Shown in strip">
                    <input
                      value={form.short_name}
                      onChange={e => update("short_name", e.target.value)}
                      placeholder="21c Hotel"
                    />
                  </Field>
                  <Field label="Partner ID" hint="URL slug">
                    <input
                      value={form.id}
                      onChange={e => update("id", autoId(e.target.value))}
                      placeholder="21c-museum-hotel"
                      style={{ fontFamily: "monospace", fontSize: 11 }}
                    />
                  </Field>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Initials Fallback" hint="Max 3 chars">
                    <input
                      value={form.logo_initials}
                      onChange={e => update("logo_initials", e.target.value.toUpperCase().slice(0, 3))}
                      placeholder="21C"
                      maxLength={3}
                    />
                  </Field>
                  <Field label="Accent Color" hint="Hex">
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="color"
                        value={form.accent_color}
                        onChange={e => update("accent_color", e.target.value)}
                        style={{ width: 44, height: 36, padding: 2, cursor: "pointer", flex: "none" }}
                      />
                      <input
                        value={form.accent_color}
                        onChange={e => update("accent_color", e.target.value)}
                        placeholder="#C8A800"
                        style={{ flex: 1 }}
                      />
                    </div>
                  </Field>
                </div>
              </Section>

              {/* LOGO UPLOAD */}
              <Section title="02 — Logo Upload">
                <div style={{ marginBottom: 12 }}>
                  <DropZone onFile={setLogoFile} currentFile={logoFile} />
                </div>
                <div style={{ fontSize: 9, color: MUTED, lineHeight: 1.6 }}>
                  If no logo is uploaded, the initials block above will display in the co-brand strip.
                  SVG preferred for crispness. Square or horizontal format works best.
                </div>
              </Section>

              {/* PLACEMENT */}
              <Section title="03 — Placement">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Hub" hint="Which node">
                    <select value={form.hub_id} onChange={e => update("hub_id", e.target.value)}>
                      {HUBS.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Strip Label" hint="Guest-facing">
                    <select value={form.label} onChange={e => update("label", e.target.value)}>
                      {LABELS.map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Active">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      onClick={() => update("active", !form.active)}
                      style={{
                        width: 40, height: 22, borderRadius: 11,
                        background: form.active ? ACCENT : "#222",
                        position: "relative", cursor: "pointer",
                        transition: "background 0.2s",
                        border: `1px solid ${form.active ? ACCENT : "#333"}`,
                      }}
                    >
                      <div style={{
                        position: "absolute",
                        width: 16, height: 16, borderRadius: 8,
                        background: form.active ? "#0A0A0A" : "#555",
                        top: 2, left: form.active ? 20 : 2,
                        transition: "left 0.2s",
                      }} />
                    </div>
                    <span style={{ fontSize: 10, color: form.active ? "#aaa" : MUTED }}>
                      {form.active ? "Partner will appear in app" : "Draft — not visible"}
                    </span>
                  </div>
                </Field>
              </Section>

              {/* NFC URL PREVIEW */}
              <Section title="04 — NFC Tap URL">
                <div style={{
                  background: "#080808", border: `1px solid ${BORDER}`,
                  borderRadius: 6, padding: "10px 12px",
                  fontSize: 10, color: ACCENT, wordBreak: "break-all",
                  lineHeight: 1.6, letterSpacing: 0.3,
                }}>
                  {form.id ? nfcUrl : "https://app.localpulses.com?partner=[id]&hub=[hub]"}
                </div>
                <div style={{ fontSize: 9, color: MUTED, marginTop: 8 }}>
                  Program this URL into the Pulse Cube NFC tag for this partner property.
                </div>
              </Section>

              {/* SUBMIT */}
              <button
                onClick={handleGenerate}
                disabled={!isValid}
                style={{
                  width: "100%",
                  background: isValid ? ACCENT : "#151515",
                  color: isValid ? "#0A0A0A" : "#333",
                  border: "none",
                  borderRadius: 8,
                  padding: "14px 0",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  transition: "all 0.2s",
                  marginTop: 8,
                }}
              >
                Generate Partner Config →
              </button>
            </div>
          )}

          {step === "generating" && (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", minHeight: 300, gap: 20,
              animation: "slide-in 0.3s ease",
            }}>
              <div style={{
                width: 32, height: 32, border: `2px solid #222`,
                borderTop: `2px solid ${ACCENT}`, borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }} />
              <div style={{ fontSize: 10, color: MUTED, letterSpacing: 1.5 }}>
                Generating config...
              </div>
            </div>
          )}

          {step === "done" && (
            <div style={{ animation: "slide-in 0.3s ease" }}>

              {/* Success header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                marginBottom: 32, padding: "12px 16px",
                background: "#0a1100", border: `1px solid #1a2e00`,
                borderRadius: 8,
              }}>
                <div style={{ color: "#00cc66", fontSize: 18 }}>✓</div>
                <div>
                  <div style={{ fontSize: 11, color: "#aaa", marginBottom: 2 }}>
                    {form.name} ready to deploy
                  </div>
                  <div style={{ fontSize: 9, color: MUTED }}>
                    Complete steps below to go live
                  </div>
                </div>
              </div>

              {/* Step 1 — Firestore */}
              <Section title="Step 1 — Add to Firestore">
                <div style={{ fontSize: 9, color: MUTED, marginBottom: 10, lineHeight: 1.6 }}>
                  Create this document at{" "}
                  <code style={{ color: ACCENT, fontSize: 9 }}>
                    /partners/{form.id}
                  </code>
                </div>
                <div style={{
                  background: "#080808", border: `1px solid ${BORDER}`,
                  borderRadius: 6, padding: 14, position: "relative",
                }}>
                  <pre style={{
                    fontSize: 10, color: "#aaa", lineHeight: 1.7,
                    overflow: "auto", whiteSpace: "pre-wrap",
                  }}>
                    {firestoreDoc}
                  </pre>
                  <button
                    onClick={() => copyText(firestoreDoc)}
                    style={{
                      position: "absolute", top: 10, right: 10,
                      background: copyDone ? "#0a1100" : "#151515",
                      border: `1px solid ${copyDone ? "#1a2e00" : "#222"}`,
                      color: copyDone ? "#00cc66" : MUTED,
                      borderRadius: 4, padding: "4px 10px",
                      fontSize: 8, letterSpacing: 1,
                    }}
                  >
                    {copyDone ? "COPIED" : "COPY"}
                  </button>
                </div>
              </Section>

              {/* Step 2 — Logo upload */}
              {logoFile && (
                <Section title="Step 2 — Upload Logo to Storage">
                  <div style={{ fontSize: 9, color: MUTED, lineHeight: 1.7 }}>
                    Upload{" "}
                    <code style={{ color: ACCENT, fontSize: 9 }}>{logoFile.name}</code>
                    {" "}to Firebase Storage at:
                  </div>
                  <div style={{
                    background: "#080808", border: `1px solid ${BORDER}`,
                    borderRadius: 6, padding: "10px 12px", marginTop: 10,
                    fontSize: 10, color: ACCENT, wordBreak: "break-all",
                  }}>
                    {`partners/${form.id}/logo`}
                  </div>
                  <div style={{ fontSize: 9, color: MUTED, marginTop: 8, lineHeight: 1.6 }}>
                    Then update the Firestore doc: set{" "}
                    <code style={{ color: "#aaa", fontSize: 9 }}>logo_url</code>
                    {" "}to the public download URL.
                  </div>
                </Section>
              )}

              {/* Step 3 — NFC */}
              <Section title={`Step ${logoFile ? "3" : "2"} — Program NFC Tag`}>
                <div style={{ fontSize: 9, color: MUTED, marginBottom: 10 }}>
                  Program this URL into the Pulse Cube for {form.short_name}:
                </div>
                <div style={{
                  background: "#080808", border: `1px solid ${BORDER}`,
                  borderRadius: 6, padding: "12px 14px",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                }}>
                  <span style={{ fontSize: 10, color: ACCENT, wordBreak: "break-all", flex: 1 }}>
                    {nfcUrl}
                  </span>
                  <button
                    onClick={() => copyText(nfcUrl)}
                    style={{
                      background: "#151515", border: `1px solid #222`,
                      color: MUTED, borderRadius: 4, padding: "5px 10px",
                      fontSize: 8, letterSpacing: 1, flexShrink: 0,
                    }}
                  >
                    COPY
                  </button>
                </div>
              </Section>

              {/* Back */}
              <button
                onClick={() => { setStep("form"); setLogoFile(null); }}
                style={{
                  width: "100%",
                  background: "transparent",
                  color: MUTED,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  padding: "12px 0",
                  fontSize: 10,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  marginTop: 8,
                }}
              >
                ← Add Another Partner
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
