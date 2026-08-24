import { AdminDatabase } from "../config/database/connectdatabase";
export const saveDebugKioskImage = async (
  imageBuffer: Buffer,
  matricNumber?: string,
): Promise<string | null> => {
  try {
    const bucketName = (
      process.env.SUPABASE_PROFILE_IMAGE_BUCKET || "profile-images"
    )
      .trim()
      .replace(/[;]+$/, "");

    // Overwrite the same debug file or create a timestamped entry
    const fileName = `debug_scans/${matricNumber || "unknown"}_${Date.now()}.jpg`;

    const { error: uploadError } = await AdminDatabase.storage
      .from(bucketName)
      .upload(fileName, imageBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("DEBUG UPLOAD ERROR:", uploadError.message);
      return null;
    }

    // Generate a signed URL valid for 1 hour
    const { data: signedData, error: signError } = await AdminDatabase.storage
      .from(bucketName)
      .createSignedUrl(fileName, 3600);

    if (signError || !signedData?.signedUrl) {
      console.error("DEBUG SIGN ERROR:", signError?.message);
      return null;
    }

    return signedData.signedUrl;
  } catch (err: any) {
    console.error("Failed to save debug kiosk image:", err.message);
    return null;
  }
};
