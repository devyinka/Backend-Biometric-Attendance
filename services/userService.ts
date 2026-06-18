import { Database } from "../config/database/connectdatabase";

export const UserService = {
  updateProfilePhoto: async (userId: string, photoUrl: string) => {
    const { data, error } = await Database.from("user_profiles")
      .update({ profile_image: photoUrl })
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },
};
