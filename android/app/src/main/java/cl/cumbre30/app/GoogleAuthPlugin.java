package cl.cumbre30.app;

import android.content.Intent;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Google Sign-In nativo para Cumbre30 (offline).
 *
 * Usa el SDK clásico de Google Play Services (GoogleSignInClient) para
 * abrir el selector de cuentas nativo — sin Firebase ni servidor propio.
 * Requisitos en Google Cloud Console (ver GUIA-GOOGLE-SIGNIN.md):
 *   1. Client ID OAuth tipo "Web application"  → se pide como requestIdToken.
 *   2. Client ID OAuth tipo "Android" con el paquete cl.cumbre30.app
 *      y el SHA-1 del keystore de la APK.
 * Ambos en el MISMO proyecto de Google Cloud.
 */
@CapacitorPlugin(name = "GoogleAuth")
public class GoogleAuthPlugin extends Plugin {

    private GoogleSignInClient client;
    private String webClientId = "";

    @PluginMethod
    public void signIn(PluginCall call) {
        String clientId = call.getString("webClientId", "");
        if (clientId == null || clientId.isEmpty()) {
            call.reject("Falta configurar el Client ID de Google (webClientId).", "NO_CLIENT_ID");
            return;
        }
        if (client == null || !webClientId.equals(clientId)) {
            webClientId = clientId;
            GoogleSignInOptions opts = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                    .requestIdToken(webClientId)
                    .requestEmail()
                    .build();
            client = GoogleSignIn.getClient(getContext(), opts);
        }
        startActivityForResult(call, client.getSignInIntent(), "signInResult");
    }

    @ActivityCallback
    private void signInResult(PluginCall call, Intent data) {
        if (call == null) return; // la actividad se destruyó mientras tanto
        Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
        try {
            GoogleSignInAccount acct = task.getResult(ApiException.class);
            String sub = acct.getId();
            String idToken = acct.getIdToken();
            if ((sub == null || sub.isEmpty()) && idToken != null) {
                sub = jwtSub(idToken);
            }
            JSObject ret = new JSObject();
            ret.put("sub", sub != null ? sub : "");
            ret.put("email", acct.getEmail() != null ? acct.getEmail() : "");
            ret.put("name", acct.getDisplayName() != null ? acct.getDisplayName() : "");
            ret.put("idToken", idToken != null ? idToken : "");
            if (acct.getPhotoUrl() != null) ret.put("photoUrl", acct.getPhotoUrl().toString());
            call.resolve(ret);
        } catch (ApiException e) {
            int code = e.getStatusCode();
            String msg;
            if (code == 12501) {
                msg = "Inicio de sesión cancelado.";
            } else if (code == 7) {
                msg = "Sin conexión con Google. Revisa tu internet e intenta otra vez.";
            } else if (code == 10 || code == 8) {
                msg = "Google no reconoce esta app: revisa en Cloud Console el Client ID, "
                        + "el paquete cl.cumbre30.app y el SHA-1 (ver GUIA-GOOGLE-SIGNIN.md).";
            } else if (code == 12502) {
                msg = "Ya hay un inicio de sesión en curso.";
            } else {
                msg = "Error de Google Sign-In (código " + code + ").";
            }
            call.reject(msg, "GSI_" + code);
        }
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        if (client == null) {
            GoogleSignInOptions opts = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN).build();
            client = GoogleSignIn.getClient(getContext(), opts);
        }
        client.signOut().addOnCompleteListener(t -> call.resolve());
    }

    /**
     * Extrae "sub" del payload de un JWT sin verificar la firma:
     * el token llegó directo del SDK nativo de Google (Play Services),
     * y solo lo usamos para enlazar la cuenta local, no para autorizar nada remoto.
     */
    private static String jwtSub(String jwt) {
        try {
            String[] parts = jwt.split("\\.");
            if (parts.length < 2) return null;
            byte[] bytes = Base64.decode(parts[1], Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
            String json = new String(bytes, StandardCharsets.UTF_8);
            Matcher m = Pattern.compile("\"sub\"\\s*:\\s*\"([^\"]+)\"").matcher(json);
            return m.find() ? m.group(1) : null;
        } catch (Exception e) {
            return null;
        }
    }
}
