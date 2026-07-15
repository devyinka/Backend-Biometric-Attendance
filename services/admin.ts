import { Database } from "../config/database/connectdatabase";

export const AdminService = {
  getAllStudents: async (): Promise<any> => {
    const { data: students, error } = await Database.from("user_profiles")
      .select(
        `
        id,
        full_name,
        matric_number,
        department,
        level,
        profile_Imagee,
        biometrics(id)
      `,
      )
      .eq("role", "student");

    if (error) {
      throw error;
    }

    return students;
  },
};
