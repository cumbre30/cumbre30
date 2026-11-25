package cl.cumbre30.app

// ============================================================
// Plugin Capacitor "SpotifyNative" (v1.28.0): control de la
// reproducción de Spotify durante el ride vía App Remote SDK.
//
//   Conexión:
//     conectar({ clientId, redirectUri })
//       → SpotifyAppRemote.connect: la app de Spotify muestra
//         SU PROPIO diálogo de autorización (una vez) y queda
//         enlazada por servicio. Sin «acceso a las
//         notificaciones», sin listeners, sin permisos nuevos:
//         el único requisito declarado es <queries> para ver
//         com.spotify.music (Android 11+).
//     desconectar()  ·  estado()  ·  accion({ accion })
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

    private fun jsEstado(ps: PlayerState): JSObject {
        val o = JSObject()
        o.put("pista", ps.track?.name ?: "")
        o.put("artista", ps.track?.artist?.name ?: "")
        o.put("album", ps.track?.album?.name ?: "")
        o.put("uri", ps.track?.uri ?: "")
        o.put("tocando", !ps.isPaused)
        o.put("posicionMs", ps.playbackPosition)
        o.put("duracionMs", ps.track?.duration ?: 0L)
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
        call.resolve(JSObject().put("instalada", instaladaSpotify()))
    }

    /** Conecta con la app de Spotify. Respuesta: { ok, motivo } con
     *  motivo = ok | sinApp | sinSesion | autorizacion | error. */
    @PluginMethod
    fun conectar(call: PluginCall) {
        val clientId = call.getString("clientId") ?: ""
        val redirectUri = call.getString("redirectUri") ?: ""
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
            .showAuthView(true)
            .build()
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
        SpotifyAppRemote.connect(bridge.context, params, object : Connector.ConnectionListener {
            override fun onConnected(conectado: SpotifyAppRemote) {
                // La conexión se guarda SIEMPRE: aunque la llamada ya se
                // resolviera por timeout, la conexión tardía es utilizable.
                remoto = conectado
                suscribir(conectado)
                if (resuelto.compareAndSet(false, true)) {
                    main.removeCallbacks(timeout)
                    call.resolve(JSObject().put("ok", true).put("motivo", "ok"))
                }
            }

            override fun onFailure(t: Throwable) {
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
                    call.resolve(JSObject().put("ok", false).put("motivo", motivo).put("detalle", t.message ?: ""))
                }
            }
        })
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

    /** Estado actual: { instalada, conectado, pista, artista, … } */
    @PluginMethod
    fun estado(call: PluginCall) {
        val o = JSObject()
        o.put("instalada", instaladaSpotify())
        o.put("conectado", remoto?.isConnected == true)
        ultimoEstado?.let { s ->
            for (k in s.keys()) o.put(k, s.get(k))
        }
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
