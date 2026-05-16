import { useState } from "react";
import { DIMENSIONS as SEED_DIMENSIONS } from "../data/seed/dimensions";
import "./invoices-ledger.css";
import "./settings-pages.css";

// Tag colour palette — keys from the seed (cls) map to a {dot, chipBg, chipFg} triple.
const PALETTE = {
  dept:   { dot: "#1A46C8", bg: "#EBF0FD", fg: "#1338A8" },
  loc:    { dot: "#0F6E56", bg: "#E1F5EE", fg: "#0F6E56" },
  proj:   { dot: "#7A4D00", bg: "#FDF3E0", fg: "#7A4D00" },
  chan:   { dot: "#534AB7", bg: "#EEEDFE", fg: "#3C3489" },
  cc:     { dot: "#A02020", bg: "#FBF0F0", fg: "#A02020" },
  pline:  { dot: "#B83D08", bg: "#FCEFE7", fg: "#B83D08" },
  cseg:   { dot: "#1A7A6A", bg: "#E0F2EE", fg: "#1A7A6A" },
  shift:  { dot: "#6B35A0", bg: "#EFE7F7", fg: "#6B35A0" },
  ic:     { dot: "#993556", bg: "#FBEAF0", fg: "#993556" },
  taxreg: { dot: "#2E6F8F", bg: "#E3EEF5", fg: "#2E6F8F" },
  _new:   { dot: "#8C857C", bg: "#F4F0EB", fg: "#2E2B27" },
};

function paletteFor(cls) {
  return PALETTE[cls] || PALETTE._new;
}

// AI recommendations — surfaced above the table. Each can be Confirmed
// (moves into the configured-dimensions table) or Dismissed (drops it).
const INITIAL_RECOMMENDATIONS = [
  {
    id: "rec-supplier-cat",
    name: "Supplier Category",
    cls: "_new",
    reason: "Klay detected expense entries hinting at supplier categorisation in the memos.",
    values: ["Logistics", "Utilities", "Professional Services", "Office Supplies"],
    signals: "Found in 218 memo lines across Apr 2025.",
  },
  {
    id: "rec-project-phase",
    name: "Project Phase",
    cls: "_new",
    reason: "Project memos reference phases like Design, Build, and Handover.",
    values: ["Design", "Build", "Handover"],
    signals: "Detected in 47 project-tagged JEs.",
  },
];

export default function DimensionsPage() {
  // Configured dimensions (seed + any confirmed from recommendations or added manually).
  const [dimensions, setDimensions] = useState(() => SEED_DIMENSIONS.map((d) => ({ ...d })));
  const [recommendations, setRecommendations] = useState(INITIAL_RECOMMENDATIONS);

  // Editing state — only one row in edit mode at a time.
  // editingId: dim.id when renaming, or "__addval__:<dim.id>" when adding a value,
  // or "__new__" when adding a new dimension.
  const [editingId, setEditingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [newValueText, setNewValueText] = useState("");
  const [newDimName, setNewDimName] = useState("");

  function startRename(dim) {
    setEditingId(dim.id);
    setRenameValue(dim.label);
  }
  function saveRename(id) {
    const name = renameValue.trim();
    if (!name) return;
    setDimensions((prev) => prev.map((d) => (d.key === id ? { ...d, label: name } : d)));
    setEditingId(null);
  }
  function cancelEdit() {
    setEditingId(null);
    setNewValueText("");
    setNewDimName("");
  }

  function startAddValue(dim) {
    setEditingId(`__addval__:${dim.key}`);
    setNewValueText("");
  }
  function saveValue(id) {
    const v = newValueText.trim();
    if (!v) return;
    setDimensions((prev) =>
      prev.map((d) => (d.key === id ? { ...d, values: [...d.values.filter((x) => x !== "—"), v, ...(d.values.includes("—") ? ["—"] : [])] } : d)),
    );
    setEditingId(null);
    setNewValueText("");
  }
  function removeValue(id, idx) {
    setDimensions((prev) =>
      prev.map((d) => (d.key === id ? { ...d, values: d.values.filter((_, i) => i !== idx) } : d)),
    );
  }

  function deleteDimension(id) {
    if (!window.confirm("Delete this dimension? Tags using it will be removed from any account references.")) return;
    setDimensions((prev) => prev.filter((d) => d.key !== id));
  }

  function startNewDim() {
    setEditingId("__new__");
    setNewDimName("");
  }
  function saveNewDim() {
    const name = newDimName.trim();
    if (!name) return;
    const key = "custom-" + Date.now();
    setDimensions((prev) => [...prev, { key, label: name, cls: "_new", values: [] }]);
    setEditingId(null);
    setNewDimName("");
  }

  function confirmRecommendation(rec) {
    setDimensions((prev) => [
      ...prev,
      { key: rec.id, label: rec.name, cls: rec.cls || "_new", values: rec.values || [] },
    ]);
    setRecommendations((prev) => prev.filter((r) => r.id !== rec.id));
  }
  function dismissRecommendation(rec) {
    setRecommendations((prev) => prev.filter((r) => r.id !== rec.id));
  }

  return (
    <div className="settings-page">
      <h1 className="lg-title">Dimensions</h1>
      <div className="settings-sub">
        Define the analytical tags you'll attach to accounts and transactions —
        like Department, Location, or Project. Each dimension has its own list
        of values. All optional.
        <br />
        <span style={{ color: "var(--color-text-tertiary)", fontSize: 12 }}>
          These dimensions persist into the live ERP after migration.
        </span>
      </div>

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <div className="s2-dim-rec-section">
          <div className="s2-dim-rec-hdr">
            <span className="s2-dim-rec-icon">✦</span>
            <span className="s2-dim-rec-title">AI-recommended dimensions</span>
            <span className="s2-dim-rec-sub">Based on patterns in your legacy CoA</span>
          </div>
          <div className="s2-dim-rec-grid">
            {recommendations.map((rec) => {
              const pal = paletteFor(rec.cls);
              const sample = (rec.values || []).slice(0, 4);
              const extra = Math.max(0, (rec.values || []).length - 4);
              return (
                <div className="s2-dim-rec-card" key={rec.id}>
                  <div className="s2-dim-rec-card-hdr">
                    <span className="s2-dim-card-dot" style={{ background: pal.dot }} />
                    <span className="s2-dim-rec-card-name">{rec.name}</span>
                  </div>
                  <div className="s2-dim-rec-card-reason">{rec.reason}</div>
                  {sample.length > 0 ? (
                    <div className="s2-dim-rec-card-vals">
                      {sample.map((v) => (
                        <span className="s2-dim-rec-card-val" key={v}>{v}</span>
                      ))}
                      {extra > 0 && (
                        <span className="s2-dim-rec-card-val s2-dim-rec-card-val-more">+{extra}</span>
                      )}
                    </div>
                  ) : (
                    <div className="s2-dim-rec-card-vals s2-dim-rec-card-vals-empty">
                      No values yet — add after confirming
                    </div>
                  )}
                  <div className="s2-dim-rec-card-meta">{rec.signals}</div>
                  <div className="s2-dim-rec-card-actions">
                    <button className="s2-dim-rec-card-btn s2-dim-rec-card-btn-pri" onClick={() => confirmRecommendation(rec)}>
                      Confirm
                    </button>
                    <button className="s2-dim-rec-card-btn" onClick={() => dismissRecommendation(rec)}>
                      Dismiss
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Configured dimensions table */}
      <div className="s2-dim-tbl-section">
        <div className="s2-dim-tbl-hdr">
          <span className="s2-dim-tbl-title">Configured dimensions</span>
          <span className="s2-dim-tbl-cnt">{dimensions.length}</span>
        </div>

        {dimensions.length === 0 && editingId !== "__new__" ? (
          <div className="s2-dim-tbl-empty">
            No dimensions yet. Confirm a recommendation above, or{" "}
            <button className="s2-dim-empty-link" onClick={startNewDim}>
              add a custom dimension
            </button>
            .
          </div>
        ) : (
          <table className="s2-dim-tbl">
            <thead>
              <tr>
                <th style={{ width: 220 }}>Name</th>
                <th>Values</th>
                <th style={{ width: 140, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dimensions.map((dim) => {
                const pal = paletteFor(dim.cls);
                const isRenaming = editingId === dim.key;
                const isAddingValue = editingId === `__addval__:${dim.key}`;
                return (
                  <tr className="s2-dim-tbl-row" key={dim.key}>
                    <td>
                      {isRenaming ? (
                        <input
                          className="s2-dim-edit-input"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRename(dim.key);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          autoFocus
                        />
                      ) : (
                        <div className="s2-dim-tbl-name">
                          <span className="s2-dim-card-dot" style={{ background: pal.dot }} />
                          {dim.label}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="s2-dim-card-values">
                        {dim.values.map((v, vi) => (
                          <span
                            className="s2-dim-val-chip"
                            key={vi}
                            style={{ background: pal.bg, color: pal.fg }}
                          >
                            {v}
                            <span
                              className="s2-dim-val-chip-x"
                              title="Remove value"
                              onClick={() => removeValue(dim.key, vi)}
                            >
                              ×
                            </span>
                          </span>
                        ))}
                        {isAddingValue ? (
                          <>
                            <input
                              className="s2-dim-edit-input"
                              style={{ width: 140, padding: "3px 6px", fontSize: 11, flex: "0 0 auto" }}
                              value={newValueText}
                              onChange={(e) => setNewValueText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveValue(dim.key);
                                if (e.key === "Escape") cancelEdit();
                              }}
                              placeholder="New value"
                              autoFocus
                            />
                            <button className="s2-dim-val-add" onClick={() => saveValue(dim.key)}>Add</button>
                            <button className="s2-dim-val-add" onClick={cancelEdit}>Cancel</button>
                          </>
                        ) : (
                          <button className="s2-dim-val-add" onClick={() => startAddValue(dim)}>
                            + value
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {isRenaming ? (
                        <>
                          <button className="s2-dim-card-act" onClick={cancelEdit}>Cancel</button>{" "}
                          <button className="s2-dim-card-act primary" onClick={() => saveRename(dim.key)}>Save</button>
                        </>
                      ) : (
                        <>
                          <button className="s2-dim-card-act" onClick={() => startRename(dim)}>Rename</button>{" "}
                          <button className="s2-dim-card-act s2-dim-card-act-danger" onClick={() => deleteDimension(dim.key)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}

              {editingId === "__new__" && (
                <tr className="s2-dim-tbl-row s2-dim-tbl-row-new">
                  <td>
                    <input
                      className="s2-dim-edit-input"
                      value={newDimName}
                      onChange={(e) => setNewDimName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveNewDim();
                        if (e.key === "Escape") cancelEdit();
                      }}
                      placeholder="Dimension name (e.g. Project, Cost Center)"
                      autoFocus
                    />
                  </td>
                  <td style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>
                    Values can be added after the dimension is created.
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="s2-dim-card-act" onClick={cancelEdit}>Cancel</button>{" "}
                    <button className="s2-dim-card-act primary" onClick={saveNewDim}>Add</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {editingId !== "__new__" && (
          <button className="s2-dim-add-card" onClick={startNewDim}>
            + Add custom dimension
          </button>
        )}
      </div>
    </div>
  );
}
