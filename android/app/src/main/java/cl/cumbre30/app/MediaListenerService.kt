package cl.cumbre30.app

// ============================================================
// NotificationListenerService mínimo (v1.12.3): su única razón de
// existir es habilitar el acceso de MediaSessionManager a las
// sesiones de media de otras apps (Spotify, YouTube Music, …), vía
// «Acceso a las notificaciones». No implementa onNotificationPosted:
// no lee, guarda ni procesa notificaciones; Android lo requiere
// como credencial para que el control de música funcione.
// ============================================================

class MediaListenerService : android.service.notification.NotificationListenerService()
