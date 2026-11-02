package cl.cumbre30.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    // ⚠️ En Capacitor 8, super.onCreate() crea el Bridge y consume la lista
    // de plugins: los registerPlugin DEBEN ir ANTES de super.onCreate().
    // (Así estaban después y nunca se registraban → "not implemented".)
    // Mapas nativos (MapLibre Native) bajo el WebView
    registerPlugin(NativeMapPlugin.class);
    // GPS en primer plano (FGS tipo LOCATION) + hápticos nativos
    registerPlugin(RideNativePlugin.class);
    // Inicio de sesión con Google (selector de cuentas nativo)
    registerPlugin(GoogleAuthPlugin.class);
    super.onCreate(savedInstanceState);
    hideStatusBar();
  }

  /**
   * Pantalla completa (modo inmersivo): oculta la barra de notificaciones
   * para que no tape las opciones del banner superior. El usuario puede
   * mostrarla momentáneamente deslizando desde el borde superior y se
   * vuelve a ocultar sola (BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE).
   */
  private void hideStatusBar() {
    WindowInsetsControllerCompat ctrl =
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    ctrl.hide(WindowInsetsCompat.Type.statusBars());
    ctrl.setSystemBarsBehavior(
        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    // Al volver de otra actividad (p. ej. el selector de cuentas de Google)
    // la barra reaparece: la volvemos a ocultar.
    if (hasFocus) hideStatusBar();
  }
}
