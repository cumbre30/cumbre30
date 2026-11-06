// ============================================================
// Google Play Billing — compra única del plan Pro (non-consumable).
//
// Usa cordova-plugin-purchase v13 (window.CdvPurchase), el puente
// Cordova que Capacitor carga nativamente. Solo opera en builds
// nativos con NEXT_PUBLIC_PLAY_BUILD=1; en web/APK directo la
// compra vive fuera de la app (página /pro + código de canje).
//
// Entitlement: si la compra está OWNED se guarda un flag local
// (cumbre30-play-pro-v1) que proLicense respete como Pro. En cada
// arranque se re-consulta a Play (restore implícito vía store.update).
// ============================================================

export const PLAY_PRO_FLAG = "cumbre30-play-pro-v1";

export function playProOwned(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(PLAY_PRO_FLAG) === "1";
  } catch {
    return false;
  }
}

export function setPlayProOwned(owned: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (owned) localStorage.setItem(PLAY_PRO_FLAG, "1");
    else localStorage.removeItem(PLAY_PRO_FLAG);
  } catch {
    // almacenamiento bloqueado
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function store(): any | null {
  if (typeof window === "undefined") return null;
  const s = (window as any)?.CdvPurchase?.store;
  return s && typeof s.register === "function" ? s : null;
}

/** ¿Este teléfono puede comprar con Play Billing? (nativo + plugin cargado) */
export function playBillingAvailable(): boolean {
  return store() != null;
}

/** Precio formateado que reporta Play para el producto, si ya cargó. */
export function playProPrice(): string | null {
  try {
    const p = store()?.get?.(process.env.NEXT_PUBLIC_PLAY_PRODUCT_ID ?? "cumbre30_pro");
    return p?.pricing?.price ?? null;
  } catch {
    return null;
  }
}

/**
 * Inicializa el store, registra el producto y deja escuchando cambios
 * de estado. Devuelve true si el producto quedó consultable. Idempotente.
 */
export async function initPlayBilling(
  productId: string,
  onOwned: () => void,
): Promise<{ ok: boolean; note?: string }> {
  const s = store();
  if (!s) return { ok: false, note: "plugin-no-disponible" };
  try {
    const Cdv = (window as any).CdvPurchase;
    // Compra ya vigente (compró antes o reinstaló): restaurar.
    if (typeof s.owned === "function" && s.owned(productId)) {
      setPlayProOwned(true);
      onOwned();
    }
    s.when?.()
      ?.approved?.((t: any) => {
        // Non-consumable: finish() = acknowledge ante Play.
        void Promise.resolve(t?.finish?.()).catch(() => undefined);
      })
      ?.updated?.((p: any) => {
        if (p?.id === productId && typeof s.owned === "function" && s.owned(productId)) {
          setPlayProOwned(true);
          onOwned();
        }
      });
    await s.register([
      {
        id: productId,
        type: Cdv?.ProductType?.NON_CONSUMABLE ?? "NON_CONSUMABLE",
        platform: Cdv?.Platform?.GOOGLE_PLAY ?? "GOOGLE_PLAY",
      },
    ]);
    await s.update();
    if (typeof s.owned === "function" && s.owned(productId)) {
      setPlayProOwned(true);
      onOwned();
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, note: e instanceof Error ? e.message : "error-init" };
  }
}

/** Inicia la compra del producto Pro. Devuelve null si partió bien. */
export async function buyPlayPro(productId: string): Promise<string | null> {
  const s = store();
  if (!s) return "Google Play no está disponible en este momento.";
  try {
    const product = s.get?.(productId);
    const offer = product?.offers?.[0] ?? product;
    if (!offer) {
      return "El producto aún no está disponible en Play. Intenta más tarde o activa un código de la web.";
    }
    const order = s.order ?? s.requestPurchase;
    if (typeof order !== "function") return "No pudimos iniciar la compra.";
    await order.call(s, offer);
    return null;
  } catch (e) {
    if (e && typeof e === "object" && "code" in e) {
      // Canceló el diálogo de Play: no es error para el usuario.
      const code = String((e as any).code ?? "");
      if (code.includes("cancel") || code === "-1" || code.includes("USER_CANCELED")) return null;
    }
    return "No se pudo iniciar la compra. Verifica tu cuenta Google e intenta de nuevo.";
  }
}

/** Reintenta restaurar una compra previa (mismo cuenta Google). */
export async function restorePlayPro(productId: string, onOwned: () => void): Promise<string | null> {
  const s = store();
  if (!s) return "Google Play no está disponible en este momento.";
  try {
    await s.update();
    if (typeof s.owned === "function" && s.owned(productId)) {
      setPlayProOwned(true);
      onOwned();
      return null;
    }
    return "No encontramos una compra Pro asociada a esta cuenta Google.";
  } catch {
    return "No pudimos consultar tus compras. Revisa tu conexión e intenta de nuevo.";
  }
}
