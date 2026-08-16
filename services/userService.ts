import { AdminDatabase } from "../config/database/connectdatabase";
import { randomUUID } from "crypto";

const PROFILE_IMAGE_BUCKET = (
  process.env.SUPABASE_PROFILE_IMAGE_BUCKET || "profile-images"
)
  .trim()
  .replace(/[;]+$/, "");

const PROFILE_IMAGE_SIGNATURE_TTL = 60 * 60 * 24 * 7;

const getStoredImagePath = (profileImage: string): string | null => {
  if (!profileImage) {
    return null;
  }

  if (!profileImage.startsWith("http")) {
    return profileImage;
  }

  try {
    const url = new URL(profileImage);
    const marker = `/storage/v1/object/public/${PROFILE_IMAGE_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);

    if (markerIndex !== -1) {
      return decodeURIComponent(
        url.pathname.slice(markerIndex + marker.length),
      );
    }

    const bucketMarker = `/${PROFILE_IMAGE_BUCKET}/`;
    const bucketIndex = url.pathname.indexOf(bucketMarker);

    if (bucketIndex !== -1) {
      return decodeURIComponent(
        url.pathname.slice(bucketIndex + bucketMarker.length),
      );
    }
  } catch {
    return null;
  }

  return null;
};

export const resolveProfileImageUrl = async (
  profileImage: string,
): Promise<string> => {
  if (!profileImage) {
    return "";
  }

  const storedPath = getStoredImagePath(profileImage);
  if (!storedPath) {
    return profileImage;
  }

  const { data, error } = await AdminDatabase.storage
    .from(PROFILE_IMAGE_BUCKET)
    .createSignedUrl(storedPath, PROFILE_IMAGE_SIGNATURE_TTL);

  if (error || !data?.signedUrl) {
    return profileImage;
  }

  return data.signedUrl;
};

export const UserService = {
  updateProfilePhoto: async (userId: string, photoUrl: string) => {
    const { data, error } = await AdminDatabase.from("user_profiles")
      .update({ profile_image: photoUrl })
      .eq("id", userId)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Profile record not found for the authenticated user");
    }

    return {
      ...data,
      profile_image: await resolveProfileImageUrl(
        data.profile_image || photoUrl,
      ),
    };
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
    const filePath = `${userId}/${randomUUID()}.${fileExtension}`;

    const { error: uploadError } = await AdminDatabase.storage
      .from(bucketName)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    return UserService.updateProfilePhoto(userId, filePath);
  },
};
