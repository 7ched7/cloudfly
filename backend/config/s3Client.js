const { S3Client } = require("@aws-sdk/client-s3");

const createS3Client = (region, endpoint) => {
    return new S3Client({
        region,
        endpoint,
        credentials: {
            accessKeyId: process.env.MINIO_ACCESS_KEY,
            secretAccessKey: process.env.MINIO_SECRET_KEY,
        },
        forcePathStyle: true,
    });
};

const s3InternalClient = createS3Client("us-east-1", process.env.MINIO_INTERNAL_ENDPOINT);
const s3PublicClient = createS3Client("us-east-1", process.env.MINIO_PUBLIC_ENDPOINT);

module.exports = { s3InternalClient, s3PublicClient };
