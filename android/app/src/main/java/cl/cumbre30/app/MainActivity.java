package cl.cumbre30.app;

import android.os.Bundle;
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
  }
}
