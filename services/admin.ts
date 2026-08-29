import { AdminDatabase, Database } from "../config/database/connectdatabase";
import { resolveProfileImageUrl } from "./userService";

export const AdminService = {
  getAdminDashboardStats: async (): Promise<any> => {
    const { data: stats, error } = await AdminDatabase.rpc(
      "get_admin_dashboard_stats",
    );

    if (error) {
      console.error("[SUPABASE ERROR]:", error.message);
      throw new Error(error.message);
    }

    return stats || {};
  },

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

    const formattedStudents = await Promise.all(
      (students || []).map(async (student) => ({
        id: student.id,
        matric_number: student.matric_number,
        full_name: student.full_name,
        department: student.department,
        level: student.level,
        profile_image: await resolveProfileImageUrl(
          student.profile_image || "",
        ),
        enrolled: student.biometrics && student.biometrics.length > 0,
      })),
    );

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

    formattedCourses.forEach((c) => delete c.student_courses);

    return formattedCourses || [];
  },

  updateCourseSettings: async (
    courseId: string,
    lecturerId: string,
    schedules: any[],
  ) => {
    try {
      await AdminDatabase.from("course_assignments")
        .delete()
        .eq("course_id", courseId);

      if (lecturerId && lecturerId !== "unassigned") {
        const { error: assignError } = await AdminDatabase.from(
          "course_assignments",
        ).insert({ course_id: courseId, lecturer_id: lecturerId });

        if (assignError) {
          console.error("[ASSIGNMENT DB ERROR]:", assignError.message);
          throw new Error("Database failed to assign lecturer.");
        }
      }

      await AdminDatabase.from("timetables").delete().eq("course_id", courseId);
      if (schedules && schedules.length > 0) {
        const slotsToInsert = schedules.map((slot) => ({
          course_id: courseId,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
          venue: slot.venue,
        }));

        const { error: timeError } =
          await AdminDatabase.from("timetables").insert(slotsToInsert);

        if (timeError) {
          console.error("[TIMETABLE DB ERROR]:", timeError.message);
          throw new Error("Database failed to save timetable slots.");
        }
      }

      return true;
    } catch (error: any) {
      console.error("[UPDATE COURSE FATAL ERROR]:", error.message);
      throw error;
    }
  },

  getAttendanceOverview: async () => {
    const { data, error } = await Database.rpc("get_admin_attendance_overview");
    if (error) throw error;
    return data;
  },

  // adminService.ts
  getAttendanceRecords: async (courseId?: string) => {
    let query = Database.from("class_sessions")
      .select(
        `
        id,
        course_id,
        session_date,
        status,
        ended_at,
        courses (course_code, title)
      `,
      )
      .order("session_date", { ascending: false });

    if (courseId) {
      query = query.eq("course_id", courseId);
    }

    const { data: sessions, error: sessionsError } = await query;
    if (sessionsError) throw sessionsError;
    if (!sessions || sessions.length === 0) return [];

    // 2. Extract course IDs for timetable lookup
    const courseIds = [...new Set(sessions.map((s) => s.course_id))];

    // 3. Fetch timetables for those courses
    const { data: timetables, error: timetablesError } = await Database.from(
      "timetables",
    )
      .select("course_id, start_time, end_time, venue")
      .in("course_id", courseIds);

    if (timetablesError) throw timetablesError;

    // 4. Map timetable by course_id (first entry per course)
    const timetableMap: Record<
      string,
      { start_time: string; end_time: string; venue: string }
    > = {};
    (timetables || []).forEach((t) => {
      if (!timetableMap[t.course_id]) {
        timetableMap[t.course_id] = {
          start_time: t.start_time,
          end_time: t.end_time,
          venue: t.venue,
        };
      }
    });

    // 5. For each session, count present students
    const records = await Promise.all(
      sessions.map(async (session: any) => {
        const { count: presentCount, error: countError } = await Database.from(
          "attendance_logs",
        )
          .select("*", { count: "exact", head: true })
          .eq("session_id", session.id)
          .eq("status", "present");

        if (countError) throw countError;

        const course = session.courses?.[0] || {};
        const timetable = timetableMap[session.course_id] || {};

        return {
          id: session.id,
          course_code: course.course_code || "Unknown",
          date: session.session_date,
          start_time: timetable.start_time || "--:--",
          end_time: timetable.end_time || "--:--",
          venue: timetable.venue || "Main Auditorium",
          present_count: presentCount || 0,
          is_active: session.status === "active",
        };
      }),
    );

    return records;
  },
};
