import { defineConfig, PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import fs from "fs";

// Plugin to copy ONNX Runtime WASM files to public directory
function copyOnnxWasmPlugin(): PluginOption {
  return {
    name: 'copy-onnx-wasm',
    buildStart() {
      const ortSource = path.resolve(import.meta.dirname, 'node_modules/onnxruntime-web/dist');
      const ortDest = path.resolve(import.meta.dirname, 'client/public/ort');
      
      // Create destination directory if it doesn't exist
      if (!fs.existsSync(ortDest)) {
        fs.mkdirSync(ortDest, { recursive: true });
      }
      
      // Copy WASM files
      const files = fs.readdirSync(ortSource).filter(f => 
        f.endsWith('.wasm') || f.endsWith('.mjs') || f.endsWith('.js')
      );
      
      for (const file of files) {
        const src = path.join(ortSource, file);
        const dst = path.join(ortDest, file);
        if (!fs.existsSync(dst)) {
          fs.copyFileSync(src, dst);
          console.log(`📦 Copied ONNX Runtime: ${file}`);
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    copyOnnxWasmPlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Handle large SAM model files
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Separate ONNX runtime into its own chunk
        manualChunks: {
          'onnx': ['onnxruntime-web'],
        },
      },
    },
  },
  worker: {
    // Ensure workers are built as ESM to support code-splitting
    format: 'es',
  },
  // Allow ONNX runtime to work properly
  optimizeDeps: {
    exclude: ['onnxruntime-web', 'onnxruntime-web/webgpu'],
  },
  server: {
    fs: {
      strict: false, // Allow serving files from node_modules
    },
    // Increase timeout for large model file downloads
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  // Handle WASM files
  assetsInclude: ['**/*.wasm', '**/*.onnx'],
});
