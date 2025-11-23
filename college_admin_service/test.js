import { downloadFromS3 } from "./utils/s3.js";

await downloadFromS3("s3://school-college-management/uploads/1763908696244-1763908696235-rakwrzof.xlsx", "./temp");
console.log("done");
