import {
  Database,
  DatabasewithHardware,
} from "../config/database/connectdatabase";

export const AdminService = {
  getAllStudents: async (): Promise<any> => {
    const { data: students, error } = await DatabasewithHardware.from(
      "user_profiles",
    )
      .select(
        `
        id,
        full_name,
        matric_number,
        department,
        level,
        profile_image,
        biometrics(id)
      `,
      )
      .eq("role", "student");

    if (error) {
      console.error("[SUPABASE ERROR]:", error.message);
      console.error("[ERROR DETAILS]:", error.details);
      throw new Error(error.message);
    }

    const formattedStudents = (students || []).map((student) => ({
      id: student.id,
      matric_number: student.matric_number,
      full_name: student.full_name,
      department: student.department,
      level: student.level,
      profile_image: student.profile_image,
      enrolled: student.biometrics && student.biometrics.length > 0,
    }));

    return formattedStudents;
  },
};
