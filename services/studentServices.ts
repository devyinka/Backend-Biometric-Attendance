import { Database } from "../config/database/connectdatabase";

export const StudentService = {
  getAvailableCourses: async (studentId: string): Promise<any> => {
    const { data: student, error: studentError } = await Database.from(
      "user_profiles",
    )
      .select("level")
      .eq("id", studentId)
      .single();

    if (studentError || !student) {
      throw new Error("Could not fetch student profile to determine level.");
    }

    const currentLevel = student.level;

    // Fetch courses at or below the student's current level, sorted by level and course code
    const { data: courses, error: courseError } = await Database.from("courses")
      .select("*")
      .lte("level", currentLevel)
      .order("level", { ascending: false })
      .order("course_code", { ascending: true });

    if (courseError) {
      throw courseError;
    }

    // Return both so the Next.js frontend knows how to organize the UI
    return {
      studentLevel: currentLevel,
      courses: courses,
    };
  },

  registerCourses: async (
    studentId: string,
    courseIds: string[],
  ): Promise<any> => {
    const registrations = courseIds.map((courseId) => ({
      student_id: studentId,
      course_id: courseId,
    }));

    const { data, error } = await Database.from("student_courses")
      .upsert(registrations, { onConflict: "student_id, course_id" })
      .select();

    if (error) {
      throw error;
    }

    return data;
  },
};
