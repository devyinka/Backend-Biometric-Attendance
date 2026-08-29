import { Database } from "../config/database/connectdatabase";

export const StudentService = {
  getAvailableCourses: async (level: number): Promise<any> => {
    const { data: courses, error: courseError } = await Database.from("courses")
      .select("id, course_code, title, level, credits")
      .lte("level", level)
      .order("level", { ascending: false })
      .order("course_code", { ascending: true });

    if (courseError) {
      throw new Error(courseError.message);
    }
    return {
      courses: courses.map((course) => ({
        id: course.id,
        code: course.course_code,
        title: course.title,
        credits: course.credits,
      })),
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

  getAttendanceRecordsOfRegisteredCourses: async (
    studentId: string,
  ): Promise<any> => {
    const { data, error } = await Database.rpc(
      "get_student_attendance_history",
      {
        p_student_id: studentId,
      },
    );
    if (error) {
      throw error;
    }
    return data;
  },

  getActiveCourses: async (studentId: string): Promise<any> => {
    // 1. Get all course IDs the student is registered in
    const { data: studentCourses, error: coursesError } = await Database.from(
      "student_courses",
    )
      .select("course_id")
      .eq("student_id", studentId);

    if (coursesError) throw coursesError;
    if (!studentCourses || studentCourses.length === 0) {
      return []; // no registered courses
    }

    const courseIds = studentCourses.map((sc) => sc.course_id);

    // 2. Find any active sessions for those courses
    const { data: activeSessions, error: sessionError } = await Database.from(
      "class_sessions",
    )
      .select(
        `
      id,
      course_id,
      courses (course_code, title)
    `,
      )
      .eq("status", "active")
      .in("course_id", courseIds);

    if (sessionError) throw sessionError;

    return activeSessions || [];
  },
};
