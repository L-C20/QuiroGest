/* =====================================================
   Almacenamiento externo de respaldos (compatible con S3)

   Funciona con Backblaze B2, Cloudflare R2, Amazon S3, Wasabi, etc.

   Variables:
     BACKUP_S3_BUCKET             nombre del bucket
     BACKUP_S3_ACCESS_KEY_ID      clave de acceso
     BACKUP_S3_SECRET_ACCESS_KEY  clave secreta
     BACKUP_S3_ENDPOINT           ej. https://s3.us-west-004.backblazeb2.com
                                  (no hace falta en Amazon S3)
     BACKUP_S3_REGION             por defecto "auto" (en AWS: la región real)
     BACKUP_S3_PREFIX             carpeta dentro del bucket (por defecto "gestiontec/")
     BACKUP_S3_PATH_STYLE=true    solo si el proveedor lo pide
===================================================== */

const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    DeleteObjectCommand,
    ListObjectsV2Command
} = require("@aws-sdk/client-s3");


function configurado() {

    return Boolean(
        process.env.BACKUP_S3_BUCKET &&
        process.env.BACKUP_S3_ACCESS_KEY_ID &&
        process.env.BACKUP_S3_SECRET_ACCESS_KEY
    );
}

function prefijo() {

    const valor = process.env.BACKUP_S3_PREFIX === undefined
        ? "gestiontec/"
        : process.env.BACKUP_S3_PREFIX;

    return valor && !valor.endsWith("/") ? valor + "/" : valor;
}


function crearProveedorS3() {

    const bucket = process.env.BACKUP_S3_BUCKET;

    const cliente = new S3Client({
        region: process.env.BACKUP_S3_REGION || "auto",
        endpoint: process.env.BACKUP_S3_ENDPOINT || undefined,
        forcePathStyle: process.env.BACKUP_S3_PATH_STYLE === "true",
        // compatibilidad con proveedores S3 que no aceptan los checksums nuevos del SDK (Backblaze B2, etc.)
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
        credentials: {
            accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY
        }
    });

    return {

        nombre: "s3",

        async subir(clave, datos) {

            await cliente.send(new PutObjectCommand({
                Bucket: bucket,
                Key: clave,
                Body: datos,
                ContentType: "application/octet-stream"
            }));

            // verificación: el objeto existe y tiene el tamaño enviado
            const cabecera = await cliente.send(new HeadObjectCommand({ Bucket: bucket, Key: clave }));

            if (Number(cabecera.ContentLength) !== datos.length) {

                throw new Error(
                    `El archivo subido no coincide (${cabecera.ContentLength} bytes en vez de ${datos.length}).`
                );
            }
        },

        async listar(prefix) {

            const items = [];

            let token;

            do {

                const respuesta = await cliente.send(new ListObjectsV2Command({
                    Bucket: bucket,
                    Prefix: prefix,
                    ContinuationToken: token
                }));

                for (const objeto of respuesta.Contents || []) {

                    items.push({
                        clave: objeto.Key,
                        bytes: objeto.Size,
                        modificado: objeto.LastModified
                    });
                }

                token = respuesta.IsTruncated ? respuesta.NextContinuationToken : undefined;

            } while (token);

            return items;
        },

        async borrar(clave) {

            await cliente.send(new DeleteObjectCommand({ Bucket: bucket, Key: clave }));
        },

        async descargar(clave) {

            const respuesta = await cliente.send(new GetObjectCommand({ Bucket: bucket, Key: clave }));

            const partes = [];

            for await (const parte of respuesta.Body) {
                partes.push(parte);
            }

            return Buffer.concat(partes);
        }
    };
}


module.exports = { configurado, crearProveedorS3, prefijo };
