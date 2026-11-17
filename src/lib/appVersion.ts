// ============================================================
// Fuente ÚNICA de la versión de Cumbre30.
// La UI (Configuración → Acerca de) y el endpoint /api/apk leen de
// aquí, así que nunca puede quedar una versión vieja hardcodeada
// en pantalla ni en la descarga. Al hacer release: actualizar este
// archivo + android/app/build.gradle (versionCode/versionName).
// ============================================================

export const APP_VERSION = "1.12.14";
export const APP_VERSION_CODE = 53;
export const APK_FILE_NAME = "cumbre30-v1.12.14-code53.apk";
export const APK_SIZE_MB = 57;
