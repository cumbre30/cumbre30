# Registro de actividades de tratamiento - Cumbre30

**Documento interno** exigible por la Ley 21.719 desde su entrada en vigencia (premisa del encargo: 2026-12-01; el Congreso aprobó el 2026-11-17 postergarla al 2027-10-15, pendiente de publicación oficial). Durante la transición rige la Ley 19.628.

**Responsable:** persona natural titular del proyecto (marca Cumbre GEO). RUT y datos de contacto: ver Política de Privacidad publicada (cumbregeo.cl/privacidad). Contacto de privacidad: contacto.cumbre30@gmail.com.

**Última revisión:** 2026-11-18 (auditoría pre-lanzamiento, corrección A-02). Próxima revisión: al habilitar funciones comunitarias nuevas, al monetizar, o ante cambios en proveedores.

## Actividades de tratamiento

| # | Actividad | Finalidad | Base jurídica | Categorías de datos | Destinatarios | Transferencia internacional | Plazo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Gestión de cuenta (registro, login) | Identificar y autenticar al usuario | Ejecución de contrato | Correo, usuario, hash de contraseña | Servidor propio (Vercel + Neon) | Sí (hosting/base fuera de Chile) | Vida de la cuenta |
| 2 | Inicio de sesión con Google | Autenticación alternativa | Consentimiento (OAuth) | Identificador Google, correo, nombre | Google (tokeninfo) | Sí (EE. UU.) | Vida de la cuenta |
| 3 | Sincronización de rides y logros | Historial y desafíos en la nube | Consentimiento (opt-in con sesión) | Estadísticas deportivas agregadas (sin coordenadas) | Servidor propio | Sí | Hasta borrado por el usuario |
| 4 | Captura GPS en el ride | Ciclocomputador, geocercas, alertas 30 km/h | Consentimiento técnico (permiso del SO) + finalidad transparente | Ubicación en tiempo real | Ninguno: procesamiento 100% local | No | No persiste salvo tracks locales |
| 5 | Pista GPS local | Mapa del recorrido, GPX, constancias | Consentimiento (en dispositivo) | Coordenadas 1 Hz | Ninguno (no sube al servidor) | No | Hasta borrado (cap automático) |
| 6 | Sensores BLE (pulso, velocidad) | Métricas deportivas en vivo | Consentimiento EXPLÍCITO (dato de salud) | Frecuencia cardíaca, CSC | Ninguno: procesamiento local | No | No persiste |
| 7 | Contactos de emergencia (ICE) | Aviso en emergencias | Consentimiento del usuario; datos de terceros | Nombre y teléfono de terceros, ubicación en el mensaje | App de mensajería elegida por el usuario (SMS/WhatsApp) | Según proveedor de mensajería | Local hasta borrado |
| 8 | Ventas Cumbre30 Pro | Cobro y entrega de códigos | Ejecución de contrato | Correo, monto, código, id de pago | Mercado Pago, Gmail SMTP | Sí | Plazo tributario (definir con contador) |
| 9 | Push web (avisos del parque) | Notificaciones operativas | Consentimiento al suscribirse | Endpoint de push, claves criptográficas | Servicio push del navegador | Sí | Hasta baja o caducidad |
| 10 | Incidencias comunitarias | Seguridad del parque | Consentimiento al publicar | Tipo, coordenadas del punto, nota, usuario | Todos los usuarios de la app | Sí (servidor) | Ocultas tras 30 días sin confirmaciones |
| 11 | Constancias de trayecto | Verificación pública de autenticidad | Consentimiento al emitir | Hash SHA-256, resumen del ride, usuario | Quien tenga el enlace/QR | Sí (servidor) | Indefinido (revisar minimización) |
| 12 | Geocodificación y clima | Nombres de sectores, banner de clima | Interés legítimo técnico, informado en la política | Consultas puntuales (texto o coordenadas del momento) | Photon (Komoot), Nominatim (OSM), Open-Meteo | Sí (UE) | No persiste (caché local breve) |

## Encargados y proveedores

- **Vercel Inc.** (hosting y funciones serverless): revisar DPA estándar; región de las funciones.
- **Neon** (base de datos Postgres): revisar DPA, región de la base y cifrado en reposo.
- **Google** (Sign-In): Política de Datos de Usuario de las API aplicable.
- **Mercado Pago** (pagos): condiciones de comercios; datos de tarjeta nunca tocan el servidor propio.
- **Gmail SMTP** (entrega de códigos): cuenta dedicada del titular.
- **Photon, Nominatim, Open-Meteo** (funciones de mapa/clima): políticas de uso público.

Pendiente documentado (corrección D-05): registrar fecha y versión de cada DPA o términos aceptados, y la región efectiva de la base de datos.

## Medidas de seguridad aplicadas

- Minimización estructural: la pista GPS completa nunca sale del dispositivo.
- Contraseñas con scrypt (servidor) y PBKDF2 (local); tokens de sesión opacos y revocables.
- Rate limiting en autenticación; claves administrativas solo en el servidor, con comparación timing-safe.
- Backups de Android restringidos (allowBackup desactivado).
- Borrado de cuenta con cascade completo (DELETE /api/auth/account).

## Derechos y procedimientos

Acceso, rectificación, supresión, oposición y portabilidad: export JSON en Perfil, Mis datos (A-02) y export GPX de rides; eliminación total desde la app o cumbregeo.cl/eliminar-cuenta. Canal: contacto.cumbre30@gmail.com. Plazo de respuesta interno: 10 días hábiles.
