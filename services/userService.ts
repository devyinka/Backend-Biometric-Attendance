import { Database, AdminDatabase } from "../config/database/connectdatabase";
import { randomUUID } from "crypto";

export const UserService = {
  updateProfilePhoto: async (userId: string, photoUrl: string) => {
    const { data, error } = await Database.from("user_profiles")
      .update({ profile_image: photoUrl })
      .eq("id", userId)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },

  uploadProfilePhoto: async (
    userId: string,
    file: Express.Multer.File,
  ): Promise<any> => {
    const bucketName = (
      process.env.SUPABASE_PROFILE_IMAGE_BUCKET || "profile-images"
    )
      .trim()
      .replace(/[;]+$/, "");

    if (!bucketName) {
      throw new Error("Supabase profile image bucket name is not configured");
    }

    const fileExtension =
      file.mimetype.split("/")[1]?.replace("jpeg", "jpg") || "png";
    const filePath = `profile-images/${userId}/${randomUUID()}.${fileExtension}`;

    const { error: uploadError } = await AdminDatabase.storage
      .from(bucketName)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: publicUrlData } = AdminDatabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData?.publicUrl;

    if (!publicUrl) {
      throw new Error("Failed to generate public image URL");
    }

    return UserService.updateProfilePhoto(userId, publicUrl);
  },
};
