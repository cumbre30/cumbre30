package cl.cumbre30.app

// ============================================================
// Plugin Capacitor "RideNative": una sola puerta del WebView al
// mundo nativo para el ride.
//
//   Ubicación:
//     startLocation()   → pide permisos y arranca RideLocationService
//     stopLocation()    → detiene el servicio y el GPS
//     isLocationRunning()
//     evento "gpsfix"   → cada fix a 1 Hz del FGS
//
//   Hápticos nativos (VibratorManager / VibrationEffect):
//     vibrate({ pattern, repeat }) — waveform exacta por tier
//     vibrateCancel()              — corta la vibración continua
//   (el WebView no garantiza navigator.vibrate; el VibratorManager
//   nativo es el camino documentado y soporta patrones en bucle)
// ============================================================

import android.Manifest
import android.app.AppOpsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaMetadata
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONArray

@CapacitorPlugin(
    name = "RideNative",
    permissions = [
        Permission(
            alias = "location",
            strings = [
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ]
        ),
        Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS])
    ]
)
class RideNativePlugin : Plugin() {

    override fun load() {
        // Puente servicio → WebView: cada fix del FGS se publica como evento.
        RideLocationService.onFix = { loc ->
            val data = JSObject()
            data.put("lat", loc.latitude)
            data.put("lng", loc.longitude)
            // speed negativo = señal Doppler inválida (lo filtra JS)
            data.put("speed", if (loc.hasSpeed()) loc.speed.toDouble() else -1.0)
            data.put("accuracy", if (loc.hasAccuracy()) loc.accuracy.toDouble() else 9999.0)
            data.put("bearing", if (loc.hasBearing()) loc.bearing.toDouble() else -1.0)
            // Fase única (2026-11-22): altitud honesta. hasAlt=false cuando
            // el proveedor no entregó altitud (el motor conserva la última
            // válida; JAMÁS la interpreta como 0 m) y valt es la accuracy
            // vertical (getVerticalAccuracyMeters, API 26+) para que el
            // motor rechace el ruido GNSS vertical de mala calidad.
            data.put("hasAlt", loc.hasAltitude())
            data.put("alt", loc.altitude)
            data.put(
                "valt",
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && loc.hasVerticalAccuracy())
                    loc.verticalAccuracyMeters.toDouble()
                else -1.0
            )
            data.put("t", loc.time.toDouble())
            notifyListeners("gpsfix", data)
        }
    }

    override fun handleOnDestroy() {
        RideLocationService.onFix = null
    }

    // ------------------------------------------------------------ ubicación

    @PluginMethod
    fun startLocation(call: PluginCall) {
        val missing = mutableListOf<String>()
        if (getPermissionState("location") != PermissionState.GRANTED) missing.add("location")
        if (Build.VERSION.SDK_INT >= 33 &&
            getPermissionState("notifications") != PermissionState.GRANTED
        ) missing.add("notifications")

        if (missing.isNotEmpty()) {
            requestPermissionForAliases(missing.toTypedArray(), call, "permCallback")
            return
        }
        startRideService(call)
    }

    @PermissionCallback
    fun permCallback(call: PluginCall) {
        if (getPermissionState("location") == PermissionState.GRANTED) {
            startRideService(call)
        } else {
            call.reject("Permiso de ubicación denegado")
        }
    }

    private fun startRideService(call: PluginCall) {
        try {
            val intent = Intent(bridge.activity, RideLocationService::class.java)
            ContextCompat.startForegroundService(bridge.activity, intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("No se pudo iniciar el servicio de ubicación: ${e.message}")
        }
    }

    @PluginMethod
    fun stopLocation(call: PluginCall) {
        try {
            val intent = Intent(bridge.activity, RideLocationService::class.java)
            intent.putExtra("stop", true)
            bridge.activity.startService(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("stopLocation falló: ${e.message}")
        }
    }

    @PluginMethod
    fun isLocationRunning(call: PluginCall) {
        val data = JSObject()
        data.put("running", RideLocationService.running)
        call.resolve(data)
    }

    // ------------------------------------------------------------ hápticos

    @PluginMethod
    fun vibrate(call: PluginCall) {
        val arr = call.getArray("pattern") ?: return call.reject("pattern requerido")
        val timings = ArrayList<Int>()
        for (i in 0 until arr.length()) {
            val n = arr.opt(i) as? Number ?: continue
            timings.add(n.toInt().coerceAtLeast(0))
        }
        if (timings.isEmpty()) return call.reject("pattern vacío")
        val repeat = call.getInt("repeat", -1) ?: -1
        try {
            val v = vibrator() ?: return call.reject("Sin vibrador")
            v.vibrate(VibrationEffect.createWaveform(timings.map { it.toLong() }.toLongArray(), repeat))
            call.resolve()
        } catch (e: Exception) {
            call.reject("vibrate falló: ${e.message}")
        }
    }

    @PluginMethod
    fun vibrateCancel(call: PluginCall) {
        try {
            vibrator()?.cancel()
        } catch (_: Exception) {
        }
        call.resolve()
    }

    private fun vibrator(): Vibrator? {
        val ctx = bridge.context
        return if (Build.VERSION.SDK_INT >= 31) {
            val vm = ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vm?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            ctx.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    // ------------------------------------------------------------ música (v1.12.3)
    //
    // Control de la música del teléfono sin salir del ride: los
    // MediaSessions que publican Spotify, YouTube Music o cualquier
    // reproductor. Es el MISMO mecanismo de los botones de los
    // audífonos: MediaSessionManager + MediaController.transportControls.
    //   · Requisito (exige Android para cualquier controlador de
    //     media de terceros): acceso a notificaciones para esta app
    //     (NotificationListenerService). MediaListenerService existe
    //     solo para habilitar esa vía; no lee notificaciones.
    //   · Sin cuentas, sin API en línea y sin Premium: todo local.

    /** MediaSessionManager del sistema (API 21+; minSdk ≥ 23). */
    private fun msm(): MediaSessionManager? =
        ContextCompat.getSystemService(bridge.context, MediaSessionManager::class.java)

    /** ComponentName de nuestro NotificationListenerService: es la
     *  credencial que Android exige para ver sesiones de otras apps. */
    private fun tagMedia(): ComponentName =
        ComponentName(bridge.context, MediaListenerService::class.java)

    /** ¿El usuario ya concedió el acceso a notificaciones? Chequeo
     *  vía Settings.Secure (compatible desde API 21; el método
     *  isNotificationListenerAccessGranted de MediaSessionManager no
     *  compila en esta configuración de SDK). */
    private fun listenerAcceso(): Boolean {
        val flat = Settings.Secure.getString(bridge.context.contentResolver, "enabled_notification_listeners")
            ?: return false
        return flat.split(":").any {
            ComponentName.unflattenFromString(it)?.packageName == bridge.context.packageName
        }
    }

    @PluginMethod
    fun mediaPermitido(call: PluginCall) {
        val granted = try {
            listenerAcceso()
        } catch (_: Exception) {
            false
        }
        val data = JSObject()
        data.put("granted", granted)
        call.resolve(data)
    }

    /** ¿La app está con «ajustes restringidos»? En APKs instalados
     *  fuera de la tienda Android 13+ bloquea conceder el acceso a
     *  notificaciones desde la lista de ajustes: el usuario debe
     *  permitirlo en Información de la aplicación (⋮ → Permitir
     *  ajustes restringidos). El op es oculto en el SDK: se lee por
     *  reflexión; si no existe (Android < 13) o falla, NO restringido
     *  (queda el camino de siempre). */
    private fun ajustesRestringidos(): Boolean = try {
        val ops = bridge.context.getSystemService(AppOpsManager::class.java)
        val op = try {
            AppOpsManager::class.java.getField("OPSTR_ACCESS_RESTRICTED_SETTINGS").get(null) as? String
        } catch (_: Throwable) {
            null
        }
        if (ops == null || op == null) false
        else {
            val uid = bridge.context.packageManager.getApplicationInfo(bridge.context.packageName, 0).uid
            ops.unsafeCheckOpNoThrow(op, uid, bridge.context.packageName) != AppOpsManager.MODE_ALLOWED
        }
    } catch (_: Throwable) {
        false
    }

    /** Abre el ajuste para conceder el «acceso a las notificaciones».
     *  Si la app está con «ajustes restringidos» (APK instalado fuera
     *  de la tienda, Android 13+), la lista de acceso bloquea la
     *  concesión: llevamos al usuario a INFORMACIÓN DE LA APLICACIÓN,
     *  donde se ve el estado «Aplicación restringida» (⋮ → Permitir
     *  ajustes restringidos). Al volver, el panel re-revisa y una vez
     *  sin restricción este mismo botón abre la lista de acceso. */
    @PluginMethod
    fun abrirAjustesMedia(call: PluginCall) {
        try {
            val i = if (ajustesRestringidos()) {
                Intent(
                    Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.fromParts("package", bridge.context.packageName, null),
                )
            } else {
                Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            bridge.activity.startActivity(i)
            call.resolve()
        } catch (e: Exception) {
            call.reject("No se pudo abrir ajustes: ${e.message}")
        }
    }

    private fun appLabel(pkg: String): String = try {
        val pm = bridge.context.packageManager
        pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
    } catch (_: Exception) {
        pkg
    }

    /** Sesiones de media activas: app, pista, artista y ¿tocando?. */
    @PluginMethod
    fun mediaSesiones(call: PluginCall) {
        val data = JSObject()
        try {
            val mgr = msm() ?: throw IllegalStateException("sin MediaSessionManager")
            if (!listenerAcceso()) {
                data.put("granted", false)
                data.put("sesiones", JSONArray())
                return call.resolve(data)
            }
            val arr = JSONArray()
            for (mc in mgr.getActiveSessions(tagMedia())) {
                val md = mc.metadata
                val st = mc.playbackState
                val o = JSObject()
                o.put("id", mc.packageName)
                o.put("app", appLabel(mc.packageName))
                o.put("pista", md?.getString(MediaMetadata.METADATA_KEY_TITLE) ?: "")
                o.put("artista", md?.getString(MediaMetadata.METADATA_KEY_ARTIST) ?: "")
                o.put("tocando", st?.state == PlaybackState.STATE_PLAYING)
                arr.put(o)
            }
            data.put("granted", true)
            data.put("sesiones", arr)
            call.resolve(data)
        } catch (e: Exception) {
            call.reject("mediaSesiones falló: ${e.message}")
        }
    }

    /** Comandos de transporte sobre la sesión indicada: toggle,
     *  play, pause, siguiente, anterior. */
    @PluginMethod
    fun mediaAccion(call: PluginCall) {
        val id = call.getString("id") ?: return call.reject("id requerido")
        val acc = call.getString("accion") ?: return call.reject("accion requerida")
        try {
            val mgr = msm() ?: throw IllegalStateException("sin MediaSessionManager")
            val mc = mgr.getActiveSessions(tagMedia()).firstOrNull { it.packageName == id }
                ?: throw IllegalStateException("sesión no encontrada")
            val tc = mc.transportControls
            when (acc) {
                "play" -> tc.play()
                "pause" -> tc.pause()
                "siguiente" -> tc.skipToNext()
                "anterior" -> tc.skipToPrevious()
                "toggle" -> if (mc.playbackState?.state == PlaybackState.STATE_PLAYING) tc.pause() else tc.play()
                else -> return call.reject("acción desconocida: $acc")
            }
            call.resolve()
        } catch (e: Exception) {
            call.reject("mediaAccion falló: ${e.message}")
        }
    }
}
