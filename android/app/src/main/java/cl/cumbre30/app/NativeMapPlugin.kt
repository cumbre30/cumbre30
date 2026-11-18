package cl.cumbre30.app

// ============================================================
// NativeMap — mapas NATIVOS de Android (MapLibre Native, el mismo
// motor del minimapa web) embebidos bajo el WebView:
//
//   [ WebView (fondo transparente, UI HTML) ]   ← arriba: banner, barra, botones
//   [ C30Backdrop: fondo oscuro con "ventana" redondeada ]  ← recorta el hueco
//   [ MapView MapLibre (pantalla completa) ]    ← abajo: mapa nativo real
//
// El JS envía el rect del contenedor del mapa (getBoundingClientRect)
// y el backdrop perfora una ventana redondeada ahí: el mapa se ve solo
// dentro del contenedor, mientras TODA la UI HTML sigue funcionando
// encima porque el WebView está encima de todo.
//
// Los toques dentro de la ventana se reenvían al MapView nativo
// (pan/pinch/pitch reales), los toques en la UI HTML quedan en el
// WebView. Cámara, rutas y fuentes llegan como JSON desde JS; las
// imágenes (pin, chevrons, emojis) viajan en base64.
// ============================================================

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Path
import android.graphics.RectF
import android.util.Base64
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.maplibre.android.MapLibre
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapLibreMapOptions
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import org.maplibre.android.style.sources.GeoJsonSource

/** Fondo del backdrop: el mismo del tema de la app (#0a0e14). */
private const val BACKDROP_COLOR = 0xFF0A0E14.toInt()

/** Ventana perforada en el backdrop, en px nativos relativos al content view. */
private class Hole(var x: Float, var y: Float, var w: Float, var h: Float, var radius: Float) {
    fun rect(): RectF = RectF(x, y, x + w, y + h)
    fun contains(px: Float, py: Float): Boolean = px >= x && px <= x + w && py >= y && py <= y + h
}

/** View que pinta el fondo oscuro dejando ver el mapa solo por las ventanas. */
private class C30Backdrop(context: Context) : View(context) {
    val holes = LinkedHashMap<String, Hole>()
    fun refresh(holeId: String, h: Hole?) {
        if (h == null) holes.remove(holeId) else holes[holeId] = h
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        if (holes.isEmpty()) {
            canvas.drawColor(BACKDROP_COLOR)
            return
        }
        canvas.save()
        val out = Path()
        for (h in holes.values) out.addRoundRect(h.rect(), h.radius, h.radius, Path.Direction.CW)
        canvas.clipOutPathCompat(out)
        canvas.drawColor(BACKDROP_COLOR)
        canvas.restore()
    }
}

/** Compat clipOutPath (API 24–25 usa la variante deprecada). */
private fun Canvas.clipOutPathCompat(p: Path) {
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
        clipOutPath(p)
    } else {
        @Suppress("DEPRECATION")
        clipPath(p, android.graphics.Region.Op.DIFFERENCE)
    }
}

/** Estado del ciclo de vida adelantado: 0=created, 1=started, 2=resumed. */
private class MapEntry(
    val mapView: MapView,
    var map: MapLibreMap? = null,
    var ready: Boolean = false,
    var gestures: Boolean = true,
    var stage: Int = 0
)

@CapacitorPlugin(name = "NativeMap")
class NativeMapPlugin : Plugin() {

    private val maps = LinkedHashMap<String, MapEntry>()
    private var backdrop: C30Backdrop? = null
    private var density = 1f
    private var webOffsetX = 0f
    private var webOffsetY = 0f
    private var forwardingHole: Hole? = null

    // ------------------------------------------------------------ utilidades

    private fun contentView(): ViewGroup =
        bridge.activity.findViewById(android.R.id.content) as ViewGroup

    private fun ensureStack() {
        val activity = bridge.activity
        density = activity.resources.displayMetrics.density
        val root = contentView()
        val wv = bridge.webView

        // offset del WebView dentro del content view (insets edge-to-edge)
        val rootLoc = IntArray(2); root.getLocationOnScreen(rootLoc)
        val wvLoc = IntArray(2); wv.getLocationOnScreen(wvLoc)
        webOffsetX = (wvLoc[0] - rootLoc[0]).toFloat()
        webOffsetY = (wvLoc[1] - rootLoc[1]).toFloat()

        if (backdrop == null) {
            backdrop = C30Backdrop(activity)
            // Z-order correcto: [MapView(s) ... , BACKDROP, WEBVIEW].
            // Se inserta en el índice del WebView (empujándolo hacia
            // arriba); los MapView se agregan después en el índice 0.
            val wvIndex = root.indexOfChild(wv)
            root.addView(
                backdrop,
                if (wvIndex >= 0) wvIndex else root.childCount,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        // WebView translúcido: el fondo oscuro real lo pinta el backdrop
        wv.setBackgroundColor(Color.TRANSPARENT)
        installTouchInterceptor(wv)
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun installTouchInterceptor(wv: View) {
        wv.setOnTouchListener { v, ev ->
            val hole = holeAtWebView(ev.x, ev.y)
                ?: forwardingHole?.takeIf { ev.actionMasked != MotionEvent.ACTION_UP && ev.actionMasked != MotionEvent.ACTION_CANCEL }
            if (hole != null) {
                forwardingHole = if (ev.actionMasked == MotionEvent.ACTION_UP || ev.actionMasked == MotionEvent.ACTION_CANCEL) null else hole
                val entry = maps.values.firstOrNull { it.gestures && it.ready } ?: return@setOnTouchListener true
                val copy = MotionEvent.obtain(ev)
                // el MapView llena el content view: sus coords locales == coords
                // del content view → solo sumamos el offset del WebView
                copy.offsetLocation(webOffsetX, webOffsetY)
                entry.mapView.dispatchTouchEvent(copy)
                copy.recycle()
                true
            } else {
                v.onTouchEvent(ev)
            }
        }
    }

    /** Hole que contiene el punto (coords WebView) con mapa gesturable activo. */
    private fun holeAtWebView(x: Float, y: Float): Hole? {
        val gesturesOn = maps.values.any { it.gestures && it.ready }
        if (!gesturesOn) return null
        val hx = x + webOffsetX
        val hy = y + webOffsetY
        return backdrop?.holes?.values?.lastOrNull { it.contains(hx, hy) }
    }

    private fun entry(id: String): MapEntry? = maps[id]

    // ------------------------------------------------------------ API JS

    @PluginMethod
    fun create(call: PluginCall) {
        val id = call.getString("id") ?: return call.reject("id requerido")
        val styleJson = call.getString("styleJson") ?: return call.reject("styleJson requerido")
        val gestures = call.getBoolean("gestures", true) ?: true
        val images = call.getObject("images")

        bridge.activity.runOnUiThread {
            try {
                ensureStack()
                MapLibre.getInstance(bridge.activity)

                val old = maps.remove(id)
                old?.let { teardown(it) }

                // v1.13.2 — causa raíz del blanco de v1.3.1: el MapView
                // default renderiza sobre SurfaceView, que vive FUERA de la
                // jerarquía de vistas y choca con el WebView translúcido que
                // lo cubre (z-order → fondo de color sin mapa). Con
                // textureMode(true) el mapa dibuja sobre TextureView, una
                // vista común que compone correctamente bajo el WebView.
                // Cuesta algo de FPS, pero sigue siendo mucho más rápido
                // que el fallback Leaflet.
                // v1.13.4: textureMode REQUIERE el artefacto
                // org.maplibre.gl:android-sdk-opengl (ver build.gradle) — el
                // artefacto estándar usa Vulkan desde 13.0 y Vulkan +
                // TextureView no dibuja nada (mapa negro, sin crash).
                val mv = MapView(
                    bridge.activity,
                    MapLibreMapOptions.createFromAttributes(bridge.activity).textureMode(true)
                )
                mv.layoutParams = ViewGroup.LayoutParams(MATCH_PARENT, MATCH_PARENT)
                val root = contentView()
                root.addView(mv, 0, ViewGroup.LayoutParams(MATCH_PARENT, MATCH_PARENT))

                val entry = MapEntry(mv, gestures = gestures)
                maps[id] = entry

                // IMPORTANTE: la Activity ya está resumed cuando JS crea el
                // mapa. Los handleOnStart/Resume del plugin solo corren en
                // eventos de la Activity, así que hay que ADELANTAR el ciclo
                // de vida manualmente o la superficie GL nunca arranca y el
                // mapa queda en blanco (el bug de la v1.2 inicial).
                runCatching { mv.onCreate(null) }
                runCatching { mv.onStart() }
                runCatching { mv.onResume() }
                entry.stage = 2

                mv.getMapAsync { map ->
                    map.setStyle(Style.Builder().fromJson(styleJson)) { style ->
                        // imágenes base64 → style
                        if (images != null) {
                            val it2 = images.keys()
                            while (it2.hasNext()) {
                                val name = it2.next()
                                val b64 = images.getString(name) ?: continue
                                val bmp = decodeBase64(b64)
                                if (bmp != null) style.addImage(name, bmp)
                            }
                        }
                        map.addOnMapClickListener { latLng ->
                            val data = JSObject()
                            data.put("id", id)
                            data.put("lat", latLng.latitude)
                            data.put("lng", latLng.longitude)
                            notifyListeners("mapclick", data)
                            true
                        }
                        map.addOnCameraMoveStartedListener { reason ->
                            if (reason == MapLibreMap.OnCameraMoveStartedListener.REASON_API_GESTURE) {
                                val data = JSObject()
                                data.put("id", id)
                                notifyListeners("usermove", data)
                            }
                        }
                        entry.map = map
                        entry.ready = true
                        val data = JSObject()
                        data.put("id", id)
                        notifyListeners("mapready", data)
                    }
                }
                call.resolve()
            } catch (e: Exception) {
                call.reject("create falló: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun setData(call: PluginCall) {
        val id = call.getString("id") ?: return call.reject("id requerido")
        val sources = call.getObject("sources")
        val entry = entry(id) ?: return call.resolve()
        bridge.activity.runOnUiThread {
            val style = entry.map?.style ?: return@runOnUiThread
            val keys = sources.keys()
            while (keys.hasNext()) {
                val name = keys.next()
                val json = sources.getString(name) ?: continue
                val src = style.getSourceAs<GeoJsonSource>(name)
                try {
                    src?.setGeoJson(json)
                } catch (_: Exception) {
                }
            }
            call.resolve()
        }
    }

    @PluginMethod
    fun setCamera(call: PluginCall) {
        val id = call.getString("id") ?: return call.reject("id requerido")
        val entry = entry(id) ?: return call.resolve()
        val lat = call.getDouble("lat") ?: return call.resolve()
        val lng = call.getDouble("lng") ?: return call.resolve()
        val zoom = (call.getDouble("zoom") ?: entry.map?.cameraPosition?.zoom ?: 14.0).toDouble()
        val tilt = (call.getDouble("pitch") ?: 0.0).toDouble()
        val bearing = (call.getDouble("bearing") ?: 0.0).toDouble()
        val animated = call.getBoolean("animated", true) ?: true
        val duration = call.getInt("duration", 680) ?: 680
        val pad = call.getObject("padding")
        bridge.activity.runOnUiThread {
            val map = entry.map ?: return@runOnUiThread
            try {
                if (pad != null) {
                    val d = density.toDouble()
                    map.setPadding(
                        Math.round(((pad.getDouble("left") ?: 0.0)) * d).toInt(),
                        Math.round(((pad.getDouble("top") ?: 0.0)) * d).toInt(),
                        Math.round(((pad.getDouble("right") ?: 0.0)) * d).toInt(),
                        Math.round(((pad.getDouble("bottom") ?: 0.0)) * d).toInt()
                    )
                }
                val cp = CameraPosition.Builder()
                    .target(LatLng(lat, lng))
                    .zoom(zoom)
                    .tilt(tilt)
                    .bearing(bearing)
                    .build()
                if (animated) {
                    map.easeCamera(CameraUpdateFactory.newCameraPosition(cp), duration, false)
                } else {
                    map.moveCamera(CameraUpdateFactory.newCameraPosition(cp))
                }
            } catch (_: Exception) {
            }
            call.resolve()
        }
    }

    /** Rect del contenedor del mapa (CSS px, viewport) → ventana del backdrop. */
    @PluginMethod
    fun setRect(call: PluginCall) {
        val id = call.getString("id") ?: return call.reject("id requerido")
        val x = (call.getDouble("x") ?: 0.0).toFloat() * density
        val y = (call.getDouble("y") ?: 0.0).toFloat() * density
        val w = (call.getDouble("w") ?: 0.0).toFloat() * density
        val h = (call.getDouble("h") ?: 0.0).toFloat() * density
        val radius = (call.getDouble("radius") ?: 12.0).toFloat() * density
        bridge.activity.runOnUiThread {
            ensureStack()
            val bd = backdrop ?: return@runOnUiThread
            val hole = if (w < 8f || h < 8f) null else Hole(x + webOffsetX, y + webOffsetY, w, h, radius)
            bd.refresh(id, hole)
            call.resolve()
        }
    }

    @PluginMethod
    fun destroy(call: PluginCall) {
        val id = call.getString("id") ?: return call.reject("id requerido")
        bridge.activity.runOnUiThread {
            maps.remove(id)?.let { teardown(it) }
            backdrop?.refresh(id, null)
            call.resolve()
        }
    }

    // ------------------------------------------------------------ ciclo de vida

    /** Detiene y libera un MapView con la secuencia completa. */
    private fun teardown(e: MapEntry) {
        runCatching { e.mapView.onPause() }
        runCatching { e.mapView.onStop() }
        runCatching { e.mapView.onDestroy() }
        (e.mapView.parent as? ViewGroup)?.removeView(e.mapView)
        e.stage = 0
        e.ready = false
    }

    override fun handleOnStart() {
        maps.values.forEach { e -> if (e.stage < 1) { runCatching { e.mapView.onStart() }; e.stage = 1 } }
    }

    override fun handleOnResume() {
        maps.values.forEach { e -> if (e.stage < 2) { runCatching { e.mapView.onResume() }; e.stage = 2 } }
    }

    override fun handleOnPause() {
        maps.values.forEach { e -> if (e.stage == 2) { runCatching { e.mapView.onPause() }; e.stage = 1 } }
    }

    override fun handleOnStop() {
        maps.values.forEach { e -> if (e.stage >= 1) { runCatching { e.mapView.onStop() }; e.stage = 0 } }
    }

    override fun handleOnDestroy() {
        maps.values.forEach { teardown(it) }
        maps.clear()
        backdrop = null
    }

    companion object {
        private val MATCH_PARENT = ViewGroup.LayoutParams.MATCH_PARENT
        private fun decodeBase64(b64: String): Bitmap? = try {
            val clean = if (b64.contains(",")) b64.substringAfter(",") else b64
            val bytes = Base64.decode(clean, Base64.DEFAULT)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        } catch (_: Exception) {
            null
        }
    }
}
