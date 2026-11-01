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
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

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
            data.put("alt", if (loc.hasAltitude()) loc.altitude else 0.0)
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
}
