import { defineConfig } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { terser } from 'rollup-plugin-terser'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
	build: {
		lib: {
			entry: resolve(__dirname, 'src/acycliq-entry.js'),
			name: 'acycliq',
			formats: ['iife'],
			fileName: () => 'acycliq-widget.min.js'
		},
		outDir: 'dist/embed',
		minify: 'terser',
		rollupOptions: {
			plugins: [terser()]
		},
		emptyOutDir: false
	}
})
