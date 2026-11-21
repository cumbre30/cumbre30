// Entry SOLO para verificación in-vivo del bundle de las tarjetas
// (public/shareadn-test.js se genera desde aquí con esbuild).
// Re-exporta el renderizador + setLang para probar el i18n dinámico.
export { buildAdnImage, buildWeekImage } from "@/lib/shareAdn";
export { setLang } from "@/lib/i18n";
