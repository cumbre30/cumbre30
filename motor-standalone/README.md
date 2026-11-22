# Proyecto de validación independiente del MotorGPS

Punto 6 del encargo de cierre de la fase única: demuestra que el núcleo
del motor (`src/motor/*`) es reutilizable **sin Cumbre30**.

## Ejecutar

```bash
npx tsx motor-standalone/validacion.ts          # demo completa
npx tsc --noEmit -p motor-standalone/tsconfig.json   # chequeo de tipos aislado
```

## Qué demuestra

| Requisito del encargo | Cómo se cumple |
| --- | --- |
| Crear su propia configuración | `MI_CONFIG` con `resolverMotorConfig` (perfil propio, sin el perfil de la app) |
| Inyectar una fuente de ubicación | `miFuente()` — generador sintético propio, ni `navigator.geolocation` ni el plugin nativo |
| Iniciar el motor y recibir eventos tipados | `motor.iniciar(...)`, `motor.on((e: EventoMotor) => ...)` |
| Consultar métricas | `motor.snapshot()`, `motor.velKmhActual()` |
| Gestionar su propio almacenamiento | `miAlmacen()` implementa `AlmacenCheckpoint` sobre un archivo JSON de este proyecto |
| Ejecutar pruebas con RideSimulator | Ruta propia (Madrid) inyectada en `RideSimulator` |
| Recuperación ante cierre | Otro `MotorGPS` retoma el checkpoint desde el almacén propio |

## Regla de independencia

Este proyecto solo importa:

- `../src/motor/index` — la API pública del motor (barrel).
- `../src/lib/simulation` — el simulador (toolkit reutilizable; solo
  depende del núcleo del motor).

No hay alias `@/...` ni rutas internas de Cumbre30. Su `tsconfig.json`
no define `paths`: si alguien reintrodujera una dependencia de la app
en el núcleo, este proyecto dejaría de compilar. El chequeo continuo de
esa regla vive en `tests/motor-cierre.test.ts` (pureza del núcleo).

Este proyecto no requiere interfaz gráfica ni empaquetado: es la
estructura técnica que servirá de base cuando se decida publicar el
motor como SDK.
