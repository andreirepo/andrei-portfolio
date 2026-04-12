---
title: "Reenvío de correo a Gmail con AWS SES, S3 y Lambda"
description: "Cómo configuré un pipeline serverless de reenvío de correo en AWS para mantener mi dirección de Gmail privada mientras recibo mensajes en contact@andreirepo.com."
pubDate: 2025-03-15
tags: ["aws", "lambda", "ses", "s3", "serverless"]
draft: false
---

Quería tener un correo de contacto en mi portfolio sin publicar mi dirección real de Gmail. Pagar Google Workspace solo para recibir algún mensaje ocasional me parecía excesivo, así que construí un pipeline serverless de reenvío en AWS usando SES, S3 y Lambda.

La idea es simple: SES recibe el correo en `contact@andreirepo.com`, almacena el mensaje en S3, y una función Lambda lo recoge, reescribe las cabeceras y lo reenvía a mi bandeja de Gmail.

## La Arquitectura

```
Remitente → SES (regla de recepción) → S3 bucket → Lambda → SES (envío) → Gmail
```

Todo configurado desde la consola de AWS — sin Terraform, sin CDK.

## Configurar SES

Primero, verifiqué `andreirepo.com` en SES añadiendo los registros DNS necesarios (un registro TXT para la verificación del dominio y un registro MX apuntando a `inbound-smtp.eu-west-1.amazonaws.com`).

Luego creé un conjunto de reglas de recepción con una sola regla:

- **Destinatarios**: `contact@andreirepo.com`
- **Acciones**: Acción S3 → almacenar en un bucket dedicado (p. ej. `andreirepo-email-inbox`)

Eso es todo para la parte de recepción. SES guarda el correo en bruto como un objeto en S3 cada vez que llega un mensaje.

## La Función Lambda

La Lambda se activa con un evento `ObjectCreated` de S3. Lee el correo en bruto desde S3, reescribe las cabeceras para que Gmail lo acepte y lo envía a través de SES.

Las partes clave:

```python
import boto3
import email
from email import policy

s3 = boto3.client('s3')
ses = boto3.client('ses', region_name='eu-west-1')

def handler(event, context):
    bucket = event['Records'][0]['s3']['bucket']['name']
    key = event['Records'][0]['s3']['object']['key']

    obj = s3.get_object(Bucket=bucket, Key=key)
    raw = obj['Body'].read()

    msg = email.message_from_bytes(raw, policy=policy.default)

    # Reescribir cabeceras para el reenvío
    original_from = msg.get('From', '')
    msg.replace_header('From', 'contact@andreirepo.com')
    msg['Reply-To'] = original_from
    msg.replace_header('To', 'your-real@gmail.com')

    ses.send_raw_email(
        Source='contact@andreirepo.com',
        Destinations=['your-real@gmail.com'],
        RawMessage={'Data': msg.as_bytes()}
    )
```

La Lambda necesita un rol IAM con `s3:GetObject` en el bucket de entrada y permiso `ses:SendRawEmail`.

## La Parte Difícil: HTML e Imágenes

Aquí es donde pasé más tiempo. La primera versión reenviaba los correos como texto plano — HTML en bruto apareciendo en Gmail, sin imágenes, con el diseño roto.

La causa raíz fueron dos cosas:

**1. No usar `policy.default`**

El módulo `email` de Python tiene múltiples políticas de análisis. Sin `policy.default`, los mensajes multiparte no se analizan correctamente y la parte HTML queda dañada. Cambiar a `policy.default` solucionó la estructura.

**2. Imágenes incrustadas (referencias CID)**

Los correos con imágenes embebidas usan referencias `Content-ID` (`cid:image001.jpg`). Al reenviar un mensaje en bruto, esas referencias CID se mantienen pero Gmail no puede resolverlas desde la copia reenviada. No hay una solución limpia para esto — las imágenes deben estar alojadas externamente o el cliente de correo necesita los adjuntos originales. Para la mayoría de correos transaccionales y de contacto no es un problema, pero los boletines con imágenes embebidas seguirán viéndose mal.

Para correos HTML con imágenes externas (el estándar `<img src="https://...">`) todo funciona bien una vez que usas `policy.default`.

## Permisos IAM

El rol de ejecución de Lambda necesita:

```json
{
  "Effect": "Allow",
  "Action": ["s3:GetObject"],
  "Resource": "arn:aws:s3:::andreirepo-email-inbox/*"
},
{
  "Effect": "Allow",
  "Action": ["ses:SendRawEmail"],
  "Resource": "*"
}
```

SES también necesita permiso para escribir en el bucket S3. Añade esto a la política del bucket:

```json
{
  "Effect": "Allow",
  "Principal": { "Service": "ses.amazonaws.com" },
  "Action": "s3:PutObject",
  "Resource": "arn:aws:s3:::andreirepo-email-inbox/*",
  "Condition": {
    "StringEquals": { "aws:Referer": "YOUR_ACCOUNT_ID" }
  }
}
```

## Resultado

Lleva funcionando aproximadamente un mes sin ningún problema. Los correos llegan a Gmail en pocos segundos, el HTML se renderiza correctamente y mi dirección real permanece privada. El coste total en AWS es prácticamente cero — el nivel gratuito de SES cubre 1.000 mensajes entrantes al mes, el nivel gratuito de Lambda es más que suficiente, y S3 cuesta fracciones de céntimo.

La única limitación es el problema de las imágenes CID mencionado anteriormente, pero para un formulario de contacto de portfolio no es una preocupación.
