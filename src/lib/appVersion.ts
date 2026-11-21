// ============================================================
// Fuente ÚNICA de la versión de Cumbre30.
// La UI (Configuración → Acerca de) y el endpoint /api/apk leen de
// aquí, así que nunca puede quedar una versión vieja hardcodeada
// en pantalla ni en la descarga. Al hacer release: actualizar este
// archivo + android/app/build.gradle (versionCode/versionName).
// ============================================================

export const APP_VERSION = "1.19.0";
export const APP_VERSION_CODE = 79;
export const APK_FILE_NAME = "cumbre30-v1.19.0-code79.apk";
export const APK_SIZE_MB = 53;
