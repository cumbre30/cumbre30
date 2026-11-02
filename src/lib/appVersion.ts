// ============================================================
// Fuente ÚNICA de la versión de Cumbre30.
// La UI (Perfil) y el endpoint /api/apk leen de aquí, así que
// nunca puede quedar una versión vieja hardcodeada en pantalla
// ni en la descarga. Al hacer release: actualizar este archivo
// + android/app/build.gradle (versionCode/versionName) juntos.
// ============================================================

export const APP_VERSION = "1.4.5";
export const APP_VERSION_CODE = 20;
export const APK_FILE_NAME = "cumbre30-v1.4.5-code20.apk";
export const APK_SIZE_MB = 56;
