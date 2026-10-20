import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The guide bundles ../contracts/MediChain.sol as text.
  server: { port: 5173, fs: { allow: [".."] }, proxy: {
    "/api": "http://localhost:4000",
    "/rpc": { target: "http://127.0.0.1:8545", rewrite: () => "/" },
  } },
});
