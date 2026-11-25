package cl.cumbre30.app

// ============================================================
// Plugin Capacitor "SpotifyNative" (v1.28.0; v1.28.3 diagnóstico):
// control de la reproducción de Spotify durante el ride vía App
// Remote SDK.
//
//   Conexión:
//     conectar({ clientId, redirectUri, mostrarAuth })
//       → SpotifyAppRemote.connect: con mostrarAuth=false intenta
//         SINCEDÓN con la sesión ya abierta de Spotify (falla
//         RÁPIDO con motivo claro si falta sesión o permiso);
//         con mostrarAuth=true la app de Spotify muestra SU
//         PROPIO diálogo de autorización (una vez). Sin «acceso
//         a las notificaciones», sin listeners, sin permisos
//         nuevos: el único requisito declarado es <queries> para
//         ver com.spotify.music (Android 11+).
//     abrir()      → abre la app de Spotify (chequeo de sesión).
//     desconectar()  ·  estado()  ·  accion({ accion })
//   Diagnóstico (v1.28.3): estado()/instalada() incluyen la
//   versión de la app de Spotify y todo fallo lleva su detalle
//   (clase + mensaje de la excepción) para ver la causa real.
//
//   Eventos:
//     "spotifyEstado" → { pista, artista, album, uri, tocando,
//                         posicionMs, duracionMs }
//     emitido en cada cambio del reproductor (track, play/pause).
//
//   Cuentas: el control (play/pause/saltar) funciona con cuenta
//   GRATIS y Premium; el modo dev del dashboard exige que la
//   cuenta esté invitada en User Management (ver instrucciones).
// ============================================================

import android.content.Intent
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.spotify.android.appremote.api.ConnectionParams
import com.spotify.android.appremote.api.Connector
import com.spotify.android.appremote.api.SpotifyAppRemote
import com.spotify.android.appremote.api.error.AuthenticationFailedException
import com.spotify.android.appremote.api.error.CouldNotFindSpotifyApp
import com.spotify.android.appremote.api.error.NotLoggedInException
import com.spotify.android.appremote.api.error.UserNotAuthorizedException
import com.spotify.protocol.types.PlayerState

@CapacitorPlugin(name = "SpotifyNative")
class SpotifyPlugin : Plugin() {
    companion object {
        private const val PAQUETE_SPOTIFY = "com.spotify.music"
        /** Estado del reproductor cacheado para estado() y el toggle. */
        private var ultimoEstado: JSObject? = null
        /** Conexión viva (null = no conectado; se reconecta a demanda). */
        private var remoto: SpotifyAppRemote? = null
        /** Evita suscribir dos veces al playerState de la misma conexión. */
        private var suscrito = false
    }

    private fun instaladaSpotify(): Boolean =
        try {
            bridge.context.packageManager.getLaunchIntentForPackage(PAQUETE_SPOTIFY) != null
        } catch (e: Exception) {
            false
        }

    /** Versión de la app de Spotify instalada (diagnóstico: versionName
     *  del paquete com.spotify.music; "" si no se puede leer). */
    private fun versionSpotify(): String =
        try {
            bridge.context.packageManager.getPackageInfo(PAQUETE_SPOTIFY, 0).versionName ?: ""
        } catch (e: Exception) {
            ""
        }

    private fun jsEstado(ps: PlayerState): JSObject {
        val o = JSObject()
        o.put("pista", ps.track?.name ?: "")
        o.put("artista", ps.track?.artist?.name ?: "")
        o.put("album", ps.track?.album?.name ?: "")
        o.put("uri", ps.track?.uri ?: "")
        o.put("tocando", !ps.isPaused)
        o.put("posicionMs", ps.playbackPosition)
        o.put("duracionMs", ps.track?.duration ?: 0L)
        // v1.28.4: el evento solo nace de una conexión viva — se marca
        // conectado para que ningún consumidor que reemplace su estado
        // con este payload pierda la conexión de vista (el panel caía a
        // «Instala la app de Spotify…» en cada cambio de canción).
        o.put("conectado", true)
        return o
    }

    /** Suscripción al estado del reproductor: cada cambio (canción
     *  nueva, play/pause) llega al WebView como "spotifyEstado". */
    private fun suscribir(r: SpotifyAppRemote) {
        if (suscrito) return
        try {
            r.playerApi.subscribeToPlayerState().setEventCallback { ps ->
                ultimoEstado = jsEstado(ps)
                notifyListeners("spotifyEstado", ultimoEstado!!)
            }
            suscrito = true
        } catch (e: Exception) {
            suscrito = false
        }
    }

    private fun limpiar() {
        remoto = null
        suscrito = false
        ultimoEstado = null
    }

    @PluginMethod
    fun instalada(call: PluginCall) {
        call.resolve(JSObject().put("instalada", instaladaSpotify()).put("version", versionSpotify()))
    }

    /** Conecta con la app de Spotify. Respuesta: { ok, motivo, detalle }
     *  con motivo = ok | sinApp | sinConfig | sinSesion | autorizacion | error.
     *  mostrarAuth=false → sincedón con la sesión de Spotify (falla rápido
     *  con motivo preciso); mostrarAuth=true → su diálogo de autorización. */
    @PluginMethod
    fun conectar(call: PluginCall) {
        val clientId = call.getString("clientId") ?: ""
        val redirectUri = call.getString("redirectUri") ?: ""
        val mostrarAuth = call.getBoolean("mostrarAuth", false) ?: false
        if (!instaladaSpotify()) {
            call.resolve(JSObject().put("ok", false).put("motivo", "sinApp"))
            return
        }
        if (clientId.isBlank() || clientId.contains("PON_AQUI")) {
            // Client ID del dashboard aún no configurado (spotifyConfig.ts)
            call.resolve(JSObject().put("ok", false).put("motivo", "sinConfig"))
            return
        }
        val r = remoto
        if (r?.isConnected == true) {
            suscribir(r)
            call.resolve(JSObject().put("ok", true).put("motivo", "ok"))
            return
        }
        limpiar()
        val params = ConnectionParams.Builder(clientId)
            .setRedirectUri(redirectUri)
            .showAuthView(mostrarAuth)
            .build()
        Log.w("SpotifyPlugin", "conectar: mostrandoAuth=$mostrarAuth spotify=${versionSpotify()}")
        // Guard de timeout (v1.28.2): si Spotify nunca responde (app vieja,
        // proceso muerto, consentimiento que no aparece), la llamada JS se
        // quedaría colgada para siempre y el panel se ve VACÍO. A los 30 s
        // devolvemos error. El guard anti doble-resolve evita que un callback
        // tardío rompa la llamada ya resuelta; si Spotify conecta DESPUÉS del
        // timeout, la conexión queda viva y la reconexión la detecta por
        // isConnected (o el latido del panel por estado()).
        val resuelto = java.util.concurrent.atomic.AtomicBoolean(false)
        val main = android.os.Handler(android.os.Looper.getMainLooper())
        val timeout = Runnable {
            if (resuelto.compareAndSet(false, true)) {
                call.resolve(
                    JSObject().put("ok", false).put("motivo", "error")
                        .put("detalle", "Spotify no respondió en 30 s; abre la app de Spotify y reconecta")
                )
            }
        }
        main.postDelayed(timeout, 30_000L)
        // connect() en el HILO PRINCIPAL (como el demo oficial del SDK;
        // Capacitor invoca los métodos del plugin en un hilo de fondo).
        main.post {
            try {
                SpotifyAppRemote.connect(bridge.context, params, object : Connector.ConnectionListener {
                    override fun onConnected(conectado: SpotifyAppRemote) {
                        // La conexión se guarda SIEMPRE: aunque la llamada ya se
                        // resolviera por timeout, la conexión tardía es utilizable.
                        remoto = conectado
                        suscribir(conectado)
                        Log.w("SpotifyPlugin", "onConnected")
                        if (resuelto.compareAndSet(false, true)) {
                            main.removeCallbacks(timeout)
                            call.resolve(JSObject().put("ok", true).put("motivo", "ok"))
                        }
                    }

                    override fun onFailure(t: Throwable) {
                        Log.w("SpotifyPlugin", "onFailure: ${t.javaClass.simpleName}: ${t.message}")
                        if (resuelto.compareAndSet(false, true)) {
                            main.removeCallbacks(timeout)
                            // Solo limpiamos si ganamos la carrera: limpiar() aquí con
                            // un connect posterior en marcha borraría su conexión.
                            limpiar()
                            val motivo = when (t) {
                                is CouldNotFindSpotifyApp -> "sinApp"
                                is NotLoggedInException -> "sinSesion"
                                is UserNotAuthorizedException, is AuthenticationFailedException -> "autorizacion"
                                else -> "error"
                            }
                            val detalle = "${t.javaClass.simpleName}: ${t.message ?: "(sin mensaje)"}"
                            call.resolve(JSObject().put("ok", false).put("motivo", motivo).put("detalle", detalle))
                        }
                    }
                })
            } catch (e: Exception) {
                if (resuelto.compareAndSet(false, true)) {
                    main.removeCallbacks(timeout)
                    call.resolve(
                        JSObject().put("ok", false).put("motivo", "error")
                            .put("detalle", "connect: ${e.javaClass.simpleName}: ${e.message ?: "(sin mensaje)"}")
                    )
                }
            }
        }
    }

    /** Abre la app de Spotify (para que el usuario confirme sesión /
     *  actualice la app antes de Reconectar). */
    @PluginMethod
    fun abrir(call: PluginCall) {
        val i = try {
            bridge.context.packageManager.getLaunchIntentForPackage(PAQUETE_SPOTIFY)
        } catch (e: Exception) {
            null
        }
        if (i == null) {
            call.resolve(JSObject().put("ok", false).put("motivo", "sinApp"))
            return
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            bridge.activity?.startActivity(i) ?: bridge.context.startActivity(i)
            call.resolve(JSObject().put("ok", true))
        } catch (e: Exception) {
            call.resolve(JSObject().put("ok", false).put("motivo", "error").put("detalle", e.message ?: ""))
        }
    }

    @PluginMethod
    fun desconectar(call: PluginCall) {
        try {
            remoto?.let { SpotifyAppRemote.disconnect(it) }
        } catch (e: Exception) {
            /* conexión ya caída: nada que hacer */
        }
        limpiar()
        call.resolve()
    }

    /** Estado actual: { instalada, version, conectado, pista, artista, … } */
    @PluginMethod
    fun estado(call: PluginCall) {
        val o = JSObject()
        // v1.28.4: primero el caché del reproductor (pista, tocando, … y
        // el conectado=true que trae todo evento); DESPUÉS los flags
        // autoritativos — un caché viejo no debe mentir sobre conectado.
        ultimoEstado?.let { s ->
            for (k in s.keys()) o.put(k, s.get(k))
        }
        o.put("instalada", instaladaSpotify())
        o.put("version", versionSpotify())
        o.put("conectado", remoto?.isConnected == true)
        call.resolve(o)
    }

    /** Comando de transporte: toggle | play | pause | siguiente | anterior. */
    @PluginMethod
    fun accion(call: PluginCall) {
        val r = remoto
        if (r?.isConnected != true) {
            call.resolve(JSObject().put("ok", false).put("motivo", "desconectado"))
            return
        }
        val acc = call.getString("accion") ?: "toggle"
        try {
            when (acc) {
                "play" -> r.playerApi.resume()
                "pause" -> r.playerApi.pause()
                "siguiente" -> r.playerApi.skipNext()
                "anterior" -> r.playerApi.skipPrevious()
                "toggle" -> r.playerApi.playerState.setResultCallback { ps ->
                    try {
                        if (ps.isPaused) r.playerApi.resume() else r.playerApi.pause()
                    } catch (e: Exception) {
                        /* conexión cortada entre consulta y comando */
                    }
                }
                else -> {
                    call.reject("acción desconocida: $acc")
                    return
                }
            }
            call.resolve(JSObject().put("ok", true))
        } catch (e: Exception) {
            call.resolve(JSObject().put("ok", false).put("motivo", "error").put("detalle", e.message ?: ""))
        }
    }

    override fun handleOnDestroy() {
        // Spotify recomienda soltar la conexión al destruir la app;
        // se reconecta sola la próxima vez que se abra el panel.
        try {
            remoto?.let { SpotifyAppRemote.disconnect(it) }
        } catch (e: Exception) {
            /* nada */
        }
        limpiar()
        super.handleOnDestroy()
    }
}
