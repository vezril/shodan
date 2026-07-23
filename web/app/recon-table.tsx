"use client";

import { type AccessPoint, type Client, isSnapshot, type StreamMessage } from "@shodan/contract";
import { useEffect, useState } from "react";

type ConnState = "connecting" | "live" | "error";

// Renders the live AP inventory plus a drill-in of the selected AP's clients.
// AP and client state are each keyed (bssid / mac) so deltas apply in place; the
// snapshot hydrates both. Selecting an AP row filters the client panel to that
// AP, and the panel updates live as client.* deltas arrive.
export function ReconTable() {
  const [aps, setAps] = useState<Map<string, AccessPoint>>(new Map());
  const [clients, setClients] = useState<Map<string, Client>>(new Map());
  const [selected, setSelected] = useState<string | null>(null);
  const [conn, setConn] = useState<ConnState>("connecting");

  useEffect(() => {
    const source = new EventSource("/api/stream");
    source.onopen = () => setConn("live");
    source.onerror = () => setConn("error");
    source.onmessage = (event) => {
      const message = JSON.parse(event.data) as StreamMessage;
      if (isSnapshot(message)) {
        setAps(new Map(message.accessPoints.map((ap) => [ap.bssid, ap])));
        setClients(new Map(message.clients.map((c) => [c.mac, c])));
        return;
      }
      switch (message.type) {
        case "ap.upsert":
          setAps((prev) => new Map(prev).set(message.ap.bssid, message.ap));
          break;
        case "ap.remove":
          setAps((prev) => {
            const next = new Map(prev);
            next.delete(message.bssid);
            return next;
          });
          break;
        case "client.upsert":
          setClients((prev) => new Map(prev).set(message.client.mac, message.client));
          break;
        case "client.remove":
          setClients((prev) => {
            const next = new Map(prev);
            next.delete(message.mac);
            return next;
          });
          break;
      }
    };
    return () => source.close();
  }, []);

  const rows = [...aps.values()].sort((a, b) => b.signalDbm - a.signalDbm);
  const selectedAp = selected ? aps.get(selected) : undefined;

  return (
    <section>
      <p style={{ color: conn === "live" ? "#1a7f37" : conn === "error" ? "#cf222e" : "#9a6700" }}>
        ● {conn} — {rows.length} access point{rows.length === 1 ? "" : "s"}
      </p>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
        <thead>
          <tr>
            {["SSID", "BSSID", "Ch", "Band", "Encryption", "Signal", "Clients", "Scope"].map((h) => (
              <th key={h} style={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ ...td, color: "#57606a" }}>
                Waiting for recon…
              </td>
            </tr>
          ) : (
            rows.map((ap) => {
              const isSelected = ap.bssid === selected;
              return (
                <tr
                  key={ap.bssid}
                  onClick={() => setSelected(isSelected ? null : ap.bssid)}
                  style={{ cursor: "pointer", background: isSelected ? "#ddf4ff" : undefined }}
                >
                  <td style={{ ...td, borderLeft: `3px solid ${ap.inScope ? "#1a7f37" : "transparent"}` }}>
                    {ap.ssid ?? <em style={{ color: "#57606a" }}>&lt;hidden&gt;</em>}
                  </td>
                  <td style={{ ...td, fontFamily: "ui-monospace, monospace" }}>{ap.bssid}</td>
                  <td style={td}>{ap.channel}</td>
                  <td style={td}>{ap.band}</td>
                  <td style={td}>{ap.encryption}</td>
                  <td style={tdRight}>{ap.signalDbm} dBm</td>
                  <td style={tdRight}>{ap.clientCount}</td>
                  <td style={td}>
                    <ScopeBadge inScope={ap.inScope} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {selected && <ClientPanel bssid={selected} ap={selectedAp} clients={clients} />}
    </section>
  );
}

function ScopeBadge({ inScope }: { inScope: boolean }) {
  return inScope ? (
    <span style={{ padding: "1px 8px", borderRadius: 999, background: "#1a7f37", color: "#fff", fontSize: 12, fontWeight: 600 }}>
      in scope
    </span>
  ) : (
    <span style={{ padding: "1px 8px", borderRadius: 999, background: "#eaeef2", color: "#57606a", fontSize: 12 }}>
      out
    </span>
  );
}

function ClientPanel({
  bssid,
  ap,
  clients,
}: {
  bssid: string;
  ap: AccessPoint | undefined;
  clients: Map<string, Client>;
}) {
  const associated = [...clients.values()]
    .filter((c) => c.bssid === bssid)
    .sort((a, b) => b.signalDbm - a.signalDbm);

  const label = ap ? (ap.ssid ?? "<hidden>") : "AP no longer in range";

  return (
    <div style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 16, marginBottom: 2 }}>Clients of {label}</h2>
      <p style={{ margin: "0 0 8px", color: "#57606a", fontFamily: "ui-monospace, monospace", fontSize: 13 }}>
        {bssid} — {associated.length} client{associated.length === 1 ? "" : "s"}
      </p>
      {associated.length === 0 ? (
        <p style={{ color: "#57606a" }}>No associated clients.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
          <thead>
            <tr>
              {["Client MAC", "Signal", "Last seen"].map((h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {associated.map((c) => (
              <tr key={c.mac}>
                <td style={{ ...td, fontFamily: "ui-monospace, monospace" }}>{c.mac}</td>
                <td style={tdRight}>{c.signalDbm} dBm</td>
                <td style={td}>{new Date(c.lastSeen).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
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
