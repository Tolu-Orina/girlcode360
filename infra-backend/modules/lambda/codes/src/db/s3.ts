import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

let client: S3Client | undefined;

export function isDataBucketEnabled(): boolean {
  const bucket = (process.env.DATA_BUCKET ?? "").trim();
  return bucket.length > 0 && bucket.toLowerCase() !== "disabled";
}

export function dataBucket(): string {
  return (process.env.DATA_BUCKET ?? "").trim();
}

function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      region:
        process.env.AWS_REGION ||
        process.env.AWS_DEFAULT_REGION ||
        "eu-west-2",
    });
  }
  return client;
}

function requireBucket(): string {
  if (!isDataBucketEnabled()) throw new Error("DATA_BUCKET_DISABLED");
  return dataBucket();
}

export async function putObject(
  key: string,
  body: Buffer | string,
  contentType = "application/octet-stream",
): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: requireBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getObject(key: string): Promise<Buffer | undefined> {
  if (!isDataBucketEnabled()) return undefined;
  try {
    const res = await s3().send(
      new GetObjectCommand({ Bucket: dataBucket(), Key: key }),
    );
    if (!res.Body) return undefined;
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === "NoSuchKey" || name === "NotFound") return undefined;
    throw err;
  }
}

export async function deleteObject(key: string): Promise<void> {
  if (!isDataBucketEnabled()) return;
  await s3().send(
    new DeleteObjectCommand({ Bucket: dataBucket(), Key: key }),
  );
}

export function walletObjectKey(userSub: string, docId: string): string {
  return `wallet/${userSub}/${docId}`;
}
