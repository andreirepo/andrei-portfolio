---
title: "Email Forwarding to Gmail with AWS SES, S3, and Lambda"
description: "How I set up a serverless email forwarding pipeline on AWS to keep my real Gmail address private while still receiving mail at contact@andreirepo.com."
pubDate: 2025-03-15
tags: ["aws", "lambda", "ses", "s3", "serverless"]
draft: false
---

I wanted a contact email on my portfolio without publishing my real Gmail address. Paying for Google Workspace just to receive the occasional message felt like overkill, so I built a serverless forwarding pipeline on AWS using SES, S3, and Lambda.

The idea is simple: SES receives mail at `contact@andreirepo.com`, stores the raw message in S3, and a Lambda function picks it up, rewrites the headers, and forwards it to my real Gmail inbox.

## The Architecture

```
Sender → SES (receive rule) → S3 bucket → Lambda → SES (send) → Gmail
```

All set up through the AWS console — no Terraform, no CDK.

## Setting Up SES

First, I verified `andreirepo.com` in SES by adding the required DNS records (a TXT record for domain verification and an MX record pointing to `inbound-smtp.eu-west-1.amazonaws.com`).

Then I created a receipt rule set with one rule:

- **Recipients**: `contact@andreirepo.com`
- **Actions**: S3 action → store to a dedicated bucket (e.g. `andreirepo-email-inbox`)

That's it for the receiving side. SES drops the raw email as an object in S3 every time a message arrives.

## The Lambda Function

The Lambda is triggered by an S3 `ObjectCreated` event. It reads the raw email from S3, rewrites the headers so Gmail accepts it, and sends it via SES.

The key parts:

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

    # Rewrite headers for forwarding
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

The Lambda needs an IAM role with `s3:GetObject` on the inbox bucket and `ses:SendRawEmail` permission.

## The Hard Part: HTML and Images

This is where I spent most of my time. The first version was forwarding emails as plain text — raw HTML showing up in Gmail, no images, broken layout.

The root cause was two things:

**1. Not using `policy.default`**

Python's `email` module has multiple parsing policies. Without `policy.default`, multipart messages don't parse correctly and the HTML part gets mangled. Switching to `policy.default` fixed the structure.

**2. Inline images (CID references)**

Emails with embedded images use `Content-ID` references (`cid:image001.jpg`). When you forward a raw message, those CID references stay intact but Gmail can't resolve them from the forwarded copy. There's no clean fix for this — the images need to be either hosted externally or the email client needs the original attachments. For most transactional and contact emails this isn't an issue, but newsletters with embedded images will still look broken.

For HTML emails with external images (standard `<img src="https://...">`) everything works fine once you use `policy.default`.

## IAM Permissions

The Lambda execution role needs:

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

SES also needs permission to write to the S3 bucket. Add this to the bucket policy:

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

## Result

It's been running for about a month with zero issues. Emails arrive in Gmail within a few seconds, HTML renders correctly, and my real address stays private. Total AWS cost is effectively zero — SES free tier covers 1,000 inbound messages per month, Lambda free tier is more than enough, and S3 costs fractions of a cent.

The only limitation is the CID image issue mentioned above, but for a portfolio contact form that's not a concern.
