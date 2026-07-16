import { AdminDatabase } from "../config/database/connectdatabase";

export const AdminService = {
  getAllStudents: async (): Promise<any> => {
    const { data: students, error } = await AdminDatabase.from("user_profiles")
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

  createCourse: async (courseData: {
    course_code: string;
    title: string;
    level: number;
    credits: number;
  }) => {
    const { data, error } = await AdminDatabase.from("courses")
      .insert([
        {
          course_code: courseData.course_code,
          title: courseData.title,
          level: courseData.level,
          credits: courseData.credits,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error(" [SUPABASE ERROR]:", error.message);
      throw new Error(error.message);
    }

    return data;
  },

  getAllLecturers: async (): Promise<any> => {
    const { data: lecturers, error } = await AdminDatabase.from("user_profiles")
      .select("id, full_name")
      .eq("role", "lecturer");

    if (error) {
      console.error("[SUPABASE ERROR]:", error.message);
      console.error("[ERROR DETAILS]:", error.details);
      throw new Error(error.message);
    }

    return lecturers || [];
  },
  assignLecturerToCourse: async (courseId: string, lecturerId: string) => {
    const { data, error } = await AdminDatabase.from("course_assignments")
      .insert([
        {
          course_id: courseId,
          lecturer_id: lecturerId,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("[SUPABASE ERROR]:", error.message);
      throw new Error(error.message);
    }

    return data;
  },

  getAllCourses: async (): Promise<any> => {
    // We select from courses and perform a "count" on the linked student_courses
    const { data: courses, error } = await AdminDatabase.from("courses")
      .select(
        `
        *,
        student_courses(count)
      `,
      )
      .order("level", { ascending: true })
      .order("course_code", { ascending: true });

    if (error) {
      console.error("[SUPABASE GET COURSES ERROR]:", error.message);
      throw new Error("Failed to fetch courses from database.");
    }
    const formattedCourses = courses.map((course: any) => ({
      ...course,
      enrollment_count: course.student_courses?.[0]?.count || 0,
    }));

    // Clean up the raw join data for frontend to receives a clean object
    formattedCourses.forEach((c) => delete c.student_courses);

    return formattedCourses || [];
  },
};
