import { useState, useEffect } from "react";
import useBirdSocket from "./useBirdSocket";

const COLORS = ["#e8734a","#6ab3d4","#c4a35a","#d94040","#8bc48a","#d45fa0","#b8a8c8","#7ee8a2"];
const colorMap = {};
let colorIndex = 0;

function getColor(name) {
  if (!colorMap[name]) {
    colorMap[name] = COLORS[colorIndex % COLORS.length];
    colorIndex++;
  }
  return colorMap[name];
}

function useBirdInfo(species) {
  const [info, setInfo] = useState({});

  useEffect(() => {
    if (!species) return;
    const query = encodeURIComponent(species.replace(/ /g, "_"));

    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${query}`)
      .then(r => r.json())
      .then(data => {
        setInfo({
          image: data.thumbnail?.source || null,
          url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${query}`,
        });
      })
      .catch(() => {});
  }, [species]);

  return info;
}

function BirdCard({ det, isNew }) {
  const color = getColor(det.species);
  const info = useBirdInfo(det.species);

  return (
    <div style={{
      background: isNew ? "rgba(126,232,162,0.05)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${isNew ? color + "88" : "#1e2e1e"}`,
      borderRadius: 12, padding: "14px 16px",
      display: "flex", alignItems: "center", gap: 14,
      boxShadow: isNew ? `0 0 20px ${color}33` : "none",
      animation: "fadeIn 0.4s ease",
      transition: "border-color 0.6s, box-shadow 0.6s",
      marginBottom: 12,
    }}>
      <a href={info.url} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
        {info.image ? (
          <img
            src={info.image}
            alt={det.species}
            style={{
              width: 64, height: 64, borderRadius: 10,
              objectFit: "cover",
              border: `2px solid ${color}55`,
              display: "block",
            }}
          />
        ) : (
          <div style={{
            width: 64, height: 64, borderRadius: 10,
            background: `${color}22`, border: `2px solid ${color}55`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28,
          }}>🐦</div>
        )}
      </a>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <a
            href={info.url}
            target="_blank"
            rel="noreferrer"
            style={{ color: "#e8f5e8", fontSize: 15, fontWeight: 700, textDecoration: "none" }}
          >
            {det.species}
          </a>
          <span style={{ color: "#3a6a3a", fontSize: 11 }}>{det.time}</span>
          {info.url && (
            <a
              href={info.url}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 9, color: "#3a6a3a", border: "1px solid #2a4a2a",
                borderRadius: 4, padding: "2px 6px", textDecoration: "none", letterSpacing: 1,
              }}
            >
              WIKIPEDIA ↗
            </a>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <div style={{ background: "#1a2a1a", borderRadius: 4, height: 5, flex: 1 }}>
            <div style={{
              height: "100%",
              width: `${det.confidence * 100}%`,
              background: `linear-gradient(90deg, ${color}66, ${color})`,
              borderRadius: 4, transition: "width 0.8s ease",
            }} />
          </div>
          <span style={{ color, fontSize: 12, fontWeight: 700, flexShrink: 0, fontFamily: "monospace" }}>
            {(det.confidence * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const {data} = useBirdSocket();
  const [newIndex, setNewIndex] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!data.length) return;
    setNewIndex(0);
    const t = setTimeout(() => setNewIndex(null), 2500);
    return () => clearTimeout(t);
  }, [data.length]);

  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const uniqueSpecies = new Set(data.map(d => d.species)).size;
  const topConf = data.length ? Math.max(...data.map(d => d.confidence * 100)).toFixed(1) : "—";

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f0a", color: "#c8e8c8", fontFamily: "monospace" }}>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(-6px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #2a4a2a; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{
        background: "#0c120c", borderBottom: "1px solid #1a2a1a",
        padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 30 }}>🐦</span>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#e8f5e8", letterSpacing: 1 }}>AvianEar</div>
            <div style={{ fontSize: 9, color: "#3a6a3a", letterSpacing: 3 }}>ACOUSTIC BIRD MONITOR</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {[["SPECIES", uniqueSpecies], ["DETECTIONS", data.length], ["BEST", topConf === "—" ? "—" : `${topConf}%`], ["SESSION", fmt(elapsed)]].map(([label, val]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#3a6a3a", letterSpacing: 2 }}>{label}</div>
              <div style={{ fontSize: 17, color: "#7ee8a2", fontWeight: 700 }}>{val}</div>
            </div>
          ))}

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#7ee8a2", boxShadow: "0 0 8px #7ee8a2",
              animation: "pulse 1.5s infinite",
            }} />
            <span style={{ fontSize: 10, color: "#7ee8a2", letterSpacing: 2 }}>LIVE</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", height: "calc(100vh - 69px)" }}>
        <div style={{ padding: 24, overflowY: "auto" }}>
          <div style={{ fontSize: 10, color: "#3a6a3a", letterSpacing: 2, marginBottom: 16 }}>LIVE DETECTIONS</div>
          {data.length === 0 ? (
            <div style={{ color: "#2a4a2a", textAlign: "center", marginTop: 100, lineHeight: 2.5, fontSize: 13 }}>
              🎙 Listening through your microphone...<br />
              Birds will appear here when detected
            </div>
          ) : (
            [...data].reverse().map((det, i) => (
              <BirdCard key={i} det={det} isNew={i === data.length - 1 && newIndex === 0} />
            ))
          )}
        </div>

        <div style={{ borderLeft: "1px solid #1a2a1a", padding: 20, overflowY: "auto", background: "#0c120c" }}>
          <div style={{ fontSize: 10, color: "#3a6a3a", letterSpacing: 2, marginBottom: 16 }}>LOG</div>
          {data.length === 0 ? (
            <div style={{ color: "#2a4a2a", fontSize: 11 }}>No detections yet</div>
          ) : (
            [...data].reverse().map((det, i) => (
              <div key={i} style={{
                display: "flex", gap: 8, alignItems: "center",
                padding: "6px 8px", borderRadius: 6, marginBottom: 4,
                background: i === 0 ? "#0f1f0f" : "transparent",
                animation: i === 0 ? "fadeIn 0.3s ease" : "none",
              }}>
                <span style={{ fontSize: 10, color: "#2a5a2a", flexShrink: 0 }}>{det.time}</span>
                <span style={{ flex: 1, fontSize: 11, color: "#7aaa7a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {det.species}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                  color: det.confidence >= 0.9 ? "#7ee8a2" : det.confidence >= 0.75 ? "#c4e87e" : "#e8c87e",
                }}>
                  {(det.confidence * 100).toFixed(0)}%
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}