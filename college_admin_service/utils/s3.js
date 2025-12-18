import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();



const s3enabled = !!process.env.S3_BUCKET;

const client = s3enabled
    ? new S3Client({
        region: process.env.S3_REGION,
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY,
            secretAccessKey: process.env.S3_SECRET_KEY
        }
    })
    : null;


function extractBucketAndKey(s3Url) {
    // s3://bucket/key
    if (s3Url.startsWith("s3://")) {
        const [, , bucket, ...rest] = s3Url.split("/");
        return { bucket, key: rest.join("/") };
    }

    // https://bucket.s3.region.amazonaws.com/key
    if (s3Url.includes(".amazonaws.com/")) {
        const url = new URL(s3Url);
        const bucket = url.hostname.split(".")[0];
        const key = url.pathname.slice(1);
        return { bucket, key };
    }

    throw new Error(`Invalid S3 URL: ${s3Url}`);
}

/* -------------------------------------------------
   UPLOAD → S3 (returns downloadable URL)
------------------------------------------------- */

export async function uploadToS3(localPath, keyPrefix = "") {
    if (!s3enabled) {
        return { url: localPath, s3: false };
    }

    if (!fs.existsSync(localPath)) {
        throw new Error(`File not found: ${localPath}`);
    }

    const filename = path.basename(localPath);
    const key = `${keyPrefix}${Date.now()}-${filename}`;

    try {
        await client.send(
            new PutObjectCommand({
                Bucket: process.env.S3_BUCKET,
                Key: key,
                Body: fs.createReadStream(localPath),
                ContentType: "application/octet-stream"
            })
        );

        // Signed download URL (10 minutes)
        const signedUrl = await getSignedUrl(
            client,
            new GetObjectCommand({
                Bucket: process.env.S3_BUCKET,
                Key: key,
                ResponseContentDisposition: `attachment; filename="${filename}"`
            }),
            { expiresIn: 60 * 10 }
        );

        return {
            url: signedUrl,
            s3Url: `s3://${process.env.S3_BUCKET}/${key}`,
            bucket: process.env.S3_BUCKET,
            key,
            s3: true
        };
    } catch (err) {
        throw new Error(`S3 upload failed: ${err.message}`);
    }
}

/* -------------------------------------------------
   DOWNLOAD FROM S3 → LOCAL FILE
------------------------------------------------- */

export async function downloadFromS3(s3Url, destDir = "./temp") {
    if (!s3enabled) {
        throw new Error("S3 is not enabled");
    }

    const { bucket, key } = extractBucketAndKey(s3Url);

    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    const localPath = path.join(destDir, path.basename(key));

    try {
        const data = await client.send(
            new GetObjectCommand({ Bucket: bucket, Key: key })
        );

        return new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(localPath);
            data.Body.pipe(writer);
            data.Body.on("error", reject);
            writer.on("finish", () => resolve(localPath));
        });
    } catch (err) {
        throw new Error(`S3 download failed: ${err.message}`);
    }
}

/* -------------------------------------------------
   GENERATE SIGNED DOWNLOAD URL (ON DEMAND)
------------------------------------------------- */

export async function getDownloadUrl(s3Url, expiresInSeconds = 600) {
    if (!s3enabled) return null;

    const { bucket, key } = extractBucketAndKey(s3Url);
    const filename = path.basename(key);

    return getSignedUrl(
        client,
        new GetObjectCommand({
            Bucket: bucket,
            Key: key,
            ResponseContentDisposition: `attachment; filename="${filename}"`
        }),
        { expiresIn: expiresInSeconds }
    );
}

/* -------------------------------------------------
   PARSE KEY ONLY (UTILITY)
------------------------------------------------- */

export function parseS3Key(s3Url) {
    try {
        return extractBucketAndKey(s3Url).key;
    } catch {
        return null;
    }
}
