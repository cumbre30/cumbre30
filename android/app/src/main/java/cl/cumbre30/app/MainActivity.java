package cl.cumbre30.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Mapas nativos (MapLibre Native) bajo el WebView
    registerPlugin(NativeMapPlugin.class);
  }
}
