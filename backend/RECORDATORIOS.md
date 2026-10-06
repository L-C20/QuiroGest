# Recordatorios de turnos (WhatsApp y correo)

El sistema ya trae todo armado. **Está apagado** hasta que se carguen las claves
como variables de entorno en Railway (servicio `QuiroGest` → Variables).
No hace falta tocar código.

## Cómo funciona

- Cada 10 minutos revisa los turnos **pendientes o confirmados** que empiezan en
  las próximas 24 horas (y a más de 1 hora de distancia).
- Envía un aviso por cada canal disponible del paciente: correo si tiene email
  válido, WhatsApp si tiene teléfono válido.
- Cada envío queda registrado en la tabla `recordatorios` (se crea sola).
  **Nunca se envía dos veces el mismo aviso** por turno y canal.
- Si un envío falla, se reintenta (hasta 3 intentos en total).
- Si el paciente no tiene ningún dato de contacto, el turno queda marcado
  como **"Sin datos de contacto"** para avisarle a mano.
- Se ve el estado y el historial en **Turnos → Recordatorios**.
- Los teléfonos se normalizan solos (`11 5555-0000`, `011 15 5555 0000`,
  `+54 9 11 5555 0000` → `5491155550000`). Para otro país, definir `DEFAULT_COUNTRY_CODE`.

## Activarlo

| Variable | Valor | Para qué |
|---|---|---|
| `REMINDERS_ENABLED` | `true` | Enciende el sistema |
| `CONSULTORIO_NOMBRE` | `Consultorio X` | Nombre que aparece en los mensajes |

Recomendado: primero probar con `REMINDER_DRY_RUN=true`. El servidor muestra en
los logs a quién avisaría, sin enviar ni registrar nada.

### Correo (Resend, https://resend.com)

| Variable | Valor |
|---|---|
| `RESEND_API_KEY` | clave de la API |
| `EMAIL_FROM` | remitente verificado, ej. `Consultorio <turnos@midominio.com>` |

Requiere verificar el dominio (o el correo) remitente en Resend.
Para usar otro proveedor (Brevo, SendGrid, SMTP) solo se cambia
`src/services/recordatorios/canales/email.js`.

### WhatsApp (API oficial de WhatsApp Business / Meta)

Para la reunión, estas son las cosas a resolver:

1. Cuenta de **Meta Business** verificada.
2. Dar de alta el **número del consultorio** en la plataforma de WhatsApp Business.
   Consultar si se puede **seguir usando la app de WhatsApp Business en ese mismo
   número** (función de "coexistencia") o si el número queda solo para la API.
3. Crear y hacer aprobar una **plantilla** de categoría *Utilidad* con 4 variables,
   en este orden: `{{1}}` nombre, `{{2}}` fecha, `{{3}}` hora, `{{4}}` consultorio.
   Ejemplo:
   > Hola {{1}}, te recordamos tu turno el {{2}} a las {{3}} en {{4}}.
   > Si no podés asistir, respondé a este mensaje.
4. Preguntar el **costo por mensaje** según país y categoría.
5. Si se usa un proveedor intermediario (Twilio, 360dialog, etc.), consultar si
   expone la API oficial de Meta; si no, hay que adaptar `canales/whatsapp.js`.

Con eso se cargan:

| Variable | Valor |
|---|---|
| `WHATSAPP_TOKEN` | token de acceso permanente |
| `WHATSAPP_PHONE_ID` | ID del número en Meta |
| `WHATSAPP_TEMPLATE_NAME` | nombre de la plantilla aprobada |
| `WHATSAPP_TEMPLATE_LANG` | idioma de la plantilla (por defecto `es_AR`) |

## Otras opciones

| Variable | Por defecto | Descripción |
|---|---|---|
| `REMINDER_HOURS_BEFORE` | `24` | Horas de anticipación |
| `REMINDER_INTERVAL_MIN` | `10` | Cada cuántos minutos revisa |
| `REMINDER_TZ` | `America/Argentina/Buenos_Aires` | Zona horaria del consultorio |
| `REMINDER_TEXT` | texto estándar | Texto del correo: `{nombre} {fecha} {hora} {consultorio}` |
| `REMINDER_DRY_RUN` | — | `true` = simulacro, no envía ni registra |

## Probar una revisión a mano

`POST /recordatorios/ejecutar` (con token de sesión) ejecuta una revisión
inmediata y devuelve `{ revisados, enviados, fallidos, sinContacto }`.

## Consentimiento

Conviene avisar a los pacientes que recibirán recordatorios por estos medios
y registrar su consentimiento, según la normativa de protección de datos vigente.
