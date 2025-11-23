import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

import dotenv from "dotenv";
dotenv.config();



const s3enabled = !!process.env.S3_BUCKET;

const client = s3enabled ? new S3Client({
    region: process.env.S3_REGION,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY
    }
}) : null;

// Upload local file → S3
export async function uploadToS3(localPath, keyPrefix = "") {
    if (!s3enabled) return { url: localPath, s3: false };

    const body = fs.createReadStream(localPath);
    const filename = path.basename(localPath);
    const key = `${keyPrefix}${Date.now()}-${filename}`;

    await client.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: body
    }));

    return {
        url: `s3://${process.env.S3_BUCKET}/${key}`,
        key,
        s3: true
    };
}



export async function downloadFromS3(s3Url, destDir = "./temp") {
    const bucket = process.env.S3_BUCKET;

    let key;

    if (s3Url.startsWith("s3://")) {
        // s3://bucket/key → key
        key = s3Url.replace(`s3://${bucket}/`, "");
    } else if (s3Url.includes(".amazonaws.com/")) {
        // https://bucket.s3.amazonaws.com/key → key
        key = s3Url.split(".amazonaws.com/")[1];
    } else {
        throw new Error("Invalid S3 URL format: " + s3Url);
    }

    const localPath = path.join(destDir, path.basename(key));
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const data = await client.send(command);

    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(localPath);
        data.Body.pipe(writer);
        data.Body.on("error", reject);
        writer.on("finish", () => resolve(localPath));
    });
}



// Parse s3://bucket/key to get only key
export function parseS3Url(url) {
    if (!url.startsWith("s3://")) return null;
    return url.replace(`s3://${process.env.S3_BUCKET}/`, "");
}
