package cl.cumbre30.app

// ============================================================
// Servicio en primer plano (Foreground Service) de ubicación.
// Sin esto, Android mata el proceso a los pocos minutos de
// bloquear la pantalla o cambiar de app (consumo de batería),
// y el ride se corta a media bajada.
//
//   • foregroundServiceType = "location" (obligatorio desde API 34)
//   • Notificación persistente en el canal "cumbre30_ride"
//   • LocationManager.GPS_PROVIDER a 1 Hz (1000 ms) — el feed
//     de hardware directo, sin dependencia de Play Services.
//     FusedLocationProvider aporta principalmente fallback de
//     sensores en cañones urbanos; en el cerro el GPS puro a
//     1 Hz es equivalente y funciona en TODOS los dispositivos.
//   • Cada fix se entrega al WebView vía RideNativePlugin
//     (evento "gpsfix"); speed negativo = señal inválida.
// ============================================================

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log

class RideLocationService : Service(), LocationListener {

    companion object {
        const val CHANNEL_ID = "cumbre30_ride"
        const val NOTIF_ID = 30

        /** Callback hacia el plugin (set en RideNativePlugin.load()). */
        var onFix: ((Location) -> Unit)? = null

        var running: Boolean = false
            private set
    }

    private var lm: LocationManager? = null

    override fun onCreate() {
        super.onCreate()
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.getBooleanExtra("stop", false) == true) {
            stopTracking()
            return START_NOT_STICKY
        }
        val notif = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            @Suppress("DEPRECATION")
            startForeground(NOTIF_ID, notif)
        }
        running = true
        try {
            lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
            lm?.requestLocationUpdates(
                LocationManager.GPS_PROVIDER,
                1000L, // 1 Hz: latencia mínima para fiscalizar a 30 km/h
                0f,
                this,
                Looper.getMainLooper()
            )
            Log.i("C30", "FGS ubicación activo (GPS_PROVIDER, 1 Hz)")
        } catch (e: Exception) {
            Log.e("C30", "requestLocationUpdates falló", e)
        }
        return START_STICKY
    }

    private fun stopTracking() {
        try {
            lm?.removeUpdates(this)
        } catch (_: Exception) {
        }
        lm = null
        running = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        stopSelf()
        Log.i("C30", "FGS ubicación detenido")
    }

    override fun onLocationChanged(loc: Location) {
        onFix?.invoke(loc)
    }

    override fun onDestroy() {
        try {
            lm?.removeUpdates(this)
        } catch (_: Exception) {
        }
        running = false
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ------------------------------------------------------------ notificación

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(
                CHANNEL_ID,
                "Ride en curso",
                NotificationManager.IMPORTANCE_LOW // sin sonido: la app ya avisa por voz
            ).apply {
                description = "GPS activo mientras pedaleas en el cerro"
                setShowBadge(false)
            }
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(ch)
        }
    }

    private fun buildNotification(): Notification {
        val tap = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("Cumbre30 · ride en curso")
            .setContentText("Límite 30 km/h · GPS activo en segundo plano")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(tap)
            .setOngoing(true)
            .build()
    }
}
