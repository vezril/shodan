"use client";

import { type AccessPoint, isSnapshot, type StreamMessage } from "@shodan/contract";
import { useEffect, useState } from "react";

type ConnState = "connecting" | "live" | "error";

// Renders the live AP inventory: the snapshot hydrates the table, then
// incremental deltas are applied in place. State is keyed by BSSID so a row is
// updated (never duplicated) on ap.upsert and dropped on ap.remove.
export function ReconTable() {
  const [aps, setAps] = useState<Map<string, AccessPoint>>(new Map());
  const [conn, setConn] = useState<ConnState>("connecting");

  useEffect(() => {
    const source = new EventSource("/api/stream");
    source.onopen = () => setConn("live");
    source.onerror = () => setConn("error");
    source.onmessage = (event) => {
      const message = JSON.parse(event.data) as StreamMessage;
      setAps((prev) => {
        if (isSnapshot(message)) {
          return new Map(message.accessPoints.map((ap) => [ap.bssid, ap]));
        }
        switch (message.type) {
          case "ap.upsert": {
            const next = new Map(prev);
            next.set(message.ap.bssid, message.ap);
            return next;
          }
          case "ap.remove": {
            const next = new Map(prev);
            next.delete(message.bssid);
            return next;
          }
          default:
            // client.* deltas don't affect the AP table (drill-in is task 3.3).
            return prev;
        }
      });
    };
    return () => source.close();
  }, []);

  const rows = [...aps.values()].sort((a, b) => b.signalDbm - a.signalDbm);

  return (
    <section>
      <p style={{ color: conn === "live" ? "#1a7f37" : conn === "error" ? "#cf222e" : "#9a6700" }}>
        ● {conn} — {rows.length} access point{rows.length === 1 ? "" : "s"}
      </p>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
        <thead>
          <tr>
            {["SSID", "BSSID", "Ch", "Band", "Encryption", "Signal", "Clients"].map((h) => (
              <th key={h} style={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ ...td, color: "#57606a" }}>
                Waiting for recon…
              </td>
            </tr>
          ) : (
            rows.map((ap) => (
              <tr key={ap.bssid}>
                <td style={td}>{ap.ssid ?? <em style={{ color: "#57606a" }}>&lt;hidden&gt;</em>}</td>
                <td style={{ ...td, fontFamily: "ui-monospace, monospace" }}>{ap.bssid}</td>
                <td style={td}>{ap.channel}</td>
                <td style={td}>{ap.band}</td>
                <td style={td}>{ap.encryption}</td>
                <td style={tdRight}>{ap.signalDbm} dBm</td>
                <td style={tdRight}>{ap.clientCount}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "2px solid #d0d7de",
  padding: "6px 10px",
  fontWeight: 600,
};
const td: React.CSSProperties = {
  borderBottom: "1px solid #eaeef2",
  padding: "6px 10px",
};
const tdRight: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
