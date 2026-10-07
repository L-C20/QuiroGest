# Respaldos de GestionTec Medical

El sistema crea una copia **completa, comprimida y cifrada** (AES-256) de toda la base:
todos los consultorios, usuarios, pacientes, turnos, pagos, recordatorios y auditoría. Se
guarda **fuera de Railway** y se puede restaurar desde cero en cualquier base vacía.

Se ve y se maneja desde el **Panel del proveedor → Respaldos** (solo super admin).

## Cómo funciona

- **Automático:** una vez por día, a partir de las 3:00 (hora de Argentina), si están
  configuradas la clave de cifrado y el almacenamiento externo. Si falla, reintenta a las 2 horas.
- **Conserva:** los últimos **7 días**, **4 semanas** y **12 meses** (el resto se borra solo).
  Nunca borra el más reciente ni archivos que no sean respaldos.
- **Respaldar ahora:** crea uno en el momento en el almacenamiento externo.
- **Descargar respaldo:** baja un archivo `.gtbak` cifrado a tu computadora (no necesita
  almacenamiento externo, solo la clave de cifrado).
- Cada respaldo se toma como una "foto" consistente (todas las tablas del mismo instante).
- El panel avisa si el último automático falló o si hace más de 36 horas que no se guarda uno.

## Puesta en marcha (una sola vez)

### 1. Activar también los respaldos propios de Railway
En Railway, servicio **Postgres → pestaña Backups**: activá el programa **Diario** y el
**Semanal**. Es una protección extra y de restauración rápida, pero vive **dentro del mismo
volumen**: si se borra el volumen, se borran también esos respaldos. Por eso hace falta la copia
externa de abajo.

### 2. Crear el almacenamiento externo
Sirve cualquier servicio compatible con S3. Dos opciones con plan gratuito:

- **Backblaze B2** (https://www.backblaze.com/cloud-storage)
- **Cloudflare R2** (https://www.cloudflare.com/developer-platform/r2/)

Pasos (iguales en ambos):
1. Creá un **bucket privado** (por ejemplo `gestiontec-respaldos`).
2. Creá una **clave de aplicación / token de API** con permiso de lectura y escritura
   **solo sobre ese bucket**.
3. Anotá: el nombre del bucket, el *endpoint*, el *Key ID* y la *clave secreta*.

### 3. Generar la clave de cifrado
En esta carpeta (`backend`):

```
node generarClaveRespaldo.js
```

Copiá el resultado y **guardalo en un gestor de contraseñas, fuera de Railway**. Sin esta clave
los respaldos no se pueden abrir y nadie puede recuperarla.

### 4. Cargar las variables en Railway (servicio `QuiroGest` → Variables)

| Variable | Valor |
|---|---|
| `BACKUP_ENCRYPTION_KEY` | la clave del paso 3 |
| `BACKUP_S3_BUCKET` | nombre del bucket |
| `BACKUP_S3_ACCESS_KEY_ID` | Key ID |
| `BACKUP_S3_SECRET_ACCESS_KEY` | clave secreta |
| `BACKUP_S3_ENDPOINT` | Backblaze: `https://s3.<region>.backblazeb2.com` · R2: `https://<ID_DE_CUENTA>.r2.cloudflarestorage.com` |
| `BACKUP_S3_REGION` | Backblaze: la región del endpoint (ej. `us-west-004`) · R2: `auto` |

Opcionales:

| Variable | Por defecto | Para qué |
|---|---|---|
| `BACKUP_S3_PREFIX` | `gestiontec/` | carpeta dentro del bucket |
| `BACKUP_HOUR` | `3` | hora local desde la cual se hace el respaldo diario |
| `BACKUP_TZ` | `America/Argentina/Buenos_Aires` | zona horaria |
| `BACKUP_KEEP_DAILY` / `_WEEKLY` / `_MONTHLY` | `7` / `4` / `12` | cuántos conservar |
| `BACKUP_S3_PATH_STYLE` | — | `true` solo si el proveedor lo exige |

### 5. Verificar
En el panel, **Respaldos → Respaldar ahora**. Debe aparecer una fila "Correcto" y el archivo
`gestiontec-AAAAMMDD-HHMMSS.gtbak` en el bucket.

## Restaurar

Se necesita una base de PostgreSQL **vacía** (por ejemplo, un servicio Postgres nuevo en Railway),
la clave de cifrado y el archivo. Desde la carpeta `backend`:

```
# ver qué respaldos hay en el almacenamiento externo
node restaurar.js --listar

# comprobar un respaldo sin tocar ninguna base (clave, integridad y filas por tabla)
node restaurar.js gestiontec-20261007-030000.gtbak --verificar

# restaurar en la base de destino (DATABASE_URL = la base NUEVA)
node restaurar.js gestiontec-20261007-030000.gtbak

# o directamente desde el almacenamiento externo
node restaurar.js --s3 gestiontec/gestiontec-20261007-030000.gtbak
```

Variables necesarias al restaurar: `BACKUP_ENCRYPTION_KEY`, `DATABASE_URL` (destino) y, si se lee
del almacenamiento externo, las `BACKUP_S3_*`. Agregá `DB_SSL=false` si el destino no usa SSL.

- La restauración **se niega** si la base de destino ya tiene tablas. Para pisar una base
  existente hay que agregar `--reemplazar-todo` (borra todo lo que haya ahí).
- Es todo o nada: si algo falla, se revierte y la base queda como estaba.
- Al terminar, verifica que cada tabla tenga exactamente las filas del respaldo.

**Después de restaurar:** apuntá el servicio `QuiroGest` a la base restaurada (variable
`DATABASE_URL`) y reiniciá. Los usuarios entran con sus mismas contraseñas.

## Qué incluye y qué no

- **Incluye:** estructura y datos de todas las tablas, restricciones, índices y secuencias.
- **No incluye:** variables de entorno ni código (el código está en GitHub), y objetos de base
  poco comunes como vistas, funciones o disparadores (hoy no existen; si algún día se agregan,
  el panel avisa en las advertencias del respaldo).

## Buenas prácticas

- Hacé un **simulacro** una vez al mes: `node restaurar.js --s3 <archivo> --verificar` y, cada
  tanto, una restauración completa en una base de prueba.
- Los respaldos contienen datos de salud y contraseñas (protegidas): mantené el bucket
  **privado**, con una clave de acceso limitada a ese bucket.
- Guardá la clave de cifrado en al menos **dos lugares seguros** distintos.
- Si cambiás la clave de cifrado, los respaldos viejos solo se abren con la clave vieja:
  conservala mientras existan.
