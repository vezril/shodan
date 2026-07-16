import { ReconTable } from "./recon-table";

export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 4 }}>shodan</h1>
      <p style={{ color: "#57606a", marginTop: 0 }}>Recon console — live access-point inventory</p>
      <ReconTable />
    </main>
  );
}
